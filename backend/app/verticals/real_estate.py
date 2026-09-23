"""Real-estate vertical: asset schemas (property, space), pricing helpers, adapters (EHR, äriregister)."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


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


class SpaceAttributes(BaseModel):
    type: str | None = None  # büroo | ladu | tootmine | ...
    net_area_m2: float | None = Field(default=None, ge=0)
    rentable_area_m2: float = Field(ge=0, description="INPUT, not computed (spec 02)")
    coefficient: float | None = Field(default=None, ge=0)
    price_per_m2: float | None = Field(default=None, ge=0)
    electrical_capacity_kw: float | None = Field(default=None, ge=0)
    parking_spots: int | None = Field(default=None, ge=0)
    floor: str | None = None

    @field_validator("rentable_area_m2")
    @classmethod
    def _positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("üüripind peab olema suurem kui 0")
        return v


def monthly_rent(space: SpaceAttributes) -> Decimal | None:
    if space.price_per_m2 is None:
        return None
    return (Decimal(str(space.rentable_area_m2)) * Decimal(str(space.price_per_m2))).quantize(Decimal("0.01"))
