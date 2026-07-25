"""Sutradhar server. One FastAPI process, no DB, no queue, no websockets.

Run it:
    cd server && pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload

--host 0.0.0.0 matters: the demo phone talks to your laptop over the LAN.
"""

from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import agents
import state
import summarize

ROOT = Path(__file__).parent
AUDIO_DIR = ROOT / "audio"
CONTENT_DIR = ROOT.parent / "content"

app = FastAPI(title="Sutradhar")

AUDIO_DIR.mkdir(exist_ok=True)
app.mount("/audio", StaticFiles(directory=AUDIO_DIR), name="audio")


# --------------------------------------------------------------------------- #
# Event track + state
# --------------------------------------------------------------------------- #
@app.get("/event_track/{episode}")
def event_track(episode: int) -> dict[str, Any]:
    """Served from content/ so Content can retune timings without an app rebuild."""
    path = CONTENT_DIR / ("event_track.json" if episode == 8 else f"event_track_ep{episode}.json")
    if not path.exists():
        raise HTTPException(404, f"no event track for episode {episode}")
    return json.loads(path.read_text())


@app.get("/state")
def get_state(listener_id: str = "demo") -> dict[str, Any]:
    return state.load()


class SilenceResult(BaseModel):
    listener_id: str = "demo"
    result: str  # "quiet" | "noise"


@app.post("/silence_result")
def silence_result(body: SilenceResult) -> dict[str, Any]:
    return state.set_flag("silence_test_result", body.result)


# --------------------------------------------------------------------------- #
# M4 - the live villain call (OpenAI Realtime, D12)
# --------------------------------------------------------------------------- #
class SessionRequest(BaseModel):
    listener_id: str = "demo"
    agent: str
    decision_id: str = ""


@app.post("/realtime_session")
async def realtime_session(body: SessionRequest) -> dict[str, Any]:
    """Mint an ephemeral Realtime token with the persona + gated canon baked in.

    The key never reaches the device. The persona is assembled server-side, so
    prompt tuning is a file edit and a re-answer of the call.
    """
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise HTTPException(500, "OPENAI_API_KEY not set")

    model = os.environ.get("OPENAI_REALTIME_MODEL", "gpt-realtime")
    voice = os.environ.get("OPENAI_REALTIME_VOICE", "cedar")
    instructions = agents.build_system_prompt(body.agent)

    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.post(
            "https://api.openai.com/v1/realtime/sessions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "voice": voice,
                "instructions": instructions,
                "modalities": ["audio", "text"],
                "turn_detection": {"type": "server_vad", "silence_duration_ms": 700},
            },
        )
    if res.status_code >= 400:
        raise HTTPException(502, f"realtime session failed: {res.text}")

    data = res.json()
    return {
        "client_secret": data["client_secret"]["value"],
        "model": model,
        "voice": voice,
    }


@app.get("/call", response_class=HTMLResponse)
def call_page() -> str:
    """The WebRTC page the app hides inside a WebView. See static/call.html."""
    return (ROOT / "static" / "call.html").read_text()


class CallEnded(BaseModel):
    listener_id: str = "demo"
    transcript: str = ""
    decision_id: str = ""


@app.post("/call_ended")
async def call_ended(body: CallEnded) -> dict[str, Any]:
    """Transcript -> summary + outcome + flags -> listener state.

    This is the seam where the in-episode call becomes something Meera can thank
    you for 30 minutes later.
    """
    result = await summarize.summarize_call(body.transcript)

    state.add_interaction(
        channel="fake_call",
        character="villain" if "villain" in body.decision_id or not body.decision_id else body.decision_id,
        summary=result["summary"],
    )
    for key, value in result["flags"].items():
        state.set_flag(key, value)
    state.set_flag(f"{body.decision_id or 'call'}_outcome", result["outcome"])

    return {"ok": True, **result}


# --------------------------------------------------------------------------- #
# M6 - post-episode callback (P1, first to cut)
# --------------------------------------------------------------------------- #
class EpisodeComplete(BaseModel):
    listener_id: str = "demo"
    episode: int
    path: str = "safe"  # "safe" | "caught"


@app.post("/episode_complete")
async def episode_complete(body: EpisodeComplete) -> dict[str, Any]:
    state.set_progress(body.episode)
    state.set_flag("episode_path", body.path)

    # asyncio.sleep IS the scheduler (architecture.md 5). 30s in demo.
    delay = int(os.environ.get("CALLBACK_DELAY_S", "30"))
    asyncio.create_task(_callback_after(delay, body.path))

    return {"ok": True, "callback_in_s": delay}


async def _callback_after(delay: int, path: str) -> None:
    await asyncio.sleep(delay)
    # Path A -> Meera calls. Path B -> The Voice calls; the listener's line is his now.
    who = "heroine" if path == "safe" else "villain"
    try:
        await _place_outbound_call(who)
    except Exception as err:  # noqa: BLE001
        print(f"[sutradhar] outbound call failed ({who}): {err}")


async def _place_outbound_call(who: str) -> None:
    """Twilio PSTN leg. Left as the single unimplemented seam on purpose.

    M6 is P1 and the first thing in the cut order, and it is the one piece that
    cannot be verified without live Twilio credentials and an Indian number that
    accepts trial-account calls. Wire it only after M1-M5 and M7 are green.

    Rehearsed fallback if it does not work: play pre-recorded call audio on a
    second phone and say so honestly (scope.md 3.5).
    """
    sid = os.environ.get("TWILIO_SID")
    if not sid:
        print(f"[sutradhar] would place {who} callback now (no TWILIO_SID - skipping)")
        return
    raise NotImplementedError(
        "Twilio outbound leg not wired. See TEAM.md hour 13-15 (Person B)."
    )


@app.get("/healthz")
def healthz() -> dict[str, Any]:
    current = state.load()
    return {
        "ok": True,
        "episode_progress": current.get("episode_progress"),
        "interactions": len(current.get("interactions", [])),
        "openai_key": bool(os.environ.get("OPENAI_API_KEY")),
        "audio_files": sorted(
            p.name for p in AUDIO_DIR.iterdir() if p.suffix.lower() in {".mp3", ".wav", ".m4a"}
        ),
    }
