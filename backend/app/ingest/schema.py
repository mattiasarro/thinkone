"""Import proposal schema — mirrors the clause tree + typed parameters + parties + key dates.

The same shape is (1) the structured-output JSON schema sent to the model, (2) validated on
the way back, (3) edited by the operator in the review UI, and (4) committed to the registry.
"""

from __future__ import annotations

from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

Category = Literal["lease", "maintenance", "management", "insurance", "security", "employment", "other"]
KeyDateKindCode = Literal["start", "end", "indexation", "payment", "notice", "probation", "salary_review", "other"]
PartyRole = Literal["landlord", "tenant", "client", "supplier", "manager", "maintainer", "security", "insurer", "insured", "employer", "employee", "other"]


class Anchor(BaseModel):
    page: int | None = None
    char_start: int | None = None
    char_end: int | None = None


class ContractHead(BaseModel):
    title: str
    category: Category
    number: str | None = None
    signed_at: date | None = None
    start_date: date | None = None
    end_date: date | None = None
    counterparty_name: str | None = None
    our_company_name: str | None = None
    summary: str | None = None
    # what kind of document this is in a batch of files (demo v622 „import lepingu kaupa”): a contract of its own, an annex
    # (lisa / muudatus) amending an earlier contract, or a supporting document (akt, garantiikiri, plaan) that belongs to one
    document_kind: Literal["contract", "annex", "document"] = "contract"
    annex_number: str | None = None
    parent_number: str | None = None  # the number of the contract an annex amends / a document belongs to, if printed
    parent_signed_at: date | None = None  # „… 25.11.2023 sõlmitud üürilepingu lisa”


class PartyProposal(Anchor):
    name: str
    role: PartyRole
    registry_code: str | None = None
    address: str | None = None
    email: str | None = None
    confidence: float = Field(ge=0, le=1, default=1.0)


class ParameterProposal(Anchor):
    key: str
    label: str
    value: str | None = None
    unit: str | None = None
    text: str
    confidence: float = Field(ge=0, le=1, default=1.0)
    source_number: str | None = None
    note: str | None = None


class KeyDateProposal(Anchor):
    kind: KeyDateKindCode
    date: date
    title: str
    confidence: float = Field(ge=0, le=1, default=1.0)
    note: str | None = None


class ClauseProposal(Anchor):
    number: str
    level: int = Field(ge=0, le=5)
    heading: str | None = None
    text: str

    @field_validator("number")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip().rstrip(".")


class AssetHint(BaseModel):
    name: str | None = None
    address: str | None = None
    area_m2: float | None = None


class FactsProposal(BaseModel):
    """What the facts call returns: everything that needs the whole document and judgement, no clause text."""

    contract: ContractHead
    parties: list[PartyProposal] = Field(default_factory=list)
    parameters: list[ParameterProposal] = Field(default_factory=list)
    key_dates: list[KeyDateProposal] = Field(default_factory=list)
    asset_hint: AssetHint | None = None


class ClausesProposal(BaseModel):
    """What the clause call returns: the verbatim clause tree (transcription, run on a cheaper model in parallel)."""

    clauses: list[ClauseProposal] = Field(default_factory=list)


class DateCheck(BaseModel):
    """How sure the contract's start or end date is (it lives on the head; this is its review state)."""

    confidence: float = Field(ge=0, le=1, default=1.0)
    note: str | None = None
    page: int | None = None


HEAD_DATES = {"start": "start_date", "end": "end_date"}


class Proposal(FactsProposal):
    """The two halves merged — the shape the review UI edits and the commit path reads."""

    clauses: list[ClauseProposal] = Field(default_factory=list)
    # not model output: the review state of contract.start_date / end_date (filled when start/end key dates fold into the head)
    date_checks: dict[str, DateCheck] = Field(default_factory=dict)

    def fold_dates(self) -> bool:
        """A contract's start and end exist once — on the head. Start/end key dates the model returns fold into it (their
        confidence and page move to ``date_checks``); the commit makes the calendar's start/end entries from the head.
        Two different dates → the head keeps its own and the date is flagged. An annex keeps its start/end key dates:
        there they say how it changes the contract (a new end), not when the annex itself runs."""
        if self.contract.document_kind != "contract":
            return False
        kept, folded = [], False
        for k in self.key_dates:
            field = HEAD_DATES.get(k.kind)
            if not field:
                kept.append(k)
                continue
            folded = True
            cur = getattr(self.contract, field)
            if cur is None or cur == k.date:
                setattr(self.contract, field, k.date)
                check = DateCheck(confidence=k.confidence, note=k.note, page=k.page)
            else:
                check = DateCheck(confidence=min(k.confidence, 0.5), page=k.page,
                                  note=f"Lepingust loetud kaks kuupäeva: {cur:%d.%m.%Y} ja {k.date:%d.%m.%Y} — vali õige")
            prev = self.date_checks.get(field)
            if prev is None or check.confidence < prev.confidence:
                self.date_checks[field] = check
        self.key_dates = kept
        return folded

    def uncertain(self, threshold: float = 0.8) -> list[str]:
        out = [f"parameter:{i}" for i, p in enumerate(self.parameters) if p.confidence < threshold]
        out += [f"key_date:{i}" for i, k in enumerate(self.key_dates) if k.confidence < threshold]
        out += [f"party:{i}" for i, p in enumerate(self.parties) if p.confidence < threshold]
        out += [f"contract:{f}" for f in ("start_date", "end_date") if f in self.date_checks and self.date_checks[f].confidence < threshold]
        return out


def _strictify(schema: dict[str, Any]) -> dict[str, Any]:
    """All properties required, no additional properties, optional → nullable (structured-output friendly).

    Keeps the compiled grammar small: ``anyOf [X, null]`` becomes ``type: [X, "null"]`` and descriptions/titles
    are dropped (the prompt carries the field semantics)."""
    if isinstance(schema, dict):
        any_of = schema.get("anyOf")
        if isinstance(any_of, list) and len(any_of) == 2 and any(x.get("type") == "null" for x in any_of):
            other = next(x for x in any_of if x.get("type") != "null")
            if isinstance(other.get("type"), str) and "$ref" not in other:
                merged = {k: v for k, v in schema.items() if k != "anyOf"}
                merged.update({k: v for k, v in other.items() if k != "type"})
                merged["type"] = [other["type"], "null"]
                schema = merged
        if schema.get("type") == "object" and "properties" in schema:
            props = schema["properties"]
            schema["required"] = list(props.keys())
            schema["additionalProperties"] = False
            for name, prop in props.items():
                props[name] = _strictify(prop)
        for k in ("anyOf", "oneOf", "allOf"):
            if k in schema:
                schema[k] = [_strictify(x) for x in schema[k]]
        if "items" in schema:
            schema["items"] = _strictify(schema["items"])
        if "$defs" in schema:
            schema["$defs"] = {k: _strictify(v) for k, v in schema["$defs"].items()}
        schema.pop("default", None)
        schema.pop("title", None)
        schema.pop("description", None)
        # the structured-output API rejects numeric bounds; Pydantic still enforces them on the way back
        for k in ("minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf"):
            schema.pop(k, None)
        if schema.get("format") == "date":
            schema.pop("format")  # the prompt says dates are ISO YYYY-MM-DD; Pydantic parses them on the way back
    return schema


def proposal_json_schema() -> dict[str, Any]:
    return _strictify(Proposal.model_json_schema())


def facts_json_schema() -> dict[str, Any]:
    return _strictify(FactsProposal.model_json_schema())


def clauses_json_schema() -> dict[str, Any]:
    return _strictify(ClausesProposal.model_json_schema())
