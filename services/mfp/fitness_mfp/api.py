import base64
import os
import tempfile
from datetime import timedelta
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from renpho import RenphoAPIError

from fitness_mfp.cli import SyncRangeOutput, build_client, collect_body_metrics, nutrition_day_from_mfp, parse_date
from fitness_mfp.renpho_cli import (
    AreaAwareRenphoClient,
    RenphoSyncOutput,
    metric_from_measurement,
    parse_optional_date,
)

app = FastAPI(title="Fitness MFP Collector")


@app.get("/api/mfp/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "mfp"}


class SyncRangeRequest(BaseModel):
    start_date: str
    end_date: str


class RenphoSyncRequest(BaseModel):
    start_date: str | None = None
    end_date: str | None = None


@app.post("/api/mfp/sync-range")
def sync_range(payload: SyncRangeRequest, authorization: str | None = Header(default=None)) -> SyncRangeOutput:
    require_authorization(authorization)
    cookie_file = resolve_cookie_file()
    client = build_client(cookie_file)
    start, end = sorted([parse_date(payload.start_date), parse_date(payload.end_date)])

    nutrition_days = []
    cursor = start
    while cursor <= end:
        nutrition_days.append(nutrition_day_from_mfp(client.get_date(cursor)))
        cursor += timedelta(days=1)

    return SyncRangeOutput(
        nutrition_days=nutrition_days,
        body_metrics=collect_body_metrics(client, start, end),
    )


@app.post("/api/mfp/renpho/sync")
def sync_renpho(payload: RenphoSyncRequest, authorization: str | None = Header(default=None)) -> RenphoSyncOutput:
    require_authorization(authorization)
    email = os.environ.get("RENPHO_EMAIL")
    password = os.environ.get("RENPHO_PASSWORD")
    if not email or not password:
        raise HTTPException(status_code=500, detail="RENPHO_EMAIL and RENPHO_PASSWORD are required")

    try:
        client = AreaAwareRenphoClient(
            email,
            password,
            area_code=os.environ.get("RENPHO_AREA_CODE", "US"),
        )
        measurements = client.get_all_measurements()
    except RenphoAPIError as error:
        raise HTTPException(status_code=401, detail=f"RENPHO authentication failed: {error}") from error

    start = parse_optional_date(payload.start_date)
    end = parse_optional_date(payload.end_date)
    metrics = [metric_from_measurement(item) for item in measurements]
    filtered = [
        metric
        for metric in metrics
        if (start is None or metric.measured_at[:10] >= start)
        and (end is None or metric.measured_at[:10] <= end)
    ]

    return RenphoSyncOutput(body_metrics=filtered)


def require_authorization(authorization: str | None) -> None:
    secret = os.environ.get("INTERNAL_WORKER_SECRET")
    if not secret:
        raise HTTPException(status_code=500, detail="INTERNAL_WORKER_SECRET is not configured")
    if authorization != f"Bearer {secret}":
        raise HTTPException(status_code=401, detail="Unauthorized")


def resolve_cookie_file() -> Path:
    cookie_text = os.environ.get("MFP_COOKIE_TEXT")
    cookie_base64 = os.environ.get("MFP_COOKIE_BASE64")
    if cookie_base64:
        cookie_text = base64.b64decode(cookie_base64).decode("utf-8")

    if cookie_text:
        path = Path(tempfile.gettempdir()) / "mfp-cookies.txt"
        path.write_text(cookie_text, encoding="utf-8")
        path.chmod(0o600)
        return path

    cookie_file = os.environ.get("MFP_COOKIE_FILE")
    if cookie_file:
        return Path(cookie_file)

    raise HTTPException(status_code=500, detail="Configure MFP_COOKIE_TEXT or MFP_COOKIE_BASE64")
