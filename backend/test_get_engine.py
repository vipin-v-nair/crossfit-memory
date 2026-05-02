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
        
        # Test 1: Using reasoningEngines with Project ID
        name_1 = f"projects/{PROJECT}/locations/{LOCATION}/reasoningEngines/{AGENT_ENGINE_ID}"
        print(f"Test 1 (reasoningEngines, ID): {name_1}")
        try:
            engine = vertex_client.agent_engines.get(name=name_1)
            print("✅ Test 1 Success!")
        except Exception as e:
            print(f"❌ Test 1 Fail: {e}")
            
        # Test 2: Using reasoningEngines with Project Number (663578038874)
        name_2 = f"projects/663578038874/locations/{LOCATION}/reasoningEngines/{AGENT_ENGINE_ID}"
        print(f"Test 2 (reasoningEngines, Number): {name_2}")
        try:
            engine = vertex_client.agent_engines.get(name=name_2)
            print("✅ Test 2 Success!")
        except Exception as e:
            print(f"❌ Test 2 Fail: {e}")
            
        # Test 3: Using agentEngines with Project Number
        name_3 = f"projects/663578038874/locations/{LOCATION}/agentEngines/{AGENT_ENGINE_ID}"
        print(f"Test 3 (agentEngines, Number): {name_3}")
        try:
            engine = vertex_client.agent_engines.get(name=name_3)
            print("✅ Test 3 Success!")
        except Exception as e:
            print(f"❌ Test 3 Fail: {e}")

    except Exception as e:
        print(f"❌ Initialization error: {e}")

if __name__ == "__main__":
    main()
