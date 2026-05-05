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
        "label": "workout_results",
        "description": (
            "Results from individual workout sessions. Capture: WOD name "
            "(e.g., 'Fran', 'Murph', 'Helen', or a custom WOD description), "
            "score (time for 'for time' WODs, rounds+reps for AMRAPs, weight for "
            "lifts), RX or scaled, date, and subjective notes the user mentioned "
            "(felt strong, pacing was off, etc.). One memory per workout session. "
            "Do NOT include here: general strength 1RMs, goals, or injuries — those belong in the profile."
        ),
    },
    {
        "label": "recurring_routines",
        "description": (
            "Training programs, splits, or recurring patterns the user follows. "
            "Examples: 'follows CompTrain Masters', 'runs 5/3/1 on Mon/Thu', "
            "'does Murph every Memorial Day'. Capture: program name, "
            "schedule/cadence, and any user-stated goals for the program. "
            "Do NOT include here: specific single-session scores or raw PRs."
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

# CrossFit Athlete Profile Schema for structured Memory Profiles.
# Gemini will automatically parse session events to extract and populate
# these specific structured fields scoped to the user.
CROSSFIT_PROFILE_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {
            "type": "string",
            "description": "The athlete's name or nickname."
        },
        "age": {
            "type": "integer",
            "description": "The athlete's current age in years."
        },
        "weight_lbs": {
            "type": "integer",
            "description": "The athlete's current body weight in pounds."
        },
        "experience_years": {
            "type": "integer",
            "description": "How many years the athlete has been training in CrossFit."
        },
        "back_squat_1rm_lbs": {
            "type": "integer",
            "description": "The athlete's 1-repetition maximum (1RM) back squat in pounds."
        },
        "deadlift_1rm_lbs": {
            "type": "integer",
            "description": "The athlete's 1-repetition maximum (1RM) deadlift in pounds."
        },
        "clean_jerk_1rm_lbs": {
            "type": "integer",
            "description": "The athlete's 1-repetition maximum (1RM) clean & jerk in pounds."
        },
        "snatch_1rm_lbs": {
            "type": "integer",
            "description": "The athlete's 1-repetition maximum (1RM) full or power snatch in pounds."
        },
        "bench_press_1rm_lbs": {
            "type": "integer",
            "description": "The athlete's 1-repetition maximum (1RM) bench press in pounds."
        },
        "fran_pr": {
            "type": "string",
            "description": "The athlete's best time for the 'Fran' benchmark WOD (e.g. '3:42 RX' or '4:15 scaled')."
        },
        "training_routine": {
            "type": "object",
            "properties": {
                "program_name": {
                    "type": "string",
                    "description": "The name of the training program followed (e.g. 'CompTrain', 'Mayhem')."
                },
                "frequency": {
                    "type": "string",
                    "description": "How many days/week or training split schedule."
                },
                "focus": {
                    "type": "string",
                    "description": "Primary active focus (e.g. 'Strength', 'Cardio endurance', 'Gymnastics skills')."
                }
            },
            "description": "Active training program split and focus details."
        },
        "recent_workouts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "wod_name": {
                        "type": "string",
                        "description": "WOD name or short custom session description."
                    },
                    "score": {
                        "type": "string",
                        "description": "Score achieved (time, rounds, reps). Always preserve units."
                    },
                    "date": {
                        "type": "string",
                        "description": "Date performed."
                    },
                    "feeling": {
                        "type": "string",
                        "description": "Subjective session pacing or energy notes."
                    }
                },
                "required": ["wod_name", "score"]
            },
            "description": "Log of recent individual workout sessions performed by the athlete."
        },
        "other_prs": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {
                        "type": "string",
                        "description": "Name of movement or named benchmark WOD (e.g. 'Grace', '500m Row', 'Strict Pull-ups')."
                    },
                    "score": {
                        "type": "string",
                        "description": "Personal record score. Always preserve units."
                    },
                    "date": {
                        "type": "string",
                        "description": "Date achieved."
                    }
                },
                "required": ["name", "score"]
            },
            "description": "Personal records for other movements or benchmark workouts not in core lifts."
        },
        "active_goals": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Active training goals the athlete is currently working toward."
        },
        "physical_limitations": {
            "type": "array",
            "items": {"type": "string"},
            "description": "Active injuries, joint pain, or mobility limits the athlete is managing."
        },
        "featured_metrics": {
            "type": "array",
            "items": {"type": "string"},
            "description": "List of metric keys the athlete wants featured as core in their dashboard (e.g. ['back_squat_1rm_lbs', 'bench_press_1rm_lbs'])."
        }
    }
}


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
                    "structured_memory_configs": [
                        {
                            "schema_configs": [
                                {
                                    "id": "athlete_profile",
                                    "memory_schema": CROSSFIT_PROFILE_SCHEMA
                                }
                            ]
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
