"""Vertical = configuration + a thin code module. The engine never branches on a vertical's name."""

from __future__ import annotations

import importlib
from typing import Any

from pydantic import BaseModel


def load_schema(ref: str) -> type[BaseModel]:
    module, name = ref.split(":")
    return getattr(importlib.import_module(module), name)


def validate_attributes(schema_ref: str, attributes: dict[str, Any]) -> dict[str, Any]:
    from app.domain.errors import ValidationFailed

    schema = load_schema(schema_ref)
    try:
        return schema.model_validate(attributes).model_dump(mode="json", exclude_none=True)
    except Exception as e:  # pydantic.ValidationError
        errors = getattr(e, "errors", lambda: [])()
        raise ValidationFailed("Atribuudid ei vasta skeemile", errors=[{"loc": list(x.get("loc", [])), "msg": x.get("msg")} for x in errors]) from e
