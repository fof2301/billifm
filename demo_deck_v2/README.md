# demo_deck_v2

The pitch deck. Rebuilt around the one-directional framing.

| File | What |
|---|---|
| `deck.html` | **The deck. Open this.** Self-contained, 16 slides, no external requests. |
| `deck.base.html` | The source. **Edit this one.** |
| `build.mjs` | Regenerates `deck.html` from the base. |

```bash
node demo_deck_v2/build.mjs
```

`deck.html` is generated — editing it directly gets overwritten on the next build.

## What changed from `docs/demo-deck.*`

The old deck opened on *"audio fiction has never listened back"*, which reads as a
complaint about one medium. This one opens wider:

> **Every story ever made is one-directional.** A book, an audiobook, a film — the
> author decides the single path through, and that is the only path you get. You can
> only explore it the way the author intended.

Then the pivot, which is the whole pitch in one line:

> **So we stopped asking authors to write the path. We ask them to write the world.**

Three slides are new, and every one of them closes a gap that would have been scored
against us:

1. **The idea** (slide 3) — the pivot, on its own, so it lands as an idea rather than
   a feature tour.
2. **The AI** (slide 7) — the hidden-rubric judge, promoted from a sub-clause on the
   characters slide to its own act. It is the one thing here that could not have been
   built before, and no competitor will have it.
3. **Personalised** (slide 10) — the submission's problem statement is *Personalized
   Interactive Experiences*, and the old deck never used the word once. Three layers:
   what you said, what you know, who is listening.

Also changed:

- **Partners named.** `OpenAI` and `Databricks` appear on the architecture slide. Both
  were absent from a deck built for a partner hackathon.
- **"What's next" rewritten** from a wishlist (more voices, more stories, video
  someday) into the AI-authoring roadmap: the annotation agent measured at **88%**
  agreement with a human director on unseen material, and the Databricks cohort
  pipeline — labelled **synthetic**, because a judge who discovers that themselves
  costs more than saying it first.
- **Business case on the close.** A story is a folder, so the marginal cost of making
  one unforgettable is near zero.

## The one real difference

The library slide here is **typographic, not art**. `docs/demo-deck.html` inlines
generated JPGs, but only SVG placeholders are committed — the real art is gitignored,
so an image build is not reproducible from a fresh checkout without re-running image
generation.

So this build reads titles, genres, runtimes and taglines straight from each
`stories/*/story.json`. It cannot drift from the actual library, and the deck is
41 KB instead of 479 KB. For the art version, regenerate the images and run
`scripts/embed-deck-images.mjs`.

## Before presenting

**Pick one flagship story.** The hook slide quotes *The Lantern Line*; the library
grid leads with *Riya Calling*, and every doc in `story/` treats Riya Calling as the
showcase. The deck, the submission form and the live demo should all name the same
one.

The spoken script that goes with this deck is in [`../docs/pitch-script.md`](../docs/pitch-script.md).
