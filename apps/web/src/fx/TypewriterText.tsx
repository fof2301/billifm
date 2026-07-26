import { useEffect, useRef, useState } from 'react'

/**
 * Reveals `text` one character at a time on an interval of `1000/cps` ms, showing a
 * blinking-style caret (▌) while incomplete. Clicking completes the reveal instantly.
 * `onStep` fires on every reveal tick (the final tick — the one that completes the
 * text — counts as a step too, so callers don't need a separate "done" callback) so a
 * parent can keep a scroll view pinned to the bottom as the line grows. The reveal
 * counter resets whenever `text` changes, so a new line always starts from scratch.
 */
export function TypewriterText({
  text,
  cps = 30,
  onStep,
}: {
  text: string
  cps?: number
  onStep?: () => void
}) {
  const [revealed, setRevealed] = useState(0)
  const onStepRef = useRef(onStep)
  onStepRef.current = onStep
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setRevealed(0)
    if (text.length === 0) return
    const id = setInterval(() => {
      setRevealed((prev) => {
        const next = Math.min(prev + 1, text.length)
        // Cleared from inside the tick that reaches the end (not a separate effect)
        // so exactly `text.length` ticks ever fire — no extra "completion" tick.
        if (next >= text.length) clearInterval(id)
        return next
      })
      onStepRef.current?.()
    }, 1000 / cps)
    intervalRef.current = id
    return () => {
      clearInterval(id)
      intervalRef.current = null
    }
  }, [text, cps])

  function complete() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (revealed < text.length) {
      setRevealed(text.length)
      onStepRef.current?.()
    }
  }

  const done = revealed >= text.length
  return (
    <span onClick={complete}>
      {text.slice(0, revealed)}
      {!done && <span aria-hidden="true">▌</span>}
    </span>
  )
}
