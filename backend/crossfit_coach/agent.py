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
    """
    After-turn callback: save the session to Memory Bank using the documented
    ADK pattern — calling add_session_to_memory() directly on the callback
    context, not through private _invocation_context APIs.
    """
    print("[MEMORY] callback fired", flush=True)
    try:
        await callback_context.add_session_to_memory()
        print("[MEMORY] add_session_to_memory completed", flush=True)
    except Exception as e:
        print(f"[MEMORY] add_session_to_memory failed: {e}", flush=True)
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
