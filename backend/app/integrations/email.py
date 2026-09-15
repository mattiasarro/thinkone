"""EmailProvider seam — Postmark (prod) / SMTP / Fake. Bounce webhooks update ``notification``."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.infra.settings import get_settings


@dataclass
class SentEmail:
    message_id: str


class EmailProvider(Protocol):
    async def send(self, *, to: str, subject: str, text: str, html: str | None = None) -> SentEmail: ...


class FakeEmailProvider:
    def __init__(self) -> None:
        self.sent: list[dict] = []

    async def send(self, *, to: str, subject: str, text: str, html: str | None = None) -> SentEmail:
        mid = f"fake-{uuid.uuid4().hex[:12]}"
        self.sent.append({"to": to, "subject": subject, "text": text, "message_id": mid})
        return SentEmail(message_id=mid)


class PostmarkProvider:
    def __init__(self, token: str, sender: str) -> None:
        self.token, self.sender = token, sender

    async def send(self, *, to: str, subject: str, text: str, html: str | None = None) -> SentEmail:
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.post(
                "https://api.postmarkapp.com/email",
                headers={"X-Postmark-Server-Token": self.token, "Accept": "application/json"},
                json={"From": self.sender, "To": to, "Subject": subject, "TextBody": text, "HtmlBody": html or None, "MessageStream": "outbound"},
            )
            r.raise_for_status()
            return SentEmail(message_id=r.json()["MessageID"])


class SmtpProvider:
    def __init__(self, url: str, sender: str) -> None:
        self.url, self.sender = url, sender

    async def send(self, *, to: str, subject: str, text: str, html: str | None = None) -> SentEmail:
        import asyncio
        import smtplib
        from email.message import EmailMessage
        from urllib.parse import urlparse

        u = urlparse(self.url)
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = self.sender, to, subject
        msg.set_content(text)
        if html:
            msg.add_alternative(html, subtype="html")

        def _send() -> None:
            with smtplib.SMTP(u.hostname or "localhost", u.port or 25) as s:
                if u.username:
                    s.starttls()
                    s.login(u.username, u.password or "")
                s.send_message(msg)

        await asyncio.to_thread(_send)
        return SentEmail(message_id=f"smtp-{uuid.uuid4().hex[:12]}")


_provider: EmailProvider | None = None


def email_provider() -> EmailProvider:
    global _provider
    if _provider is None:
        s = get_settings()
        if s.email_provider == "postmark" and s.postmark_token:
            _provider = PostmarkProvider(s.postmark_token, s.email_from)
        elif s.email_provider == "smtp" and s.smtp_url:
            _provider = SmtpProvider(s.smtp_url, s.email_from)
        else:
            _provider = FakeEmailProvider()
    return _provider


def set_email_provider(p: EmailProvider | None) -> None:
    global _provider
    _provider = p
