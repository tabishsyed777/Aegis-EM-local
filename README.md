# Aegis-EM Command Center

A real-time incident dashboard prototype with two modes: an always-available browser simulation and an optional API stream for incidents from a data source you are authorized to use.

## Current GitHub Pages demo

Open the [live demo](https://tabishsyed777.github.io/Aegis-EM-local/). It runs a browser-only simulation and adds sample events while the page is open. The **Run demo incident** button animates the response flow. No actual emergency reports, AI model, GIS feed, dispatch system, or alert service is connected.

## Run the realtime API locally

```sh
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export INGEST_API_KEY='replace-with-a-long-random-secret'
export ALLOWED_ORIGINS='http://localhost:8000,https://tabishsyed777.github.io'
uvicorn main:app --reload --port 8000
```

The API provides `GET /api/health`, `GET /api/incidents`, and `GET /api/events` (Server-Sent Events). A configured upstream source can submit authorized incident records to `POST /api/incidents` with `Authorization: Bearer <INGEST_API_KEY>`.

Example payload:

```json
{
  "source_id": "source-record-123",
  "title": "Road obstruction reported",
  "category": "Traffic obstruction",
  "severity": "P3",
  "location": "Mumbai, India",
  "summary": "Lane blocked by debris",
  "source": "your-authorized-feed"
}
```

The API keeps recent events in memory, so a restart clears them. For a public production service, add persistent storage, request signing or OAuth, rate limiting, audit logging, monitoring, and a vetted feed adapter before handling operational data.

## Connect the hosted dashboard

Deploy the `backend` folder as an ASGI service that runs `uvicorn main:app --host 0.0.0.0 --port $PORT`. Set `INGEST_API_KEY` and `ALLOWED_ORIGINS` on that backend. Then set `apiBase` in `api-config.js` to the backend's HTTPS base URL and push the change; GitHub Pages will redeploy automatically.

GitHub Pages only hosts the static dashboard; the backend must run on a separate service. Until the backend URL and an authorized incident feed are configured, the hosted page remains in simulation mode. The commander approval control is a demo only and never dispatches units or sends public alerts.
