"""
CrossFit coach agent.

Wires together:
- Gemini 2.5 Flash as the LLM
- PreloadMemoryTool (runs at turn start, retrieves relevant memories)
- after_agent_callback (runs at turn end, ships the session to Memory Bank)
"""

import logging

from google.adk.agents import Agent
from google.adk.tools.preload_memory_tool import PreloadMemoryTool
from google.adk.agents.callback_context import CallbackContext

from crossfit_coach.prompts import COACH_INSTRUCTION

logger = logging.getLogger(__name__)


async def persist_to_memory_bank(callback_context: CallbackContext) -> None:
    """Save the session to Memory Bank after each turn using the documented ADK pattern."""
    try:
        await callback_context.add_session_to_memory()
    except Exception:
        logger.exception("persist_to_memory_bank failed")


root_agent = Agent(
    name="crossfit_coach",
    model="gemini-2.5-flash",
    description=(
        "A CrossFit performance coach with persistent memory of the athlete's "
        "training history, PRs, workouts, routines, injuries, and goals."
    ),
    instruction=COACH_INSTRUCTION,
    tools=[PreloadMemoryTool()],
    after_agent_callback=persist_to_memory_bank,
)
