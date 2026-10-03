import os
from pathlib import Path
from dotenv import load_dotenv
from livekit import agents
from livekit.agents import AgentSession, Agent, RoomInputOptions
from livekit.plugins import elevenlabs, silero

load_dotenv(dotenv_path=Path(__file__).parent.parent / ".env")

VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")

class Ava(Agent):
    def __init__(self):
        super().__init__(
            instructions=(
                "You are Ava, a warm and calm deal host for Aval. "
                "You speak in one to three short sentences. "
                "You never use the words: fraud, error, blocked, failed. "
                "You never make decisions. You only explain and point."
            )
        )

    async def on_enter(self):
        await self.session.generate_reply(
            instructions="Greet the room in one short sentence: 'Hello, I am Ava. I will host this deal.'"
        )

async def entrypoint(ctx: agents.JobContext):
    await ctx.connect()

    session = AgentSession(
        vad=silero.VAD.load(),
        tts=elevenlabs.TTS(voice_id=VOICE_ID) if VOICE_ID else None,
    )

    await session.start(
        room=ctx.room,
        agent=Ava(),
        room_input_options=RoomInputOptions(),
    )

if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
