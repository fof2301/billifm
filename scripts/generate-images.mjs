// Content pipeline: generate scene backgrounds + covers for story bundles.
// Usage: node --env-file=.env scripts/generate-images.mjs [--force]
// Writes stories/<id>/assets/*.webp (or .png on dall-e-3 fallback) and
// updates each story.json's backgrounds/cover paths. Skips existing files
// unless --force. Bills the OPENAI_API_KEY in use.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const KEY = process.env.OPENAI_API_KEY
if (!KEY) throw new Error('OPENAI_API_KEY required (run with: node --env-file=.env scripts/generate-images.mjs)')
const FORCE = process.argv.includes('--force')

const STYLE =
  'painterly digital illustration, cinematic lighting, rich atmosphere, no people, no text, no words, no letters, no watermark'

const SCENES = {
  'kidnapping-escape': {
    base: 'A dim underground cellar: rough concrete walls, a narrow metal cot with a thin grey blanket, a small barred window high on the wall, a single bare hanging bulb, a heavy bolted door in shadow, tense thriller mood.',
    phases: {
      dawn: 'cold blue-grey first light seeping through the barred window',
      day: 'a hard narrow shaft of daylight cutting across the dusty floor',
      dusk: 'dying amber light, long distorted shadows, the bulb glowing weakly',
      night: 'near darkness, a thin sliver of moonlight, the bulb off',
    },
    cover:
      'The heavy cellar door slightly ajar, harsh light leaking around its edges into darkness, a keyhole glowing faintly, ominous thriller book-cover composition.',
  },
  'ancestor-tree': {
    base: 'A warm cluttered attic: old leather trunks, stacks of faded photographs, dust motes floating in light beams, a round window, an antique brass locket resting on a wooden chest, nostalgic magical-realism mood.',
    phases: {
      morning: 'golden morning light streaming through the round window',
      evening: 'deep amber lamplight, long soft shadows, dust glittering like fireflies',
    },
    cover:
      'An antique brass locket on a wooden chest caught in an attic light beam, faint translucent silhouettes drifting in the dust behind it, warm mysterious book-cover composition.',
  },
}

let model = process.env.IMAGE_MODEL ?? 'gpt-image-1'

async function callImagesApi(prompt) {
  const body =
    model === 'gpt-image-1'
      ? { model, prompt, size: '1024x1536', quality: 'medium', output_format: 'webp' }
      : { model, prompt, size: '1024x1792', quality: 'standard', response_format: 'b64_json' }
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    // Some accounts can't use gpt-image-1 (org verification) — fall back once.
    if (model === 'gpt-image-1' && (res.status === 403 || res.status === 404 || /verif|model/i.test(text))) {
      console.warn(`gpt-image-1 unavailable (${res.status}); falling back to dall-e-3`)
      model = 'dall-e-3'
      return callImagesApi(prompt)
    }
    throw new Error(`images api ${res.status}: ${text.slice(0, 300)}`)
  }
  const json = await res.json()
  return Buffer.from(json.data[0].b64_json, 'base64')
}

const ext = () => (model === 'gpt-image-1' ? 'webp' : 'png')

for (const [storyId, cfg] of Object.entries(SCENES)) {
  const storyPath = join(ROOT, 'stories', storyId, 'story.json')
  const story = JSON.parse(readFileSync(storyPath, 'utf8'))

  for (const [phase, mood] of Object.entries(cfg.phases)) {
    const rel = `assets/${phase}.${ext()}`
    const abs = join(ROOT, 'stories', storyId, rel)
    if (existsSync(abs) && !FORCE) {
      console.log(`skip ${storyId}/${rel} (exists)`)
    } else {
      console.log(`generating ${storyId}/${rel} …`)
      const img = await callImagesApi(`${cfg.base} ${mood}. ${STYLE}. vertical mobile wallpaper composition`)
      writeFileSync(abs, img)
      console.log(`  wrote ${(img.length / 1024).toFixed(0)} KB`)
    }
    story.scene.backgrounds[phase] = `assets/${phase}.${ext()}`
  }

  const coverRel = `assets/cover.${ext()}`
  const coverAbs = join(ROOT, 'stories', storyId, coverRel)
  if (existsSync(coverAbs) && !FORCE) {
    console.log(`skip ${storyId}/${coverRel} (exists)`)
  } else {
    console.log(`generating ${storyId}/${coverRel} …`)
    const img = await callImagesApi(`${cfg.cover} ${STYLE}`)
    writeFileSync(coverAbs, img)
    console.log(`  wrote ${(img.length / 1024).toFixed(0)} KB`)
  }
  story.meta.cover = coverRel

  writeFileSync(storyPath, JSON.stringify(story, null, 2) + '\n')
  console.log(`updated ${storyId}/story.json`)
}
console.log('done')
