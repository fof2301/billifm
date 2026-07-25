import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildCharacterSystemPrompt, buildJudgeSystemPrompt } from '../src/prompt'
import { loadStories } from '../src/stories'

const { bundle, secrets } = loadStories(join(__dirname, '../../../stories')).get('kidnapping-escape')!
const session = { beatId: 'b1', flags: ['knows_why_taken'], cluesFound: ['your_gift'], day: 1, phase: 'day' }

describe('buildCharacterSystemPrompt', () => {
  it('includes persona, secrets, hard limits, story state, and clue text', () => {
    const p = buildCharacterSystemPrompt({ bundle, secrets, characterId: 'viktor', session, wantSuggestions: false })
    expect(p).toContain('chillingly patient')          // personality
    expect(p).toContain('vault beneath the house')     // secret knowledge
    expect(p).toContain("Never reveals the vault's location") // hard limits
    expect(p).toContain('Find out why you were taken') // beat objective
    expect(p).toContain('knows_why_taken')             // flags
    expect(p).toContain('your hands can open')         // unlocked clue text
    expect(p).toContain('Day 1, day')                  // story time
  })

  it('requests strict JSON with suggestions when asked', () => {
    const p = buildCharacterSystemPrompt({ bundle, secrets, characterId: 'viktor', session, wantSuggestions: true })
    expect(p).toContain('"suggestedReplies"')
    const noSugg = buildCharacterSystemPrompt({ bundle, secrets, characterId: 'viktor', session, wantSuggestions: false })
    expect(noSugg).not.toContain('"suggestedReplies"')
  })
})

describe('buildJudgeSystemPrompt', () => {
  it('embeds the challenge rubric and asks for a JSON verdict', () => {
    const p = buildJudgeSystemPrompt(bundle, secrets, 'c1')
    expect(p).toContain('special ability of their hands') // rubric text
    expect(p).toContain('"success"')
  })
})
