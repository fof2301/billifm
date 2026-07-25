import * as Haptics from 'expo-haptics';
import type { EffectContext, HapticEvent } from '../types';

/**
 * M3 - synced knock haptics.
 *
 * Exactly two named patterns. No haptic framework (scope.md M3).
 *  knock_x3         heavy 120ms x3 at 700ms spacing
 *  heartbeat_rising medium pulses accelerating 900 -> 450ms over 8s
 *
 * Sync is to audio POSITION, not wall clock - the engine already fires us off
 * the position ticker. If the knocks feel late, move event.t in the JSON; do
 * not add compensation code here.
 */
export async function run(event: HapticEvent, ctx: EffectContext) {
  try {
    if (event.pattern === 'knock_x3') {
      for (let i = 0; i < 3; i++) {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        if (i < 2) await sleep(700);
      }
      return;
    }

    // heartbeat_rising - interval shrinks linearly across ~8s.
    const total = 8000;
    let elapsed = 0;
    let gap = 900;
    while (elapsed < total) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await sleep(gap);
      elapsed += gap;
      gap = Math.max(450, gap - 60);
    }
  } catch (err) {
    ctx.log(`haptic ${event.pattern} failed: ${String(err)}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
