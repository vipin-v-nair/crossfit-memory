import os
import asyncio
from dotenv import load_dotenv
from google.adk.sessions import VertexAiSessionService

load_dotenv()

PROJECT = os.environ["GOOGLE_CLOUD_PROJECT"]
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
AGENT_ENGINE_ID = os.environ["AGENT_ENGINE_ID"]
APP_NAME = os.environ.get("APP_NAME", "crossfit_memory_demo")
DEFAULT_USER_ID = os.environ.get("DEFAULT_USER_ID", "demo_athlete")

async def main():
    try:
        print(f"Initializing VertexAiSessionService...")
        session_service = VertexAiSessionService(
            project=PROJECT,
            location=LOCATION,
            agent_engine_id=AGENT_ENGINE_ID,
        )
        
        print(f"Attempting to create a session for user {DEFAULT_USER_ID}...")
        session = await session_service.create_session(
            app_name=APP_NAME, user_id=DEFAULT_USER_ID
        )
        print("✅ Successfully created session!")
        print(f"Session ID: {session.id}")
        
    except Exception as e:
        print(f"❌ Error creating session: {e}")

if __name__ == "__main__":
    asyncio.run(main())
