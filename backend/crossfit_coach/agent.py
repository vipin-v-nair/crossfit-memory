"""
CrossFit coach agent.

Wires together:
- Gemini 2.5 Flash as the LLM
- PreloadMemoryTool (runs at turn start, retrieves relevant memories)
- after_agent_callback (runs at turn end, ships the session to Memory Bank)
"""

import logging
import os
from typing import Any

from google.adk.agents import Agent
from google.adk.tools.preload_memory_tool import PreloadMemoryTool
from google.adk.agents.callback_context import CallbackContext

from crossfit_coach.prompts import COACH_INSTRUCTION

logger = logging.getLogger(__name__)


async def persist_to_memory_bank(callback_context: CallbackContext) -> None:
    """
    After-turn callback: ship the current session to Memory Bank so Gemini
    can extract structured memories asynchronously in the background.

    Without this callback, NO memories will ever get extracted. ADK does not
    auto-trigger memory generation — it must be wired here.
    """
    print("[MEMORY] persist_to_memory_bank: callback fired", flush=True)
    invocation = callback_context._invocation_context
    memory_service = invocation.memory_service
    if memory_service is None:
        print("[MEMORY] ERROR: memory_service is None — check ADKAgent wiring", flush=True)
        return

    try:
        session = invocation.session
        print(f"[MEMORY] triggering extraction for session {session.id} ({len(session.events)} events)", flush=True)
        await memory_service.add_events_to_memory(
            app_name=session.app_name,
            user_id=session.user_id,
            events=session.events,
            custom_metadata={"wait_for_completion": True},
        )
        print("[MEMORY] extraction triggered successfully", flush=True)
    except Exception as e:
        print(f"[MEMORY] extraction FAILED: {e}", flush=True)
        logger.exception("persist_to_memory_bank: extraction failed")


root_agent = Agent(
    name="crossfit_coach",
    model="gemini-2.5-flash",
    description=(
        "A CrossFit performance coach with persistent memory of the athlete's "
        "training history, PRs, workouts, routines, injuries, and goals."
    ),
    instruction=COACH_INSTRUCTION,
    # PreloadMemoryTool runs at the START of each turn, queries Memory Bank
    # with the user's input, and injects relevant memories into the context.
    tools=[PreloadMemoryTool()],
    # Runs after the agent finishes its turn — ships the session to Memory Bank
    # for asynchronous extraction.
    after_agent_callback=persist_to_memory_bank,
)
