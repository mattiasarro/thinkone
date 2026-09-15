"""ChatModel seam (architecture §6). Single adapter today: Anthropic. Fake for tests/dev."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass
class StructuredResult:
    data: dict[str, Any]
    model: str
    usage: dict[str, int] = field(default_factory=dict)
    raw_text: str | None = None


class ChatModel(Protocol):
    async def structured(self, *, system: str, user: str, schema: dict[str, Any], max_tokens: int = 32000) -> StructuredResult:
        """Return JSON validated by the API against ``schema`` (JSON schema)."""
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
