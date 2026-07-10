import json
from datetime import datetime
from typing import Annotated, Any, Optional

import typer
from pydantic import BaseModel
from renpho import RenphoAPIError, RenphoClient

app = typer.Typer(no_args_is_help=True)


class RenphoBodyMetric(BaseModel):
    source: str = "renpho"
    external_id: str
    measured_at: str
    weight_kg: float | None = None
    body_fat_percent: float | None = None
    lean_mass_kg: float | None = None
    metadata: dict[str, Any]


class RenphoSyncOutput(BaseModel):
    status: str = "ok"
    body_metrics: list[RenphoBodyMetric]


@app.command()
def sync(
    email: Annotated[str, typer.Option(help="RENPHO account email.")],
    password: Annotated[str, typer.Option(help="RENPHO account password.")],
    start_date: Annotated[Optional[str], typer.Option(help="Optional YYYY-MM-DD lower bound.")] = None,
    end_date: Annotated[Optional[str], typer.Option(help="Optional YYYY-MM-DD upper bound.")] = None,
) -> None:
    try:
        client = RenphoClient(email, password)
        measurements = client.get_all_measurements()
    except RenphoAPIError as error:
        typer.echo(json.dumps({"status": "authentication_failed", "message": str(error)}))
        raise typer.Exit(code=2) from error

    start = parse_optional_date(start_date)
    end = parse_optional_date(end_date)
    metrics = [metric_from_measurement(item) for item in measurements]
    filtered = [
        metric
        for metric in metrics
        if (start is None or metric.measured_at[:10] >= start) and (end is None or metric.measured_at[:10] <= end)
    ]

    typer.echo(RenphoSyncOutput(body_metrics=filtered).model_dump_json())


def metric_from_measurement(item: dict[str, Any]) -> RenphoBodyMetric:
    measured_at = normalize_timestamp(item)
    external_id = str(item.get("id") or item.get("timeStamp") or measured_at)

    return RenphoBodyMetric(
        external_id=external_id,
        measured_at=measured_at,
        weight_kg=number_or_none(item.get("weight")),
        body_fat_percent=number_or_none(item.get("bodyfat")),
        lean_mass_kg=number_or_none(item.get("sinew") or item.get("fatFreeWeight")),
        metadata={key: value for key, value in item.items() if key not in {"weight", "bodyfat", "sinew", "fatFreeWeight"}},
    )


def normalize_timestamp(item: dict[str, Any]) -> str:
    value = item.get("timeStamp") or item.get("timestamp") or item.get("createdAt")
    if isinstance(value, (int, float)):
        timestamp = value / 1000 if value > 10_000_000_000 else value
        return datetime.fromtimestamp(timestamp).isoformat()

    if isinstance(value, str):
        if value.isdigit():
            return normalize_timestamp({"timeStamp": int(value)})
        return value.replace(" ", "T")

    return datetime.utcnow().isoformat()


def number_or_none(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_optional_date(value: str | None) -> str | None:
    if not value:
        return None

    try:
        return datetime.fromisoformat(value).date().isoformat()
    except ValueError:
        raise typer.BadParameter("Date must use YYYY-MM-DD format") from None
