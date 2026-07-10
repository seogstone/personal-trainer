import http.cookiejar
import json
from datetime import date, timedelta
from pathlib import Path
from typing import Annotated, Any

import myfitnesspal
import typer
from pydantic import BaseModel, Field

app = typer.Typer(no_args_is_help=True)


class NutritionMeal(BaseModel):
    meal_name: str
    position: int
    calories: float | None = None
    protein_g: float | None = None
    carbohydrate_g: float | None = None
    fat_g: float | None = None
    items: list[dict[str, Any]] = Field(default_factory=list)


class NutritionDay(BaseModel):
    source: str = "myfitnesspal"
    calendar_date: date
    calories_consumed: float | None = None
    protein_g: float | None = None
    carbohydrate_g: float | None = None
    fat_g: float | None = None
    fibre_g: float | None = None
    sugar_g: float | None = None
    sodium_mg: float | None = None
    water_ml: float | None = None
    goal_calories: float | None = None
    goal_protein_g: float | None = None
    goal_carbohydrate_g: float | None = None
    goal_fat_g: float | None = None
    complete: bool = False
    meals: list[NutritionMeal] = Field(default_factory=list)


class BodyMetric(BaseModel):
    source: str = "myfitnesspal"
    measured_at: date
    weight_kg: float | None = None
    body_fat_percent: float | None = None


class SyncRangeOutput(BaseModel):
    status: str = "ok"
    nutrition_days: list[NutritionDay]
    body_metrics: list[BodyMetric]


@app.command()
def sync_day(
    day: Annotated[str, typer.Argument(help="Diary date to collect, YYYY-MM-DD.")],
    cookie_file: Annotated[Path, typer.Option(help="Mozilla-format browser cookie jar path.")],
) -> None:
    client = build_client(cookie_file)
    payload = nutrition_day_from_mfp(client.get_date(parse_date(day)))
    typer.echo(payload.model_dump_json())


@app.command()
def sync_range(
    start_date: Annotated[str, typer.Argument(help="First diary date to collect, YYYY-MM-DD.")],
    end_date: Annotated[str, typer.Argument(help="Last diary date to collect, YYYY-MM-DD.")],
    cookie_file: Annotated[Path, typer.Option(help="Mozilla-format browser cookie jar path.")],
) -> None:
    client = build_client(cookie_file)
    start, end = sorted([parse_date(start_date), parse_date(end_date)])

    nutrition_days: list[NutritionDay] = []
    cursor = start
    while cursor <= end:
        nutrition_days.append(nutrition_day_from_mfp(client.get_date(cursor)))
        cursor += timedelta(days=1)

    body_metrics = collect_body_metrics(client, start, end)
    payload = SyncRangeOutput(nutrition_days=nutrition_days, body_metrics=body_metrics)
    typer.echo(payload.model_dump_json())


def build_client(cookie_file: Path) -> myfitnesspal.Client:
    if not cookie_file.exists() or cookie_file.stat().st_size == 0:
        payload = {"status": "reauthentication_required", "reason": "missing_cookie_file"}
        typer.echo(json.dumps(payload))
        raise typer.Exit(code=2)

    jar = http.cookiejar.MozillaCookieJar(str(cookie_file))
    jar.load(ignore_discard=True, ignore_expires=True)
    return myfitnesspal.Client(cookiejar=jar)


def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise typer.BadParameter("Date must use YYYY-MM-DD format") from None


def nutrition_day_from_mfp(day: Any) -> NutritionDay:
    totals = normalize_totals(getattr(day, "totals", {}) or {})
    goals = normalize_totals(getattr(day, "goals", {}) or {})

    return NutritionDay(
        calendar_date=getattr(day, "date"),
        calories_consumed=totals.get("calories"),
        protein_g=totals.get("protein"),
        carbohydrate_g=totals.get("carbohydrates"),
        fat_g=totals.get("fat"),
        fibre_g=totals.get("fiber") or totals.get("fibre"),
        sugar_g=totals.get("sugar"),
        sodium_mg=totals.get("sodium"),
        water_ml=normalize_water_ml(getattr(day, "water", None)),
        goal_calories=goals.get("calories"),
        goal_protein_g=goals.get("protein"),
        goal_carbohydrate_g=goals.get("carbohydrates"),
        goal_fat_g=goals.get("fat"),
        complete=bool(getattr(day, "complete", False)),
        meals=[meal_from_mfp(meal, position) for position, meal in enumerate(getattr(day, "meals", []))],
    )


def meal_from_mfp(meal: Any, position: int) -> NutritionMeal:
    totals = normalize_totals(getattr(meal, "totals", {}) or {})
    entries = []

    for entry in getattr(meal, "entries", []):
        entry_totals = normalize_totals(getattr(entry, "totals", {}) or {})
        entries.append(
            {
                "name": getattr(entry, "name", None),
                "brand": getattr(entry, "brand", None),
                "nutrition": entry_totals,
            }
        )

    return NutritionMeal(
        meal_name=str(getattr(meal, "name", f"meal-{position + 1}")),
        position=position,
        calories=totals.get("calories"),
        protein_g=totals.get("protein"),
        carbohydrate_g=totals.get("carbohydrates"),
        fat_g=totals.get("fat"),
        items=entries,
    )


def collect_body_metrics(client: myfitnesspal.Client, start: date, end: date) -> list[BodyMetric]:
    metrics: dict[date, BodyMetric] = {}

    for measured_at, weight in get_measurements_if_available(client, "Weight", start, end).items():
        metrics[measured_at] = BodyMetric(measured_at=measured_at, weight_kg=float(weight))

    for measured_at, body_fat in get_measurements_if_available(client, "Body Fat", start, end).items():
        existing = metrics.get(measured_at, BodyMetric(measured_at=measured_at))
        existing.body_fat_percent = float(body_fat)
        metrics[measured_at] = existing

    return list(metrics.values())


def get_measurements_if_available(
    client: myfitnesspal.Client, measurement: str, start: date, end: date
) -> dict[date, float]:
    try:
        return dict(client.get_measurements(measurement, start, end))
    except ValueError:
        return {}


def normalize_totals(values: dict[str, Any]) -> dict[str, float]:
    return {key: normalize_number(value) for key, value in values.items() if normalize_number(value) is not None}


def normalize_number(value: Any) -> float | None:
    if value is None:
        return None

    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_water_ml(value: Any) -> float | None:
    number = normalize_number(value)
    if number is None:
        return None

    return number
