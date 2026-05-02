import os
import inspect
import vertexai
from dotenv import load_dotenv

load_dotenv()

PROJECT = os.environ["GOOGLE_CLOUD_PROJECT"]
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")

def main():
    try:
        from google.genai import types
        print("Attributes of types.ListAgentEngineMemoryConfig:")
        for attr in dir(types.ListAgentEngineMemoryConfig):
            if not attr.startswith("_"):
                print(f"  {attr}")
                
        print("\nInspect types.ListAgentEngineMemoryConfig.__init__ signature:")
        sig = inspect.signature(types.ListAgentEngineMemoryConfig.__init__)
        print(sig)
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
