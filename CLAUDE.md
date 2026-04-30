# CrossFit Performance Memory — CLAUDE.md

> Guide for Claude Code working in this repo. Read this first, every session.

## What this project is

A demo app showcasing **Vertex AI Memory Bank** on Google's Gemini Enterprise Agent
Platform. The user talks (text or voice) to a "CrossFit Coach" agent about today's
workout; the agent extracts structured performance facts (times, weights, PRs,
routines, scaling) and persists them in Memory Bank. Later, the user can ask
"What's my Fran PR?" or "How's my back squat trending?" and the agent retrieves
relevant memories.

This is a **demo**, not a production app. Optimize for clarity, smooth happy
path, and a sleek-but-simple UI. Do not over-engineer.

## Stack (canonical — do not substitute without asking)

| Layer | Choice | Why |
|---|---|---|
| Agent framework | **Google ADK** (Python) | First-class Memory Bank integration via `VertexAiMemoryBankService` |
| Memory | **Vertex AI Memory Bank** (GA) | The thing we're showcasing |
| LLM | **Gemini 2.5 Flash** for chat, Gemini for memory extraction (managed) | Cost/latency for demo |
| Frontend protocol | **AG-UI** (SSE-based) | Recommended ADK frontend path |
| Frontend framework | **Next.js 15 + CopilotKit** (React) | Ships AG-UI client + chat UI components |
| Bridge | **`ag_ui_adk`** middleware on **FastAPI** | Standard ADK→AG-UI adapter |
| Voice (phase 2) | **ADK Gemini Live API Toolkit** over WebSocket | Separate route from AG-UI; do not try to merge them |
| Deploy target | **Agent Engine Runtime** on GCP | Native Memory Bank attachment |

**Hard rules:**
- Do **not** swap out CopilotKit for a custom WebSocket chat UI. AG-UI is the
  point.
- Do **not** put Live API voice traffic through the AG-UI endpoint. They're
  different protocols (SSE vs. WebSocket). Keep them as separate routes.
- Do **not** use `InMemoryMemoryService` outside of unit tests. The demo's whole
  point is persistent memory.
- Do **not** add LangChain, LangGraph, or CrewAI. ADK is the framework.

## Repo layout

```
crossfit-memory/
├── CLAUDE.md                       ← you are here
├── README.md                       ← human setup walkthrough
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── server.py                   ← FastAPI + AG-UI middleware + Live API WS route
│   └── crossfit_coach/
│       ├── __init__.py             ← exports root_agent
│       ├── agent.py                ← ADK Agent definition + tools
│       ├── memory_setup.py         ← Agent Engine + Memory Bank topic config
│       └── prompts.py              ← system prompt
└── frontend/                       ← scaffolded by `npx copilotkit@latest create -f adk`
    ├── app/page.tsx                ← main UI (heavily customized)
    ├── app/api/copilotkit/route.ts ← proxies to backend AG-UI endpoint
    └── components/                 ← PR cards, timeline, etc.
```

## Memory Bank model — read carefully

Memory Bank is **not** a database you `INSERT` into. It's a managed service that:

1. Watches a Session's event stream (Agent Engine Sessions = short-term
   conversation history).
2. When you call `add_session_to_memory()`, it asynchronously runs Gemini to
   **extract** structured memories from those events, scoped to a `user_id`.
3. When the agent calls `search_memory()`, it does semantic retrieval over those
   extracted memories.

**Key implication for our domain:** the quality of extraction depends on
**memory topics** (the schema we tell Memory Bank to extract against). Defaults
will give you generic preference memories. We override topics to be CrossFit-
specific:

- `personal_records` — lift/movement, weight (kg/lb), reps, date
- `workout_results` — WOD name (e.g., "Fran", "Murph"), time or score, RX/scaled
- `recurring_routines` — programs the user follows (e.g., "Comptrain", "5/3/1")
- `physical_state` — injuries, soreness, mobility limits, recovery
- `goals` — active training goals (e.g., "first muscle-up", "sub-3 Fran")

Topic config lives in `backend/crossfit_coach/memory_setup.py`. If you change
the topics, you must recreate the Agent Engine instance — topics are bound at
instance creation time.

## Memory lifecycle in our app (the flow Claude Code must preserve)

```
1. User: "Did Fran today, 3:42 RX, felt smooth"
2. Runner stores event in Agent Engine Session
3. PreloadMemoryTool runs at turn start → searches Memory Bank → injects context
4. Agent responds: "Nice — that's 8 seconds off your previous Fran PR of 3:50."
5. After-turn callback → memory_service.add_session_to_memory(session)
6. Memory Bank (async, background) → Gemini extracts:
     - workout_results: { wod: "Fran", time: "3:42", rx: true, date: <today> }
     - personal_records: { exercise: "Fran", time: "3:42", date: <today> }
7. Next session, "What's my Fran PR?" → search_memory("Fran PR") returns
   the extracted record.
```

The after-turn callback is **mandatory**. Without it, no memories get extracted.
ADK does NOT auto-trigger `add_session_to_memory` — it must be wired in
`agent.py` via an `after_agent_callback`.

## Conventions

### Python
- Python 3.11+
- `uv` for package management locally (compatible with `pip install -r`)
- Type hints on all function signatures
- Use `async`/`await` end-to-end — ADK is async-first
- Logging: `structlog` if you add anything; otherwise stdlib `logging`
- Don't catch broad `Exception` in agent code; let ADK handle it

### TypeScript / Frontend
- Next.js 15 App Router (the scaffold default)
- `@copilotkit/react-core/v2` (the v2 namespace — important)
- Tailwind for styling — the scaffold sets this up
- Keep the page minimal: chat sidebar + a "PR dashboard" panel that uses
  `useCoAgentStateRender` to show extracted memories live
- No state-management library beyond CopilotKit's `useCoAgent` and React state

### Naming
- Agent: `crossfit_coach`
- App name (passed to ADK + Memory Bank): `crossfit_memory_demo`
- Default user_id for the demo: `demo_athlete` (single-user demo; no auth)

### Environment variables (loaded from `.env`, never committed)
```
GOOGLE_CLOUD_PROJECT=<your-project>
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_GENAI_USE_VERTEXAI=TRUE
AGENT_ENGINE_ID=<populated by memory_setup.py on first run>
APP_NAME=crossfit_memory_demo
DEFAULT_USER_ID=demo_athlete
```

The `AGENT_ENGINE_ID` is created by running `python -m crossfit_coach.memory_setup`
once — it provisions the Agent Engine + Memory Bank instance and prints the ID.
Paste that into `.env`.

## Authentication (local dev on Windows)

The user develops on Windows. Authenticate with:
```powershell
gcloud auth application-default login
gcloud config set project <your-project>
gcloud services enable aiplatform.googleapis.com
```

Application Default Credentials (ADC) is what `vertexai.Client()` and
`VertexAiMemoryBankService` will pick up. Do NOT pass API keys for Memory Bank
— it requires ADC.

## Running locally

Two terminals:

**Terminal 1 — backend:**
```powershell
cd backend
uv venv
.venv\Scripts\activate
uv pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

**Terminal 2 — frontend:**
```powershell
cd frontend
pnpm dev
# http://localhost:3000
```

## Tasks Claude Code should know how to do

When the user asks for these, here's the right place to make changes:

| Task | File(s) |
|---|---|
| Change agent personality | `backend/crossfit_coach/prompts.py` |
| Add a new memory topic (e.g., nutrition, sleep) | `backend/crossfit_coach/memory_setup.py` — then user must re-run setup script |
| Add a backend tool (e.g., calculate 1RM) | `backend/crossfit_coach/agent.py` — add to `tools=[...]` |
| Add a frontend dashboard widget | `frontend/components/` + wire via `useCoAgent` in `app/page.tsx` |
| Render a PR card from a tool call | `frontend/app/page.tsx` — use `useRenderToolCall` from CopilotKit |
| Add voice input | `backend/server.py` (Live API WS route) + `frontend/components/VoiceButton.tsx` |
| Inspect what's in Memory Bank | Use the Agent Engine SDK directly: `client.agent_engines.get(...).list_memories(scope={"user_id": "demo_athlete"})` |

## Things that have bitten people before

1. **Memory Bank doesn't extract memories until you call `add_session_to_memory`.**
   If the demo "isn't remembering," check the after-turn callback is firing.

2. **Memory extraction is asynchronous.** A memory written this turn might not
   be retrievable for ~10 seconds. For the demo, wait between "log workout" and
   "query workout" actions, or close the session first.

3. **`use_in_memory_services=True` in `ADKAgent` middleware bypasses Memory
   Bank entirely.** The CopilotKit scaffold sets this for the proverbs demo.
   Set it to `False` and pass real services. This is the #1 bug.

4. **Topic schemas can't be edited in place.** If you need different topics,
   create a new Agent Engine instance.

5. **`adk web` and our FastAPI server are two different runtimes.** The scaffold
   uses FastAPI + AG-UI; do not also run `adk web` against the same agent for
   testing — sessions diverge.

6. **Live API ≠ AG-UI.** Live API is a WebSocket bidirectional voice protocol;
   AG-UI is SSE for text/tools. They share the agent but live on different
   routes.

## When in doubt

- Memory Bank docs: https://cloud.google.com/vertex-ai/generative-ai/docs/agent-engine/memory-bank/overview
- ADK memory docs: https://google.github.io/adk-docs/sessions/memory/
- AG-UI + ADK: https://google.github.io/adk-docs/integrations/ag-ui/
- CopilotKit ADK: https://docs.copilotkit.ai/adk
- Live API toolkit: https://google.github.io/adk-docs/streaming/

Ask before adding new dependencies or significantly changing the architecture.
