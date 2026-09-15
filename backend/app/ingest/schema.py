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
PartyRole = Literal["landlord", "tenant", "client", "supplier", "insurer", "insured", "employer", "employee", "other"]


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


class Proposal(BaseModel):
    contract: ContractHead
    parties: list[PartyProposal] = Field(default_factory=list)
    parameters: list[ParameterProposal] = Field(default_factory=list)
    key_dates: list[KeyDateProposal] = Field(default_factory=list)
    clauses: list[ClauseProposal] = Field(default_factory=list)
    asset_hint: AssetHint | None = None

    def uncertain(self, threshold: float = 0.8) -> list[str]:
        out = [f"parameter:{i}" for i, p in enumerate(self.parameters) if p.confidence < threshold]
        out += [f"key_date:{i}" for i, k in enumerate(self.key_dates) if k.confidence < threshold]
        out += [f"party:{i}" for i, p in enumerate(self.parties) if p.confidence < threshold]
        return out


def _strictify(schema: dict[str, Any]) -> dict[str, Any]:
    """All properties required, no additional properties, optional → nullable (structured-output friendly)."""
    if isinstance(schema, dict):
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
        if schema.get("format") == "date":
            schema.pop("format")
            schema["description"] = (schema.get("description", "") + " ISO date YYYY-MM-DD").strip()
    return schema


def proposal_json_schema() -> dict[str, Any]:
    return _strictify(Proposal.model_json_schema())
