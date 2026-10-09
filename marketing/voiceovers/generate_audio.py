"""Generate natural-sounding neural voiceover variants for the mySales Reel.

This is isolated marketing tooling. It does not import or modify the web app.
"""
import asyncio
from pathlib import Path
import edge_tts

SCRIPT = """A business can be busy every day... and still be quietly losing money.
Sales are happening, but nobody can clearly say what was sold, what is left in stock, or who still owes.
So the owner spends the night with notebooks, receipts, and guesswork.
That is where mySales comes in.
Record sales as they happen.
Track stock automatically.
Monitor debtors.
And see how the business is really performing from your phone.
Less confusion. Better decisions. More control.
If you want growth, stop running your business blind.
Start tracking with mySales."""

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
        await client.save(str(target))
        if target.stat().st_size < 5000:
            raise RuntimeError(f"Audio file is unexpectedly small: {target}")
        print(f"SUCCESS: {target} ({target.stat().st_size} bytes)", flush=True)

if __name__ == "__main__":
    asyncio.run(main())
