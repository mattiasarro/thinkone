"""Official ``anthropic`` SDK adapter. Structured output via ``output_config.format`` (JSON schema)."""

from __future__ import annotations

import json
from typing import Any

import anthropic
import structlog

from app.agent.providers.base import StructuredResult

log = structlog.get_logger()


class AnthropicChatModel:
    def __init__(self, api_key: str, model: str = "claude-opus-5") -> None:
        self.client = anthropic.AsyncAnthropic(api_key=api_key, max_retries=3, timeout=600.0)
        self.model = model

    async def structured(self, *, system: str, user: str, schema: dict[str, Any], max_tokens: int = 32000) -> StructuredResult:
        # Streaming keeps long structuring runs clear of HTTP timeouts; the stable system prompt is cached.
        async with self.client.messages.stream(
            model=self.model,
            max_tokens=max_tokens,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": user}],
            thinking={"type": "adaptive"},
            output_config={"effort": "high", "format": {"type": "json_schema", "schema": schema}},
        ) as stream:
            msg = await stream.get_final_message()
        if msg.stop_reason == "refusal":
            raise RuntimeError(f"Model refused structuring: {getattr(msg.stop_details, 'explanation', '')}")
        if msg.stop_reason == "max_tokens":
            raise RuntimeError("Structuring output exceeded max_tokens")
        text = next(b.text for b in msg.content if b.type == "text")
        usage = {
            "input_tokens": msg.usage.input_tokens,
            "output_tokens": msg.usage.output_tokens,
            "cache_read_input_tokens": getattr(msg.usage, "cache_read_input_tokens", 0) or 0,
            "cache_creation_input_tokens": getattr(msg.usage, "cache_creation_input_tokens", 0) or 0,
        }
        log.info("llm_structured", model=msg.model, request_id=msg._request_id, **usage)
        return StructuredResult(data=json.loads(text), model=msg.model, usage=usage, raw_text=text)
