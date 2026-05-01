"""
Provisions an Agent Engine instance with Memory Bank configured for CrossFit
performance tracking.

Run once:
    python -m crossfit_coach.memory_setup

Copy the printed AGENT_ENGINE_ID into your .env file.

Why this exists: Memory Bank's extraction quality depends heavily on the topic
schema. The default schema gives you generic preference memories ("user likes
the color blue"). For our domain we want structured CrossFit data extraction,
so we configure custom memory topics at instance-creation time.

NOTE: Topic schemas are bound at instance creation. To change topics, you must
create a new Agent Engine instance.
"""

import os
from dotenv import load_dotenv
import vertexai

load_dotenv()

PROJECT = os.environ["GOOGLE_CLOUD_PROJECT"]
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")


# CrossFit-specific custom memory topics.
# Descriptions guide Gemini's extraction — be explicit about what belongs
# here AND what should be excluded to avoid boundary misclassification.
CROSSFIT_MEMORY_TOPICS = [
    {
        "label": "personal_records",
        "description": (
            "Personal records (PRs) the user has explicitly set on lifts or named "
            "benchmark workouts. Capture: exercise/movement name, weight (with unit "
            "kg or lb), rep count, time (for benchmark WODs like Fran, Cindy, Helen), "
            "date, and whether RX or scaled. "
            "Examples: '405 lb back squat 1RM', '3:42 Fran RX', '12 strict pull-ups'. "
            "Always preserve units. Do not infer PRs the user did not explicitly state. "
            "Do NOT include here: general workout session results that are not stated "
            "as PRs, recurring events, or physical condition notes."
        ),
    },
    {
        "label": "workout_results",
        "description": (
            "Results from individual workout sessions. Capture: WOD name "
            "(e.g., 'Fran', 'Murph', 'Helen', or a custom WOD description), "
            "score (time for 'for time' WODs, rounds+reps for AMRAPs, weight for "
            "lifts), RX or scaled, date, and subjective notes the user mentioned "
            "(felt strong, pacing was off, etc.). One memory per workout session. "
            "Do NOT include here: general fatigue or soreness unrelated to a specific "
            "session, skill assessments ('my double-unders are bad'), or injury "
            "reports — those belong in physical_state."
        ),
    },
    {
        "label": "recurring_routines",
        "description": (
            "Training programs, splits, or recurring patterns the user follows. "
            "Examples: 'follows CompTrain Masters', 'runs 5/3/1 on Mon/Thu', "
            "'does Murph every Memorial Day'. Capture: program name, "
            "schedule/cadence, and any user-stated goals for the program. "
            "Key signal: phrases like 'I always do X', 'every Y I do Z', "
            "'I follow program X'. Even if a specific result is mentioned alongside "
            "the routine (e.g., 'I do Murph every Memorial Day — this year 55 min'), "
            "capture the routine pattern here; also log the result in workout_results."
        ),
    },
    {
        "label": "physical_state",
        "description": (
            "Current and recent physical condition — specifically injuries, mobility "
            "limitations, soreness patterns, recovery status, and movements the user "
            "is avoiding or modifying due to physical issues. "
            "Examples: 'tweaked left shoulder on overhead press', 'knee flares on "
            "box jumps', 'still recovering from calf strain'. "
            "Do NOT include here: general workout fatigue ('felt drained after "
            "pull-ups'), performance feelings during a session, skill gaps "
            "('my sit-ups are bad'), or post-workout feelings that are not "
            "injury/recovery related — those belong in workout_results."
        ),
    },
    {
        "label": "goals",
        "description": (
            "Active training goals the user is working toward. Examples: "
            "'first ring muscle-up by summer', 'sub-3:00 Fran', '500 lb deadlift', "
            "'compete at local sanctional'. Capture: goal, target metric, and "
            "timeline if mentioned. Mark goals as achieved when the user reports "
            "hitting them. "
            "Key signal: future tense, 'I want to', 'I'm working toward', 'my goal "
            "is'. Do NOT include here: past achievements — those are personal_records."
        ),
    },
]

# Built-in managed topics from Memory Bank.
# These are active by default — Memory Bank persists them automatically.
# We list them explicitly here so the provisioning output is clear about
# what the instance captures, and to ensure they appear in the UI.
MANAGED_MEMORY_TOPICS = [
    "USER_PERSONAL_INFO",       # athlete name, background, competitive history, key dates
    "USER_PREFERENCES",         # preferred training style, equipment, coaching approach
    "KEY_CONVERSATION_DETAILS", # important milestones and conclusions in the dialogue
    "EXPLICIT_INSTRUCTIONS",    # things the user explicitly asked to remember or forget
]


def main() -> None:
    client = vertexai.Client(project=PROJECT, location=LOCATION)

    print(f"Creating Agent Engine instance in {PROJECT}/{LOCATION}...")

    model_prefix = f"projects/{PROJECT}/locations/{LOCATION}/publishers/google/models"

    agent_engine = client.agent_engines.create(
        config={
            "display_name": "crossfit-memory-demo",
            "description": (
                "CrossFit performance memory demo. Extracts PRs, workout "
                "results, routines, physical state, goals, and personal "
                "context from athlete conversations."
            ),
            "context_spec": {
                "memory_bank_config": {
                    "generation_config": {
                        "model": f"{model_prefix}/gemini-2.5-flash",
                    },
                    "similarity_search_config": {
                        "embedding_model": f"{model_prefix}/text-embedding-005",
                    },
                    "customization_configs": [
                        {
                            "memory_topics": (
                                [
                                    {"custom_memory_topic": topic}
                                    for topic in CROSSFIT_MEMORY_TOPICS
                                ]
                                + [
                                    {"managed_memory_topic": {"managed_topic_enum": t}}
                                    for t in MANAGED_MEMORY_TOPICS
                                ]
                            ),
                        }
                    ],
                }
            },
        }
    )

    resource_name = agent_engine.api_resource.name
    engine_id = resource_name.split("/")[-1]

    print()
    print("=" * 60)
    print("✅ Agent Engine + Memory Bank provisioned.")
    print("=" * 60)
    print(f"Resource name:    {resource_name}")
    print(f"AGENT_ENGINE_ID:  {engine_id}")
    print()
    print("Add this to your .env:")
    print(f"  AGENT_ENGINE_ID={engine_id}")
    print()
    print("Custom memory topics:")
    for t in CROSSFIT_MEMORY_TOPICS:
        print(f"  - {t['label']}")
    print("Built-in managed topics:")
    for t in MANAGED_MEMORY_TOPICS:
        print(f"  - {t}")
    print()


if __name__ == "__main__":
    main()
