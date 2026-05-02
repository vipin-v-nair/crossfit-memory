import os
import inspect
import vertexai
from dotenv import load_dotenv

load_dotenv()

PROJECT = os.environ["GOOGLE_CLOUD_PROJECT"]
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")

def main():
    try:
        vertex_client = vertexai.Client(project=PROJECT, location=LOCATION)
        print("Signature of vertex_client.agent_engines.list_memories:")
        sig = inspect.signature(vertex_client.agent_engines.list_memories)
        print(sig)
        
        # Print docstring if available
        print("\nDocstring:")
        print(vertex_client.agent_engines.list_memories.__doc__)
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
