import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// @testing-library/dom's `waitFor` (used by @testing-library/react) only advances fake
// timers itself when it can see a global `jest.advanceTimersByTime` — see
// https://github.com/testing-library/dom-testing-library/issues/939. Vitest's `vi` doesn't
// expose one, so under `vi.useFakeTimers()` a bare `await waitFor(...)` schedules its poll
// on the faked clock and nothing ever advances it, hanging forever. Shim just that one
// method so `waitFor` can drive Vitest's fake timers the same way it drives Jest's.
if (typeof (globalThis as { jest?: unknown }).jest === 'undefined') {
  ;(globalThis as { jest?: { advanceTimersByTime: (ms: number) => void } }).jest = {
    advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms),
  }
}
