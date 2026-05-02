import os
import vertexai
from dotenv import load_dotenv

load_dotenv()

PROJECT = os.environ["GOOGLE_CLOUD_PROJECT"]
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
AGENT_ENGINE_ID = os.environ["AGENT_ENGINE_ID"]

def main():
    try:
        vertex_client = vertexai.Client(project=PROJECT, location=LOCATION)
        full_name = f"projects/{PROJECT}/locations/{LOCATION}/reasoningEngines/{AGENT_ENGINE_ID}"
        print(f"Attempting to get Agent Engine with full name (project ID string): {full_name}")
        
        engine = vertex_client.agent_engines.get(name=full_name)
        print("✅ Successfully retrieved Agent Engine!")
        print(f"Display Name: {engine.api_resource.display_name}")
        
    except Exception as e:
        print(f"❌ Error retrieving Agent Engine: {e}")

if __name__ == "__main__":
    main()
