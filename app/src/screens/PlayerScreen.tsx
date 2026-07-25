import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Audio } from 'expo-av';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { EventEngine } from '../engine/eventEngine';
import { audioUrl, fetchEventTrack, postEpisodeComplete } from '../lib/api';
import type { EffectContext, EventTrack, FakeCallEvent } from '../types';
import { C, FADE_MS } from '../theme';
import FakeCallScreen from './FakeCallScreen';

/**
 * Screen 2 - the possessed player. Owns the audio, the position ticker, the
 * overlay, and the EffectContext that every handler is given.
 *
 * The UI deliberately does almost nothing: no effect is ever announced, the
 * scrubber is display-only, and there is no progress text during effects.
 * Silence sells it (Design.md 6).
 */
export default function PlayerScreen({ classic }: { classic: boolean }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const engineRef = useRef<EventEngine | null>(null);
  const positionRef = useRef(0);
  const callResolver = useRef<(() => void) | null>(null);

  const overlay = useRef(new Animated.Value(0)).current;
  const [blockTouches, setBlockTouches] = useState(false);
  const [call, setCall] = useState<FakeCallEvent | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [branchPath, setBranchPath] = useState<'safe' | 'caught' | null>(null);

  const pushLog = useCallback((m: string) => {
    // eslint-disable-next-line no-console
    console.log('[sutradhar]', m);
    setLog((prev) => [m, ...prev].slice(0, 6));
  }, []);

  // ---- EffectContext: the only surface handlers are allowed to touch --------
  const ctx: EffectContext = {
    async setVolume(to, rampMs) {
      const sound = soundRef.current;
      if (!sound) return;
      const status = await sound.getStatusAsync();
      const from = status.isLoaded ? (status.volume ?? 1) : 1;
      const steps = Math.max(1, Math.round(rampMs / 50));
      for (let i = 1; i <= steps; i++) {
        await sound.setVolumeAsync(from + ((to - from) * i) / steps);
        await sleep(50);
      }
    },
    setOverlay(opacity, block, fadeMs) {
      setBlockTouches(block);
      Animated.timing(overlay, {
        toValue: opacity,
        duration: fadeMs,
        useNativeDriver: true,
      }).start();
    },
    async pauseAudio() {
      await soundRef.current?.pauseAsync();
      setPlaying(false);
    },
    async resumeAudio() {
      await soundRef.current?.playAsync();
      setPlaying(true);
    },
    async swapAudio(file) {
      pushLog(`swap audio -> ${file}`);
      setBranchPath(file.includes('caught') ? 'caught' : 'safe');
      await soundRef.current?.unloadAsync();
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl(file) },
        { shouldPlay: true, volume: 1 },
        onStatus
      );
      soundRef.current = sound;
      positionRef.current = 0;
      // Branch audio carries no further events; the timeline is done.
      engineRef.current?.stop();
    },
    presentFakeCall(event) {
      return new Promise<void>((resolve) => {
        callResolver.current = resolve;
        setCall(event);
      });
    },
    log: pushLog,
  };

  const onStatus = useCallback(
    (status: any) => {
      if (!status.isLoaded) return;
      positionRef.current = status.positionMillis ?? 0;
      if (status.didJustFinish) {
        setPlaying(false);
        void postEpisodeComplete(8, branchPath ?? 'safe').catch(() => {});
        pushLog('episode complete -> callback scheduled');
      }
    },
    [branchPath, pushLog]
  );

  // ---- Load track + audio --------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await activateKeepAwakeAsync();
        const track: EventTrack = await fetchEventTrack(8);
        const { sound } = await Audio.Sound.createAsync(
          { uri: audioUrl(track.audio) },
          { shouldPlay: false, volume: 1, progressUpdateIntervalMillis: 250 },
          onStatus
        );
        if (cancelled) {
          await sound.unloadAsync();
          return;
        }
        soundRef.current = sound;

        if (!classic) {
          engineRef.current = new EventEngine(track, ctx, () => positionRef.current);
        }
        setReady(true);
        pushLog(`loaded ep${track.episode} · ${track.events.length} events${classic ? ' (classic mode - effects off)' : ''}`);
      } catch (err) {
        pushLog(`load failed: ${String(err)}`);
      }
    })();

    return () => {
      cancelled = true;
      engineRef.current?.stop();
      void soundRef.current?.unloadAsync();
      deactivateKeepAwake();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle() {
    const sound = soundRef.current;
    if (!sound) return;
    if (playing) {
      await sound.pauseAsync();
      engineRef.current?.stop();
      setPlaying(false);
    } else {
      await sound.playAsync();
      engineRef.current?.start();
      setPlaying(true);
    }
  }

  // Safety valve: a press held >=3s always clears a blackout (Design.md 5).
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <View style={s.root}>
      <View style={s.cover}>
        <Text style={s.logo}>AAKHRI AWAAZ</Text>
        <Text style={s.ep}>Episode 8 — Sutradhar</Text>
      </View>

      <Pressable style={s.play} onPress={toggle} disabled={!ready}>
        <Text style={s.playText}>{playing ? '❙❙' : '▶'}</Text>
      </Pressable>

      <View style={s.scrubber}>
        <View style={s.scrubberFill} />
      </View>

      {__DEV__ && (
        <View style={s.log}>
          {log.map((line, i) => (
            <Text key={i} style={s.logLine}>
              {line}
            </Text>
          ))}
        </View>
      )}

      <Animated.View
        pointerEvents={blockTouches ? 'auto' : 'none'}
        style={[s.overlay, { opacity: overlay }]}
        onTouchStart={() => {
          holdTimer.current = setTimeout(() => {
            ctx.setOverlay(0, false, 0);
            pushLog('blackout dismissed by long press (safety)');
          }, 3000);
        }}
        onTouchEnd={() => holdTimer.current && clearTimeout(holdTimer.current)}
      />

      {call && (
        <FakeCallScreen
          event={call}
          onDone={() => {
            setCall(null);
            callResolver.current?.();
            callResolver.current = null;
          }}
        />
      )}
    </View>
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, alignItems: 'center', paddingTop: 90 },
  cover: {
    width: 250,
    height: 250,
    borderWidth: 1,
    borderColor: '#1C1C24',
    justifyContent: 'flex-end',
    padding: 16,
  },
  logo: { color: C.red, fontSize: 24, fontWeight: '800', letterSpacing: 1 },
  ep: { color: C.muted, fontSize: 12, marginTop: 6 },
  play: {
    marginTop: 48,
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 1,
    borderColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playText: { color: C.text, fontSize: 22 },
  scrubber: { width: 250, height: 2, backgroundColor: '#1C1C24', marginTop: 40 },
  scrubberFill: { width: '0%', height: 2, backgroundColor: C.red },
  log: { position: 'absolute', bottom: 24, left: 20, right: 20 },
  logLine: { color: '#3A3A46', fontSize: 10, fontFamily: 'monospace' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
});
