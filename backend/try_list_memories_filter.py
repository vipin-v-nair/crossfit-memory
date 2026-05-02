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
        
        # Try various filter strings
        filters = [
            f'user_id="{DEFAULT_USER_ID}"',
            f'scope.user_id="{DEFAULT_USER_ID}"',
            f'metadata.user_id="{DEFAULT_USER_ID}"',
            # Let's try no filter just to list everything
            None
        ]
        
        for f in filters:
            print(f"\nTrying filter: {f}")
            try:
                config = {}
                if f is not None:
                    config["filter"] = f
                memories = list(
                    vertex_client.agent_engines.memories.list(
                        name=full_name,
                        config=config
                    )
                )
                print(f"✅ Success! Found {len(memories)} memories.")
                if memories:
                    print(f"First memory keys: {dir(memories[0])}")
                    print(f"First memory details: {memories[0]}")
            except Exception as e:
                print(f"❌ Fail: {e}")

    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
