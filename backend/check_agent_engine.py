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
        print(f"Attempting to get Agent Engine {AGENT_ENGINE_ID} in project {PROJECT}...")
        
        # Under the hood ADK uses client.agent_engines.get
        engine = vertex_client.agent_engines.get(name=AGENT_ENGINE_ID)
        print("✅ Successfully retrieved Agent Engine!")
        print(f"Display Name: {engine.api_resource.display_name}")
        print(f"Resource Name: {engine.api_resource.name}")
        
    except Exception as e:
        print(f"❌ Error retrieving Agent Engine: {e}")

if __name__ == "__main__":
    main()
