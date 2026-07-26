// Builds demo_deck_v2/deck.html from demo_deck_v2/deck.base.html.
//
// Unlike scripts/embed-deck-images.mjs, this does NOT inline story art. The real
// generated JPGs are gitignored (only SVG placeholders are committed), so an
// image build isn't reproducible from a fresh checkout without re-running image
// generation. Instead the library slide is built typographically from each
// bundle's own story.json — so it can never drift from the actual library, and
// the deck stays a single file with no external requests.
//
// Usage: node scripts/build-deck-v2.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = join(ROOT, 'demo_deck_v2/deck.base.html')
const OUT = join(ROOT, 'demo_deck_v2/deck.html')

// Order matters: flagship first.
const storyIds = [
  'riya-calling', 'lantern-line', 'kidnapping-escape', 'night-desk',
  'rain-on-the-vestry', 'salvage-run', 'the-inside-voice', 'ancestor-tree',
]

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const cards = storyIds.map((id) => {
  const { meta } = JSON.parse(readFileSync(join(ROOT, 'stories', id, 'story.json'), 'utf8'))
  return `              <div class="story-card">
                <h4>${esc(meta.title)}</h4>
                <div class="genre">${esc(meta.genre)} · ${meta.estimatedMinutes} min</div>
                <p>${esc(meta.tagline)}</p>
              </div>`
})

let html = readFileSync(BASE, 'utf8')
if (!html.includes('<!--COVER-GRID-->')) throw new Error('COVER-GRID placeholder missing from base')
html = html.replace('<!--COVER-GRID-->', `<div class="story-grid">\n${cards.join('\n')}\n            </div>`)

writeFileSync(OUT, html)

const slides = (html.match(/class="slide[ "]/g) ?? []).length
console.log(`wrote demo_deck_v2/deck.html — ${(html.length / 1024).toFixed(0)} KB, ${slides} slides, ${cards.length} stories`)
