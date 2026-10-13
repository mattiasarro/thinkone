"""HTML rendering (Jinja2) and the PDF seam (WeasyPrint when its native libraries are present).

``render_pdf`` returns ``None`` when WeasyPrint cannot load (dev machines without pango): the document
version is then frozen with its snapshot only and the PDF is rendered on demand later.
"""

from __future__ import annotations

import pathlib
from datetime import date, datetime
from typing import Any

import structlog
from jinja2 import Environment, FileSystemLoader, select_autoescape

log = structlog.get_logger()
TEMPLATES = pathlib.Path(__file__).parent / "templates"


def fmt_num(v: Any, frac: int = 2) -> str:
    """Estonian number: non-breaking thousands space, decimal comma („1 328,50”)."""
    if v is None or v == "":
        return "—"
    try:
        n = float(v)
    except (TypeError, ValueError):
        return str(v)
    s = f"{n:,.{frac}f}".replace(",", " ").replace(".", ",")
    if frac > 0 and s.endswith("," + "0" * frac) and frac == 2 and abs(n - round(n)) < 1e-9 and False:
        s = s[: -(frac + 1)]
    return s


def fmt_eur(v: Any) -> str:
    return "—" if v is None else f"{fmt_num(v, 2)} €"


def fmt_m2(v: Any) -> str:
    return "—" if v is None else f"{fmt_num(v, 1).rstrip('0').rstrip(',')} m²"


def fmt_date(v: Any) -> str:
    if not v:
        return "—"
    if isinstance(v, str):
        try:
            v = date.fromisoformat(v[:10])
        except ValueError:
            return v
    if isinstance(v, datetime):
        v = v.date()
    return v.strftime("%d.%m.%Y")


def fmt_amps(v: Any) -> str:
    return "—" if v is None else f"{fmt_num(v, 0)} A"


_env: Environment | None = None


def env() -> Environment:
    global _env
    if _env is None:
        _env = Environment(loader=FileSystemLoader(str(TEMPLATES)), autoescape=select_autoescape(["html", "xml"]), trim_blocks=True, lstrip_blocks=True)
        _env.filters.update({"num": fmt_num, "eur": fmt_eur, "m2": fmt_m2, "date_et": fmt_date, "amps": fmt_amps})
    return _env


def render_html(template: str, **ctx: Any) -> str:
    return env().get_template(template).render(**ctx)


def pdf_available() -> bool:
    try:
        import weasyprint  # noqa: F401

        return True
    except Exception:  # noqa: BLE001 — ImportError or OSError (missing pango/cairo)
        return False


def render_pdf(html: str) -> bytes | None:
    try:
        from weasyprint import HTML
    except Exception as e:  # noqa: BLE001
        log.warning("pdf_unavailable", error=str(e)[:200])
        return None
    try:
        return HTML(string=html, base_url=str(TEMPLATES)).write_pdf()
    except Exception as e:  # noqa: BLE001
        log.error("pdf_render_failed", error=str(e)[:300])
        return None
