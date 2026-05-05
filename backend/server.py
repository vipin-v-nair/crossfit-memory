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
from pydantic import BaseModel


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
_active_users: set[str] = {DEFAULT_USER_ID}

def extract_user_id(input_data) -> str:
    state = getattr(input_data, "state", {}) or {}
    headers = state.get("headers", {})
    user_id = headers.get("user_id")
    if user_id:
        _active_users.add(user_id)
        return user_id
    return DEFAULT_USER_ID

# IMPORTANT: use_in_memory_services=False is the whole point. The CopilotKit
# scaffold defaults this to True for its proverbs demo; we override.
adk_agent = ADKAgent(
    adk_agent=root_agent,
    app_name=APP_NAME,
    user_id_extractor=extract_user_id,
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
            for user_id in list(_active_users):
                result = await session_service.list_sessions(
                    app_name=APP_NAME, user_id=user_id
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
                        scope={"user_id": user_id},
                        config={"wait_for_completion": False},
                    )
                    _extracted_sessions.add(s.id)
                    print(f"[MEMORY] extracted session {s.id} for user {user_id}", flush=True)
        except Exception as e:
            print(f"[MEMORY] background extractor error: {e}", flush=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize active users from stored memories on startup
    try:
        all_memories = list(
            vertex_client.agent_engines.memories.list(name=_FULL_RESOURCE_NAME)
        )
        for m in all_memories:
            uid = getattr(m, "scope", {}).get("user_id")
            if uid:
                _active_users.add(uid)
        print(f"[STARTUP] Loaded active users from Memory Bank: {_active_users}", flush=True)
    except Exception as e:
        print(f"[STARTUP] Failed to load active users on startup: {e}", flush=True)

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
# Extract x-user-id from incoming request headers and inject it into state.headers
add_adk_fastapi_endpoint(app, adk_agent, path="/agent", extract_headers=["x-user-id"])



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

    custom_memory_topic_label is already a plain string.
    managed_memory_topic is a ManagedTopicEnum — use .value to get the
    raw string (e.g. "USER_PERSONAL_INFO"), not str() which returns
    "ManagedTopicEnum.USER_PERSONAL_INFO".
    """
    topics = getattr(m, "topics", None)
    if topics:
        t = topics[0]
        label = getattr(t, "custom_memory_topic_label", None)
        if label:
            return label
        managed = getattr(t, "managed_memory_topic", None)
        if managed:
            return managed.value if hasattr(managed, "value") else str(managed)
    # Fallback for older SDK paths that expose a plain `topic` string.
    topic = getattr(m, "topic", None)
    if topic:
        return str(topic)
    return None


@app.get("/users")
async def list_users():
    """Retrieve a list of all unique user IDs that have stored memories."""
    try:
        all_memories = list(
            vertex_client.agent_engines.memories.list(name=_FULL_RESOURCE_NAME)
        )
        users = set()
        for m in all_memories:
            uid = getattr(m, "scope", {}).get("user_id")
            if uid:
                users.add(uid)
        # Also ensure active users we tracked are included
        for uid in _active_users:
            users.add(uid)
        return {"users": sorted(list(users))}
    except Exception as e:
        return {"status": "error", "message": str(e)}


# --- Memory inspection endpoint (demo helper) -------------------------------
@app.get("/memories")
async def list_memories(user_id: str = DEFAULT_USER_ID):
    """List the raw memories Memory Bank has extracted for a user.

    Useful for the demo's 'Memory Inspector' panel — lets the audience see
    Gemini's structured extractions in real time.
    """
    resource_name = _FULL_RESOURCE_NAME
    all_memories = list(
        vertex_client.agent_engines.memories.list(name=resource_name)
    )
    # Filter memories by user_id scope, excluding structured profile memories
    memories = [
        m for m in all_memories
        if getattr(m, "scope", {}).get("user_id") == user_id
        and getattr(m, "structured_content", None) is None
    ]

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


class UpdateMemoryRequest(BaseModel):
    fact: str
    topic: str = None
    user_id: str = None


@app.delete("/memories/{memory_id}")
async def delete_memory(memory_id: str):
    """Delete a specific memory by ID."""
    full_name = f"projects/{PROJECT}/locations/{LOCATION}/reasoningEngines/{AGENT_ENGINE_ID}/memories/{memory_id}"
    vertex_client.agent_engines.memories.delete(name=full_name)
    return {"status": "deleted", "memory_id": memory_id}


@app.put("/memories/{memory_id}")
async def update_memory(memory_id: str, req: UpdateMemoryRequest):
    """Trigger consolidation to update a memory semantically, preserving history."""
    event = {
        "content": {
            "parts": [{"text": f"User corrected their memory: {req.fact}"}]
        }
    }
    
    vertex_client.agent_engines.memories.generate(
        name=_FULL_RESOURCE_NAME,
        scope={"user_id": req.user_id or DEFAULT_USER_ID},
        direct_contents_source={
            "events": [event]
        }
    )
    return {"status": "update_triggered"}


@app.get("/memories/{memory_id}/revisions")
async def list_memory_revisions(memory_id: str):
    """List historical revisions of a specific memory."""
    full_name = f"projects/{PROJECT}/locations/{LOCATION}/reasoningEngines/{AGENT_ENGINE_ID}/memories/{memory_id}"
    try:
        revisions = list(vertex_client.agent_engines.memories.revisions.list(name=full_name))
        # De-duplicate consecutive identical facts
        deduped = []
        prev_fact = None
        for r in revisions:
            if r.fact != prev_fact:
                deduped.append({
                    "fact": r.fact,
                    "create_time": str(getattr(r, "create_time", "")),
                })
                prev_fact = r.fact
                
        return {
            "memory_id": memory_id,
            "count": len(deduped),
            "revisions": deduped
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/profile")
async def get_athlete_profile(user_id: str = DEFAULT_USER_ID):
    """Retrieve the structured athlete profile from Memory Bank."""
    try:
        response = vertex_client.agent_engines.memories.retrieve_profiles(
            name=_FULL_RESOURCE_NAME,
            scope={"user_id": user_id}
        )
        
        profiles = response.profiles
        athlete_profile_obj = profiles.get("athlete_profile")
        if athlete_profile_obj and not getattr(athlete_profile_obj, "profile", {}):
            # Fallback: manually consolidate structured memories for this user
            all_memories = list(
                vertex_client.agent_engines.memories.list(name=_FULL_RESOURCE_NAME)
            )
            consolidated_profile = {}
            for m in all_memories:
                if getattr(m, "scope", {}).get("user_id") == user_id and getattr(m, "structured_content", None) is not None:
                    sc = m.structured_content
                    if hasattr(sc, "data") and isinstance(sc.data, dict):
                        consolidated_profile.update(sc.data)
                    elif isinstance(sc, dict) and isinstance(sc.get("data"), dict):
                        consolidated_profile.update(sc.get("data"))
            
            if consolidated_profile:
                athlete_profile_obj.profile = consolidated_profile
                print(f"[PROFILE FALLBACK] Successfully consolidated structured properties: {consolidated_profile}", flush=True)

        return {
            "user_id": user_id,
            "profiles": profiles
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}



@app.get("/profile/revisions")
async def get_athlete_profile_revisions(user_id: str = DEFAULT_USER_ID):
    """Retrieve historical revisions of the structured athlete profile."""
    try:
        all_memories = list(vertex_client.agent_engines.memories.list(name=_FULL_RESOURCE_NAME))
        profile_memories = [
            m for m in all_memories
            if getattr(m, "scope", {}).get("user_id") == user_id 
            and getattr(m, "structured_content", None) is not None
        ]
        
        revisions_data = []
        for pm in profile_memories:
            try:
                revs = list(vertex_client.agent_engines.memories.revisions.list(name=pm.name))
                for r in revs:
                    sd = getattr(r, "structured_data", None)
                    profile_dict = {}
                    if sd and isinstance(sd, dict):
                        profile_dict = sd
                    else:
                        sc = getattr(r, "structured_content", None)
                        if sc:
                            if hasattr(sc, "data") and isinstance(sc.data, dict):
                                profile_dict = sc.data
                            elif isinstance(sc, dict) and isinstance(sc.get("data"), dict):
                                profile_dict = sc.get("data")
                    
                    if profile_dict:
                        revisions_data.append({
                            "profile": profile_dict,
                            "create_time": str(getattr(r, "create_time", ""))
                        })
            except Exception as rev_err:
                print(f"[REVISION FALLBACK] Failed listing revisions for {pm.name}: {rev_err}", flush=True)

                
        revisions_data.sort(key=lambda x: x.get("create_time", ""))
        return {
            "user_id": user_id,
            "revisions": revisions_data
        }
    except Exception as e:
        print(f"[REVISIONS ERROR] {e}", flush=True)
        return {"status": "error", "message": str(e)}



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


