import os
from dotenv import load_dotenv
import vertexai

load_dotenv()

PROJECT = os.environ["GOOGLE_CLOUD_PROJECT"]
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
AGENT_ENGINE_ID = os.environ["AGENT_ENGINE_ID"]

# Enforce active gcloud auth
if "GOOGLE_APPLICATION_CREDENTIALS" in os.environ:
    del os.environ["GOOGLE_APPLICATION_CREDENTIALS"]

vertexai.init(project=PROJECT, location=LOCATION)
vertex_client = vertexai.Client(project=PROJECT, location=LOCATION)

resource_name = f"projects/{PROJECT}/locations/{LOCATION}/reasoningEngines/{AGENT_ENGINE_ID}"

print(f"Connecting to Memory Bank: {resource_name}...")
try:
    all_memories = list(
        vertex_client.agent_engines.memories.list(name=resource_name)
    )
    print(f"\nTotal raw memories in Bank: {len(all_memories)}")
    
    users_with_memories = set()
    for m in all_memories:
        uid = getattr(m, "scope", {}).get("user_id", "None")
        users_with_memories.add(uid)
        print(f"\n- Memory ID: {m.name.split('/')[-1]}")
        print(f"  User Scope: {uid}")
        print(f"  Fact: {getattr(m, 'fact', 'None')}")
        print(f"  Structured Content: {getattr(m, 'structured_content', 'None')}")
        
    print(f"\nDistinct Users in Memory Bank: {list(users_with_memories)}")
except Exception as e:
    print(f"Error listing memories: {e}")
