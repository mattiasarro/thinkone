"""Real-estate vertical: asset schemas (property, space, parking spot), pricing helpers, adapters (EHR, äriregister)."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

# Space parts (demo v656: a space has only its rentable area plus an optional breakdown into parts).
SPACE_PART_KEYS = ("ladu", "kontor", "myygisaal", "olmeala", "yhisala")
SPACE_PART_LABELS = {"ladu": "Ladu", "kontor": "Kontor", "myygisaal": "Müügisaal", "olmeala": "Olmeala", "yhisala": "Ühisala"}
PARKING_TYPES = ("tavaline", "elektriauto", "ligipääsetav")


class SpotGeom(BaseModel):
    """A spot's box on the building's parking schematic: centre ``x, y``, size ``w, h`` in metres, ``rot`` degrees clockwise."""

    x: float
    y: float
    w: float = Field(gt=0, le=100)
    h: float = Field(gt=0, le=100)
    rot: float = Field(default=0, ge=-360, le=360)


class PlanBackground(BaseModel):
    """The uploaded parking plan drawn under the boxes: which attachment and where it sits on the frame (metres)."""

    attachment_id: str
    x: float = 0
    y: float = 0
    w: float = Field(gt=0)
    h: float = Field(gt=0)
    opacity: float = Field(default=0.6, ge=0, le=1)


class ParkingPlanFrame(BaseModel):
    units: Literal["m"] = "m"
    width: float = Field(gt=0, le=5000)
    height: float = Field(gt=0, le=5000)
    background: PlanBackground | None = None


class PropertyAttributes(BaseModel):
    ehr_code: str | None = None
    address: str | None = None
    use_type: str | None = None
    footprint_m2: float | None = Field(default=None, ge=0)
    net_area_m2: float | None = Field(default=None, ge=0)
    floors: int | None = Field(default=None, ge=0)
    build_year: int | None = Field(default=None, ge=1800, le=2100)
    vat_taxable: bool = True
    utility_cost_winter: float | None = Field(default=None, ge=0, description="€/m² per month, Oct–Mar average")
    utility_cost_summer: float | None = Field(default=None, ge=0, description="€/m² per month, Apr–Sep average")
    utility_source: str | None = None  # moderan | manual
    ehr_source: str | None = None  # ehr | manual
    ehr_payload: dict | None = None  # trimmed raw register payload (architecture §7: adapters snapshot responses)
    template_id: str | None = None  # general-terms template used for this building's leases (object workflow step 5)
    has_parking: bool | None = None  # None = not decided; False = „parkimist pole”
    parking_plan: ParkingPlanFrame | None = None  # the schematic's frame (metres); spots carry their own ``geom``
    parking_plan_draft: dict | None = None  # VLM proposal awaiting the operator's review (parking_plan domain)


class SpaceAttributes(BaseModel):
    """A space has ONE area — the rentable area — plus an optional breakdown into parts that must sum to it.

    ``electrical_capacity_a`` is amperes (the general terms cap it at 63 A; a higher value becomes a
    special term in Phase 3). ``parking_spots`` is a plain count, used only on buildings without a
    parking register; with a register the space's spots are the register rows whose ``space_id`` is this space.
    """

    type: str | None = None  # büroo | ladu | tootmine | ...
    rentable_area_m2: float = Field(ge=0, description="INPUT, not computed (spec 02)")
    parts: dict[str, float] | None = None  # {ladu: 120.0, kontor: 30.0, ...} — sums to rentable_area_m2
    price_per_m2: float | None = Field(default=None, ge=0)
    electrical_capacity_a: float | None = Field(default=None, ge=0)
    parking_spots: int | None = Field(default=None, ge=0)
    floor: str | None = None
    split_from: str | None = None  # parent space id when this is a rental unit of a split space
    split_into: list[str] | None = None  # unit ids when this space has been split („Jagatud”)
    # tolerated legacy fields (spec v2 columns dropped by the demo in v656); not shown in UI
    net_area_m2: float | None = Field(default=None, ge=0)
    coefficient: float | None = Field(default=None, ge=0)

    @model_validator(mode="before")
    @classmethod
    def _legacy(cls, data: Any) -> Any:
        if isinstance(data, dict) and data.get("electrical_capacity_a") is None and data.get("electrical_capacity_kw") is not None:
            data = {**data, "electrical_capacity_a": data["electrical_capacity_kw"]}
        if isinstance(data, dict):
            data = {k: v for k, v in data.items() if k != "electrical_capacity_kw"}
        return data

    @field_validator("rentable_area_m2")
    @classmethod
    def _positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("üüripind peab olema suurem kui 0")
        return v

    @field_validator("parts")
    @classmethod
    def _parts_keys(cls, v: dict[str, float] | None) -> dict[str, float] | None:
        if not v:
            return None
        out: dict[str, float] = {}
        for k, m2 in v.items():
            if k not in SPACE_PART_KEYS:
                raise ValueError(f"tundmatu ruumiosa „{k}” (lubatud: {', '.join(SPACE_PART_KEYS)})")
            if m2 is None:
                continue
            if m2 < 0:
                raise ValueError(f"{SPACE_PART_LABELS[k]}: pindala ei saa olla negatiivne")
            if m2 > 0:
                out[k] = round(float(m2), 2)
        return out or None

    @model_validator(mode="after")
    def _parts_sum(self) -> SpaceAttributes:
        if self.parts:
            total = round(sum(self.parts.values()), 2)
            if abs(total - self.rentable_area_m2) > 0.05:
                raise ValueError(f"osad kokku {total:g} m², üüripind {self.rentable_area_m2:g} m² — need peavad klappima")
        return self


class ParkingSpotAttributes(BaseModel):
    """One row of a building's parking register (demo v660–668). Status is derived, never stored:
    out of service › rented (allocation) › reserve › free. ``space_id`` = the space whose default spot this is."""

    number: str = Field(min_length=1, max_length=20)
    zone: str | None = None
    type: Literal["tavaline", "elektriauto", "ligipääsetav"] = "tavaline"
    reserve: bool = False
    out_of_service: bool = False
    space_id: str | None = None
    geom: SpotGeom | None = None  # None = not placed on the schematic yet

    @field_validator("number", mode="before")
    @classmethod
    def _num(cls, v: Any) -> str:
        return str(v).strip()


def monthly_rent(space: SpaceAttributes) -> Decimal | None:
    if space.price_per_m2 is None:
        return None
    return (Decimal(str(space.rentable_area_m2)) * Decimal(str(space.price_per_m2))).quantize(Decimal("0.01"))


def spot_sort_key(number: str) -> tuple[int, str]:
    digits = "".join(ch for ch in number if ch.isdigit())
    return (int(digits) if digits else 10**9, number)
