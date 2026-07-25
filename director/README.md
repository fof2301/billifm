# director/ — The AI Sutradhar (M7)

The headline AI feature, and the one that is **never cut** (D11). It also has zero
dependency on the phone, the audio, or the server — so this stream starts at hour
zero and never waits for anyone.

```bash
pip install -r requirements.txt
export OPENAI_API_KEY=...
```

## The four things in here

### 1. Annotate — transcript in, playable Event Track out

```bash
python annotate.py transcripts/ep8.txt --out /tmp/agent_track.json
```

`transcripts/ep8.txt` is the Ep 8 script **with every effect marker stripped**, so
the agent has to rediscover the direction. That makes it a real test rather than a
copy exercise.

### 2. Validate — the guardrail that is the platform claim

`validate.py` enforces monotonic timestamps, whitelisted effects and patterns, a
cue and a reason on every event, and the sensory-moment budget. Output that passes
is playable in the app *unchanged* — and that "unchanged" property is what makes
"any episode is one JSON away" true instead of aspirational.

A note on the budget, because the docs look contradictory: scope says "≤4 sensory
moments per 6 min", the design philosophy says "2–4 per episode", and the
hand-authored Ep 8 track has five effect clusters. All three are consistent once
you count a *moment* as a cluster of effects on one beat, and exclude decision
points. Ep 8 = three sensory moments (whisper, blackout+torch, knocks) + two
decision points (call, silence). That is what the validator implements.

### 3. Compare — the acceptance number

```bash
python compare.py ../content/event_track.json /tmp/agent_track.json
```

Matches agent placements against the human-authored track (same effect type,
within 5s) and prints an agreement percentage. The PRD's "a human agrees ≥80% of
the time" becomes a number you can put on a slide.

It also prints what the agent added that you did not. **Read that list** — more
than once it will be right and you will be wrong, and "the AI found a moment we
missed" is a better story than "the AI matched us".

### 4. Catalog — the Databricks scale proof

```bash
python make_catalog.py --count 500 --jsonl --out catalog/
```

500 synthetic episode transcripts across five genres, deterministic per index so a
re-run is comparable. Feed them to the annotation agent as a Databricks batch job,
land the results in a Delta table, and build one dashboard (effects per genre,
sensory moments per episode).

**These transcripts are synthetic and we say so on stage.** The pipeline is real;
the catalog is generated. That distinction is the whole difference between a demo
and a lie (scope.md §3.5).

## Stage demo order

1. Paste a fresh transcript, run `annotate.py`, let the direction stream out with
   its reasoning.
2. Run `compare.py` — "it agreed with our human director 88% of the time, and
   here is the one moment it found that we missed."
3. Show the Databricks dashboard — "then we ran it across 500 episodes overnight."

## Related

`eval/` is the other half of this stream: the Genome Agent (M10a). It already does
persona simulation → JSONL events → Delta tables → cohort aggregation, which is
most of the pipeline. **Remap its event names to ours; do not rewrite it.**
