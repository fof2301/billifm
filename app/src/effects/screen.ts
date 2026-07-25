import * as Brightness from 'expo-brightness';
import type { EffectContext, ScreenBlackoutEvent, ScreenDimEvent } from '../types';

/**
 * M1 (dim) and M2 (blackout).
 *
 * Blackout blocks touches for its duration. Safety valve lives in the overlay
 * component itself: any press held >=3s dismisses it, so nobody is ever trapped
 * in a black screen (Design.md 5).
 */
export async function run(
  event: ScreenDimEvent | ScreenBlackoutEvent,
  ctx: EffectContext
) {
  if (event.type === 'screen_dim') {
    ctx.setOverlay(event.opacity, false, event.fade_ms);
    await sleep(event.hold_s * 1000);
    ctx.setOverlay(0, false, event.fade_ms);
    return;
  }

  // screen_blackout: overlay AND hardware brightness floor, so an OLED panel
  // reads as genuinely off rather than "dark grey rectangle".
  let restore: number | null = null;
  try {
    restore = await Brightness.getBrightnessAsync();
    await Brightness.setBrightnessAsync(0);
  } catch (err) {
    ctx.log(`brightness unavailable, overlay only: ${String(err)}`);
  }

  ctx.setOverlay(1, true, 0);
  await sleep(event.duration_s * 1000);
  ctx.setOverlay(0, false, 200);

  if (restore !== null) {
    try {
      await Brightness.setBrightnessAsync(restore);
    } catch {
      /* leave it - the user's system brightness reasserts on background */
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
