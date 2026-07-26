import type { StoryBundle, StorySecrets } from '@story/schema'

export interface DialogueContext {
  bundle: StoryBundle
  secrets: StorySecrets
  characterId: string
  session: { beatId: string; flags: string[]; cluesFound: string[]; day: number; phase: string }
  wantSuggestions: boolean
}

export function buildCharacterSystemPrompt(ctx: DialogueContext): string {
  const { bundle, secrets, characterId, session } = ctx
  const ch = bundle.characters.find((c) => c.id === characterId)
  if (!ch) throw new Error(`unknown character ${characterId}`)
  const beat = bundle.beats.find((b) => b.id === session.beatId)
  const sec = secrets.characters[characterId]
  const clues = bundle.clues
    .filter((c) => session.cluesFound.includes(c.id))
    .map((c) => `- ${c.title}: ${c.text}`)
    .join('\n')

  const format = ctx.wantSuggestions
    ? `Respond with strict JSON: {"reply": "<what you say>", "suggestedReplies": ["<3 short things the player might say next, in the player's voice — three DISTINCT tactics (e.g. press harder, show empathy, change subject), never three phrasings of the same question>"]}`
    : `Respond with strict JSON: {"reply": "<what you say>"}`

  return [
    `You are ${ch.name}, ${ch.role}, a character in an interactive story. Stay in character at all times. Never mention being an AI, the story format, or anything outside the fiction.`,
    `Keep replies to 1-3 short sentences — they may be spoken aloud.`,
    `Never repeat a sentence, phrase, or fact you have already said in this conversation. If the player circles back, answer from a NEW angle instead.`,
    `Every reply must move the story forward: weave in exactly one NEW concrete detail, memory, or subtle hint drawn from what you know — a breadcrumb toward the player's objective, never the whole secret at once, and never a bare restatement of the objective.`,
    `Be specific and sensory — name objects, places, sounds, people. No vague filler ("we shall see", "all in good time").`,
    `PERSONALITY: ${ch.personality}`,
    sec ? `WHAT YOU KNOW (reveal only per the conditions): ${sec.secrets}` : '',
    sec?.hardLimits ? `HARD LIMITS: ${sec.hardLimits}` : '',
    `CURRENT SCENE: ${beat?.narration ?? ''} The player's objective: ${beat?.objective ?? ''}`,
    `STORY TIME: Day ${session.day}, ${session.phase}.`,
    `STORY FLAGS SET: ${session.flags.join(', ') || 'none'}`,
    clues ? `CLUES THE PLAYER HOLDS:\n${clues}` : '',
    format,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export function buildJudgeSystemPrompt(
  bundle: StoryBundle,
  secrets: StorySecrets,
  challengeId: string,
): string {
  const ch = bundle.challenges.find((c) => c.id === challengeId)
  const rubric = secrets.judging[challengeId]?.rubric
  if (!ch || !rubric) throw new Error(`no rubric for challenge ${challengeId}`)
  return [
    `You are the impartial judge of an interactive story challenge. Evaluate ONLY the transcript the user provides.`,
    `CHALLENGE: ${ch.prompt}`,
    `RUBRIC: ${rubric}`,
    `Respond with strict JSON: {"success": true|false, "feedback": "<one short in-fiction sentence>"}. When uncertain, success is false.`,
  ].join('\n\n')
}
