# Ancestry Mode — Design

**Date:** 2026-07-26
**Status:** Approved

Family-tree screen with clue-gated unlocks, plus a new demo story that uses it. Framework-first: the tree is data-driven, any story that declares kinship gets it.

## 1. Schema (additive, optional — existing bundles unaffected)

- `character.kin?: { generation: number; parents?: string[] }` — signed generation (−4 = great-great-grandparent, 0 = the player's own, +1 = child, +2 = grandchild). `parents` holds character ids for connector lines.
- `character.availability.requiresClues?: string[]` — the character is unreachable until every listed clue is found.

Validation: `superRefine` checks `requiresClues` ids exist in `clues[]` and `kin.parents` ids exist in `characters[]`.

## 2. Engine

`isCharacterAvailable` gains one condition: every id in `availability.requiresClues` must be in `state.cluesFound`. Beat/phase rules unchanged. The ancestry story lists all cast in each beat's `characters`, so clue gating is what actually paces the story.

## 3. Tree screen (`apps/web/src/components/FamilyTree.tsx`)

- Full-screen overlay (same pattern as Journal: backdrop, `slideup`, clock paused via a dedicated `'tree'` pause reason).
- Opened by a 🌳 button in TopBar, rendered only when the bundle has any character with `kin`.
- Layout: generations sorted ascending (oldest at top), one row per generation with its label ("Four generations back" … "You" … "Yet to come"). Each person is a portrait node; CSS vertical connector between rows (no graph library).
- Node states: **available** (lit, tappable, ring if active), **locked** (silhouette + "Find: <clue title>" for the first missing clue), **known but not here** (dimmed, phase/beat unavailable, with the reason).
- Tap an available node → `selectCharacter(id)` + close. Locked nodes are inert.

## 4. Story: "The Lantern Line" (`stories/lantern-line/`)

One night, 24h clock, `realMinutesPerStoryDay: 8`, `totalStoryDays: 1`, phases `dusk / midnight / small-hours / dawn`. Modes: mcq, text, voice.

**Premise:** You are sixteen. Your grandmother died three days ago and left you a lantern that lets you speak to anyone in your bloodline — the dead and the unborn. Her note: *"Every third of November this family loses someone. It ends with you, if you find out what we did."* You have until dawn.

**Cast** (generation / unlock):
| Character | Gen | Unlocked by |
|---|---|---|
| Sera, your grandmother | −1 | (start) |
| Nadia, her mother | −2 | clue `ledger` |
| Tomas, the child who lived | −3 | clue `photo` |
| Ilsa, who made the choice | −4 | clue `letter` |
| Marren, the name scratched out | −4 | clue `scratched-name` |
| Wren, your daughter (2061) | +1 | (start — the lantern reaches forward) |

**Truth:** In 1891 Ilsa let her sister Marren drown to save her infant son Tomas, and every generation since has kept the silence; the "curse" is the silence. Breaking it means speaking Marren's name to the future.

**Beats:** `b1` the lantern (Sera) → `b2` the pattern (Nadia) → `b3` the child who lived (Tomas) → `b4` 1891 (Ilsa) → `b5` the name (Wren).
**Challenges:** four judged `task` challenges (one per generation) each unlocking the next clue, and a final `task` — say Marren's name to Wren.
**Endings:** `line-breaks` (named Marren to Wren), `half-truth` (reached Ilsa, never named Marren), `another-november` (clock expired).

Secrets file carries each character's withheld knowledge, reveal conditions, hard limits, and the four judging rubrics.

**Assets:** scene backgrounds per phase + cover generated with the existing image script; portraits are public-domain Met Open Access details, credited in `assets/CREDITS.md`.

## 5. Testing

- Schema: `requiresClues`/`kin` validation, both new-story parse checks.
- Engine: clue-gated availability (locked until clue found, then available).
- Web: FamilyTree renders generations in order, locked nodes show their unlock hint and don't select, available nodes select and close; TopBar tree button only with kin data.
- Engine simulation: the new story plays headlessly to `line-breaks`.
- Existing suites stay green; e2e unchanged.

## 6. Out of scope

Tree zoom/pan, marriage/sibling edges beyond `parents`, per-character trust meters, tree animations beyond the unlock ripple, editing the existing two stories.
