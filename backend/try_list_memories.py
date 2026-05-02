import os
import vertexai
from dotenv import load_dotenv

load_dotenv()

PROJECT = os.environ["GOOGLE_CLOUD_PROJECT"]
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
AGENT_ENGINE_ID = os.environ["AGENT_ENGINE_ID"]
DEFAULT_USER_ID = os.environ.get("DEFAULT_USER_ID", "demo_athlete")

def main():
    try:
        vertex_client = vertexai.Client(project=PROJECT, location=LOCATION)
        full_name = f"projects/{PROJECT}/locations/{LOCATION}/reasoningEngines/{AGENT_ENGINE_ID}"
        
        print("Attempt 1: memories.list with config dict:")
        try:
            memories = list(
                vertex_client.agent_engines.memories.list(
                    name=full_name,
                    config={"scope": {"user_id": DEFAULT_USER_ID}}
                )
            )
            print(f"✅ Success! Found {len(memories)} memories.")
        except Exception as e:
            print(f"❌ Fail: {e}")
            
        print("\nAttempt 2: memories.list with flat kwargs? (if accepted):")
        try:
            memories = list(
                vertex_client.agent_engines.memories.list(
                    name=full_name,
                    scope={"user_id": DEFAULT_USER_ID}
                )
            )
            print(f"✅ Success! Found {len(memories)} memories.")
        except Exception as e:
            print(f"❌ Fail: {e}")
            
        print("\nAttempt 3: Memories list using the direct list_memories:")
        try:
            memories = list(
                vertex_client.agent_engines.list_memories(
                    name=full_name,
                    config={"scope": {"user_id": DEFAULT_USER_ID}}
                )
            )
            print(f"✅ Success! Found {len(memories)} memories.")
        except Exception as e:
            print(f"❌ Fail: {e}")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
