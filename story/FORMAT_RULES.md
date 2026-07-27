# FORMAT_RULES.md — the rules a Sutradhar story must obey

Applies to *Riya Calling* and to every episode written after it. Two parts: the
**sensory rules** (what earns each device effect) and the **branching rules** (new —
because this story has 30 paths and visible checkpoints, which the original format
explicitly forbade).

Read with `bible.md` for canon and `branch-map.md` for the graph. This file is the
*law*; those two are the content.

---

# PART 1 — THE GATE

## G1. The listener must be a named character with a reason to hold the phone

Finish this sentence with no hedging: **"The listener is the person who ______."**

Fail it and every effect degrades into a gimmick. The torch thrills because *she
found a torch*. If it fires because the app decided a scary moment deserved a
flourish, the listener notices the app — and the moment they notice the app, the
fiction is over.

**Riya Calling passes, and passes differently from the last story.**

*Aakhri Awaaz*: the listener was a **separate character** — the stranger on the far
end of Meera's hidden line.
*Riya Calling*: the listener **is the protagonist**. Arjun's phone *is* your phone.
Riya calls him, so Riya calls you.

That is the stronger anchor of the two — there is no seam to explain. Keep it.
Everything the device does must be something that would happen to **Arjun's actual
handset**, and nothing else qualifies. This single test disposes of most bad effect
ideas before they're written.

## G2. Helplessness is the fuel — and this story relocates it

The rule: **the more agency the protagonist has, the worse the format works.** An
action hero doesn't need the listener; a trapped person does.

Arjun has plenty of agency — he redials, he confronts Dev, he directs Riya. That
looks like a violation. It isn't, because his helplessness is **relocated from space
to time**: he cannot save her, and every intervention re-routes fate. He is
powerless against the one thing that matters while being busy about everything else.

**Write to that.** Arjun's activity must keep failing at the level that counts. The
moment he can simply fix it, the phone has no reason to act on anyone.

---

# PART 2 — THE SEVEN INGREDIENTS

Each effect needs a specific thing planted in the script. No ingredient, no effect.

| Effect | What you must write for it to be legal |
|---|---|
| `volume_duck` | Someone nearby who must not hear. Never decorative. |
| `screen_dim` | The **same beat** as a duck. Never fires alone. |
| `screen_blackout` | A motivated failure of light — power cut, tunnel, underpass, fuse. |
| `flashlight` | A light source a character **finds and switches on**. |
| `haptic knock_x3` | A real percussive event at a barrier: knocks, a struck door. |
| `haptic heartbeat_rising` | A stretch of dread with no action in it. Sustained, not percussive. |
| `fake_call` | Someone with the listener's number **and a motive to dial it**. |
| `mic_listen` | A threat that can hear **the line**, not merely the room. |
| `message_overlay` | A sender who would text rather than call, and a reason the words land harder written than spoken. |
| `outgoing_call` | A number Arjun would plausibly dial *in that second*, and a reason the outcome matters (answered or not). |

**Riya Calling's ingredients are strong.** The 2:07 AM caller ID is the best
`fake_call` cue the format has had — it needs no explanation at all. Ep3's power cut
earns blackout and torch honestly. Ep5's flyover underpass earns the duck.

---

# PART 3 — SCARCITY IS THE EFFECT, AND THIS IS WHERE THE STORY CURRENTLY FAILS

## S1. Two to four sensory *moments* per episode. Hard ceiling.

A **moment** is a cluster of effects on one beat, not a single effect. Duck + dim +
heartbeat on the same beat is *one* moment. Blackout followed by the torch is *one*
moment. Stacking buys intensity without spending budget — that is the trick.

`fake_call` and `mic_listen` are **decision points**, not sensory moments, and are
counted separately.

## S2. The density audit — run this before recording anything

Counting effect cues in the current scripts:

| Episode | total cues | sensory cues | verdict |
|---|---|---|---|
| ep1 | 18 | 10 | over budget |
| ep2 | 22 | 14 | over budget |
| ep3 | 25 | 18 | over budget |
| ep4a | 13 | 10 | over budget |
| ep4b | 20 | 12 | over budget |
| **ep5** | **67** | **38** | **far over** |

If those cues resolve into 2–4 *clusters* per episode, fine. If they are 38 separate
firings in Ep5, the format is dead on arrival: **an effect the listener expects is a
gimmick; an effect that ambushes them is a memory.** Always-on immersion is the one
failure mode that cannot be fixed in the mix.

**Required action before recording:** for each episode, group the cues into named
moments and confirm the count is ≤4. Ep5 almost certainly needs cuts, and Ep5 is the
episode carrying five endings, so it is also where restraint pays most.

`memory_burn` is the specific risk — the graph says it fires *"repeatedly"* during
E5's night-run. Repeated identical effects are exactly what turns a prop back into a
UI. Fire it three times, not eleven, and make each one cost something.

## S3. The escalation ladder — order is not negotiable

**hearing → sight → touch → the phone itself → the listener's real room**

Each rung is a bigger imposition than the last. The listener's real room comes
**last**, because the mic is the largest ask and only works on total trust.

The first ~90 seconds of any episode carry **no effects**. You are teaching the
listener the phone is safe so you can betray that later. Ep1 must be especially
disciplined: the 2:07 AM call is the payload, and everything before it is the setup
that makes it land.

---

# PART 4 — THE BRANCHING RULES

*Riya Calling* introduces 30 paths and **visible on-screen options** at checkpoints.
The original format banned both (`files/rules.md` §4: *"options exist only in the
schema — NEVER on screen"*; `memory.md` D15: branching vocabulary banned).

That reversal is defensible — but only under the rules below. Without them, the
pitch line *"you never make a choice in Sutradhar"* is simply false, and the answer
to *"so it's Bandersnatch?"* is *"yes."*

## B1. Reconvergence is mandatory

Every option must arrive at the next checkpoint. No option may open a subtree that
never rejoins.

This is not an artistic preference, it is arithmetic: every consequence needs a
rendered asset (`agents.md` Module 4 — *no consequence ships without its asset*). A
truly divergent tree of 4 checkpoints is unrenderable. A reconvergent one costs the
spine plus a handful of short variants.

**The story already does this correctly.** Keep it absolute.

## B2. Flags colour; they do not fork

The correct pattern is already in `branch-map.md`: *"Same rails, different girl."*
`trust=scared` makes Riya whisper more and hesitate at doors; `allied` makes her
improvise jokes. The route is identical; the performance differs.

**Rule:** a flag may change *how* a scene plays — line variants, one extra beat of
danger, a different reading — but may not change *which* scene plays, except at a
declared checkpoint. This keeps 30 paths affordable and keeps continuity provable.

## B3. A visible menu is legal only where the phone itself would show one

**This is the rule that reconciles the reversal, and it is the important one.**

A phone legitimately shows you a list when you are **composing a message**. Choosing
between three drafts of a text is not a narrative menu — it is a phone doing exactly
what phones do. That is diegetic and it is allowed.

A phone does **not** show you *"how do you want the story to go?"* That is UI
wearing the story's clothes, and it breaks G1.

So:

- **Legal:** three draft texts to send Riya (`message_overlay` + `fl1_word`, `fl2_text`). The screen is still a prop.
- **Legal:** a contact list when the beat is "who do you call" — that is a phone screen.
- **Illegal:** an abstract list of intentions with no on-screen justification.
- **Test:** would this list exist on a real handset in this second? If not, it must be voice.

Applied to the current checkpoints: **CP1's options are written as things Arjun
would say** ("Sab sach bata do…", "Kasam do…", "Predict karke dikha do") — good, but
they must be presented as *his draft words on his phone or his voice*, not as three
narrative branches. The framing does all the work here. Same content, different
frame, opposite positioning.

## B4. Never put a menu inside a sensory moment

During a duck, dim, blackout, torch or mic beat, the screen is a **prop**. A menu
turns it back into an interface and cancels the effect you just paid for.

**Checkpoints live in the gaps** — and by preference at the seam between episodes,
which is where `branch-map.md` already puts CP1–CP4. Never mid-set-piece.

Engine consequence: a `checkpoint_menu` must never overlap an active effect window.
Worth asserting in the validator.

## B5. One visible checkpoint per episode

The genome profile sets `decision_point_tolerance: 1`. Two or more visible menus per
episode reads as a game, and "game" invites every comparison the positioning is
built to avoid.

Current structure — one CP at the end of each episode — is correct. Do not add
mid-episode menus.

## B6. Voice outranks menu

If a beat can be run as free voice with outcomes mapped invisibly (A/B/C/FALLBACK),
**do that instead of a menu.** The invisible version is the differentiated product;
the menu is the commodity.

Reserve menus for beats where speech genuinely cannot work — composing a text being
the clear case. The Dev confrontation and the Ep5 lure-resistance beat are already
specified as `interaction_scene`, which is right: those must stay voice, invisible,
no options on screen, ever.

## B7. No dead flags — every option ships with its asset

If an option sets a flag, the variant that flag selects must exist as rendered
audio before the episode ships. An unrendered branch is worse than no branch: it
plays the wrong scene, or silence, in front of judges.

`branch-map.md` should be readable as a manifest. If a variant is listed there, an
audio file exists for it or the option is cut.

## B8. Not choosing is a choice — every checkpoint has a deadline

A checkpoint that waits forever hands the listener a pause button, and a pause
button is the opposite of *the story acts on you*.

Every checkpoint needs a timeout that routes somewhere canon. Silence, hesitation
and refusal are all **moves the story absorbs** (`userflow.md`), never dead ends.
Missing the 2:07 AM call is canon. Not answering Zoya is canon.

## B9. The listener must never be able to count the paths

Reconvergence has to be invisible. The fate mechanic — *every change re-routes* — is
the in-fiction cover, and it is a good one. But it only holds if no scene ever
acknowledges the rails: no "you chose X earlier", no recap of the decision, no
character summarising the alternative.

Characters may reference *consequences* freely. They may never reference the
*choice*.

## B10. Invariants are sacred

Fixed on every path: the crime happened, the motive, the brake line, the 9:40
transformer blast, the 11:58 clock. Reconvergence depends on these; a variant that
contradicts one breaks every downstream scene simultaneously.

Before adding a variant, ask which invariant it touches. If it touches one, it is
not a variant — it is a different story.

## B11. The physical branch reconverges too

The Ep3 silence test is a branch whose input is the listener's real room, not a
menu. Both outcomes must be pre-rendered and both must reconverge — the graph
already says *"tension-only, both results reconverge."* Correct. Never let a
physical branch be the one that forks the plot: mics are unreliable, rooms are
noisy, and a demo cannot afford the plot to hinge on a threshold.

## B12. Vocabulary — the ban still applies

Even with visible checkpoints, these words stay out of all materials and all stage
talk: *branch, branching, choices, your decisions matter, different endings,
interactive fiction.*

Say instead: **checkpoint**, *the story re-routes*, *fate closes the gap*, *the
story tests you*, *reversed agency*.

The ready answer to *"so it's Bandersnatch?"*: **"Bandersnatch gave you a remote. We
gave the story your phone. You are not picking scenes — you are telling your sister
what to do, and fate keeps arriving anyway."**

---

# PART 5 — ANTI-RULES

Absolute. Each one has killed an immersive format somewhere.

1. **No effect during exposition.** No ambience, no always-on immersion.
2. **No effect the fiction didn't cause.** If you cannot name the line of script that causes it, cut it.
3. **No instruction on screen.** *"Stay silent!"* as text destroys the mic beat. A character's whisper **is** the instruction.
4. **No agent turn longer than 2 sentences.** Long TTS on a call kills the illusion.
5. **The protagonist never simply solves it.** The moment Arjun can fix it, the phone has no reason to act.
6. **Never the listener's real world.** No real name, location, family or contacts, ever — in any character's mouth, on any path.
7. **The mic only meters amplitude.** No transcription, no storage, no transmission. This is a privacy line and a pitch point.
8. **No repeated identical effect.** The second identical firing is a gimmick; the fifth is furniture.

---

# PART 6 — THE CHECKLIST

Run every new episode through this. **Q1 is a gate — failing it disqualifies
regardless of the rest.**

**Sensory**
1. Can you name the listener as a character holding this phone? *(gate)*
2. Do the cues group into **≤4 sensory moments**?
3. Does every effect have a line of script that causes it?
4. Are the first ~90 seconds effect-free?
5. Does each effect's ingredient (Part 2) actually appear?
6. Is the protagonist more acted-upon than acting, where it counts?

**Branching**
7. Does every option reconverge to the next checkpoint?
8. Do flags colour scenes rather than fork routes?
9. Would every visible list exist on a real handset in that second?
10. Is every checkpoint outside all effect windows?
11. Exactly one visible checkpoint this episode?
12. Could any menu beat have been voice instead? If yes, make it voice.
13. Does every flag have a rendered asset?
14. Does the checkpoint have a timeout that routes somewhere canon?
15. Does any scene acknowledge the rails? (must be no)
16. Does any variant contradict an invariant? (must be no)

**Production**
17. Does `refine_lines.py` report `0 overrunning`?
18. Does the silence report say `PASS` — no dialogue inside the mic window?
19. Does the render fit the remaining ElevenLabs quota?

---

# PART 7 — THE PRODUCTION CEILING (read before writing more variants)

**ElevenLabs is free tier: 10,000 characters total, ever. ~6,900 remain.**

Five episodes, four voices, 30 paths, five endings. The spine alone exceeds the
budget. Consequences, not opinions:

- **The spine carries the story; variants must be short.** A variant that changes a *reading* costs nothing extra if it is the same words. A variant that adds 200 characters of new dialogue costs 200 characters you cannot re-earn.
- **Prefer flag-coloured performance over flag-selected scenes** (B2). This is a budget rule as much as a craft rule.
- **Voice the moments the demo shows.** Everything off the demo path can be OpenAI TTS (`content/gen_audio_openai.py`) or unrendered.
- **Audition before rendering** (`content/audition_voices.py`), and never re-render to try a setting — use `--only <id>`.
- There is **no Indian-accented premade voice** on this tier and no cloning scope. For a Hinglish story set in Bhopal that is a real ceiling. Upgrading the account is the single highest-leverage spend available.
