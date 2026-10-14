"""The hand-rolled tool loop (architecture §6): provider-agnostic events in, persisted message + cards + citations out.

Human-in-the-loop by construction: no tool here sends, signs or changes client-visible state; draft tools return
confirmation cards that the operator confirms through the REST endpoint in ``api/operator/agent.py``.
"""

from __future__ import annotations

import json
import re
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

import structlog
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.prompts import agent_system
from app.agent.providers.base import StreamEvent, chat_model
from app.agent.tools import TOOL_BY_NAME, TOOLS, ToolResult
from app.domain import agent as agent_domain
from app.domain.errors import DomainError
from app.domain.events import Actor
from app.models.agent import AgentThread

log = structlog.get_logger()
MAX_ITERATIONS = 6
MAX_TOOL_CALLS = 10
CITE_RE = re.compile(r"\[§([^\]|]+)\|([0-9a-fA-F-]{8,36})\]")
DRAFT_RE = re.compile(r"SÕNASTUS:\s*(.+)$", re.S)

Emit = Callable[[dict[str, Any]], Awaitable[None]]


async def _context_prefix(session: AsyncSession, actor: Actor, thread: AgentThread) -> tuple[str | None, dict[str, dict[str, Any]], list[dict[str, Any]]]:
    """A contract thread loads the contract once as the cached prefix (architecture §6: the contract is the cached prefix)."""
    if thread.context_type == "contract" and thread.context_id:
        from app.agent.tools import LoadIn, load_contract

        r = await load_contract(session, actor, LoadIn(contract=str(thread.context_id)))
        if r.clauses:
            return f"KONTEKST — avatud leping:\n{r.content}", r.clauses, [{"tool": "load_contract", "summary": r.summary, "ok": True, "auto": True}]
    if thread.context_type == "quote" and thread.context_id:
        from app.agent.tools import QuoteIn, get_quote

        r = await get_quote(session, actor, QuoteIn(quote=str(thread.context_id)))
        return f"KONTEKST — avatud pakkumine:\n{r.content}", {}, [{"tool": "get_quote", "summary": r.summary, "ok": True, "auto": True}]
    return None, {}, []


def _history(messages: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for m in messages[-12:]:
        if m.role in ("user", "assistant") and m.text:
            out.append({"role": m.role, "content": m.text})
    return out


def validate_citations(text: str, vocab: dict[str, dict[str, Any]]) -> tuple[str, list[dict[str, Any]], int]:
    """Every [§X|id] must resolve to a clause the turn loaded; others are stripped (a hallucinated § never reaches the operator)."""
    found: list[dict[str, Any]] = []
    dropped = 0

    def repl(m: re.Match[str]) -> str:
        nonlocal dropped
        number, cid = m.group(1).strip(), m.group(2)
        hit = next((v for k, v in vocab.items() if k.startswith(cid) or cid.startswith(k[: len(cid)])), None) if len(cid) < 36 else vocab.get(cid)
        if not hit:
            dropped += 1
            return f"§{number}"
        if not any(c["clause_id"] == hit.get("id", cid) for c in found):
            found.append({"clause_id": next(k for k, v in vocab.items() if v is hit), "number": hit["number"], "contract_id": hit["contract_id"]})
        return f"[§{hit['number']}|{found[-1]['clause_id'] if found and found[-1]['number'] == hit['number'] else cid}]"

    return CITE_RE.sub(repl, text), found, dropped


async def run_turn(session: AsyncSession, actor: Actor, thread: AgentThread, user_text: str, emit: Emit | None = None) -> Any:
    """One operator message → tools → answer. Persists both messages; streams events through ``emit`` when given."""
    async def send(ev: dict[str, Any]) -> None:
        if emit:
            await emit(ev)

    usage_info = await agent_domain.month_usage(session, actor.account_id)
    await agent_domain.add_message(session, actor, thread, role="user", text=user_text)
    if usage_info["exhausted"]:
        text = "Selle kuu AI-eelarve on täis — assistent jätkab järgmisel kuul või kui admin eelarvet tõstab."
        m = await agent_domain.add_message(session, actor, thread, role="assistant", text=text, status="budget", prompt_version=agent_system.PROMPT_VERSION)
        await send({"type": "delta", "text": text})
        await send({"type": "done", "message_id": str(m.id), "status": "budget"})
        return m

    model = chat_model()
    history = _history(await agent_domain.messages_of(session, thread.id))
    prefix, vocab, steps = await _context_prefix(session, actor, thread)
    for st in steps:
        await send({"type": "step", **st})
    messages: list[dict[str, Any]] = history  # the user message was just persisted → it is the last history item
    tool_defs = [t.definition() for t in TOOLS]
    cards: list[dict[str, Any]] = []
    answer_parts: list[str] = []
    total_usage: dict[str, int] = {}
    model_name: str | None = None
    status, error = "done", None
    calls = 0
    clarify = False
    for _ in range(MAX_ITERATIONS):
        text_buf: list[str] = []
        tool_calls: list[StreamEvent] = []
        stop = None
        async for ev in model.stream(system=agent_system.SYSTEM, messages=messages, tools=tool_defs, cache_prefix=prefix):
            if ev.type == "text_delta":
                text_buf.append(ev.text)
                await send({"type": "delta", "text": ev.text})
            elif ev.type == "tool_call":
                tool_calls.append(ev)
            elif ev.type == "error":
                status, error = "failed", ev.text
                break
            elif ev.type == "done":
                stop = ev.stop_reason
                model_name = ev.model or model_name
                for k, v in ev.usage.items():
                    total_usage[k] = total_usage.get(k, 0) + int(v or 0)
        if status == "failed":
            break
        text = "".join(text_buf)
        if text:
            answer_parts.append(text)
        if not tool_calls:
            break
        content: list[dict[str, Any]] = []
        if text:
            content.append({"type": "text", "text": text})
        content += [{"type": "tool_use", "id": tc.id, "name": tc.name, "input": tc.input or {}} for tc in tool_calls]
        messages = messages + [{"role": "assistant", "content": content}]
        results: list[dict[str, Any]] = []
        for tc in tool_calls:
            calls += 1
            r = await _run_tool(session, actor, tc.name or "", tc.input or {})
            vocab.update(r.clauses)
            cards += r.cards
            clarify = clarify or r.clarify
            step = {"tool": tc.name, "args": tc.input, "summary": r.summary or tc.name, "ok": not r.content.startswith("VIGA")}
            steps.append(step)
            await send({"type": "step", **step})
            results.append({"type": "tool_result", "tool_use_id": tc.id, "content": r.content[:60000]})
            if calls >= MAX_TOOL_CALLS:
                results[-1]["content"] += "\n[Tööriistakutsete piir täis — vasta nüüd.]"
        messages = messages + [{"role": "user", "content": results}]
        if stop != "tool_use" and not tool_calls:
            break
    answer = "\n".join(p for p in answer_parts if p).strip()
    answer, citations, dropped = validate_citations(answer, vocab)
    if dropped:
        steps.append({"tool": "citations", "summary": f"{dropped} viidet ei vastanud laetud lepingule — eemaldatud", "ok": False})
    # draft cards take their text from the model's final „SÕNASTUS:” line
    m = DRAFT_RE.search(answer)
    if m:
        for c in cards:
            if c.get("type") == "draft" and not c.get("text"):
                c["text"] = m.group(1).strip()
        answer = answer[: m.start()].rstrip()
    if clarify and not any(c.get("type") == "clarify" for c in cards):
        cards.append({"type": "clarify", "id": f"q-{uuid.uuid4().hex[:6]}", "title": "Täpsusta"})
    if not answer and status == "done":
        answer = "Sellele ei leia andmetest vastust."
    if status == "failed":
        answer = answer or "Vastamine ebaõnnestus — proovi uuesti."
    msg = await agent_domain.add_message(session, actor, thread, role="assistant", text=answer, steps=steps, cards=cards, citations=citations,
                                         prompt_version=agent_system.PROMPT_VERSION, model=model_name, usage=total_usage, status=status, error=error)
    if total_usage:
        await agent_domain.meter(session, actor, purpose="chat", model=model_name, usage=total_usage)
    for c in cards:
        await send({"type": "card", "card": c})
    await send({"type": "done", "message_id": str(msg.id), "status": status, "citations": citations, "text": answer})
    return msg


async def _run_tool(session: AsyncSession, actor: Actor, name: str, args: dict[str, Any]) -> ToolResult:
    tool = TOOL_BY_NAME.get(name)
    if not tool:
        return ToolResult(content=f"VIGA: tundmatu tööriist {name}", summary=f"{name} · tundmatu")
    try:
        parsed = tool.model.model_validate(args)
    except ValidationError as e:
        return ToolResult(content=f"VIGA: vigased argumendid — {e.errors()[0].get('msg')}", summary=f"{name} · vigased argumendid")
    try:
        async with session.begin_nested():  # a failing tool must not poison the request transaction
            return await tool.handler(session, actor, parsed)
    except DomainError as e:
        return ToolResult(content=f"VIGA: {e.message}", summary=f"{name} · {e.message[:60]}")
    except Exception as e:  # noqa: BLE001
        log.exception("tool_failed", tool=name)
        return ToolResult(content=f"VIGA: {str(e)[:200]}", summary=f"{name} · viga")


async def stream_turn(session: AsyncSession, actor: Actor, thread: AgentThread, user_text: str) -> AsyncIterator[str]:
    """SSE frames for the chat UI: step · delta · card · done."""
    import asyncio

    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    async def emit(ev: dict[str, Any]) -> None:
        await queue.put(ev)

    async def runner() -> None:
        try:
            await run_turn(session, actor, thread, user_text, emit)
        except Exception as e:  # noqa: BLE001
            log.exception("agent_turn_failed")
            await queue.put({"type": "done", "status": "failed", "error": str(e)[:300]})
        finally:
            await queue.put(None)

    task = asyncio.create_task(runner())
    try:
        while True:
            ev = await queue.get()
            if ev is None:
                break
            yield f"event: {ev['type']}\ndata: {json.dumps(ev, ensure_ascii=False, default=str)}\n\n"
    finally:
        await task
