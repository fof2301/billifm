# Pocket FM Formula — Research Notes

Compiled 2026-07-26 from web research. Calibrates episode structure, cliffhanger
placement, and register for *Riya Calling*.

## 1. Top shows & numbers (Hindi/India)

- **Insta Millionaire** — ~853M plays, 1,440 eps, ~$15M gross; 80%+ listeners
  aged 18–35. (technosports.co.in/15-best-pocket-fm-stories-you-must-listen/,
  thehardcopy.co/pocket-fm-growthdesign-case-study/)
- **Saving Nora** (revenge drama) — ~500M plays, 1,884 eps, ~$18M gross.
- **The Billionaire's Accidental Bride** ~399M · **Shoorveer** ~293M ·
  **Number Zero** ~258M · **The New Avatar** ~150M/2,000+ eps ·
  **Super Yoddha** ~140M plays.
- **Yakshini** (horror) — 100M plays by Nov 2021, later ~195M; 200K+ reviews;
  5 languages. (prnewswire.com — "Horror audio show Yakshini surpasses 100
  million plays")
- **Devil Se Shaadi** (forced-marriage romance) — ~1,078 eps; ~217M plays.
- Platform: ARR ~$150M by end-2023; Indian users listen ~115 min/day.

## 2. Structural formula

- **Episode length:** 7–15 min typical; official writer guidance: **4–13 min,
  keep length constant across episodes**. Insta Millionaire ≈15 min/ep.
- **Episode counts:** hits run 800–2,000 eps — daily-soap logic. (Our 5-ep
  arc is a demo miniseries; each episode still follows the per-episode rules.)
- **Cliffhanger cadence** (official writer tips, studio.pocketfm.com):
  every episode needs (a) a **high point mid-episode** and (b) a **strong hook
  at the very end**; listeners decide whether to continue **within 30 sec–5 min
  of episode 1**; **first 3 episodes are make-or-break**.
- **Unlock gate:** first ~10–20 episodes free, then locked; unlock via waiting
  (~48 h/ep), ads, or coins (8–10 coins/ep). "Every episode ends on a
  cliffhanger" is the explicit conversion mechanic — the paywall lands
  mid-cliffhanger. 3 of 4 Indian listeners prefer per-episode micropayments.
  (pocketfm.com/frequently-asked-questions, pocketfm.freshdesk.com,
  mediabrief.com — Pocket FM Entertainment Insights 2025)
- **Demo mirror:** eps 1–3 escalate free-feeling; the series' biggest
  cliffhanger sits at the **ep 3→4 boundary** (the paywall slot). In *Riya
  Calling* that is CP3 — the fork.

## 3. Tropes & genre over-indexing

- Genre preference (Pocket FM Insights '25): **Drama 40%, Romance 37%,
  Sci-Fi/Fantasy 37%, Thriller/Horror 34%**; 86% prefer episodic audio drama;
  49% binge 10+ eps/day; Hindi = 53% of listeners; 84% aged 18–35.
- Winning trope stack in the hits: secret identity + betrayal by a loved one +
  underdog vs the powerful + status-reversal/vindication scenes + supernatural
  hook. (*Riya Calling* maps: the impossible phone link [supernatural hook],
  Dev's betrayal [loved-one betrayal], a middle-class girl vs an MLA's dynasty
  [underdog vs power], the endings where her voice topples him [vindication].)

## 4. Dialogue / writing style

- Official tips: write **like a novel, not screenplay** — third-person
  narration carrying dialogue; **modern spoken register, avoid literary
  Hindi** → conversational Hinglish with natural English loanwords.
- Production convention: narrator + modulated character voices + curated BG
  score/SFX. Episode titles are hook-questions.
- Melodrama beats at act turns are rewarded; suspense must be **calibrated to
  the protagonist's emotional state** so cliffhangers feel personal, not
  mechanical (official writer guidance).

## 5. Interactive/branching audio prior art

- Audible × ChooseCo "Choose Your Own Adventure" Alexa skill (2019) —
  voice-controlled branching with full sound design.
- The Wayne Investigation (2016 Alexa skill) — early voice-choice detective drama.
- Amazon Skill Flow Builder (2019) / Storyflow-Voiceflow — authoring tools
  separating branching content from code (same philosophy as our Event
  Track/story-graph JSON).
- Academic guidance for voice IF: **2–3 options max per choice point, restate
  options verbally, place choices at cliffhanger moments.**
  (link.springer.com/chapter/10.1007/978-3-030-68288-0_10)

## 6. Calibration decisions taken for Riya Calling

1. 8–12 min per episode, constant length.
2. Hook inside first 30 seconds of Ep1 (three missed calls → the 2:07 ring).
3. One mid-episode spike + hard cliffhanger every episode end; every
   checkpoint sits ON a cliffhanger.
4. Biggest cliffhanger (the CP3 fork) at the ep 3→4 paywall slot.
5. Options per checkpoint: 2–3 (per voice-IF research; our max is 3).
6. Conversational Hinglish, novel-style minimal narration, emotion-calibrated
   cliffhangers (each one lands on Arjun's guilt or Riya's courage — never on
   plot mechanics alone).
