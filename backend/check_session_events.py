import os
import asyncio
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

from google.adk.sessions import VertexAiSessionService
session_service = VertexAiSessionService(project=PROJECT, location=LOCATION)

async def main():
    user_id = "iron_vip1"
    print(f"Querying sessions for user: {user_id}...")
    try:
        result = await session_service.list_sessions(
            app_name=AGENT_ENGINE_ID, user_id=user_id
        )
        print(f"Total sessions: {len(result.sessions or [])}")
        for s in result.sessions or []:
            print(f"\nSession ID: {s.id}")
            print(f"Create Time: {getattr(s, 'create_time', 'None')}")
            print(f"Total Events: {len(s.events or [])}")
            for e in s.events or []:
                print(f"  - Author: {e.author}")
                print(f"    Content: {getattr(e, 'content', 'None')}")
                print(f"    Input Trans: {getattr(e, 'input_transcription', 'None')}")
                print(f"    Output Trans: {getattr(e, 'output_transcription', 'None')}")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(main())
