#!/usr/bin/env python3
"""Autonomous, no-paid-API mySales reels. Publishes files to a GitHub Actions artifact only."""
import asyncio
import datetime as dt
import json
import math
import os
import random
import shutil
import subprocess
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import edge_tts

ROOT=Path(__file__).resolve().parent
DEST=ROOT/"output"
SCENES=ROOT/"scenes"
CYAN=(20,225,235)
WHITE=(235,243,241)
TOPICS=[
("Lost stock","Your shelves can look full while your cash disappears.","If you never reconcile stock after each sale, missing products become invisible.","Record sales immediately and check stock movements every day."),
("Unpaid debts","A sale is not finished when the customer still owes.","Small unpaid balances are easy to forget when they live in scattered notebooks.","Record receivables and review outstanding balances before they pile up."),
("Profit confusion","A busy shop is not automatically a profitable shop.","Revenue looks impressive until product costs and daily expenses enter the picture.","Track sale values alongside costs and pay attention to actual margins."),
("Business visibility","Can you tell what your shop sold while you were away?","If every answer requires calling a staff member, you need clearer records.","Organize sales and stock in a system you can review on your phone."),
("Closing-time headache","Why are you still adding receipts long after closing time?","Waiting until night to calculate everything creates stress and avoidable mistakes.","Record each transaction when it happens, then review your daily summary."),
("Out-of-stock surprise","Your next customer should not be your stock alert.","Fast-moving products run out because nobody notices the numbers until the shelf is empty.","Track inventory quantities and review what needs restocking."),
("Price mistakes","One wrong selling price repeated all day can damage your profit.","Costs increase, yet old prices remain on products and in staff memory.","Review cost prices and selling prices consistently."),
("Staff accountability","Trust your staff. But make every sale easy to verify.","Without consistent records, honest mistakes can look like missing money.","Keep clear transaction history and investigate discrepancies using evidence."),
("Second branch","Your second shop needs more than another notebook.","As branches increase, it gets harder to compare stock, sales and collections.","Organize each branch's records and review performance separately."),
("Slow-moving stock","Some inventory is quietly locking up your working capital.","Products that rarely sell still occupy shelf space and tie down money.","Look at product movement before deciding what to buy again."),
("Customer orders","A lost order detail can become a lost customer.","Scattered messages make it easy to miss a delivery instruction or payment balance.","Keep customer orders and their status in one dependable record."),
("Returns and refunds","Returns are part of business. Confusion doesn't have to be.","Unrecorded refunds and exchanged items can distort your stock and sales totals.","Track adjustments carefully so your numbers continue to make sense."),
("Daily numbers","Was today actually better than yesterday?","A crowded shop feels successful, but feelings don't replace measurable results.","Review daily sales and trends so you can make informed decisions."),
("Hidden expenses","Small business expenses can eat a large part of your margin.","Delivery costs, transport, damaged goods and discounts can add up quietly.","Record relevant expenses and understand what is left after costs."),
("Memory trap","Your memory is not an inventory management system.","One hectic afternoon is enough to forget a sale or a customer balance.","Enter transactions while they are fresh and let your records do the remembering."),
("Supplier decisions","Buying more stock is not always a sign of growth.","When purchases are based on guesses, cash can get trapped in the wrong products.","Check your fast sellers and existing quantities before you reorder."),
("Business clarity","If you cannot explain your numbers, growth becomes harder.","Owners who cannot see sales, stock and balances clearly often react too late.","Build a simple daily habit of checking what matters."),
("Professional small shops","You don't need a big chain to run your shop professionally.","Even one shop needs consistent sales, inventory and payment records.","Start building clear systems while the business is still small.")
]
OPENERS=["One thing every small-business owner should know:","Here's a costly mistake business owners often overlook:","If you run a shop, listen to this:","This simple business lesson could save you headaches:"]
CLOSERS=["Less confusion. Better decisions. More control.","Don't just work hard. Know your numbers.","A clearer business is easier to grow.","Better records give you better choices."]

# Test distinct, supported neural voices; never attribute retention changes
# to the voice alone until there is enough comparable Reel performance data.
VOICE_PRESETS = {
    "christopher": {"name": "en-US-ChristopherNeural", "rate": "+10%"},
    "abeo": {"name": "en-NG-AbeoNeural", "rate": "+6%"},
    "ezinne": {"name": "en-NG-EzinneNeural", "rate": "+6%"},
    "guy": {"name": "en-US-GuyNeural", "rate": "+9%"},
}

def select_voice(now, slot):
    # A reproducible four-voice sequence creates an initial comparison set.
    # Editorial reviews may override 'voice' and 'voice_rate' via next_content.json.
    ordinal = (now.date() - dt.date(2026, 10, 10)).days * 2 + slot
    key = ("christopher", "abeo", "guy", "ezinne")[ordinal % 4]
    custom_rate = None
    plan_file = ROOT / "next_content.json"
    if plan_file.is_file():
        try:
            plan = json.loads(plan_file.read_text(encoding="utf-8"))
            if (plan.get("business_only") is True
                    and plan.get("date") == now.strftime("%Y-%m-%d")
                    and plan.get("slot") == ("morning" if slot == 0 else "evening")):
                candidate = plan.get("voice", key)
                if candidate in VOICE_PRESETS:
                    key = candidate
                r = plan.get("voice_rate")
                if isinstance(r, int) and 0 <= r <= 15:
                    custom_rate = f"+{r}%"
        except (OSError, ValueError, TypeError):
            pass
    preset = dict(VOICE_PRESETS[key])
    if custom_rate is not None:
        preset["rate"] = custom_rate
    return key, preset


def cmd(*args):
    subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)

def get_duration(path):
    return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","default=nw=1:nk=1",str(path)],text=True).strip())

def choose():
    now=dt.datetime.now(dt.timezone(dt.timedelta(hours=1)))
    slot=0 if now.hour<13 else 1
    index=((now.date()-dt.date(2026,10,9)).days*2+slot)%len(TOPICS)
    phase=((now.date()-dt.date(2026,10,9)).days*2+slot)//len(TOPICS)
    title,hook,problem,advice=TOPICS[index]
    # Start with the conflict immediately; generic introductions raise early-skip risk.
    script=f"{hook} {problem} {advice} {CLOSERS[(phase+index)%len(CLOSERS)]} Send this to a business owner. Follow for more practical business lessons."
    # Scheduled ChatGPT editorial review can write a one-off script for this exact slot.
    plan_path=ROOT/"next_content.json"
    if plan_path.exists():
        try:
            plan=json.loads(plan_path.read_text(encoding="utf-8"))
            if plan.get("date")==now.strftime("%Y-%m-%d") and plan.get("slot")==("morning" if slot==0 else "evening"):
                candidate=plan.get("script","").strip()
                if 55 <= len(candidate.split()) <= 125 and plan.get("business_only",False):
                    script=candidate
                    title=str(plan.get("title",title))[:80]
                    hook=str(plan.get("hook",hook))[:180]
        except Exception as exc:
            print(f"Content plan ignored: {type(exc).__name__}")
    return now,slot,title,script,hook

def font(size,bold=False):
    f="/usr/share/fonts/truetype/dejavu/DejaVuSans"+("-Bold" if bold else "")+".ttf"
    return ImageFont.truetype(f,size)

def wrap(draw,text,f,maxwidth):
    lines=[]; line=""
    for word in text.split():
        test=(line+" "+word).strip()
        if line and draw.textbbox((0,0),test,font=f)[2]>maxwidth: lines.append(line);line=word
        else:line=test
    if line:lines.append(line)
    return lines

def artwork(dest,title,seed):
    rng=random.Random(seed)
    w,h=720,1280
    im=Image.new("RGB",(w,h),(7,12,16))
    d=ImageDraw.Draw(im)
    for _ in range(900):
        x=rng.randrange(w);y=rng.randrange(h)
        d.line((x,y,x+rng.randrange(2,30),y-rng.randrange(1,12)),fill=(25,32,39),width=1)
    d.ellipse((105,210,620,1070),outline=(12,43,51),width=36)
    # Illustrated shop owner in graphic-novel silhouette
    x=175+rng.randrange(-20,21);y=625
    d.ellipse((x-67,y-170,x+76,y-21),fill=(27,34,42),outline=WHITE,width=6)
    d.arc((x-71,y-200,x+76,y-60),175,350,fill=WHITE,width=8)
    d.ellipse((x+17,y-114,x+28,y-103),fill=WHITE)
    d.arc((x-10,y-80,x+42,y-40),0,155,fill=WHITE,width=4)
    d.polygon([(x-84,y-17),(x+83,y-17),(x+145,y+285),(x-140,y+285)],fill=(19,27,33))
    d.line([(x-84,y-17),(x-140,y+285)],fill=WHITE,width=6)
    d.line([(x+83,y-17),(x+145,y+285)],fill=WHITE,width=6)
    # Financial phone panel, receipt icons and dynamic charts
    ox=408+rng.randrange(-15,15);oy=575
    d.rounded_rectangle((ox-50,oy-163,ox+237,oy+288),radius=24,fill=(9,34,43),outline=CYAN,width=7)
    d.rounded_rectangle((ox+7,oy-102,ox+179,oy-42),radius=12,outline=WHITE,width=3)
    for j,hh in enumerate([72,140,100,190]):
        d.rectangle((ox-7+j*56,oy+158-hh,ox+24+j*56,oy+158),fill=(10,132+22*j,157+16*j))
    d.line((ox-4,oy+204,ox+171,oy+204),fill=WHITE,width=4)
    for a in range(16):
        theta=a*math.tau/16
        xx=ox+103+math.cos(theta)*216;yy=oy+32+math.sin(theta)*296
        d.line((xx,yy,xx+math.cos(theta)*19,yy+math.sin(theta)*19),fill=(10,114,126),width=3)
    d.rectangle((0,0,w,14),fill=CYAN)
    f=font(43,True); yy=97
    for line in wrap(d,title.upper(),f,630):
        bbox=d.textbbox((0,0),line,font=f)
        d.text(((w-(bbox[2]-bbox[0]))/2,yy),line,font=f,fill=WHITE,stroke_width=2,stroke_fill=(0,0,0))
        yy+=69
    d.line((120,yy+7,600,yy+7),fill=CYAN,width=5)
    d.text((43,1177),"MYSALES   •   BUSINESS CLARITY",font=font(22,True),fill=CYAN)
    im.save(dest,optimize=True)

async def speech(script, dest, voice, rate):
    boundaries = []
    with dest.open("wb") as f:
        async for piece in edge_tts.Communicate(script, voice=voice, rate=rate).stream():
            if piece["type"] == "audio":
                f.write(piece["data"])
            elif piece["type"] == "WordBoundary":
                boundaries.append((piece["offset"]/10_000_000, piece["duration"]/10_000_000, piece["text"]))
    if dest.stat().st_size < 6000 or not boundaries:
        raise RuntimeError("Voiceover empty or missing word timestamps")
    return boundaries

async def speech_with_fallback(script, dest, voice_key, config):
    # If an experimental regional voice is unavailable, preserve continuity
    # with the previously verified Christopher voice and note the fallback.
    try:
        word_times = await speech(script, dest, config["name"], config["rate"])
        return word_times, voice_key, config
    except Exception as e:
        if voice_key == "christopher":
            raise
        print(f"Trial voice {voice_key} unavailable ({type(e).__name__}); retrying baseline voice")
        dest.unlink(missing_ok=True)
        baseline = VOICE_PRESETS["christopher"]
        word_times = await speech(script, dest, baseline["name"], baseline["rate"])
        return word_times, "christopher", baseline

def timecode(seconds):
    m=round(max(seconds,0)*1000)
    return f"{m//3600000:02}:{(m//60000)%60:02}:{(m//1000)%60:02},{m%1000:03}"

def timed_subtitles(words,script,T,path):
    if not words:
        tokens=script.split(); words=[(i*T/len(tokens),T/len(tokens),v) for i,v in enumerate(tokens)]
    groups=[];segment=[]
    for w in words:
        segment.append(w)
        if len(segment)>=5 or w[0]+w[1]-segment[0][0]>1.45 or (str(w[2]).endswith((".", "?", "!")) and len(segment)>=2):
            groups.append(segment);segment=[]
    if segment:groups.append(segment)
    result=[]
    for i,g in enumerate(groups):
        start=g[0][0];end=g[-1][0]+g[-1][1]
        if i<len(groups)-1:end=min(end,groups[i+1][0][0]-.02)
        result.extend([str(i+1),f"{timecode(start)} --> {timecode(max(end,start+.08))}"," ".join(z[2] for z in g),""])
    path.write_text("\n".join(result))

def video(images,mp3,srt,dest):
    T=get_duration(mp3); n=len(images);step=T/n;fade=.14
    with tempfile.TemporaryDirectory() as temp:
        clips=[]
        for i,img in enumerate(images):
            p=Path(temp)/f"{i:02}.mp4"
            vf=("scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,"
                "zoompan=z='min(zoom+0.0003,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
                "d=1:s=720x1280:fps=24,format=yuv420p")
            cmd("ffmpeg","-y","-v","error","-loop","1","-framerate","24","-i",str(img),"-vf",vf,
                "-t",f"{step+(fade if i<n-1 else 0):.3f}","-c:v","libx264","-preset","ultrafast","-crf","25",str(p))
            clips.append(p)
        inputs=[]
        for c in clips:inputs+=["-i",str(c)]
        inputs+=["-i",str(mp3)]
        chains=[];prev="[0:v]"
        for j in range(1,n):
            output=f"[x{j}]"
            chains.append(f"{prev}[{j}:v]xfade=transition=fade:duration={fade}:offset={j*step:.3f}{output}")
            prev=output
        escape=str(srt).replace("\\","\\\\").replace(":","\\:").replace("'","\\'")
        chains.append(f"{prev}subtitles=filename='{escape}':force_style='FontName=DejaVu Sans,FontSize=14,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,Outline=2,Alignment=2,MarginV=130'[v]")
        cmd("ffmpeg","-y","-v","error",*inputs,"-filter_complex",";".join(chains),"-map","[v]","-map",f"{n}:a",
            "-t",f"{T:.3f}","-c:v","libx264","-preset","veryfast","-crf","23",
            "-pix_fmt","yuv420p","-c:a","aac","-b:a","160k","-movflags","+faststart",str(dest))

def main():
    now,slot,title,script,hook=choose()
    DEST.mkdir(parents=True,exist_ok=True)
    (DEST/"script.txt").write_text(script)
    (DEST/"caption.txt").write_text(f"{hook}\n\nBusiness owners need clarity, not guesswork. Follow for practical small-business ideas.\n\n#mySales #SmallBusinessNigeria #BusinessTips #InventoryManagement")
    requested_voice, voice_config = select_voice(now, slot)
    audio=DEST/"voice.mp3"
    boundaries, actual_voice, actual_config = asyncio.run(speech_with_fallback(script,audio,requested_voice,voice_config))
    if not boundaries:raise RuntimeError("No timing data returned for captions")
    length=get_duration(audio)
    timed_subtitles(boundaries,script,length,DEST/"subtitles.srt")
    existing=sorted(SCENES.glob("scene_*.png"))
    frames=[]
    for i in range(12):
        dest=DEST/f"scene_{i+1:02}.png"
        if existing:shutil.copyfile(existing[(i+slot)%len(existing)],dest)
        else:artwork(dest,title if i==0 else ["BUSY SHOP","MISSING FIGURES","CHECK THE NUMBERS","STOCK MOVEMENT","CLEAR RECORDS","TAKE CONTROL"][i%6],now.date().toordinal()*33+i)
        frames.append(dest)
    shutil.copyfile(frames[0],DEST/"cover.png")
    video(frames,audio,DEST/"subtitles.srt",DEST/"reel.mp4")
    metadata={
        "title":title,
        "hook":hook,
        "date":now.strftime("%Y-%m-%d"),
        "slot":"morning" if slot==0 else "evening",
        "generated_at":now.isoformat(),
        "duration_seconds":length,
        "video_file":"reel.mp4",
        "account":"_constano_",
        "category":"business",
        "voice_preset": actual_voice,
        "voice_name": actual_config["name"],
        "voice_rate": actual_config["rate"],
        "voice_trial_requested": requested_voice,
        "automated":True
    }
    (DEST/"manifest.json").write_text(json.dumps(metadata,indent=2),encoding="utf-8")
    print(json.dumps(metadata))
if __name__=="__main__":main()
