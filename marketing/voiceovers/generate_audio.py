"""Generate an actual Nigerian English female Ezinne audio sample on a free GitHub runner."""
import asyncio
from pathlib import Path
import edge_tts

SCRIPT = (
    "Here's why some shops look busy, but the owners are still losing money. "
    "They record sales, but forget customer debts, missing stock, and those small expenses that add up. "
    "Before you chase more customers, find out where your money is going. "
    "A successful business doesn't just sell. It tracks."
)

async def main():
    out = Path("marketing/voiceovers/output")
    out.mkdir(parents=True,exist_ok=True)
    voice = edge_tts.Communicate(SCRIPT, voice="en-NG-EzinneNeural", rate="+7%")
    target = out / "mysales_ezinne_preview.mp3"
    await voice.save(str(target))
    if target.stat().st_size < 6000:
        raise RuntimeError("Ezinne voice not generated")
    (out / "mysales_ezinne_preview_script.txt").write_text(SCRIPT, encoding="utf-8")
    print(f"SUCCESS authentic Ezinne voice MP3, bytes: {target.stat().st_size}",flush=True)

if __name__=="__main__":
    asyncio.run(main())
