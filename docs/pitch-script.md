# Pitch script — Story Framework

**5 minutes. Three roles: DRIVER (phone, silent), NARRATOR (speaks), BACKUP (laptop, runs the fallback).**

Everything in here is true of what is deployed at https://billifm.dauntexlabs.com.
Nothing references the Expo device-effects player (never run on hardware) or claims
the AI authors playable bundles today.

---

## Before you walk up

- [ ] Live site open on the demo phone, screen mirrored. Story pre-loaded to a beat with a character present — **do not** start from the library.
- [ ] Same story open on the laptop at `/#demo` (split view) as the instant fallback.
- [ ] **Backup screen recording** of the full flow, already playing-ready. Venue wifi kills live AI calls; this is not optional.
- [ ] `pnpm e2e` output on screen in a spare tab — the deterministic mocked flow, in case the gateway is down entirely.
- [ ] Deck at slide 1. Phone on Do Not Disturb. Volume up, tested in the room.
- [ ] Decide the flagship story and use it everywhere: deck, form, demo. (Recommended: **The Lantern Line** for the hook, **Riya Calling** as the flagship — or collapse to one.)

---

## 0:00 — Cold open. Do not explain anything.

> *[DRIVER is already in a scene. NARRATOR says nothing about the product yet.]*

**NARRATOR:** "This is a story called The Lantern Line. I'm going to ask this character something the author never wrote."

> *[DRIVER types or speaks something clearly unscripted — e.g. "Why do you keep looking at the door?" or "Are you lying to me?"]*
>
> *[Let the answer land. Silence for two seconds. Do not talk over it.]*

**NARRATOR:** "Nobody scripted that. There is no dialogue tree in there."

---

## 0:35 — The problem. Go wide: this is about all literature, not audio.

**NARRATOR:** "Every story ever made is one-directional.

A book, an audiobook, a film, a podcast — the author decides the single path through it, and that's the only path you get. You can re-read it, re-watch it, listen twice. You get the same story, in the same order, told the same way. **You can only explore it the way the author intended.**

And you can't ask it anything. If you wonder why a character looked at the door, the book doesn't answer. Nobody in there knows you're present.

Even the attempts to fix this didn't. Choose-your-path books, Bandersnatch — those aren't explorable stories, they're a handful of pre-written paths with a menu on top. **Every ending was already filmed.** You're still picking from what the author decided; you're just picking.

Here's why it was always like that: a story had to be *finished* before it could be delivered. Every copy identical. That was a manufacturing constraint, not a creative one — and it isn't true anymore."

> *[Beat. This next sentence is the whole pitch.]*

**NARRATOR:** "**So we stopped asking authors to write the path. We ask them to write the world.**"

---

## The 'how' is a mapping — each piece kills one part of one-directionality

Deliver 1:05 → 3:50 in this order. The mapping *is* the argument; don't reorder it
into a feature tour.

| The piece | What it kills |
|---|---|
| You speak, you don't choose | the menu |
| Characters are people with secrets | pre-written answers |
| Hidden-rubric judge | pre-determined outcomes ← **the big one** |
| A clock that runs without you | the story existing only when you look |
| Clue-gated kin tree | only seeing what you're shown |
| A story is a folder | one story vs a format |

---

## 1:05 — You don't choose. You speak. *(kills: the menu)*

> *[DRIVER: tap a suggested reply chip. Then type. Then hold the mic and speak.]*

**NARRATOR:** "Tap, type, or talk — and switch mid-scene. There's no list of what you're allowed to want; you say the thing you actually thought of.

Even if you only ever tap, the reply chips are generated from where you actually are in the story — so a tap player still gets a living conversation rather than a menu.

Speak, and it's speech-to-text in, and that character's own voice back out."

---

## 1:35 — Characters are people, not lines. *(kills: pre-written answers)*

**NARRATOR:** "Every character is a persona with things to hide, and conditions the author set for giving them up.

Ask something the author never anticipated and you still get an answer — in character, from someone who knows what they're protecting."

---

## 1:55 — Nobody hard-coded the right answer. *(kills: pre-determined outcomes)*

> *[This is the centre of the pitch. Slow down. It is the one thing here that could not
> have been built before, and it is what makes the exploration real rather than decorative.]*

**NARRATOR:** "Here's the part I want you to remember.

When there's a challenge, you don't pick the right answer — **you talk your way through it however you like.** Then an LLM judge reads the entire conversation against a rubric the player never sees, and decides on its own whether you actually solved it.

**Nobody hard-coded a right answer.** Two people get past the same character with completely different arguments — and one can fail while saying something that sounds perfectly reasonable.

That's what makes your route through the story genuinely yours: nothing pre-decided what counted."

> *[DRIVER: attempt a challenge with an unusual approach. Show the outcome.]*

---

## 2:25 — The clock *(kills: the story existing only when you look at it)*

**NARRATOR:** "There's an in-story clock. Every few real minutes is a whole story day — dawn, day, dusk, night — and the scene changes with it.

It runs whether you say anything or not. Hesitating is a decision. **The world is happening; you're in it, not driving it.**

Two things it does pause for: when a reply is in flight, and when your journal is open. Network lag never costs you story time, and thinking is free."

---

## 2:50 — You can reach where the author never pointed *(kills: only seeing what you're shown)*

> *[DRIVER: open journal, then the family tree.]*

**NARRATOR:** "Your journal holds your objective, what you've learned, and who's reachable right now.

And in stories with kinship there's a family tree — generations, top to bottom. Locked people tell you exactly which clue opens them. **Some of the people you can talk to are dead.** You find the clue, and you get to ask your grandmother about the night she died.

The author didn't write that scene. They made her reachable."

---

## 3:20 — Personalisation. This answers the brief — say the word.

**NARRATOR:** "This is personalised at three levels, and none of them is a branch.

**What you say** — the judge rules on your actual words, so the same challenge resolves differently for two people.

**What you know** — flags and clues change who is reachable and what opens. Your journal is not anyone else's.

**Who's listening** — every character reasons over your state, and only your state. They can't reference story you haven't reached yet; that's enforced on the server, not asked for in a prompt."

---

## 3:50 — A story is a folder

> *[Deck slide 8 — the real JSON. Then slide 9 — the library.]*

**NARRATOR:** "Here's the format. A story is `story.json`, a `secrets.json` that never leaves the server, and an assets folder. Both are checked against a schema the moment the server boots — a broken story fails loudly before a player ever sees it, never mid-game.

Eight stories. Seven genres — mystery, thriller, heist, sci-fi, noir, supernatural horror. **We changed zero lines of framework code to add any of them.**

The engine that decides what happens next is pure TypeScript with no DOM and no network. That's why there are 199 tests across four workspaces, plus one Playwright run that plays a story start to finish with no API key at all."

---

## 4:25 — Partners and what's next. Label the honest parts.

**NARRATOR:** "**OpenAI** runs the characters, the voices and the judge. **Databricks** runs the data layer behind this — we simulate listener cohorts and compute behaviour profiles there; the pipeline is real and the listeners are synthetic, and we'll say that on the record.

And the next step is already measured: we have an agent that reads a raw episode transcript and writes the direction for it. Against a human director on material it had never seen, it agreed **88% of the time.**

Today a human authors the folder. Next, the story writes its own."

---

## 4:55 — Close

**NARRATOR:** "For **Pocket FM** the problem was never the audio. It's that a story disappears from your life between episodes.

A story here is a folder — so the marginal cost of making one of them unforgettable is close to zero. We're not offering to upgrade a catalogue. We're offering every serial the one episode people tell their friends about.

It's live right now."

> *[Deck slide 13 — URL on screen.]*

**NARRATOR:** "billifm.dauntexlabs.com. Open it on a phone. That's the real thing."

---

## Q&A — prepared answers

**"So it's Bandersnatch?"**
> "Bandersnatch gave you a remote — every ending was already filmed. Here there's nothing pre-filmed to pick. You say whatever you want, and a character with secrets decides what to give you. It's closer to talking to a person than choosing from a menu."

**"What stops the AI going off the rails / breaking character?"**
> "Three things. The persona has hard limits the author writes. The secrets live server-side and are released only on authored conditions — the model can't leak what it was never given. And the judge decides outcomes, not the character, so a persuasive player still can't rewrite the plot."

**"Is the AI writing the stories?"**
> "Not yet, and I won't claim it. A human authors the bundle today. The annotation agent that writes the direction is built and measured at 88% agreement with a human — turning that into a playable bundle is the next step, not a shipped one."

**"How is this personalised if the story is authored?"**
> "The route is authored; the conversation isn't. Two players clear the same challenge with different arguments, hold different clues, and unlock different people. Nothing about the exchange is pre-recorded."

**"Do you record the user's voice?"**
> "Speech goes to transcription and the audio isn't retained. Nothing about a player's real identity ever enters the fiction — no real names, no location. That's a hard rule in our own spec."

**"Latency?"**
> "The engine is local, so state, timers and the clock are instant. Only the character's reply is a round trip — and the story clock pauses while it's in flight, so lag never costs you story time."

**"What's the hardest part you solved?"**
> "Making outcomes trustworthy without hard-coding answers. An LLM that just chats will let you talk your way into anything. Separating the character from the judge — and hiding the rubric from both the player and the character — is what makes a free-text challenge actually winnable or losable."

---

## If it breaks

| Failure | Move |
|---|---|
| Character doesn't reply | Wait one beat, say *"venue wifi"*, cut to the laptop `/#demo`. Keep talking. |
| Gateway down | Cut to the backup recording. Say plainly it's a recording. |
| Everything down | Deck only. Show the JSON slide and the 199-test slide — the format claim needs no network. |

**Never present a recording as live.** If a fallback fires, say so and move on — it costs one sentence, and getting caught costs the pitch.
