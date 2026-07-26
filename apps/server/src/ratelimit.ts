export interface RateLimiter {
  allow(deviceId: string, nowMs: number): boolean
}

export function createRateLimiter(maxPerMinute: number): RateLimiter {
  const hits = new Map<string, number[]>()
  return {
    allow(deviceId, nowMs) {
      const windowStart = nowMs - 60_000
      const recent = (hits.get(deviceId) ?? []).filter((t) => t > windowStart)
      if (recent.length >= maxPerMinute) {
        hits.set(deviceId, recent)
        return false
      }
      recent.push(nowMs)
      hits.set(deviceId, recent)
      return true
    },
  }
}
