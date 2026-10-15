"""ChatModel seam (architecture §6). Single adapter today: Anthropic. Fake for tests/dev.

Two entry points: ``structured`` (one JSON reply validated against a schema — import, template ingestion,
plan matching) and ``stream`` (the agent loop: text deltas and tool calls, provider-agnostic event vocabulary).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class StructuredResult:
    data: dict[str, Any]
    model: str
    usage: dict[str, int] = field(default_factory=dict)
    raw_text: str | None = None


ImageInput = tuple[str, bytes]  # (media type, raw bytes) — shown to the model before the user text


@dataclass
class ToolDef:
    name: str
    description: str
    input_schema: dict[str, Any]


@dataclass
class StreamEvent:
    """``text_delta`` (text), ``tool_call`` (id, name, input), ``done`` (stop_reason, usage, model), ``error`` (text)."""

    type: str
    text: str = ""
    id: str | None = None
    name: str | None = None
    input: dict[str, Any] | None = None
    stop_reason: str | None = None
    usage: dict[str, int] = field(default_factory=dict)
    model: str | None = None


class ChatModel(Protocol):
    async def structured(self, *, system: str, user: str, schema: dict[str, Any], max_tokens: int = 32000,
                         images: list[ImageInput] | None = None, effort: str = "high", model: str | None = None) -> StructuredResult:
        """Return JSON validated by the API against ``schema`` (JSON schema). ``images`` precede the text (vision tasks).
        ``effort`` sets the thinking depth for this call; ``model`` overrides the default model for this call."""
        ...

    def stream(self, *, system: str, messages: list[dict[str, Any]], tools: list[ToolDef], max_tokens: int = 8000,
               cache_prefix: str | None = None) -> AsyncIterator[StreamEvent]:
        """One model turn: yields text deltas and tool calls, then ``done``. ``messages`` use the Anthropic shape
        (role user|assistant; content str or blocks incl. tool_use / tool_result)."""
        ...


_model: ChatModel | None = None


def chat_model() -> ChatModel:
    global _model
    if _model is None:
        from app.infra.settings import get_settings

        s = get_settings()
        if s.llm_mode == "live" and s.anthropic_api_key:
            from app.agent.providers.anthropic_native import AnthropicChatModel

            _model = AnthropicChatModel(api_key=s.anthropic_api_key, model=s.llm_model)
        else:
            from app.agent.providers.fake import FakeChatModel

            _model = FakeChatModel()
    return _model


def set_chat_model(m: ChatModel | None) -> None:
    global _model
    _model = m
