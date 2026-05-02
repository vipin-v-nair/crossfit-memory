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
        print("Signature of vertex_client.agent_engines.memories.list:")
        sig = inspect.signature(vertex_client.agent_engines.memories.list)
        print(sig)
        
        print("\nDocstring:")
        print(vertex_client.agent_engines.memories.list.__doc__)
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
