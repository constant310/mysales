"""Generate natural-sounding neural voiceover variants for the mySales Reel.

This is isolated marketing tooling. It does not import or modify the web app.
"""
import asyncio
import json
from pathlib import Path
import edge_tts

SCRIPT = """She made two hundred thousand naira in sales today. So why did she almost cry when she checked the numbers?
Because sales... are not profit.
The goods she sold cost one hundred and sixty thousand.
Transport, damages, and fees? Another thirty thousand.
Two hundred thousand in sales. Just ten thousand left.
And until that night, she'd been judging her business by how busy the shop looked.
Here's the lesson: Track your selling prices. Track your product costs. Track expenses. And know what's actually left.
Because a busy shop can still be a broke shop.
That's why tools like mySales matter.
Send this to one business owner who needs to hear it."""

VOICES = [
    ("male_christopher", "en-US-ChristopherNeural", "+11%", "-1Hz"),
    ("male_guy", "en-US-GuyNeural", "+12%", "+0Hz"),
]

async def main():
    output = Path("marketing/voiceovers/output")
    output.mkdir(parents=True, exist_ok=True)
    (output / "script.txt").write_text(SCRIPT, encoding="utf-8")
    for name, voice, rate, pitch in VOICES:
        target = output / f"mysales_{name}.mp3"
        print(f"Generating {name} ({voice})...", flush=True)
        client = edge_tts.Communicate(SCRIPT, voice, rate=rate, pitch=pitch)
        word_boundaries = []
        with target.open("wb") as audio:
            async for msg in client.stream():
                if msg["type"] == "audio":
                    audio.write(msg["data"])
                elif msg["type"] == "WordBoundary":
                    word_boundaries.append({
                        "text": msg["text"],
                        "start": msg["offset"] / 10_000_000,
                        "duration": msg["duration"] / 10_000_000,
                    })
        (output / f"mysales_{name}_words.json").write_text(json.dumps(word_boundaries, indent=2))

        if target.stat().st_size < 5000:
            raise RuntimeError(f"Audio file is unexpectedly small: {target}")
        print(f"SUCCESS: {target} ({target.stat().st_size} bytes)", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
