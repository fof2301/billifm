# Design.md — Sutradhar Experience & Content Design

> **The name is the design brief.** In Indian theatre, the Sutradhar ("thread-holder") is the invisible narrator-puppeteer who controls everything on stage. Our Event Track is exactly that: an invisible director track that pulls the strings of the listener's phone. The phone is the stage; the story holds the threads.

## 1. Design philosophy
1. **Scarcity is the effect.** 2–4 sensory moments per episode, each justified by the script. An effect the listener expects is a gimmick; an effect that ambushes them is a memory.
2. **The phone is diegetic.** Every effect must have an in-story explanation: the torch turns on because *she found a torch*; the phone rings because *the kidnapper is calling her phone — which you are holding*. Never "app does cool thing"; always "story reaches through the phone."
3. **Whisper-first sound design.** Fear lives at low volume. The duck moment works because the listener must physically lean in — the design goal is changing the listener's body, not their screen.
4. **Live only where liveness is felt.** Narration is pre-generated (quality), conversations are live (magic). Never mix these up.

## 2. The showcase story — "Aakhri Awaaz" (Episode 8 of 8)
Serial premise (episodes 1–7, summarized in canon): Meera, a true-crime podcaster in Bhopal, got too close to a serial extortionist known only as THE VOICE. Episode 7 ended with her abducted; her phone — the listener's phone — is the only thing she managed to keep.

### Episode 8 beat sheet (6 minutes, timestamps drive the event track)
| Time | Beat | Effect |
|---|---|---|
| 0:00–1:30 | Meera wakes in a storeroom, whispers into the hidden phone, recaps stakes. Establishes: "you" are on the other end of her line. | none — earn trust first |
| 1:34 | Footsteps outside. "He's coming — I have to whisper." | `volume_duck` to 15% + `screen_dim`; heartbeat haptic underneath |
| 2:01 | Power cut. Total dark. Silence, breathing. | `screen_blackout` 6s |
| 2:07 | "Wait — there's a torch in this drawer…" click. | `flashlight` flicker_then_on, hold 20s |
| 2:40 | Three slow knocks on the storeroom door. | `haptic` knock_x3, synced to sound design |
| 3:00 | Meera: "He took my SIM — if he calls, it comes to YOU. Don't tell him anything." | plants the call |
| 3:00 | **UNKNOWN NUMBER incoming.** | `fake_call`, pause audio, live villain agent |
| post-call | Meera reacts to what the listener did (two pre-recorded variants: told / didn't tell). | resume audio, variant select via flag |
| 5:00 | "He's outside. He's listening. Don't. Make. A. Sound." | `mic_listen` 10s — **the story tests the listener's real room** |
| 5:10 | Room stayed quiet: he walks away; Meera escapes to the window — cliffhanger. Room made noise: door bursts open — harder cliffhanger. (Two pre-recorded paths; an implementation detail we never surface.) | audio path swap |
| end | Credits sting. | triggers `/episode_complete` → heroine callback in 30s |

### Characters
**MEERA (heroine).** 28, sharp, dry-humored even in fear; speaks Hinglish; whispers 80% of the episode. Voice: warm mid-range, breathy under stress. Motivation: expose The Voice; treats the listener as her last trusted ally ("sirf tum ho ab").
**THE VOICE (villain).** Calm, courteous, never shouts — menace through politeness. Speaks slowly, uses the listener's own words back at them. Never threatens the listener's real world; all menace is about Meera and the fiction. Voice: low, unhurried, slight smile in the tone.

### Conversation design (live agent turns)
- Villain opener (scripted): "You are not Meera. …Interesting. Then you must be the friend she keeps whispering to."
- Goal of the call (agent objective): extract where Meera is / what she has told the listener. Max 2 sentences per turn. If listener stonewalls 3 turns → villain exits with: "Loyalty. I respect that. She won't." (hangup)
- Every call ends inside 60–90 seconds by design — brevity preserves the illusion and the demo clock.
- Heroine callback opener (context-fed): references the villain-call summary. e.g., "Tumne usse kuch nahi bataya… thank you. Kal raat, episode nau. Please be there."

## 2b. The World Layer — how three more problem-statement bullets live inside the same story

**The motive is a family tree.** In 1994, Meera's grandfather Dinanath testified in an extortion trial; the accused family was ruined — a father jailed (died inside, 2003), a mother institutionalized, two sons scattered. The Voice is the younger son. The case IS two khandaans connected by one buried betrayal, three generations deep.

**Khandaan Board (AI Family Tree — P2 bullet).** A screen in the app: two family trees, mostly dark at Ep 8. Every interaction lights nodes — the villain lets slip he knew Dinanath's name → Dinanath's node + a red edge appear. AI generates ancestors/descendants + their one secret on demand, validated against canon. The tree is the murder board, not a widget.
- Scope: JSON-rendered tree screen; nodes unlock from interaction flags; AI generation of new relatives behind a "canon validator" prompt. NOT building: multi-generation world simulation, tree editing.

**Iqbal, the third character (AI Detective — P2 bullet).** Meera's retired-cop uncle. Callable between episodes; reasons over the listener's ACTUAL interaction history ("you said he went quiet when you mentioned the trial — that silence is a confession, beta"), generates deductions and next questions live. Voice: gravelly, affectionate, chai-slurping.
- Scope: one more voice persona + a "detective" prompt fed listener state + clue list. NOT building: evidence mini-games, puzzle validation.

**Switch the Line (character switching).** After finishing Ep 8, the listener can switch whose line they hold: replay the villain-call scene from THE VOICE's side — same 60 seconds, his room tone, his hesitation, what he almost said before hanging up. Between episodes, choose whose companion you are: Meera's ally or the wire into his world (changes who calls you back).
- Scope: ONE pre-generated 60-second POV scene with its own mini event track; a toggle for callback identity. NOT building: full parallel episodes per character.

**Living Characters (P2 bullet — claim it by name).** Meera, The Voice, and Iqbal remember every conversation across weeks; relationships evolve permanently (stonewall the villain three times → by Ep 10 his tone carries respect). Already implemented via listener state; now stated explicitly in the pitch.

Pitch line for this layer: "These aren't five features. It's one world — and every problem statement Pocket FM listed is just a window into it."

## 3. App UX
### Screens (only three)
1. **Home / Episode list** — looks like a minimal Pocket FM show page: cover art ("AAKHRI AWAAZ" in deep red on near-black), Ep 1–8 list, Ep 8 marked "IMMERSIVE ⚡". Sole purpose: demo starts from something that reads as a real product.
2. **Player** — full-bleed dark UI: cover art, scrubber (display-only), one large play/pause. During effects the UI recedes (dim overlay); the player never announces effects.
3. **Fake call screen** — pixel-faithful Android incoming-call layout: "UNKNOWN NUMBER", avatar silhouette, green/red swipe buttons, subtle ringtone + vibration. Answer → live call UI with mute/end. This screen must NOT look like part of our app; the deception is the design.

### Visual language
- Palette: near-black `#0D0D12`, blood red accent `#C0392B`, off-white text `#EDEDED`. No gradients, no playful shapes — thriller austerity.
- Type: Inter (UI); the show logotype may use a condensed display face.
- Motion: effects own the drama; UI motion stays minimal (200ms fades only).
- Immersive-consent moment (one-time, in-fiction): "This story would like to use your torch, vibration and microphone. It will never record you." [Enter the story / Classic mode]. This dialog is also a pitch slide — privacy as design.

## 4. Audio design
- Narration/scene audio: ElevenLabs multilingual v2, Hinglish; separate voice IDs for Meera, The Voice, narrator sting.
- Mix rule: dialogue -14 LUFS baseline so the 15% duck is dramatic but intelligible on phone speaker at demo volume.
- Haptic patterns are authored against the sound design (knocks in audio and hand must be sample-synced ±50ms — sync haptics to audio position, not wall clock).
- Branch audios share the first 2 seconds (door area ambience) so the swap is seamless.

## 5. Effect design specs
| Effect | Spec |
|---|---|
| volume_duck | Ramp 800ms to 0.15 gain; restore ramp 1200ms; never hard-cut |
| screen_dim | Black overlay opacity 0.85 + brightness floor; restore with story beat |
| screen_blackout | Opacity 1.0, block touches, hard 6s cap (safety: any tap ≥3s exits) |
| flashlight | flicker_then_on = 80ms×3 pulses, 400ms gap, then solid; hold_s then off |
| haptics | knock_x3 = heavy 120ms ×3 @700ms; heartbeat_rising = medium pulses accelerating 900→450ms over 8s |
| fake_call | Rings max 25s then "missed call" (story handles it: Meera panics — pre-recorded variant) |
| mic_listen | Meter 10s @10Hz; threshold in JSON (`-35dB` default); show nothing on screen (darkness is the interface) |

## 5b. Pitch language rules (positioning is design)
- BANNED words on stage and in the writeup: "branch," "branching," "choices," "your decisions matter," "different endings," "interactive fiction." These pattern-match to Bandersnatch/AI Dungeon and kill our novelty. 
- Our vocabulary instead: "the story acts on you," "the story tests you," "the story has senses," "reversed agency," "live actor," "the AI is the director."
- Ready answer if a judge says "so it's Bandersnatch?": "Bandersnatch gave you a remote. We gave the story your phone. You never make a choice in Sutradhar — the story watches, listens, and reaches out."
- Always name partners where load-bearing: "the kidnapper is an OpenAI Realtime agent — that's why you can interrupt him and he hears your silence"; "the director ran across a 500-episode catalog on Databricks overnight."

## 6. Anti-patterns (never do)
- Effects during exposition or as ambience. No "always-on immersion."
- Any effect without an in-story cause.
- Agent monologues >2 sentences; villain breaking character to be helpful.
- UI toasts/labels announcing effects ("Immersive moment!") — silence sells it.
- Using the listener's real name, location, or contacts anywhere in the fiction.
