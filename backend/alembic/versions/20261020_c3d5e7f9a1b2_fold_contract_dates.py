"""Import proposals: the contract's start and end live once, on the head (start/end key dates fold into it)

Jobs still in review are rewritten the way ``Proposal.fold_dates`` folds new ones, and their saved checks follow:
``key_date:i`` is renumbered, a checked start/end key date becomes ``contract:start_date`` / ``contract:end_date``. A start/end
key date the operator already checked (or corrected) wins over a different head date — that was their decision.

Revision ID: c3d5e7f9a1b2
Revises: b7c4e2a9d1f3
Create Date: 2026-10-20 10:00:00
"""
import json

import sqlalchemy as sa

from alembic import op

revision = 'c3d5e7f9a1b2'
down_revision = 'b7c4e2a9d1f3'
branch_labels = None
depends_on = None

HEAD = {"start": "start_date", "end": "end_date"}


def _ee(iso: str) -> str:
    y, m, d = iso[:10].split("-")
    return f"{d}.{m}.{y}"


def fold(prop: dict | None, checked: set[int] | frozenset[int] = frozenset()) -> tuple[dict | None, dict[int, str]]:
    """Same rule as Proposal.fold_dates, on the stored JSON (``checked``: key date indexes the operator confirmed).
    Returns the folded proposal and {old index → new check key}; a clash nobody confirmed maps to nothing (stays open)."""
    if not prop or (prop.get("contract") or {}).get("document_kind", "contract") != "contract":
        return prop, {}
    c, checks, kept, remap = dict(prop.get("contract") or {}), dict(prop.get("date_checks") or {}), [], {}
    for i, k in enumerate(prop.get("key_dates") or []):
        field = HEAD.get(k.get("kind"))
        if not field:
            remap[i] = f"key_date:{len(kept)}"
            kept.append(k)
            continue
        remap[i] = f"contract:{field}"
        cur, conf = c.get(field), float(k.get("confidence", 1.0))
        if not cur or cur[:10] == k["date"][:10] or i in checked:
            c[field] = k["date"][:10]
            check = {"confidence": conf, "note": k.get("note"), "page": k.get("page")}
        else:
            remap.pop(i)
            check = {"confidence": min(conf, 0.5), "page": k.get("page"),
                     "note": f"Lepingust loetud kaks kuupäeva: {_ee(cur)} ja {_ee(k['date'])} — vali õige"}
        if field not in checks or check["confidence"] < checks[field]["confidence"]:
            checks[field] = check
    if len(kept) == len(prop.get("key_dates") or []):
        return prop, {}
    return {**prop, "contract": c, "key_dates": kept, "date_checks": checks}, remap


def upgrade() -> None:
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, proposal, reviewed, checked FROM import_job WHERE status NOT IN ('committed', 'manual')")).mappings().all()
    for r in rows:
        done = {int(k.split(":")[1]) for k in (r["checked"] or []) if k.startswith("key_date:")}
        proposal, remap_p = fold(r["proposal"], done if r["reviewed"] is None else frozenset())
        reviewed, remap_r = fold(r["reviewed"], done)
        remap = remap_r if r["reviewed"] is not None else remap_p  # the checks belong to the version the review shows
        if proposal is r["proposal"] and reviewed is r["reviewed"]:
            continue
        checked = []
        for key in r["checked"] or []:
            if key.startswith("key_date:") and remap:
                new = remap.get(int(key.split(":")[1]))
                if new:
                    checked.append(new)
            else:
                checked.append(key)
        conn.execute(sa.text("UPDATE import_job SET proposal = CAST(:p AS jsonb), reviewed = CAST(:r AS jsonb), checked = CAST(:c AS jsonb) WHERE id = :id"),
                     {"id": r["id"], "p": json.dumps(proposal) if proposal is not None else None,
                      "r": json.dumps(reviewed) if reviewed is not None else None, "c": json.dumps(sorted(set(checked)))})


def downgrade() -> None:
    pass  # the folded shape is valid for the old code too (it simply has no start/end key dates)
