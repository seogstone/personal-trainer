from typer.testing import CliRunner

from fitness_mfp.cli import app


def test_missing_cookie_file_reports_reauthentication_required() -> None:
    result = CliRunner().invoke(app, ["sync-day", "2026-07-10", "--cookie-file", "/tmp/not-real"])

    assert result.exit_code == 2
    assert "reauthentication_required" in result.stdout
