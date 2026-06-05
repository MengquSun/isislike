"""Optional export access control via env flags."""

from __future__ import annotations

from fastapi import Header, HTTPException

from app.config import settings


def require_export_access(
    x_export_key: str | None = Header(default=None, alias="X-Export-Key"),
) -> None:
    if not settings.export_enabled:
        raise HTTPException(status_code=403, detail="Export is disabled on this server")
    if settings.export_api_key and x_export_key != settings.export_api_key:
        raise HTTPException(status_code=403, detail="Invalid or missing export API key")
