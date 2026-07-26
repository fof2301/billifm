// Inlines real story art into the demo deck as data URIs so the deck stays a
// single self-contained file. Idempotent: it works from docs/demo-deck.base.html
// (created on first run) and rewrites docs/demo-deck.html each time.
// Usage: node scripts/embed-deck-images.mjs
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'docs/demo-deck.html')
const BASE = join(ROOT, 'docs/demo-deck.base.html')
if (!existsSync(BASE)) copyFileSync(OUT, BASE)

const work = mkdtempSync(join(tmpdir(), 'deck-'))

/** Downscale + recompress so the inlined deck stays a reasonable size. */
function dataUri(relPath, maxPx, quality = 62) {
  const src = join(ROOT, relPath)
  const dst = join(work, relPath.replace(/[/.]/g, '_') + '.jpg')
  copyFileSync(src, dst)
  execFileSync('sips', ['-Z', String(maxPx), '-s', 'formatOptions', String(quality), dst], { stdio: 'ignore' })
  return `data:image/jpeg;base64,${readFileSync(dst).toString('base64')}`
}

// Titles, genres and taglines are read from the bundles themselves, so the
// deck can never drift from the actual library.
const storyIds = ['riya-calling', 'lantern-line', 'kidnapping-escape', 'night-desk',
  'rain-on-the-vestry', 'salvage-run', 'the-inside-voice', 'ancestor-tree']
const covers = storyIds.map((id) => {
  const meta = JSON.parse(readFileSync(join(ROOT, 'stories', id, 'story.json'), 'utf8')).meta
  return [id, meta.title, meta.genre, meta.tagline]
})
const phases = ['dawn', 'day', 'dusk', 'night']
const faces = [
  ['stories/kidnapping-escape/assets/viktor.jpg', 'Viktor', 'Your captor'],
  ['stories/lantern-line/assets/ilsa.jpg', 'Ilsa', '1891 — the one who chose'],
  ['stories/riya-calling/assets/riya.jpg', 'Riya', 'Calling from three days ago'],
]

let html = readFileSync(BASE, 'utf8')

// --- styles for the inlined art ---
html = html.replace(
  '</style>',
  `
    .art-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:26px}
    .art-strip figure{margin:0;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.09);background:#0b0d13}
    .art-strip img{display:block;width:100%;height:120px;object-fit:cover}
    .art-strip figcaption{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#8b93a7;padding:7px 9px}
    .cover-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:24px}
    .cover-grid figure{margin:0;border-radius:12px;overflow:hidden;border:1px solid rgba(255,255,255,.09);position:relative}
    .cover-grid img{display:block;width:100%;height:150px;object-fit:cover}
    .cover-grid figcaption{position:absolute;left:0;right:0;bottom:0;padding:26px 10px 9px;display:flex;
      flex-direction:column;gap:1px;background:linear-gradient(to top,rgba(5,6,10,.97) 45%,transparent)}
    .cover-grid .ct{font-size:13.5px;color:#f2f5fb;font-weight:600}
    .cover-grid .cg{font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;color:#d4a355}
    .cover-grid .cl{font-size:11px;line-height:1.35;color:#98a1b4;margin-top:3px}
    .face-row{display:flex;gap:16px;margin-top:24px;flex-wrap:wrap}
    .face-row figure{margin:0;display:flex;align-items:center;gap:11px}
    .face-row img{width:64px;height:64px;border-radius:50%;object-fit:cover;border:2px solid rgba(212,163,85,.35)}
    .face-row .fname{font-size:14px;color:#e8ecf7}
    .face-row .frole{font-size:11.5px;color:#8b93a7}
    .slide-art{position:absolute;inset:0;z-index:0;overflow:hidden}
    .slide-art img{width:100%;height:100%;object-fit:cover;opacity:.55}
    .slide-art::after{content:"";position:absolute;inset:0;
      background:linear-gradient(100deg,rgba(5,6,10,.96) 26%,rgba(5,6,10,.45) 62%,rgba(5,6,10,.30))}
    .slide-hook .content,.slide-demo .content{position:relative;z-index:1}
  </style>`,
)

// --- 1. hero + closing get a full-bleed dimmed still ---
const hero = `<div class="slide-art"><img src="${dataUri('stories/lantern-line/assets/cover.jpg', 1400)}" alt=""></div>`
html = html.replace('<section class="slide slide-hook">', `<section class="slide slide-hook">${hero}`)
const closing = `<div class="slide-art"><img src="${dataUri('stories/riya-calling/assets/cover.jpg', 1400)}" alt=""></div>`
html = html.replace('<section class="slide slide-demo">', `<section class="slide slide-demo">${closing}`)

// --- 2. the clock slide shows the four phases of one real scene ---
const strip = `<div class="art-strip">${phases
  .map(
    (p) =>
      `<figure><img src="${dataUri(`stories/kidnapping-escape/assets/${p}.jpg`, 460, 58)}" alt=""><figcaption>${p}</figcaption></figure>`,
  )
  .join('')}</div>`
html = html.replace(
  /<div class="phasebar-wrap">/,
  `${strip}\n            <div class="phasebar-wrap">`,
)

// --- 3. the characters slide shows real faces ---
const faceRow = `<div class="face-row">${faces
  .map(
    ([p, n, r]) =>
      `<figure><img src="${dataUri(p, 200, 68)}" alt=""><figcaption><div class="fname">${n}</div><div class="frole">${r}</div></figcaption></figure>`,
  )
  .join('')}</div>`
html = html.replace(
  /(<h2 class="headline">It's not a script[^<]*<\/h2>)/,
  `$1\n            ${faceRow}`,
)

// --- 4. the stories slide shows every real cover ---
const grid = `<div class="cover-grid">${covers
  .map(
    ([id, title, genre, tagline]) =>
      `<figure><img src="${dataUri(`stories/${id}/assets/cover.jpg`, 420, 58)}" alt="">` +
      `<figcaption><span class="ct">${title}</span><span class="cg">${genre}</span>` +
      `<span class="cl">${tagline}</span></figcaption></figure>`,
  )
  .join('')}</div>`
html = html.replace('<!--COVER-GRID-->', grid)

writeFileSync(OUT, html)
const mb = (Buffer.byteLength(html) / 1024 / 1024).toFixed(2)
console.log(`wrote docs/demo-deck.html — ${mb} MB, ${(html.match(/data:image\/jpeg/g) ?? []).length} inlined images`)
