"""DOCX → PDF with headless LibreOffice, so a Word original shows in the review as pages (with a text layer — the viewer
marks values on it) like a signed PDF does. The original stays the source of truth; the PDF is a rendering of it."""

from __future__ import annotations

import asyncio
import shutil
import subprocess
import tempfile
from pathlib import Path

import structlog

log = structlog.get_logger()
_LIMIT = asyncio.Semaphore(2)  # one soffice is ~150 MB; a big drop must not start dozens at once


def converter() -> str | None:
    """The soffice binary, if this machine has LibreOffice (the backend image does; a dev laptop may not)."""
    return shutil.which("soffice") or shutil.which("libreoffice")


def _run(exe: str, data: bytes, timeout: int) -> bytes | None:
    with tempfile.TemporaryDirectory(prefix="t1-docx-") as d:
        src = Path(d) / "doc.docx"
        src.write_bytes(data)
        # own profile per run: parallel conversions do not fight over one user installation lock
        cmd = [exe, "--headless", "--norestore", "--nologo", f"-env:UserInstallation=file://{d}/profile", "--convert-to", "pdf", "--outdir", d, str(src)]
        r = subprocess.run(cmd, capture_output=True, timeout=timeout, check=False)
        out = Path(d) / "doc.pdf"
        if not out.exists():
            log.warning("docx_convert_failed", code=r.returncode, stderr=r.stderr.decode("utf-8", "ignore")[-400:])
            return None
        return out.read_bytes()


async def docx_to_pdf(data: bytes, timeout: int = 90) -> bytes | None:
    """The PDF rendering of a DOCX, or None (no LibreOffice here, or the conversion failed — the review then shows text)."""
    exe = converter()
    if not exe:
        return None
    async with _LIMIT:
        try:
            return await asyncio.to_thread(_run, exe, data, timeout)
        except (subprocess.TimeoutExpired, OSError) as e:
            log.warning("docx_convert_failed", error=str(e))
            return None
