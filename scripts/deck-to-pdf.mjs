// Renders docs/demo-deck.html to a landscape PDF, one page per slide.
// Usage: node scripts/deck-to-pdf.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'docs/demo-deck.html')
const OUT = join(ROOT, 'docs/demo-deck.pdf')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
await page.goto(pathToFileURL(SRC).href, { waitUntil: 'load' })
// The deck reveals one slide at a time; print styles show them all, but the
// entrance animations still need a beat to settle before we snapshot.
await page.waitForTimeout(1200)
await page.pdf({
  path: OUT,
  width: '1280px',
  height: '720px',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
  pageRanges: '1-13',
})
await browser.close()
console.log(`wrote ${OUT}`)
