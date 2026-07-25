# RIYA CALLING — Branch Architecture

**The contract:** 4 checkpoints per playthrough · 30 unique end-to-end paths ·
5 endings · plot and motive invariant on every path. Every option at every
checkpoint flows to the next checkpoint. The listener never feels the rails —
the story's own fate mechanic covers the reconvergence.

---

## 1. The graph

```
                        EP1  "Missed Call"
                             │
                        ┌── CP1 ──┐            "Usse kaise yakeen dilaoge?"
                   3 options: SACH / KASAM / SABOOT
                        └────┬────┘            (all → EP2, trust flag differs)
                             │
                        EP2  "Teen Din, Teen Raat"
                             │
                        ┌── CP2 ──┐            "Kal raat uska plan kya hai?"
                     2 options: CHAARA / OJHAL
                        └────┬────┘            (all → EP3, watcher flag differs)
                             │
                        EP3  "Parchhaai"       ← the intruder set-piece
                             │
                        ┌── CP3 ──┐            THE FORK (ep3→4, paywall slot)
                 2 options: TRACK A / TRACK B
                   ┌─────────┴──────────┐
              EP4A "Vishwasghat"   EP4B "Kaanch Ka Mahal"
              (Dev ka hisaab)      (the break-in)
                   │                    │
              ┌─ CP4a ─┐           ┌─ CP4b ─┐
              3 options            2 options
              │   │   │            │       │
              E1  E2  E3           E4      E5
           SHIKANJA │ BHAAG    WAHI RAAT  11:58
                BHARI MEHFIL
                   └───── EP5 "11:58" (one episode, five endings) ─────┘
```

**Path math: 3 (CP1) × 2 (CP2) × [3 (via Track A) + 2 (via Track B)] = 3 × 2 × 5 = 30 paths.**

Endings: E1 Shikanja · E2 Bhari Mehfil · E3 Bhaag · E4 Wahi Raat · E5 11:58.
Riya survives in E1, E2, E3, E5. She dies (but wins) in E4. E4 is the
**default/canonical path** — the story "as written," fate + justice — so users
who replay to *avert the outcome* find E1/E2/E5, which is exactly the replay
loop the demo wants to showcase.

**Default path (the one linear_script.txt compiles):**
CP1→SABOOT, CP2→CHAARA, CP3→TRACK B, CP4b→WAHI RAAT.

---

## 2. Checkpoints — exact UI copy + reconvergence proof

Every checkpoint block below states: the dramatic question, the option copy
(what the listener sees on screen), the variant scene each option buys, the
flag it sets, and **why every option lands on the same next checkpoint**.

### CP1 — end of Ep1 · "Woh teen din baad marne wali hai. Usse kaise yakeen dilaoge?"
*(She dies in three days. How do you make her believe you?)*

| # | Option (UI copy) | Variant scene (Ep2 cold open) | Flag |
|---|---|---|---|
| 1 | **SACH** — "Sab sach bata do — ki woh teen din baad nahi rahegi" | He says it plainly. She laughs, then goes silent, then hangs up. Twenty minutes later she calls back, voice small: the 9:40 transformer blast he'd mentioned in passing just happened outside her window. | `trust=scared` |
| 2 | **KASAM** — "Kasam do — bina wajah bataye, Diwali raat ghar se bahar mat nikalna" | He uses the brother-card: "Papa ki kasam." She promises, unsettled, but catches him lying about *why* — trust is cracked; she starts testing him. | `trust=shaky` |
| 3 | **SABOOT** — "Agle ek ghante ki har cheez predict karke dikha do" | He predicts her next hour: Sharma uncle's card-game fight, Maa burning the kheer, the 9:40 transformer blast. By the third hit she's terrified AND thrilled — the little podcast detective lights up. | `trust=allied` |

**Reconvergence:** all three land at the same state by Ep2 scene 2 — *she
believes him enough to cooperate* — because the transformer blast (a fixed
event in all variants) closes whatever gap the option left. The flag colours
everything downstream: `scared` Riya whispers more and hesitates at doors;
`shaky` Riya double-checks his instructions (one extra beat of danger in Ep3);
`allied` Riya improvises jokes under pressure. Same rails, different girl.

### CP2 — end of Ep2 · "Koi Riya pe nazar rakh raha hai. Aaj raat ka plan?"
*(Someone is watching her. What's the plan for tonight?)*
Timing note: CP2 is decided ≈11 PM on D-2; both options execute immediately
and the midnight intruder set-piece follows the same night. (Diwali-eve
markets run late — the CHAARA op at 11 PM is plausible and reads bolder.)

Context: the brake-line reveal just landed (it was murder), and Riya has
spotted a man photographing the house.

| # | Option (UI copy) | Variant scenes (Ep3 first half) | Flag |
|---|---|---|---|
| 1 | **CHAARA** — "Riya bait banegi — usse dikhne do, hum uska chehra chahiye" | She walks to the market wired on a call with Arjun, doubles back through the sabzi lane, and *makes* the watcher blink: she photographs his bike. Number plate half-visible. Fear becomes offense. | `watcher=seen_bike` |
| 2 | **OJHAL** — "Riya gayab ho jaye — Ashoka Garden, Mausi ke ghar, aaj hi" | She slips out to Mausi's within the hour, back lanes, no scooty. And before midnight, the watcher's shadow crosses **Mausi's** gate. Nobody knew she moved. *Nobody except the people she trusts.* The mole-dread is born. | `watcher=knows_moves` |

**Reconvergence:** both options end Ep3's first half at the same place — the
watcher has found her (because Dev's leak means the Chaddha side always knows),
and at midnight the intruder set-piece happens wherever she is. CHAARA arms her
with the bike photo (evidence flag); OJHAL arms her with the traitor question
(suspicion flag). Both are live ammunition for Ep4 — different track, same rails.

### CP3 — end of Ep3 · THE FORK · "Aakhri poora din bacha hai. Kaunsa dhaaga khichoge?"
*(One full day left. Which thread do you pull?)*

Context: she survived the intruder. Two facts glow in the dark: (1) the
intruder knew things only Dev knew; (2) the intruder came for the **recorder** —
the SD card is the motive. One day, two threads, no time for both.

| # | Option (UI copy) | → Track |
|---|---|---|
| 1 | **DEV KA SAAMNA** — "Pehle ghar ka bhedi. Riya Dev se sach ugalwaegi" | **Ep4A Vishwasghat** |
| 2 | **KAANCH KA MAHAL** — "Proof pura karo — Chaddha showroom ke records raat mein" | **Ep4B Kaanch Ka Mahal** |

This is the one *plot-divergent* choice (the "2 different checkpoints" the
structure promises): the two tracks are different episodes with different
climax checkpoints. They reconverge only at the fact level that matters for
Ep5: **by Diwali morning, Riya knows who and why, Rohan knows she knows, and
the bail-hearing deadline stands.** What differs is *what she holds* — a
confession and a broken boy (A), or hard documents and a hunted night (B) —
which is why the two tracks offer different endings.

### CP4a — end of Ep4A · "Diwali raat. Dev tumhare saath hai. Kya karna hai?"

Context (Track A): Dev confessed — his leak, his terror, his complicity. He'll
do anything now. You hold: Kalia's drunk phone-confession (recorded), Dev as
witness, but no documents.

| # | Option (UI copy) | → Ending |
|---|---|---|
| 1 | **SHIKANJA** — "Dev wire pehnega. Showroom mein Rohan se sach kabulwao, record karo" | **E1** |
| 2 | **BHARI MEHFIL** — "MLA ki Diwali sabha mein, sab ke saamne, speaker pe chala do sab kuch" | **E2** |
| 3 | **BHAAG** — "Koi hero-giri nahi. Riya aaj raat sheher chhod degi — zinda rehna jeet hai" | **E3** |

### CP4b — end of Ep4B · "SD card poora hai. Rohan ko pata hai. Aakhri chaal?"

Context (Track B): she got the ledger photos + the workshop's repair record for
the smashed SUV — the hard chain. But a camera saw her leave. Rohan's men are
already on the roads between her and home.

| # | Option (UI copy) | → Ending |
|---|---|---|
| 1 | **SACH KI DAAK** — "Aaj raat kuch mat karo. Teen parcel banao — court, press, crime branch. Subah pahunchenge" | **E4** |
| 2 | **11:58** — "Bhaago mat, chhupo mat. Main line pe hoon — poori raat. Hum 11:58 ke paar nikalenge, saath" | **E5** |

**Note the honest trap in E4's copy:** it *reads* like the safe option — and it
is the smart one; the parcels DO land. But Diwali night still comes for her
(the watchman-lure adapts), and fate completes itself while the evidence is in
the mail. Users who chose "safe" learn the series' thesis: you can't sit out
the night. That's what sends them back to replay for E5.

---

## 3. Endings (Ep5 plays the common spine, then the chosen ending)

Every ending keeps the invariants: Rohan killed Sana; Dev leaked; the hearing
is tomorrow; the SD card exists; the lure message comes at 11:41 PM. What
changes is what Riya does with the night — and what it costs.

### E1 — SHIKANJA (Track A) · *the trap*
Dev wears the wire into the showroom's Diwali party. Rohan, two pegs in and
cornered by his own bravado, says the sentence — *"Ek scooty wali ka intezaam
kiya hai aaj raat ka, tension mat le"* — premeditation, on tape, BEFORE the
attempt. The takedown at the gate is executed by past-side (3-days-ago)
police acting on the anonymous tip package Riya delivers — Zoya herself never
contacts the past (see §5 timeline note). Cost: Dev takes Kalia's
knife across the palms holding the door. Riya lives. Rohan goes in for Sana AND
attempt-to-murder. Bittersweet-triumphant. *Flag echoes:* `trust=allied` gives
the wire-scene banter; `watcher=seen_bike` lets the bike photo nail Kalia too.

### E2 — BHARI MEHFIL (Track A) · *the public burning*
MLA's Diwali sabha, MP Nagar. Riya patches Arjun's edit — Sana's voicemail,
the watchman's voice note, Kalia's confession — into the PA system Dev has
access to (showroom staff run the event AV). Three thousand people, one
minute of audio. Rohan unravels *on stage* grabbing for the mic — the crowd's
phones film everything. Arrest by morning (public pressure outruns the MLA's
fixers). Riya lives, but the Chaddha empire stands, wounded and patient.
Victory with a sequel-shadow: *"jeet gaye... par jung baaki hai."*

### E3 — BHAAG (Track A) · *the escape*
No heroics. Dev drives her to Itarsi junction at dusk; she boards the Pushpak
with the SD card sewn into her jacket. Diwali midnight passes in a train
corridor... 11:58 comes and goes. She's alive — the record flickers and holds:
**"whereabouts unknown."** But the evidence never filed, the hearing sails
through, Rohan walks free, and the link dies mid-sentence — the last thing
Arjun hears is wheels on tracks. Epilogue: a voicemail from a new number:
*"Zinda hoon, bhaiya. Par kab tak bhaagungi?"* Safe, hollow, haunted. (The
ending that proves survival ≠ winning — and quietly indicts the "safe" instinct.)

### E4 — WAHI RAAT (Track B) · *fate + justice — THE DEFAULT ENDING*
The parcels go out at dusk from three different post offices. It's done; she
just has to stay home. At 11:41 the lure lands anyway — Ramdin's number:
*"Beta, woh log mere ghar pe hain. Tune jo diya tha maine wapas...*" — Ramdin,
the broken witness, the one loose thread she can't leave to burn. She goes.
Arjun screams down the line; she puts the phone in her jacket pocket, mic
open — *"Bhaiya. Sun'na mat chhodna."* The flyover. The SUV. **11:58.** The
record doesn't flicker this time. Three mornings later (present), the parcels
land; the tape of her last eleven minutes — recorded through the very phone
link — is the final nail. Rohan convicted for Sana and for Riya. Her podcast
gets its last episode, posted by Arjun: *"Khoji, episode aakhri. Host: meri
behen."* The listener sobs; justice is total; the girl is still gone. **This
is the story as originally written — the ending fate always had on file.**

### E5 — 11:58 (Track B) · *the golden save — costs everything*
The all-in gambit. She doesn't hide and doesn't run *blind* — she runs a route
only a man with three days of hindsight could call: Arjun stays on the line
the entire night, steering her past every checkpoint of her own death — away
from the lure (because in THIS variant he finally tells her the full truth of
11:58, `reveal_death=true`), through the mela crowd when the SUV noses her
lane, dark under the flyover she died beneath while Kalia's headlights sweep
past above. Every turn he calls, another memory of her burns — Nainital, her
first day of school, her voice on the childhood video, the smell of the
kitchen on her birthdays — the price rule, paid on-screen. **11:58:** the SUV
finds them on the service road — headlong beat — and at the last second Zoya's
timeline-side trap (present-Zoya found the 3-days-ago traffic-barricade work
order was still *pending history* and filed one change — a barricade moved
200 meters; the single sanctioned present→past act in the series) forces Kalia's SUV into the barricade instead. 12:00 AM. She's
past it. **The record rewrites live** — obituary dissolves, the chat history
re-threads, the cremation photos in his gallery become Diwali photos — and
Arjun forgets. All of it. The calls, the three nights, her death that now
never was. Final scene: his phone rings. **Riya 💜.** *"Bhaiyaaaa, ghar aaja,
Maa bula rahi hai. ...Arre, ro kyun rahe ho?"* He doesn't know. Cut to black.
Rohan still falls: the parcels (she still mailed them at dusk — invariant)
land after the hearing collapses. Maximal ending: survival + justice + the
cost paid by the one who'll never know he paid it.

---

## 4. Flags (the personalization layer — same rails, different ride)

| Flag | Set at | Values | Downstream effects |
|---|---|---|---|
| `trust` | CP1 | scared / shaky / allied | Riya's register in every scene; one extra danger-beat in Ep3 if `shaky`; wire-banter in E1 if `allied` |
| `watcher` | CP2 | seen_bike / knows_moves | Ep4 ammunition: bike photo (nails Kalia in E1/E4 epilogue) vs mole-suspicion (Dev confrontation lands harder in Ep4A) |
| `track` | CP3 | dev / showroom | Which Ep4, which climax checkpoint, which endings reachable |
| `evidence` | Ep4 outcome | confession / documents | Epilogue texture in every ending; what convicts Rohan |
| `reveal_death` | E5 only (Ep1 SACH also sets partial) | true/false | Whether Riya ever knowingly speaks about her own death — the two scenes where she does are the series' emotional peaks |
| `memory_debt` | Ep2 onward, auto-increments per change | 0–5 | Which memories Arjun has lost; read aloud in Ep5; E5 spends all |

Flags are exactly what the **Zoya advice-agent** and the **genome pipeline**
consume: Zoya's live answers reference `trust`, `watcher`, `evidence`
("dekho Arjun, bike ka number aadha hai, par aadha kaafi hai...") — this is
the demo proof that the AI persona knows *your* playthrough.

## 5. Timeline discipline (the one hard consistency rule)

Zoya exists in the PRESENT. Riya acts in the PAST. They never talk. Everything
past-side is executed by Riya/Dev; everything present-side (records, Sana case
files, parcel arrivals, E5's barricade trick) is Arjun+Zoya. The E5 barricade
is the single sanctioned present→past intervention and it works only because
traffic-barricade logs are *pending history* (bible rule 4) until Diwali
re-occurs. Writers: if a scene needs Zoya to affect the past any other way,
the scene is wrong — rewrite it.

## 6. Flavor checkpoints (non-branching choices — the message-typing demo)

These add felt agency WITHOUT multiplying paths. Same next scene either way;
the choice sets a cosmetic flag and — crucially — drives the **message-overlay
UI demo** (the listener watches their chosen text get typed and sent).

| ID | Where | Choice | Effect |
|---|---|---|---|
| FL1 | Ep2, proof game | Which secret word she writes on the terrace wall: **"AB2026"** / **"BUDDHU"** | The aged-wall photo that arrives shows the chosen word |
| FL2 | Ep3, she's hiding, phone on silent | What you type to her: **"chup. saans mat le."** / **"main hoon. darr mat."** | Different whispered reply post-scene; `trust` echo |
| FL3 | Ep5 (all endings), 11:40 PM | Your last text before the lure lands: **"jo bhi ho, phone mat chhodna"** / **"I love you, Riyu"** | The text is read back in the ending's final scene |

## 7. Reconvergence audit — why no path leaks

- **CP1 options** differ in *how belief happens*, not whether. The transformer
  blast at 9:40 (fixed event, all variants) is the belief-clincher on every path.
- **CP2 options** differ in *where the midnight intruder finds her*, not whether.
  Dev's leak guarantees the Chaddha side always finds her — that's canon (§3
  bible) doing the rails' work.
- **CP3** genuinely diverges (by design — the promised "two different
  checkpoints"), but both tracks arrive at Diwali morning with the same four
  invariants: she knows who/why; he knows she knows; the deadline stands; the
  SD card exists. Ep5's common spine plays identically up to 11:40 PM on all
  30 paths; only the chosen ending's execution differs.
- **No option is a dead end, a loop, or an early exit.** Every option's variant
  scene ends by handing the listener to the next checkpoint inside one scene.
- **Motive never moves.** On all 30 paths, Rohan's motive is the same
  (bail-hearing deadline + Sana coverup) and Dev's leak is the same. Choices
  change *tactics and costs*, never *truth*. (This is the user-invisible
  contract that keeps 30 paths writable and canon-safe.)

## 8. Path count enumeration (for the record)

CP1 ∈ {SACH, KASAM, SABOOT} → 3
CP2 ∈ {CHAARA, OJHAL} → 2
CP3=A: CP4a ∈ {SHIKANJA, MEHFIL, BHAAG} → 3 → endings E1/E2/E3
CP3=B: CP4b ∈ {DAAK, 11:58} → 2 → endings E4/E5

Total = 3 × 2 × (3 + 2) = **30 paths**, 5 endings,
paths per ending: E1:6 · E2:6 · E3:6 · E4:6 · E5:6 (perfectly balanced).
Flavor checkpoints (FL1–FL3) multiply *felt* variety (×8 surface variants)
without adding paths.

## 9. Where each demo feature fires (the showcase map)

| Demo feature | Story moment |
|---|---|
| **Fake incoming call** | Ep1 2:07 AM "Riya 💜" (signature); Ep5 final call (E5) |
| **Fake outgoing call** | Ep3: Arjun dials Riya while intruder is inside — she can't pick up (missed-call dread); Zoya advice calls (any time between beats) |
| **Message-overlay typing UI** | Ep1 missed-calls/chat popup; FL1–FL3 typed choices; E5 chat history re-threading live |
| **Haptics** | Ep1 heartbeat on caller-ID; Ep3 knock_x3 (intruder at the storeroom door); Ep5 heartbeat_rising through 11:50–11:58 |
| **Blackout + flashlight** | Ep3: power cut in her house; her phone-torch = the listener's torch |
| **Volume duck / whisper** | Ep3 hiding scene; Ep5 flyover underpass |
| **Silence test (mic)** | Ep3: "woh darwaze ke bahar hai — saans mat lena" — the LISTENER's room must stay silent |
| **Live AI persona (advice)** | Zoya — callable, flag-aware, canon-gated |
| **Live AI persona (emotional)** | Riya free-talk moments (Ep2 terrace call, Ep4 "last normal conversation") |
| **Interaction agent (invisible A/B/C in conversation)** | Dev confrontation (Ep4A) and Riya's lure-resistance beat (Ep5) run on the constrained-outcome schema |
| **Director/genome** | `linear_script.txt` (default path) is the director-v2 input; two genomes re-segment the same script — checkpoint placement shifts by cohort |
| **Checkpoint menus (visible options)** | CP1–CP4 as designed above — the new visible-choice mode |
