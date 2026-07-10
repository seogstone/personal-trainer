import json
from datetime import date
from pathlib import Path
from typing import Annotated

import typer
from pydantic import BaseModel

app = typer.Typer(no_args_is_help=True)


class NutritionDay(BaseModel):
    source: str = "myfitnesspal"
    calendar_date: date
    calories_consumed: int | None = None
    protein_g: float | None = None
    carbohydrate_g: float | None = None
    fat_g: float | None = None
    complete: bool = False


@app.command()
def sync_day(
    day: Annotated[date, typer.Argument(help="Diary date to collect.")],
    cookie_file: Annotated[Path, typer.Option(help="Browser cookie file or jar path.")],
) -> None:
    if not cookie_file.exists():
        payload = {"status": "reauthentication_required", "calendar_date": day.isoformat()}
        typer.echo(json.dumps(payload))
        raise typer.Exit(code=2)

    payload = NutritionDay(calendar_date=day)
    typer.echo(payload.model_dump_json())
