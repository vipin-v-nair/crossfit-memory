import os
import vertexai
from dotenv import load_dotenv

load_dotenv()

PROJECT = os.environ["GOOGLE_CLOUD_PROJECT"]
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")

def main():
    try:
        vertex_client = vertexai.Client(project=PROJECT, location=LOCATION)
        
        # Let's see if we can find the pydantic model inside the client
        from vertexai._genai.types import common
        print("Attributes in vertexai._genai.types.common:")
        for attr in dir(common):
            if "Memory" in attr or "Config" in attr:
                print(f"  {attr}")
                
        # Inspect ListAgentEngineMemoryConfig fields
        print("\nListAgentEngineMemoryConfig model fields:")
        model = common.ListAgentEngineMemoryConfig
        for name, field in model.model_fields.items():
            print(f"  {name}: {field.annotation}")
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
