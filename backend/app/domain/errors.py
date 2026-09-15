class DomainError(Exception):
    status_code = 400

    def __init__(self, message: str, *, code: str = "domain_error", status_code: int | None = None):
        super().__init__(message)
        self.message = message
        self.code = code
        if status_code:
            self.status_code = status_code


class NotFound(DomainError):
    status_code = 404

    def __init__(self, what: str = "Kirjet ei leitud"):
        super().__init__(what, code="not_found")


class Conflict(DomainError):
    status_code = 409

    def __init__(self, message: str = "Keegi muutis vahepeal"):
        super().__init__(message, code="conflict")


class Forbidden(DomainError):
    status_code = 403

    def __init__(self, message: str = "Puudub õigus"):
        super().__init__(message, code="forbidden")


class ValidationFailed(DomainError):
    status_code = 422

    def __init__(self, message: str, errors: list[dict] | None = None):
        super().__init__(message, code="validation")
        self.errors = errors or []
