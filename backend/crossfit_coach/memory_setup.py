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


# CrossFit-specific memory topics. These prompts guide Gemini's extraction
# when add_session_to_memory() runs in the background.
CROSSFIT_MEMORY_TOPICS = [
    {
        "label": "personal_records",
        "description": (
            "Personal records (PRs) the user has set on lifts or named workouts. "
            "Capture: exercise/movement name, weight (with unit kg or lb), "
            "rep count, time (for benchmark WODs), date, and whether RX or scaled. "
            "Examples: '405 lb back squat 1RM', '3:42 Fran RX', '12 strict pull-ups'. "
            "Always preserve units. Do not infer PRs the user did not state."
        ),
    },
    {
        "label": "workout_results",
        "description": (
            "Results from individual workout sessions. Capture: WOD name "
            "(e.g., 'Fran', 'Murph', 'Helen', or a custom WOD description), "
            "score (time for 'for time' WODs, rounds+reps for AMRAPs, "
            "weight for lifts), RX or scaled, date, and any subjective notes "
            "the user mentioned (felt strong, pacing was off, etc.). "
            "One memory per workout session."
        ),
    },
    {
        "label": "recurring_routines",
        "description": (
            "Training programs, splits, or recurring routines the user follows. "
            "Examples: 'follows CompTrain Masters', 'runs 5/3/1 for strength on "
            "Mondays and Thursdays', 'does Murph every Memorial Day weekend'. "
            "Capture program name, schedule/cadence, and any user-stated goals "
            "for the program."
        ),
    },
    {
        "label": "physical_state",
        "description": (
            "Current and recent physical condition. Capture: injuries (location, "
            "severity, when it started, what aggravates it), mobility limitations, "
            "soreness patterns, recovery status, and movements the user is "
            "currently avoiding or modifying. Update existing memories when the "
            "user reports recovery or change in status."
        ),
    },
    {
        "label": "goals",
        "description": (
            "Active training goals the user is working toward. Examples: "
            "'first ring muscle-up by summer', 'sub-3:00 Fran', '500 lb deadlift', "
            "'compete at local sanctional'. Capture the goal, target metric, "
            "and timeline if mentioned. Mark goals as achieved when the user "
            "reports hitting them."
        ),
    },
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
                "results, routines, physical state, and goals from athlete "
                "conversations."
            ),
            # Custom memory topics drive extraction quality.
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
                            "memory_topics": [
                                {"custom_memory_topic": topic}
                                for topic in CROSSFIT_MEMORY_TOPICS
                            ],
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
    print("Memory topics configured:")
    for t in CROSSFIT_MEMORY_TOPICS:
        print(f"  - {t['label']}")
    print()


if __name__ == "__main__":
    main()
