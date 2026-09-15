"""Rule-based structurer (FakeChatModel). Good enough to run the whole import flow offline and in
tests; the live model replaces it. Same output shape as the LLM (see schema.Proposal)."""

from __future__ import annotations

import re
from datetime import date, timedelta
from typing import Any

CLAUSE_RE = re.compile(r"^(?P<num>\d{1,2}(?:\.\d{1,2}){0,3})\.?\s+(?P<text>\S.*)$")
DATE_RE = re.compile(r"\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b")
ISO_RE = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")
REG_RE = re.compile(r"[Rr]egistrikood(?:iga)?:?\s*(\d{8})")
NAME_RE = re.compile(r"((?:[A-ZÕÄÖÜŠŽ][\wÕÄÖÜõäöüšž&.\-]*\s){1,4}(?:OÜ|AS|UÜ|TÜ|MTÜ|SA)\b|(?:AS|OÜ)\s+[A-ZÕÄÖÜ][\wÕÄÖÜõäöüšž\-]*(?:\s+[A-ZÕÄÖÜ][\wÕÄÖÜõäöüšž\-]*)*)")


def _parse_text(user: str) -> tuple[str, list[tuple[int, int]]]:
    """Strip page markers; return plain text + [(page, char_start)]."""
    pages: list[tuple[int, int]] = []
    out: list[str] = []
    pos = 0
    for line in user.split("\n"):
        m = re.match(r"^<<<PAGE (\d+)>>>(?: \[offset=(\d+)\])?$", line)
        if m:
            pages.append((int(m.group(1)), pos))
            continue
        out.append(line)
        pos += len(line) + 1
    return "\n".join(out) + "\n", pages or [(1, 0)]


def _page_of(pages: list[tuple[int, int]], offset: int) -> int:
    p = 1
    for page, start in pages:
        if start <= offset:
            p = page
    return p


def _to_iso(m: re.Match) -> str | None:
    try:
        d = date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        return d.isoformat()
    except ValueError:
        return None


def heuristic_structure(user: str) -> dict[str, Any]:
    text, pages = _parse_text(user)
    low = text.lower()
    category = "other"
    for cat, words in (("lease", ("üürileping", "üüripind")), ("maintenance", ("hooldusleping", "hooldaja")),
                       ("management", ("haldusleping", "haldaja")), ("insurance", ("kindlustus", "poliis")),
                       ("security", ("valveleping", "valve")), ("employment", ("tööleping", "töötaja"))):
        if any(w in low[:4000] for w in words):
            category = cat
            break

    # parties: name + registry code pairs
    parties: list[dict[str, Any]] = []
    for m in REG_RE.finditer(text):
        window = text[max(0, m.start() - 160): m.start()]
        names = NAME_RE.findall(window)
        name = names[-1].strip() if names else None
        if name and not any(p["registry_code"] == m.group(1) for p in parties):
            role = "other"
            ctx = text[max(0, m.start() - 400): m.start()].lower()
            if category == "lease":
                role = "tenant" if "üürnik" in ctx[-200:] else "landlord"
            elif category in ("maintenance", "management", "security"):
                role = "supplier" if len(parties) else "client"
            elif category == "insurance":
                role = "insured" if len(parties) else "insurer"
            parties.append({"name": name, "role": role, "registry_code": m.group(1), "address": None, "email": None,
                            "confidence": 0.85, "page": _page_of(pages, m.start()), "char_start": m.start(), "char_end": m.end()})
        if len(parties) >= 2:
            break

    # dates
    dates = [(m, _to_iso(m)) for m in DATE_RE.finditer(text)]
    dates = [(m, d) for m, d in dates if d]
    signed = None
    for m, d in dates:
        ctx = low[max(0, m.start() - 80): m.start()]
        if any(w in ctx for w in ("sõlminud", "sõlmitud", "allkirjast")):
            signed = d
            break
    if not signed and dates:
        signed = dates[0][1]
    start = signed
    end = None
    term_years = re.search(r"tähtajaliselt\s+(\d{1,2})\s+aastaks", low)
    term_months = re.search(r"tähtajaliselt\s+(\d{1,3})\s+kuuks", low)
    if start and term_years:
        y = int(term_years.group(1))
        s = date.fromisoformat(start)
        end = s.replace(year=s.year + y).isoformat()
    elif start and term_months:
        s = date.fromisoformat(start)
        end = (s + timedelta(days=30 * int(term_months.group(1)))).isoformat()
    for m, d in dates:
        ctx = low[max(0, m.start() - 60): m.start()]
        if "kehtib kuni" in ctx or "lõpeb" in ctx or "kuni" in ctx[-12:]:
            end = d

    params: list[dict[str, Any]] = []

    def add_param(key: str, label: str, value: str | None, unit: str | None, m: re.Match, conf: float = 0.9, note: str | None = None) -> None:
        line_start = text.rfind("\n", 0, m.start()) + 1
        line_end = text.find("\n", m.end())
        line_end = len(text) if line_end < 0 else line_end
        params.append({"key": key, "label": label, "value": value, "unit": unit, "text": text[line_start:line_end].strip(),
                       "confidence": conf, "source_number": None, "note": note, "page": _page_of(pages, m.start()),
                       "char_start": line_start, "char_end": line_end})

    m = re.search(r"EUR\s*(\d+[.,]\d{2})\s*Üüripinna ühe ruutmeetri", text) or re.search(r"(\d+[.,]\d{2})\s*(?:€|EUR)\s*/?\s*m", text)
    if m:
        add_param("rent_per_m2", "Üür €/m²", m.group(1).replace(",", "."), "EUR/m²", m)
    m = re.search(r"üldpinnaga\s*(\d+[.,]?\d*)\s*m", text) or re.search(r"(\d+[.,]?\d*)\s*m²", text)
    if m:
        add_param("area_m2", "Üüripind", m.group(1).replace(",", "."), "m²", m)
    m = re.search(r"tagatisraha\s+(\d+)\s+kuu Üüri", text, re.I)
    if m:
        add_param("deposit", "Tagatis", f"{m.group(1)} kuu üür", None, m)
    m = re.search(r"tähtajaliselt\s+(\d{1,2}\s+aastaks|\d{1,3}\s+kuuks)", text)
    if m:
        add_param("term", "Tähtaeg", m.group(1), None, m)
    m = re.search(r"(\d{1,2})\.\s*kuupäevaks", text)
    if m:
        add_param("payment_due", "Maksetähtaeg", f"kuu {m.group(1)}.", "päev", m, 0.75, "Tuletatud korduvast maksetähtajast")
    m = re.search(r"(\d+(?:[  ]\d{3})*(?:[.,]\d{2})?)\s*(?:€|EUR|eurot)\s*(?:kuus|/ kuu|kuu)", text)
    if m and category != "lease":
        add_param("fee_monthly", "Tasu kuus", m.group(1).replace(" ", "").replace(" ", "").replace(",", "."), "EUR", m)
    m = re.search(r"(\d{1,3})\s*(?:kuu|kuulise|kuud)\s*(?:etteteatamis|ette teatamis)", low) or re.search(r"etteteatamis\w*\s*(?:tähtaeg|aeg)\w*\s*(?:on\s*)?(\d{1,3})\s*(?:kuu|päev)", low)
    if m:
        add_param("notice_period", "Etteteatamine", m.group(1), "kuud", m, 0.7, "Tekstist tuletatud")
    m = re.search(r"(tarbijahinnaindeks\w*|indekseeri\w*)", low)
    if m:
        add_param("indexation", "Indekseerimine", "THI" if "tarbijahinna" in m.group(1) else "kokkuleppel", None, m, 0.7, "Kontrolli meetod ja sagedus originaalist")

    key_dates: list[dict[str, Any]] = []
    if start:
        key_dates.append({"kind": "start", "date": start, "title": "Lepingu algus", "confidence": 0.85, "note": None, "page": 1, "char_start": None, "char_end": None})
    if end:
        key_dates.append({"kind": "end", "date": end, "title": "Lepingu lõpp", "confidence": 0.7 if term_years or term_months else 0.85,
                          "note": "Tuletatud tähtajast" if (term_years or term_months) else None, "page": 1, "char_start": None, "char_end": None})
    idx = re.search(r"(?:esimene indekseerimine|indekseeritakse alates|alates)\s+(\d{1,2})\.(\d{1,2})\.(\d{4})", text)
    if idx and _to_iso(idx):
        key_dates.append({"kind": "indexation", "date": _to_iso(idx), "title": "Indekseerimine", "confidence": 0.75, "note": "Kontrolli",
                          "page": _page_of(pages, idx.start()), "char_start": idx.start(), "char_end": idx.end()})

    clauses: list[dict[str, Any]] = []
    pos = 0
    in_toc = False
    for line in text.split("\n"):
        ln = line.strip()
        if ln.lower() == "sisukord":
            in_toc = True
        if in_toc and re.search(r"\.{5,}\s*\d+$", ln):
            pos += len(line) + 1
            continue
        in_toc = in_toc and (bool(re.search(r"\.{3,}", ln)) or ln.lower() == "sisukord")
        m = CLAUSE_RE.match(ln)
        if m and not re.search(r"\.{4,}", ln):
            num = m.group("num")
            body = m.group("text").strip()
            level = num.count(".")
            heading = re.sub(r"\s+\d{1,3}$", "", body) if (level == 0 and body.isupper()) else None
            clauses.append({"number": num, "level": level, "heading": heading.title() if heading else None,
                            "text": "" if heading else body, "page": _page_of(pages, pos), "char_start": pos, "char_end": pos + len(line)})
        elif clauses and ln and not ln.isupper() and not re.match(r"^<<<", ln) and len(ln) > 2:
            # continuation line of the previous clause
            c = clauses[-1]
            if c["text"]:
                c["text"] = (c["text"] + " " + ln).strip()
                c["char_end"] = pos + len(line)
        pos += len(line) + 1
    # a table of contents repeats the top-level headings (with a trailing page number): drop the first run
    tops = [i for i, c in enumerate(clauses) if c["level"] == 0]
    nums = [clauses[i]["number"] for i in tops]
    if len(nums) >= 4 and nums[: len(nums) // 2] == nums[len(nums) // 2:]:
        cut = tops[len(nums) // 2]
        clauses = clauses[cut:]
    # de-duplicate numbers that restart (main terms vs general terms): keep first occurrence's prefix distinct
    seen: dict[str, int] = {}
    for c in clauses:
        seen[c["number"]] = seen.get(c["number"], 0) + 1
        if seen[c["number"]] > 1:
            c["number"] = f"ÜT {c['number']}" if seen[c["number"]] == 2 else f"L{seen[c['number']] - 2} {c['number']}"

    our = next((p["name"] for p in parties if p["role"] in ("landlord", "client", "insured", "employer")), None)
    counter = next((p["name"] for p in parties if p["role"] in ("tenant", "supplier", "insurer", "employee")), None)
    first_line = next((ln.strip() for ln in text.split("\n") if ln.strip()), "Leping")
    number = None
    mnum = re.search(r"\bNr\.?\s*([A-Z0-9][\w./-]*)", text[:800])
    if mnum:
        number = mnum.group(1)
    hint_name = None
    mh = re.search(r"\b(P_?\d{1,3}|[Pp]ind\s*\d{1,3})\b", text[:3000])
    if mh:
        hint_name = mh.group(1)
    addr = re.search(r"aadressil\s+([^,]+(?:,[^,]+){0,3}?(?:küla|linn|vald|Tallinn|maakond)[^,\n]*)", text)
    return {
        "contract": {"title": first_line[:120].title() if first_line.isupper() else first_line[:120], "category": category, "number": number,
                     "signed_at": signed, "start_date": start, "end_date": end, "counterparty_name": counter, "our_company_name": our,
                     "summary": f"{category} · {len(clauses)} punkti · automaatselt struktureeritud (reeglipõhine)"},
        "parties": parties,
        "parameters": params,
        "key_dates": key_dates,
        "clauses": clauses[:600],
        "asset_hint": {"name": hint_name, "address": addr.group(1).strip() if addr else None, "area_m2": None},
    }
