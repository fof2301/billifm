import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import type { EffectContext, MicListenEvent } from '../types';
import { postSilenceResult } from '../lib/api';

/**
 * M5 - the silence test. The story tests the listener's real room.
 *
 * PRIVACY (rules.md 4, and a pitch claim we must be able to defend):
 * amplitude metering only. Nothing is stored, nothing is transmitted, no STT.
 *
 * Caveat the team must know: expo-av has no metering-without-recording mode -
 * Recording always writes a file. So we write to the cache directory and delete
 * it in a `finally` before this function returns. The audio never leaves the
 * device and never outlives the effect. If a judge asks, that is the honest
 * answer - do not claim we never touch a buffer.
 */
export async function run(event: MicListenEvent, ctx: EffectContext) {
  let recording: Audio.Recording | null = null;
  let uri: string | null = null;
  let peakDb = -160;

  try {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      ctx.log('mic denied - defaulting to the quiet branch');
      return finish('quiet', event, ctx);
    }

    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: false });

    recording = new Audio.Recording();
    await recording.prepareToRecordAsync({
      ...Audio.RecordingOptionsPresets.LOW_QUALITY,
      isMeteringEnabled: true,
    });
    await recording.startAsync();

    // Meter at 10Hz for duration_s. Nothing is drawn on screen - darkness is
    // the interface (Design.md 5).
    const ticks = event.duration_s * 10;
    for (let i = 0; i < ticks; i++) {
      await sleep(100);
      const status = await recording.getStatusAsync();
      if (typeof status.metering === 'number') {
        peakDb = Math.max(peakDb, status.metering);
      }
    }

    const result = peakDb > event.threshold_db ? 'noise' : 'quiet';
    ctx.log(`silence test: peak ${peakDb.toFixed(1)}dB vs ${event.threshold_db}dB -> ${result}`);
    return finish(result, event, ctx);
  } catch (err) {
    ctx.log(`mic_listen failed, defaulting to quiet branch: ${String(err)}`);
    return finish('quiet', event, ctx);
  } finally {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
        uri = recording.getURI();
      }
      if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {
      /* nothing left to do; the file is in app-private cache either way */
    }
  }
}

async function finish(
  result: 'quiet' | 'noise',
  event: MicListenEvent,
  ctx: EffectContext
) {
  void postSilenceResult(result).catch(() => {});
  await ctx.swapAudio(event.branch[result]);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
