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
    invocation = callback_context._invocation_context
    memory_service = invocation.memory_service
    if memory_service is None:
        logger.warning(
            "persist_to_memory_bank: memory_service is None — "
            "check that ADKAgent was created with use_in_memory_services=False "
            "and a real VertexAiMemoryBankService."
        )
        return

    try:
        session = invocation.session
        logger.info(
            "persist_to_memory_bank: triggering extraction for session %s (%d events)",
            session.id,
            len(session.events),
        )
        # Use add_events_to_memory with wait_for_completion in custom_metadata.
        # This forces the ADK to use memories.generate() (immediate Gemini
        # extraction) instead of ingest_events() (which requires a separate
        # generation_trigger_config to fire and would otherwise buffer forever).
        await memory_service.add_events_to_memory(
            app_name=session.app_name,
            user_id=session.user_id,
            events=session.events,
            custom_metadata={"wait_for_completion": False},
        )
        logger.info("persist_to_memory_bank: extraction triggered successfully")
    except Exception:
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
