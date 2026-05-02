"""
FastAPI server exposing two routes:

  POST /agent      — AG-UI / SSE endpoint for text chat (CopilotKit talks here)
  WS   /voice      — Gemini Live API bidirectional voice (separate from AG-UI)
  GET  /memories   — Inspect raw memories (debug/demo helper)

The two agent-facing routes deliberately use different transports because
AG-UI is SSE and Live API is WebSocket. Do not try to merge them.
"""

import os
import json
import asyncio
import base64
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import vertexai
from google.adk.memory import VertexAiMemoryBankService
from google.adk.sessions import VertexAiSessionService
from google.adk.runners import Runner
from google.genai import types

from ag_ui_adk import ADKAgent, add_adk_fastapi_endpoint

from crossfit_coach import root_agent

load_dotenv()

PROJECT = os.environ["GOOGLE_CLOUD_PROJECT"]
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
APP_NAME = os.environ.get("APP_NAME", "crossfit_memory_demo")
DEFAULT_USER_ID = os.environ.get("DEFAULT_USER_ID", "demo_athlete")
AGENT_ENGINE_ID = os.environ["AGENT_ENGINE_ID"]  # required

# --- Shared services (real Memory Bank, real Sessions — NOT in-memory) -----

vertex_client = vertexai.Client(project=PROJECT, location=LOCATION)

memory_service = VertexAiMemoryBankService(
    project=PROJECT,
    location=LOCATION,
    agent_engine_id=AGENT_ENGINE_ID,
)

session_service = VertexAiSessionService(
    project=PROJECT,
    location=LOCATION,
    agent_engine_id=AGENT_ENGINE_ID,
)

# --- AG-UI middleware --------------------------------------------------------
# IMPORTANT: use_in_memory_services=False is the whole point. The CopilotKit
# scaffold defaults this to True for its proverbs demo; we override.
adk_agent = ADKAgent(
    adk_agent=root_agent,
    app_name=APP_NAME,
    user_id=DEFAULT_USER_ID,
    session_timeout_seconds=120,   # short so cleanup saves to Memory Bank quickly
    cleanup_interval_seconds=30,   # check for expired sessions every 30s
    use_in_memory_services=False,
    session_service=session_service,
    memory_service=memory_service,
)


_extracted_sessions: set[str] = set()

# Full resource name — required for all Vertex AI Memory Bank API calls.
_FULL_RESOURCE_NAME = (
    f"projects/{PROJECT}/locations/{LOCATION}/reasoningEngines/{AGENT_ENGINE_ID}"
)


async def _memory_extraction_loop() -> None:
    """Background task: extract memories from recent sessions every 30 seconds.

    Uses vertex_session_source so Memory Bank reads session events directly
    from Vertex AI rather than us extracting and passing them manually.
    """
    while True:
        await asyncio.sleep(30)
        try:
            result = await session_service.list_sessions(
                app_name=APP_NAME, user_id=DEFAULT_USER_ID
            )
            for s in result.sessions or []:
                if s.id in _extracted_sessions:
                    continue
                full_session_name = (
                    f"{_FULL_RESOURCE_NAME}/sessions/{s.id}"
                )
                vertex_client.agent_engines.memories.generate(
                    name=_FULL_RESOURCE_NAME,
                    vertex_session_source={"session": full_session_name},
                    scope={"user_id": DEFAULT_USER_ID},
                    config={"wait_for_completion": True},
                )
                _extracted_sessions.add(s.id)
                print(f"[MEMORY] extracted session {s.id}", flush=True)
        except Exception as e:
            print(f"[MEMORY] background extractor error: {e}", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_memory_extraction_loop())
    yield
    task.cancel()


app = FastAPI(title="CrossFit Memory Demo", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the AG-UI endpoint at /agent — CopilotKit's runtime will POST here.
add_adk_fastapi_endpoint(app, adk_agent, path="/agent")


# Managed topic enum values from Memory Bank — used to classify topic_type.
# All four managed topics provided by Memory Bank by default.
_MANAGED_TOPICS = {
    "USER_PERSONAL_INFO",
    "USER_PREFERENCES",
    "KEY_CONVERSATION_DETAILS",
    "EXPLICIT_INSTRUCTIONS",
}


def _extract_topic(m) -> str | None:
    """Extract the topic label from a Memory object.

    The SDK may return topic data as a simple `topic` string (older path) or
    as a `topics` list of MemoryTopicId objects (newer Pydantic path). Handle
    both so we stay compatible across SDK versions.
    """
    topic = getattr(m, "topic", None)
    if topic:
        return str(topic)
    topics = getattr(m, "topics", None)
    if topics:
        t = topics[0]
        label = getattr(t, "custom_memory_topic_label", None)
        if label:
            return label
        managed = getattr(t, "managed_memory_topic", None)
        if managed:
            return str(managed)
    return None


# --- Memory inspection endpoint (demo helper) -------------------------------
@app.get("/memories")
async def list_memories(user_id: str = DEFAULT_USER_ID):
    """List the raw memories Memory Bank has extracted for a user.

    Useful for the demo's 'Memory Inspector' panel — lets the audience see
    Gemini's structured extractions in real time.
    """
    resource_name = _FULL_RESOURCE_NAME
    memories = list(
        vertex_client.agent_engines.memories.list(name=resource_name)
    )
    return {
        "user_id": user_id,
        "count": len(memories),
        "memories": [
            {
                "name": m.name,
                "fact": m.fact,
                "topic": _extract_topic(m),
                "topic_type": (
                    "managed"
                    if _extract_topic(m) in _MANAGED_TOPICS
                    else "custom"
                ),
                "create_time": str(getattr(m, "create_time", "")),
                "update_time": str(getattr(m, "update_time", "")),
            }
            for m in memories
        ],
    }


# --- Live API voice route (Phase 2) -----------------------------------------
@app.websocket("/voice")
async def voice_endpoint(ws: WebSocket):
    """Bidirectional voice via Gemini Live API.

    Client protocol (JSON over WebSocket):
        {"type": "audio", "data": "<base64 PCM 16kHz mono>"}
        {"type": "end_turn"}
    Server emits:
        {"type": "audio", "data": "<base64 PCM 24kHz mono>"}
        {"type": "transcript", "text": "...", "role": "user"|"model"}
        {"type": "turn_complete"}

    This route shares the same ADK agent + Memory Bank as /agent, so anything
    said via voice contributes to the same memory store as text chat.
    """
    await ws.accept()

    runner = Runner(
        app_name=APP_NAME,
        agent=root_agent,
        session_service=session_service,
        memory_service=memory_service,
    )

    # One session per WebSocket connection
    session = await session_service.create_session(
        app_name=APP_NAME, user_id=DEFAULT_USER_ID
    )

    from google.adk.agents.run_config import RunConfig
    from google.adk.agents import LiveRequestQueue

    live_queue = LiveRequestQueue()
    run_config = RunConfig(response_modalities=["AUDIO"])

    async def upstream():
        """Client -> Live API"""
        try:
            while True:
                msg = await ws.receive_text()
                payload = json.loads(msg)
                if payload["type"] == "audio":
                    pcm = base64.b64decode(payload["data"])
                    live_queue.send_realtime(
                        types.Blob(mime_type="audio/pcm;rate=16000", data=pcm)
                    )
                elif payload["type"] == "end_turn":
                    live_queue.close()
                    break
        except WebSocketDisconnect:
            live_queue.close()

    async def downstream():
        """Live API -> client"""
        async for event in runner.run_live(
            session=session, live_request_queue=live_queue, run_config=run_config
        ):
            for part in event.content.parts if event.content else []:
                if part.inline_data and part.inline_data.mime_type.startswith("audio/"):
                    await ws.send_text(json.dumps({
                        "type": "audio",
                        "data": base64.b64encode(part.inline_data.data).decode(),
                    }))
                if part.text:
                    role = event.content.role or "model"
                    await ws.send_text(json.dumps({
                        "type": "transcript",
                        "text": part.text,
                        "role": role,
                    }))
            if event.turn_complete:
                await ws.send_text(json.dumps({"type": "turn_complete"}))

    try:
        await asyncio.gather(upstream(), downstream())
    except Exception as e:
        await ws.send_text(json.dumps({"type": "error", "message": str(e)}))
    finally:
        # Trigger memory extraction for the voice session too.
        await memory_service.add_session_to_memory(session)
        await ws.close()


@app.get("/health")
async def health():
    return {"status": "ok", "agent_engine_id": AGENT_ENGINE_ID}


@app.get("/debug/memory")
async def debug_memory():
    """Quick check: can we reach Memory Bank and how many memories exist?"""
    try:
        resource_name = _FULL_RESOURCE_NAME
        memories = list(
            vertex_client.agent_engines.memories.list(name=resource_name)
        )
        return {
            "status": "ok",
            "agent_engine_id": AGENT_ENGINE_ID,
            "memory_count": len(memories),
            "sample": [
                {"fact": m.fact, "topic": _extract_topic(m)}
                for m in memories[:3]
            ],
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


@app.get("/debug/sessions")
async def debug_sessions():
    """Inspect sessions and what events they contain."""
    try:
        result = await session_service.list_sessions(
            app_name=APP_NAME, user_id=DEFAULT_USER_ID
        )
        sessions_info = []
        for s in (result.sessions or [])[:5]:
            session = await session_service.get_session(
                app_name=APP_NAME, user_id=DEFAULT_USER_ID, session_id=s.id
            )
            events_summary = []
            for e in (session.events if session else []):
                content = e.content
                if content and content.parts:
                    for part in content.parts:
                        if part.text:
                            events_summary.append({
                                "role": content.role,
                                "text_preview": part.text[:100],
                            })
            sessions_info.append({
                "id": s.id,
                "event_count": len(session.events) if session else 0,
                "text_events": events_summary,
            })
        return {"sessions": sessions_info}
    except Exception as e:
        return {"status": "error", "error": str(e)}


@app.post("/debug/extract-latest-session")
async def debug_extract_latest():
    """Run generate() on the latest session and return the full Memory Bank response."""
    try:
        result = await session_service.list_sessions(
            app_name=APP_NAME, user_id=DEFAULT_USER_ID
        )
        if not result.sessions:
            return {"status": "no sessions found"}
        latest = result.sessions[0]
        full_session_name = f"{_FULL_RESOURCE_NAME}/sessions/{latest.id}"
        op = vertex_client.agent_engines.memories.generate(
            name=_FULL_RESOURCE_NAME,
            vertex_session_source={"session": full_session_name},
            scope={"user_id": DEFAULT_USER_ID},
            config={"wait_for_completion": True},
        )
        generated = []
        if op.response and hasattr(op.response, "generated_memories"):
            for gm in op.response.generated_memories or []:
                generated.append({
                    "action": str(getattr(gm, "action", "?")),
                    "fact": getattr(gm.memory, "fact", "?") if gm.memory else "?",
                })
        return {
            "session_id": latest.id,
            "session_name": full_session_name,
            "done": op.done,
            "generated_memories": generated,
            "raw_response": str(op.response),
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}


@app.post("/debug/write-test-memory")
async def write_test_memory():
    """Directly write a test memory to verify the Memory Bank write path."""
    try:
        resource_name = _FULL_RESOURCE_NAME
        vertex_client.agent_engines.memories.generate(
            name=resource_name,
            direct_memories_source={
                "direct_memories": [
                    {"fact": "Test memory written directly via debug endpoint."}
                ]
            },
            scope={"user_id": DEFAULT_USER_ID},
            config={"wait_for_completion": True},
        )
        # Read back to confirm
        memories = list(
            vertex_client.agent_engines.memories.list(name=resource_name)
        )
        return {
            "status": "ok",
            "memory_count_after_write": len(memories),
            "sample": [{"fact": m.fact} for m in memories[:3]],
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}
