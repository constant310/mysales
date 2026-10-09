"""Make a short, unaltered sample of the authentic Nigerian Ezinne neural voice."""
import asyncio
from pathlib import Path
import edge_tts

VOICE = "en-NG-EzinneNeural"
TEXT = (
    "Here's why some shops look busy, but the owners are still losing money. "
    "They record sales, but forget customer debts, missing stock, "
    "and those small expenses that add up. "
    "Before you chase more customers, find out where your money is going. "
    "A successful business doesn't just sell. It tracks."
)
OUT = Path("marketing/voiceovers/ezinne_sample.mp3")

async def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    # No voice fallback: the output must genuinely be Ezinne.
    engine = edge_tts.Communicate(TEXT, voice=VOICE, rate="+7%", pitch="+0Hz")
    await engine.save(str(OUT))
    if OUT.stat().st_size < 7000:
        raise RuntimeError("Ezinne sample unavailable or invalid")
    print(f"Generated actual {VOICE}: {OUT.stat().st_size} bytes")

if __name__ == "__main__":
    asyncio.run(main())
