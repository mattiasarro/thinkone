"""Architecture guard: no naked writes outside the domain layer (invariant 1)."""

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent / "app"
WRITE_PATTERNS = [r"\bsession\.add\(", r"\bsession\.add_all\(", r"\bsession\.delete\(", r"\b(?:insert|update|delete)\(\s*[A-Z]\w*\s*\)"]
ALLOWED_DIRS = {"domain", "ingest", "worker"}  # worker tasks route through domain commands; ingest is domain-level


def test_no_naked_writes_in_api_or_agent():
    offenders = []
    for path in ROOT.rglob("*.py"):
        top = path.relative_to(ROOT).parts[0]
        if top in ALLOWED_DIRS or top in {"models", "infra", "verticals", "integrations", "documents"}:
            continue
        src = path.read_text()
        for pat in WRITE_PATTERNS:
            for m in re.finditer(pat, src):
                line = src[: m.start()].count("\n") + 1
                offenders.append(f"{path.relative_to(ROOT)}:{line} {m.group(0)}")
    assert not offenders, "Writes outside domain commands:\n" + "\n".join(offenders)


def test_domain_does_not_import_framework():
    for path in (ROOT / "domain").rglob("*.py"):
        src = path.read_text()
        assert "from fastapi" not in src and "import fastapi" not in src, f"{path} imports FastAPI"
