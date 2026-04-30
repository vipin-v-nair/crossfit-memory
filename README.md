# CrossFit Performance Memory

A demo app that showcases **Vertex AI Memory Bank** on Google's Gemini Enterprise
Agent Platform. Talk to a CrossFit coach about your workouts, and Gemini
extracts and persists structured performance facts (PRs, times, weights,
routines, goals) that you can query later.

**Stack:** ADK (Python) · Memory Bank · AG-UI · CopilotKit · Next.js · Gemini 2.5

---

## Prerequisites

- Python 3.11+
- Node.js 20+ and `pnpm` (or `npm`)
- Google Cloud project with billing enabled
- `gcloud` CLI installed

## Setup

### 1. Clone & enable APIs

```powershell
gcloud config set project YOUR_PROJECT_ID
gcloud services enable aiplatform.googleapis.com
gcloud auth application-default login
```

### 2. Backend — Python + ADK

```powershell
cd backend
copy .env.example .env
# Edit .env and set GOOGLE_CLOUD_PROJECT
```

Create a venv and install:

```powershell
uv venv
.venv\Scripts\activate
uv pip install -r requirements.txt
```

(If you don't use `uv`, plain `python -m venv .venv` + `pip install -r requirements.txt` works fine.)

### 3. Provision Agent Engine + Memory Bank (one-time)

This creates the Memory Bank instance with CrossFit-specific extraction topics:

```powershell
python -m crossfit_coach.memory_setup
```

Copy the printed `AGENT_ENGINE_ID` into your `.env`.

### 4. Frontend — bootstrap with the CopilotKit scaffold

From the project root (one level above `backend/`):

```powershell
npx copilotkit@latest create -f adk -n frontend
cd frontend
pnpm install
```

When the scaffold finishes, **replace two files** with the versions from
`frontend-snippets/` in this repo:

- `frontend/app/page.tsx` ← from `frontend-snippets/page.tsx`
- `frontend/app/api/copilotkit/route.ts` ← from `frontend-snippets/route.ts`

### 5. Run

**Terminal 1 — backend:**
```powershell
cd backend
.venv\Scripts\activate
uvicorn server:app --reload --port 8000
```

**Terminal 2 — frontend:**
```powershell
cd frontend
pnpm dev
```

Open http://localhost:3000.

---

## Try it

1. **Log a workout:**
   > "Did Fran today, 3:42 RX. Felt smooth, thrusters were the limiter."

2. Wait ~10 seconds. The right-side **Memory Bank** panel should populate
   with extractions under `Workouts` and `PRs`.

3. **Log another:**
   > "Hit a 405 back squat 1RM yesterday. New PR by 10 pounds."

4. **Recall:**
   > "What's my Fran PR? And how's my back squat trending?"

The agent should answer from extracted memories, not from the chat history.

---

## What's where

| Path | What it does |
|---|---|
| `CLAUDE.md` | Project guide for Claude Code — read this first when developing |
| `backend/crossfit_coach/agent.py` | The ADK agent + after-turn memory callback |
| `backend/crossfit_coach/memory_setup.py` | Provisions Agent Engine with CrossFit memory topics |
| `backend/crossfit_coach/prompts.py` | Coach personality / system prompt |
| `backend/server.py` | FastAPI server: AG-UI endpoint + Live API voice WebSocket + memory inspector |
| `frontend-snippets/page.tsx` | Customized main UI (chat + live memory panel) |
| `frontend-snippets/route.ts` | CopilotKit runtime → backend wiring |

---

## Voice (Phase 2)

The backend already exposes `/voice` (WebSocket, Gemini Live API). To wire a
mic button into the frontend, see notes in `CLAUDE.md` → "Add voice input."

---

## Inspect what Memory Bank extracted

```powershell
curl http://localhost:8000/memories
```

Or hit it directly via the Agent Engine SDK in a Python REPL:

```python
import vertexai, os
client = vertexai.Client(project=os.environ["GOOGLE_CLOUD_PROJECT"])
ae = client.agent_engines.get(name=os.environ["AGENT_ENGINE_ID"])
for m in ae.list_memories(scope={"user_id": "demo_athlete"}):
    print(m.fact)
```

---

## Cost note

Memory Bank billing started Jan 2026. For a demo this is negligible (cents),
but if you leave the Agent Engine instance up indefinitely you'll accrue
session/memory storage charges. To clean up:

```python
client.agent_engines.delete(name=os.environ["AGENT_ENGINE_ID"])
```
