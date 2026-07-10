from fastapi import FastAPI

app = FastAPI(title="Fitness MFP Collector")


@app.get("/api/mfp/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "mfp"}
