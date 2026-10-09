#!/usr/bin/env python3
"""Post a completed mySales reel via Meta's official API. Disabled unless explicitly enabled."""
import base64, datetime as dt, json, os, re, subprocess, time
from pathlib import Path
from zoneinfo import ZoneInfo
import requests

ROOT=Path(__file__).resolve().parent
VIDEO=ROOT/"output/reel.mp4"
CAPTION=ROOT/"output/caption.txt"
VER=os.getenv("META_GRAPH_API_VERSION","v26.0")
HTTP=requests.Session()

def http(method,url,**kwargs):
    response=HTTP.request(method,url,timeout=kwargs.pop("timeout",120),**kwargs)
    if not response.ok:
        raise RuntimeError(f"{method} {url.split('?')[0]} failed HTTP {response.status_code}")
    return response.json()

def graph(path,token,method="POST",**kw):
    return http(method,f"https://graph.facebook.com/{VER}/{path}",
                headers={"Authorization":f"Bearer {token}"},**kw)

def validate():
    if not VIDEO.is_file() or VIDEO.stat().st_size<10000 or not CAPTION.is_file():
        raise RuntimeError("Finished reel.mp4 or caption.txt missing")
    caption=CAPTION.read_text().strip()
    if not 1<=len(caption)<=2200: raise ValueError("Invalid caption length")
    data=json.loads(subprocess.check_output(["ffprobe","-v","error","-select_streams","v:0",
        "-show_entries","stream=width,height,codec_name:format=duration","-of","json",str(VIDEO)],text=True))
    stream=data["streams"][0]; secs=float(data["format"]["duration"])
    if stream["codec_name"]!="h264" or not 3<=secs<=60 or abs(stream["width"]/stream["height"]-9/16)>.015:
        raise ValueError("Reel must be H264, 9:16 and 3–60 seconds for both platforms")
    raw=os.getenv("META_IG_COLLABORATORS","")
    collab=[v.strip().lstrip("@") for v in raw.split(",") if v.strip()]
    if len(collab)>3 or any(not re.fullmatch("[a-zA-Z0-9_.]+",v) for v in collab):
        raise ValueError("Use at most 3 public Instagram collaborator usernames")
    print(f"Validated {secs:.2f}s Reel, caption {len(caption)} chars, collab {collab}")
    return caption,collab

def upload(upload_url,token):
    with VIDEO.open("rb") as f:
        r=HTTP.post(upload_url,data=f,headers={"Authorization":f"OAuth {token}",
            "offset":"0","file_size":str(VIDEO.stat().st_size),
            "Content-Type":"application/octet-stream"},timeout=600)
    if not r.ok:raise RuntimeError(f"Meta upload returned {r.status_code}")

def instagram(token,user_id,caption,collab):
    data={"media_type":"REELS","upload_type":"resumable","caption":caption,"share_to_feed":"true"}
    if collab:data["collaborators"]=json.dumps(collab)
    session=graph(f"{user_id}/media",token,data=data)
    if not session.get("id") or not session.get("uri"):
        raise RuntimeError("Instagram resumable upload unavailable for this app/account")
    upload(session["uri"],token)
    for i in range(24):
        state=graph(session["id"],token,method="GET",params={"fields":"status_code"})
        if state.get("status_code")=="FINISHED":break
        if state.get("status_code") in ("ERROR","EXPIRED"):raise RuntimeError("Instagram processing failed")
        time.sleep(8)
    else:raise TimeoutError("Instagram processing did not finish")
    result=graph(f"{user_id}/media_publish",token,data={"creation_id":session["id"]})
    if not result.get("id"):raise RuntimeError("Instagram publish not confirmed")
    return result["id"]

def facebook(token,page_id,caption):
    session=graph(f"{page_id}/video_reels",token,data={"upload_phase":"start"})
    if not session.get("video_id") or not session.get("upload_url"):
        raise RuntimeError("Facebook Page Reel session unavailable")
    upload(session["upload_url"],token)
    result=graph(f"{page_id}/video_reels",token,data={
        "upload_phase":"finish","video_id":session["video_id"],
        "video_state":"PUBLISHED","title":"mySales Business Tips","description":caption})
    if not result.get("success"):raise RuntimeError("Facebook publishing not confirmed")
    return session["video_id"]

def slot():
    d=dt.datetime.now(ZoneInfo("Africa/Lagos"))
    return d.strftime("%Y-%m-%d")+("-morning" if d.hour<13 else "-evening")

def state_url():
    return f"https://api.github.com/repos/{os.environ['GITHUB_REPOSITORY']}/contents/marketing/reel-autopilot/published/{slot()}.json"

def load_state():
    r=HTTP.get(state_url(),headers={"Authorization":f"Bearer {os.environ['GITHUB_TOKEN']}",
        "Accept":"application/vnd.github+json"},params={"ref":"main"},timeout=30)
    if r.status_code==404:return {},None
    if not r.ok:raise RuntimeError("Cannot verify prior posts; refusing duplicate")
    data=r.json()
    return json.loads(base64.b64decode(data["content"])),data["sha"]

def save_state(state):
    _,sha=load_state()
    payload={"message":f"Record mySales posts for {slot()}","branch":"main",
        "content":base64.b64encode((json.dumps(state,indent=2)+"\n").encode()).decode()}
    if sha:payload["sha"]=sha
    http("PUT",state_url(),json=payload,headers={"Authorization":f"Bearer {os.environ['GITHUB_TOKEN']}",
        "Accept":"application/vnd.github+json"})

def main():
    import argparse
    p=argparse.ArgumentParser();p.add_argument("--dry-run",action="store_true");args=p.parse_args()
    caption,collab=validate()
    if args.dry_run:
        print("DRY RUN: no Reel posted.")
        return
    if os.getenv("META_AUTOPOST_ENABLED","false").lower()!="true":
        print("Auto publishing disabled. No Reel posted.")
        return
    ig=os.getenv("META_IG_USER_ID","")
    token=os.getenv("META_IG_ACCESS_TOKEN","")
    fb_on=os.getenv("META_FB_ENABLED","false").lower()=="true"
    fb_page=os.getenv("META_FB_PAGE_ID","");fb_token=os.getenv("META_FB_PAGE_ACCESS_TOKEN","")
    if not ig or not token:raise ValueError("Instagram ID/token not configured")
    if fb_on and (not fb_page or not fb_token):raise ValueError("Facebook selected but Page ID/token missing")
    state,_=load_state()
    if not state.get("ig_media_id"):
        state["ig_media_id"]=instagram(token,ig,caption,collab)
        save_state(state)
        print(f"Instagram published: {state['ig_media_id']}")
    else: print("Already posted to Instagram in this schedule slot")
    if fb_on:
        if not state.get("fb_video_id"):
            state["fb_video_id"]=facebook(fb_token,fb_page,caption)
            save_state(state)
            print(f"Facebook Page published: {state['fb_video_id']}")
        else:print("Already posted to Facebook in this schedule slot")
    else:print("Facebook direct posting not enabled (not automatically cross-posted)")

if __name__=="__main__":main()
