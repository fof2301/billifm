import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { StoryBundleSchema } from '@story/schema'

// The real gateway always serves bundles through StoryBundleSchema.parse() (it validates at
// boot — see loadStories in apps/server/src/stories.ts), which fills in schema defaults such as
// beat.transitions/when.flags. Parsing here too keeps this mock representationally faithful to
// what the app actually receives in production; a bare JSON.parse of the file omits those
// defaults and desyncs the mock from the real gateway contract.
const story = StoryBundleSchema.parse(
  JSON.parse(readFileSync(join(import.meta.dirname, '../stories/kidnapping-escape/story.json'), 'utf8')),
)
const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'

test('plays kidnapping-escape start to finish in MCQ mode', async ({ page }) => {
  let dialogueCount = 0
  await page.route('**/api/stories', (r) => r.fulfill({ json: { stories: [story.meta] } }))
  await page.route('**/api/stories/kidnapping-escape', (r) => r.fulfill({ json: story }))
  await page.route('**/stories/**/assets/**', (r) =>
    r.fulfill({ body: SVG, contentType: 'image/svg+xml' }),
  )
  await page.route('**/api/sessions/snapshot', (r) => r.fulfill({ json: { ok: true } }))
  await page.route('**/api/dialogue', (r) => {
    dialogueCount++
    r.fulfill({
      json: {
        text: dialogueCount === 1 ? 'You have a gift. Your hands.' : 'We are done talking.',
        suggestedReplies: ['Why my hands?', 'Let me go'],
      },
    })
  })
  await page.route('**/api/judge', (r) => r.fulfill({ json: { success: true, feedback: 'done' } }))

  // First-play coach marks would otherwise cover the stage and block every click below —
  // pre-seed the "already seen it" flag so this flow exercises the story, not onboarding.
  await page.addInitScript(() => localStorage.setItem('sf-coached', '1'))
  await page.goto('/')
  await page.getByText('The Cellar').click()
  await page.getByRole('button', { name: 'Choices' }).click()
  await page.getByRole('button', { name: 'Begin' }).click()

  // beat 1: dismiss narration, talk to Viktor via a starter chip; judge passes c1
  await page.getByText('tap to continue').click()
  await page.getByRole('button', { name: 'Viktor' }).click()
  await expect(page.getByText("Ah. You're awake. Good — we have work to do.")).toBeVisible()
  await page.getByRole('button', { name: 'Who are you?' }).click() // framework starter chip

  // judge success -> beat 2 -> mcq challenge c2 options appear (suggestions cleared on beat change)
  await page.getByText('tap to continue').click()
  await page.getByRole('button', { name: 'A bird' }).click()

  // beat 3 -> task c3: starters show again, judge passes -> escaped ending
  await page.getByText('tap to continue').click()
  await page.getByRole('button', { name: 'What is this place?' }).click()

  await expect(page.getByText('Out, together')).toBeVisible({ timeout: 15_000 })
})
