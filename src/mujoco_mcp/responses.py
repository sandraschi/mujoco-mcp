"""Response invariant for MCP tool results.

Every tool in this server answers with a ``{"success": bool, ...}`` dict. Two
shapes are easy to produce by accident and expensive to diagnose downstream:

* ``{"success": True, "error": "..."}`` - the caller reads success and never
  sees the error that contradicts it.
* ``{"success": False}`` with no ``error`` - the caller cannot say why.

``ok_response`` and ``error_response`` make both unrepresentable, and
``check_response`` can assert the invariant on a payload built elsewhere.

Borrowed from NVlabs/ASPIRE's ``cap_harness._validate_result_status``; see
``mcp-central-docs/robotics/research/2026-10-21_aspire-skill-discovery-probe.md``
section 2 for the rationale.
"""

from __future__ import annotations

from typing import Any

Response = dict[str, Any]

_RESERVED = ("error", "error_type")


class ResponseInvariantError(ValueError):
    """A tool result would carry an ambiguous success/error shape."""


def ok_response(**fields: Any) -> Response:
    """Build a successful response.

    Raises:
        ResponseInvariantError: if ``error`` or ``error_type`` was passed.
            A caller that has an error must use :func:`error_response`.
    """
    for key in _RESERVED:
        if key in fields:
            raise ResponseInvariantError(
                f"a successful response cannot carry {key!r}; use error_response()"
            )
    return {"success": True, **fields}


def error_response(error: str, *, error_type: str | None = None, **fields: Any) -> Response:
    """Build a failed response that always carries a non-empty error string.

    Raises:
        ResponseInvariantError: if ``error`` is empty or whitespace.
    """
    message = str(error or "").strip()
    if not message:
        raise ResponseInvariantError("a failed response must carry a non-empty error")
    payload: Response = {"success": False, "error": message}
    if error_type is not None:
        payload["error_type"] = error_type
    payload.update(fields)
    return payload


def check_response(payload: Response) -> Response:
    """Validate the invariant on an existing payload and return it unchanged.

    Raises:
        ResponseInvariantError: on a missing/non-bool ``success``, a successful
            payload carrying an error, or a failed payload without one.
    """
    if "success" not in payload:
        raise ResponseInvariantError("response is missing 'success'")
    if not isinstance(payload["success"], bool):
        raise ResponseInvariantError("'success' must be a bool")
    has_error = bool(payload.get("error"))
    if payload["success"] and has_error:
        raise ResponseInvariantError("a successful response cannot carry an error")
    if not payload["success"] and not has_error:
        raise ResponseInvariantError("a failed response must carry an error")
    return payload
