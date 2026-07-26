"""Image asset generator — the visual limb of agents.md Module 4.

For a directed_story.json + a cohort tone key, produce one portrait
1024x1536 image per selected segment via OpenAI `gpt-image-1`. Save to
a Databricks Volume (if configured) and mirror to `content/images/`.

Safety + style rules live in `content/prompts/image_style.md`.

CLI:
    export OPENAI_API_KEY=sk-...
    python -m content.gen_images \\
        --story content/directed_story_v0.json \\
        --cohort-tone thriller_binger_night \\
        --out-dir content/images/thriller \\
        --quality medium

    # both cohorts at once:
    python -m content.gen_images --story ... --both-cohorts --out-dir content/images/
"""

from __future__ import annotations
import argparse
import base64
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional

try:
    from openai import OpenAI
except ImportError as e:
    raise ImportError("pip install openai") from e


# --- Style layers ------------------------------------------------------

HERE = Path(__file__).parent
STYLE_MD = HERE / "prompts" / "image_style.md"


BASE_STYLE = (
    "Cinematic thriller-noir photograph. Portrait 2:3 for a mobile phone. "
    "Bhopal, present day. Low-key lighting, deep shadows, muted palette "
    "with near-black tones and a single blood-red accent. Semi-"
    "photorealistic. Film grain. No text, no captions, no subtitles, "
    "no logos, no watermarks. Original fictional characters only — do "
    "NOT depict any real, living, celebrity, or public figure. The "
    "listener is NEVER in frame. No graphic violence."
)


COHORT_TONES: dict[str, str] = {
    "thriller_binger_night": (
        "Starker contrast. Tighter framing (close-ups). Deeper blacks. "
        "Higher tension. Menacing composition. Colder white balance."
    ),
    "slow_burn_evening": (
        "Softer light. Wider framing with breathing room. Warmer tones — "
        "amber and sepia within the noir palette. More emotional than "
        "menacing. Contemplative composition."
    ),
    # Fallbacks — map any Genome-Agent cohort label to a tone:
    "thriller_binger_active_listener": (
        "Starker contrast. Tighter framing (close-ups). Deeper blacks. "
        "Higher tension. Menacing composition."
    ),
    "slow_burn_patient_returner": (
        "Softer light. Wider framing. Warmer tones (amber, sepia) inside "
        "the noir palette. Contemplative composition."
    ),
    "confrontational_engager": (
        "Direct, close, oppressive framing. High tension. Sharp shadows."
    ),
    "early_dropoff_cohort": (
        "Cool, distant framing. Less immediate menace. Wider shots."
    ),
}


def cohort_tone(name: str) -> str:
    """Look up a tone; fall back to a neutral thriller default."""
    return COHORT_TONES.get(
        name,
        "Balanced noir framing. Neither the sharpest contrast nor the "
        "softest — a middle read of the beat."
    )


# --- Segment → prompt --------------------------------------------------

# Which segment IDs get an image. Aligned with content/directed_story_v0.json
# (Riya Calling default path). Skip checkpoints — the beats are what render.
DEMO_SEGMENT_ALLOWLIST = {
    "ep1_missed_call",
    "ep2_teen_din",
    "ep3_parchhaai",
    "ep4a_vishwasghat",
    "ep4b_kaanch",
    "ep5_spine",
    "e4_wahi_raat",
}


# Fallback beat prompts per known segment id, used when the LLM-authored
# `beat` field is too abstract. Written to describe FRAMES not story.
# Per content/prompts/image_style.md: no faces of real people, no text
# overlays, characters glimpsed obliquely.
BEAT_HINTS: dict[str, str] = {
    "ep1_missed_call": (
        "A man's phone on a wooden desk in a dim bedroom, glowing with an "
        "incoming call notification labelled with just an emoji heart. "
        "Far off through the window, a few faint Diwali sparks in the sky. "
        "The man's silhouette blurred in the foreground — face out of frame. "
        "2:07 AM digital clock softly visible on a nightstand."
    ),
    "ep2_teen_din": (
        "A young woman on a Bhopal apartment terrace at dusk, back to camera, "
        "phone pressed to her ear. City lights below. A single word spray-"
        "painted on the low wall behind her — kept illegible in the frame, "
        "just a smear of white paint. Warm amber horizon. Quiet, waiting mood."
    ),
    "ep3_parchhaai": (
        "The instant a small phone-torch beam cuts through total darkness "
        "in a middle-class Indian home storeroom — cluttered shelves, a "
        "sewing machine, dust in the beam. A woman's hand in the beam. "
        "Cracks of hallway light around a closed wooden door in the "
        "background. Nobody else visible. High tension."
    ),
    "ep4a_vishwasghat": (
        "Two men across a small table in a dimly lit interior — one seated "
        "and lit, the other only a hand and a shoulder in the foreground "
        "shadow. The lit man's face turned toward the camera at three-"
        "quarter angle, unable to hold the gaze. A confrontation the moment "
        "before someone flips."
    ),
    "ep4b_kaanch": (
        "Inside a shuttered car showroom at night. Rows of vehicles in "
        "silhouette under emergency lighting. A young woman in the "
        "foreground, framed small, phone-torch beam picking out a paper "
        "ledger. Reflection of a tall male figure glimpsed in a distant "
        "windshield — deliberately partial, face out of frame."
    ),
    "ep5_spine": (
        "A single mobile phone lying face-up on a bed of Diwali marigolds "
        "and unlit diyas. Notifications piled on the lock screen. A "
        "digital clock reading 11:40 PM. No people. Everything held very "
        "still — the moment before an ending arrives."
    ),
    "e4_wahi_raat": (
        "A rain-slick Bhopal underpass at midnight. A single motorcycle "
        "headlight cutting through the wet dark. A phone dropped on the "
        "road, screen cracked, still glowing. The scene composed to feel "
        "like an accident report photograph — no bodies, no violence, only "
        "the aftermath's cold geometry."
    ),
}


def _beat_prompt(seg: dict) -> str:
    """Prefer the built-in beat hint; fall back to the directed_story field."""
    sid = seg.get("seg_id", "")
    if sid in BEAT_HINTS:
        return BEAT_HINTS[sid]
    return seg.get("beat", "")[:280]


def build_prompt(seg: dict, cohort: str) -> str:
    return (
        f"{BASE_STYLE}\n\n"
        f"SCENE: {_beat_prompt(seg)}\n\n"
        f"MOOD: {cohort_tone(cohort)}"
    )


# --- OpenAI image call -------------------------------------------------

_client: Optional[OpenAI] = None


def _api_key() -> str:
    try:
        from pyspark.dbutils import DBUtils  # type: ignore
        from pyspark.sql import SparkSession  # type: ignore
        dbutils = DBUtils(SparkSession.builder.getOrCreate())
        return dbutils.secrets.get(scope="sutradhar", key="OPENAI_API_KEY")
    except Exception:
        pass
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise RuntimeError("OPENAI_API_KEY not set.")
    return key


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=_api_key())
    return _client


def generate_one(seg: dict, cohort: str,
                 quality: str = "medium",
                 size: str = "1024x1536") -> bytes:
    """One image → PNG bytes."""
    prompt = build_prompt(seg, cohort)
    resp = _get_client().images.generate(
        model="gpt-image-1",
        prompt=prompt,
        size=size,
        quality=quality,
        n=1,
    )
    b64 = resp.data[0].b64_json
    return base64.b64decode(b64)


# --- Storage -----------------------------------------------------------

def _write_local(out_dir: Path, seg_id: str, cohort: str,
                 img_bytes: bytes) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    p = out_dir / f"{seg_id}__{cohort}.png"
    p.write_bytes(img_bytes)
    return p


def _write_volume(volume_dir: str, seg_id: str, cohort: str,
                  img_bytes: bytes) -> str:
    """Upload to a Databricks Volume path via the Files API."""
    import urllib.request
    host = os.environ.get("DATABRICKS_HOST", "").rstrip("/")
    token = os.environ.get("DATABRICKS_TOKEN", "")
    if not (host and token):
        return ""
    path = f"{volume_dir.rstrip('/')}/{seg_id}__{cohort}.png"
    url = f"{host}/api/2.0/fs/files{path}?overwrite=true"
    req = urllib.request.Request(
        url, data=img_bytes, method="PUT",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/octet-stream",
        },
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        if r.status not in (200, 204):
            raise RuntimeError(f"volume upload HTTP {r.status}")
    return path


# --- Orchestration -----------------------------------------------------

def generate_for_story(story: dict, cohort: str, out_dir: Path,
                       volume_dir: Optional[str] = None,
                       quality: str = "medium",
                       allowlist: Optional[set[str]] = None,
                       ) -> list[dict]:
    """Generate images for all allowlisted segments. Returns manifest."""
    allow = allowlist if allowlist is not None else DEMO_SEGMENT_ALLOWLIST
    manifest: list[dict] = []
    for seg in story.get("segments", []):
        sid = seg.get("seg_id", "")
        if sid not in allow:
            continue
        t0 = time.time()
        try:
            img_bytes = generate_one(seg, cohort, quality=quality)
            local_path = _write_local(out_dir, sid, cohort, img_bytes)
            volume_path = _write_volume(volume_dir, sid, cohort, img_bytes) \
                if volume_dir else ""
            manifest.append({
                "seg_id": sid, "cohort": cohort,
                "local_path": str(local_path),
                "volume_path": volume_path,
                "prompt_head": build_prompt(seg, cohort)[:180],
                "bytes": len(img_bytes),
                "elapsed_s": round(time.time() - t0, 1),
            })
            print(f"  ✓ {sid} [{cohort}]  {len(img_bytes)//1024}KB  "
                  f"{time.time()-t0:.1f}s", file=sys.stderr)
        except Exception as e:
            manifest.append({
                "seg_id": sid, "cohort": cohort,
                "error": str(e)[:300],
            })
            print(f"  ✗ {sid} [{cohort}]  {e}", file=sys.stderr)
    return manifest


def _main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--story", required=True, type=Path)
    ap.add_argument("--cohort-tone", default=None,
                    help="Tone key (see COHORT_TONES). Or use --both-cohorts.")
    ap.add_argument("--both-cohorts", action="store_true",
                    help="Generate for both thriller_binger_night and slow_burn_evening")
    ap.add_argument("--out-dir", type=Path, default=Path("content/images"))
    ap.add_argument("--volume-dir", default=None,
                    help="e.g. /Volumes/billifm/eval/assets/story_v0")
    ap.add_argument("--quality", choices=["low", "medium", "high"],
                    default="medium")
    ap.add_argument("--manifest", type=Path, default=None)
    args = ap.parse_args()

    story = json.loads(args.story.read_text())
    cohorts = ["thriller_binger_night", "slow_burn_evening"] \
        if args.both_cohorts else [args.cohort_tone or "thriller_binger_night"]

    all_manifest: list[dict] = []
    for c in cohorts:
        print(f"\n=== Generating for cohort '{c}' ===", file=sys.stderr)
        all_manifest.extend(generate_for_story(
            story, c,
            out_dir=args.out_dir / c,
            volume_dir=args.volume_dir,
            quality=args.quality,
        ))

    manifest_path = args.manifest or (args.out_dir / "manifest.json")
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(all_manifest, indent=2))
    print(f"\nWrote {len(all_manifest)} manifest entries → {manifest_path}",
          file=sys.stderr)


if __name__ == "__main__":
    _main()
