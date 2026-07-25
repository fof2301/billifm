# userflow.md — Sutradhar: Complete User Flow & Actions

Every screen, every action the user takes, and what the system does in response. The core design tension to remember while reading: **the user acts very little — the story acts on them.** User actions are deliberately few and physical (answer, stay silent, call back). Anything resembling a menu of choices is a design failure.

Legend: 👆 = user action · ⚙️ = system response · 🎭 = story acts on the user

---

## FLOW 0 — First open & consent (one time, ~30 seconds)

1. 👆 User opens the app → lands on the **Show Page** (Aakhri Awaaz cover, Ep 1–8 list, Ep 8 badged "IMMERSIVE ⚡").
2. 👆 Taps **Episode 8**.
3. ⚙️ The one and only consent dialog appears, written in-fiction:
   > *"Yeh kahaani aapki torch, vibration aur microphone istemaal karna chahti hai. Yeh aapko kabhi record nahin karegi."*
   > **[ Kahaani mein aao ]** · **[ Classic mode ]**
4. 👆 User taps **Kahaani mein aao** (Enter the story).
   - If **Classic mode**: episode plays as plain audio; every 🎭 below is skipped; flow ends here.
5. ⚙️ Permissions requested natively (camera/torch, mic). State initialized: `episode_progress = 7`, empty interactions.

**Actions in this flow: 2 taps.** That's the entire onboarding.

---

## FLOW 1 — The Possessed Episode (~6 minutes)

6. 👆 User presses **Play**. (Ideally: headphones or quiet room, at night — the show page suggests "raat ko suno, andhere mein" but never blocks.)
7. ⚙️ Player UI recedes to near-black; scrubber is display-only. From here until the end, the user's job is to *listen*. 

8. 🎭 **[t=1:34] The Whisper** — Meera whispers; volume ducks to 15%, screen dims, heartbeat haptic begins.
   - 👆 *Involuntary action:* user leans in, hunches over the phone, maybe cups it. **No tap. The body is the input.**

9. 🎭 **[t=2:01] The Blackout** — screen goes fully black for 6 seconds (touches blocked; safety: any 3s+ press exits).
   - 👆 User action: none. Sitting in the dark IS the experience.

10. 🎭 **[t=2:07] The Torch** — phone flashlight flickers, then holds, as Meera finds the torch.
    - 👆 User action: none. (Observed behavior to film: users lift the phone and look around their own room.)

11. 🎭 **[t=2:40] The Knocks** — three haptic thuds synced to the knocks on her door.

12. 🎭 **[t=3:30] THE CALL** — episode audio pauses; full-screen **UNKNOWN NUMBER** incoming-call UI, ringtone + vibration.
    - 👆 **DECISION POINT 1 — Answer or not** (swipe green / swipe red / let it ring 25s):
      - **Answer** → live conversation with The Voice (Realtime agent).
        - 👆 During the call the user can: **speak** (say anything — resist, lie, bargain, stay quiet), **stay silent** (he comments on it), **hang up** at any moment.
        - ⚙️ Turn-by-turn: agent replies ≤2 sentences; call self-terminates in 60–90s with his Dinanath slip.
      - **Decline / miss** → story handles it: Meera's pre-recorded panic variant ("Tumne nahi uthaya?! ...Shayad theek kiya. Woh sirf sunna chahta tha ki tum kaun ho.") Flag: `call_missed = true` — the villain references this later.
    - ⚙️ On call end: transcript → summary → `listener.json` (flags: what was revealed, tone, silence). **Khandaan Board unlock:** Dinanath node + red edge appear.

13. 🎭 **[t≈4:10] The story reacts to YOU** — Meera's stitched reaction plays, referencing what the user actually did on the call (revealed / stonewalled / missed).

14. 🎭 **[t=5:00] THE SILENCE TEST** — "Dus second. Koi. Awaaz. Nahi."
    - 👆 **DECISION POINT 2 — but it's not a menu: the user's real body in a real room is the input.** They hold their breath, freeze, silence the TV — or fail to.
    - ⚙️ Mic meters amplitude 10s (nothing recorded, nothing on screen — darkness is the interface). Quiet → Path A (escape). Noise → Path B (caught; The Voice takes over the listener's line).

15. ⚙️ Episode ends → credits sting → `POST /episode_complete` → state: `episode_progress = 8`, path flag saved.

**Deliberate user actions in this flow: 1 tap (play) + 1 call decision + speaking freely on one call + 10 seconds of silence.** Everything else, the story does *to* them.

---

## FLOW 2 — The Story Follows You (between episodes)

16. 👆 User closes the app. Does nothing. Lives their life.
17. 🎭 **~30 min later: the phone rings for real.**
    - Path A → **Meera calls**: thanks them using their actual call behavior; makes them promise to return for Ep 9.
    - Path B → **The Voice calls**: "Ab tum kahaani ka hissa ho."
    - 👆 Actions: answer / decline / talk / hang up. Declining is canon too — the character leaves a voicemail-style voice note instead.
18. 🎭 **Next afternoon: villain voice note** arrives (WhatsApp/SMS) — the hummed shabad + a taunt built from the call summary.
    - 👆 Action: just listens. (No reply channel by design — his notes are one-way; power asymmetry is the point.)
19. ⚙️ Every touchpoint appends to memory. Miss 2+ days → Meera calls asking where you disappeared (retention loop, in-fiction).

---

## FLOW 3 — The Investigation Hub (user-initiated, anytime)

The app's second tab: **"Case"**. Three things live here.

### 3a. Khandaan Board (family tree = murder board)
20. 👆 User opens the Board → sees two family trees, mostly dark silhouettes; unlocked nodes lit (Meera, Dinanath after the call, "???" at the center of the Saluja tree).
21. 👆 Taps any lit node → card: name, what's known, which conversation revealed it ("Unlocked: The Voice's call, Ep 8").
22. 👆 Taps a dark silhouette → *"Iska sach abhi kisi ne nahi bola."* (Nobody has spoken this truth yet.) — a pull to keep investigating.
23. ⚙️ New nodes/edges animate in live whenever an interaction reveals them; AI generates newly referenced relatives canon-consistently.

### 3b. Call Iqbal (the detective line)
24. 👆 User taps **"Iqbal Chacha ko call karo"** (or dials the real number saved from an SMS).
25. 🎭 Iqbal answers on the second ring, chai audible. 
26. 👆 User can, in natural voice: **share** what the villain said · **ask** "ab kya karein?", "yeh Saluja kaun hai?", "kya Dada ji sach mein...?" · **theorize** — he pushes back or builds on it.
27. ⚙️ Iqbal reasons ONLY over unlocked state (spoiler-safe), generates deductions + one next question, and occasionally unlocks a Board node himself ("'94 ki file mein ek naam tha... likh lo: Sethi.").
28. 👆 Hang up anytime; everything said persists to memory.

### 3c. Switch the Line (POV replay)
29. 👆 After completing Ep 8, a new card appears: **"Uski taraf se suno"** (Hear it from his side).
30. 👆 Taps it → the 60-second villain-POV scene of the same call plays, with its own mini event track (his room tone; a single haptic when his hand shakes).
31. 👆 Toggle in the Case tab: **"Kiski line pe ho?"** — Meera's ally / the wire into his world → changes who calls you back between episodes.

---

## FLOW 4 — Return & Episode 9 (the retention proof)

32. 🎭 Ep 9 drop: not a push notification — **Meera calls**: "Aaj raat. Aakhri episode. Line pe rehna."
33. 👆 User opens app → Ep 9 unlocked → Flow 1 pattern repeats with new effects.

---

## The complete action inventory (for the team)

| # | User action | Where | Voluntary? |
|---|---|---|---|
| A1 | Tap episode + accept in-fiction consent | Flow 0 | Yes |
| A2 | Press play | Flow 1 | Yes |
| A3 | Lean in / cup the phone at the whisper | Flow 1 | Involuntary 🎯 |
| A4 | Answer or decline the UNKNOWN call | Flow 1 | Yes — first decision |
| A5 | Speak freely / lie / resist / stay silent on the villain call | Flow 1 | Yes — open voice, no menus |
| A6 | Keep the real room silent for 10 seconds | Flow 1 | Physical 🎯 |
| A7 | Answer/decline the character's real callback | Flow 2 | Yes |
| A8 | Listen to the villain's voice note | Flow 2 | Passive |
| A9 | Explore/tap Khandaan Board nodes | Flow 3a | Yes |
| A10 | Call Iqbal; share, ask, theorize by voice | Flow 3b | Yes |
| A11 | Play the villain-POV scene | Flow 3c | Yes |
| A12 | Toggle whose line you hold | Flow 3c | Yes |
| A13 | Return for Ep 9 when Meera calls | Flow 4 | The metric 🎯 |

🎯 = the three actions that define the product: a body that leans in, a room that goes silent, a listener who comes back. No other audio product has ever had these as inputs.

## Design guardrails on the flow
- Never more than ONE tap-decision inside an episode (the call). Everything else in-episode is listening or physical.
- No on-screen prompts during effects ("Stay silent!" text would kill A6 — Meera's voice IS the instruction).
- Every user utterance anywhere feeds one memory; every memory can surface in any later character's mouth.
- Decline paths are always canon, never dead ends — refusing the call, ignoring the voice note, and silence itself are all "moves" the story absorbs.
