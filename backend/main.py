"""Small real-time incident intake API for the Aegis-EM dashboard prototype."""

from __future__ import annotations

import asyncio
import hmac
import json
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


class IncidentInput(BaseModel):
    source_id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=3, max_length=160)
    category: str = Field(default="Unclassified", max_length=80)
    severity: Literal["P1", "P2", "P3", "P4"] = "P3"
    location: str = Field(min_length=2, max_length=200)
    summary: str = Field(default="", max_length=1000)
    observed_at: datetime | None = None
    source: str = Field(default="authorized-feed", max_length=100)


listeners: set[asyncio.Queue[str]] = set()
incidents: list[dict] = []
last_demo_request: dict[str, float] = {}


async def publish(event: dict) -> None:
    payload = json.dumps(event, separators=(",", ":"))
    for queue in tuple(listeners):
        if queue.full():
            try:
                queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
        queue.put_nowait(payload)


def make_incident(item: IncidentInput, incident_id: str | None = None) -> dict:
    observed = item.observed_at or datetime.now(timezone.utc)
    incident = {
        "id": incident_id or f"INC-{uuid4().hex[:8].upper()}",
        "title": item.title,
        "category": item.category,
        "severity": item.severity,
        "location": item.location,
        "summary": item.summary,
        "source": item.source,
        "source_id": item.source_id,
        "time": observed.astimezone().strftime("%H:%M"),
        "received_at": datetime.now(timezone.utc).isoformat(),
        "status": "awaiting-commander-review",
    }
    return incident


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


app = FastAPI(title="Aegis-EM Realtime Intake", version="0.1.0", lifespan=lifespan)
origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",") if origin.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


async def require_ingest_key(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("INGEST_API_KEY", "")
    if not expected:
        raise HTTPException(status_code=503, detail="Incident intake is not configured.")
    supplied = authorization.removeprefix("Bearer ") if authorization else ""
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Invalid intake credentials.")


async def require_dashboard_key(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("DASHBOARD_API_KEY", "")
    if not expected:
        raise HTTPException(status_code=503, detail="Dashboard access is not configured.")
    supplied = authorization.removeprefix("Bearer ") if authorization else ""
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(status_code=401, detail="Invalid dashboard credentials.")


@app.get("/api/health")
async def health() -> dict:
    return {"ready": True, "service": "aegis-em-realtime-intake", "checked_at": datetime.now(timezone.utc).isoformat()}


@app.get("/api/incidents", dependencies=[Depends(require_dashboard_key)])
async def incident_snapshot() -> dict:
    return {"incidents": incidents[-100:], "count": len(incidents)}


@app.get("/api/events", dependencies=[Depends(require_dashboard_key)])
async def events(request: Request) -> StreamingResponse:
    queue: asyncio.Queue[str] = asyncio.Queue(maxsize=32)
    listeners.add(queue)

    async def stream():
        try:
            yield f"event: ready\ndata: {json.dumps({'count': len(incidents)})}\n\n"
            for incident in incidents[-100:]:
                yield f"event: incident\ndata: {json.dumps(incident, separators=(',', ':'))}\n\n"
            while not await request.is_disconnected():
                try:
                    payload = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"event: incident\ndata: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            listeners.discard(queue)

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/api/incidents", dependencies=[Depends(require_ingest_key)])
async def receive_incident(item: IncidentInput) -> dict:
    incident = make_incident(item)
    incidents.append(incident)
    del incidents[:-100]
    await publish(incident)
    return incident


@app.post("/api/demo/run")
async def run_demo(request: Request) -> dict:
    # Keep the public demo endpoint from being spammed. This is a lightweight
    # prototype guard, not a production rate limiter.
    client = request.client.host if request.client else "unknown"
    now = time.monotonic()
    if now - last_demo_request.get(client, 0) < 8:
        raise HTTPException(status_code=429, detail="Wait a few seconds before starting another demo run.")
    last_demo_request[client] = now
    demo = IncidentInput(
        source_id=f"demo-{uuid4().hex[:6]}",
        title="Multi-vehicle collision",
        category="Traffic collision",
        severity="P1",
        location="Western Express Highway · Andheri",
        summary="Simulated collision for the Aegis-EM demonstration.",
        source="demo-simulator",
    )
    incident = make_incident(demo)
    incidents.append(incident)
    del incidents[:-100]
    await publish(incident)
    return {"incident": incident, "mode": "simulation"}
