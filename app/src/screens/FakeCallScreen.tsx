import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { BASE, postCallEnded } from '../lib/api';
import type { FakeCallEvent } from '../types';
import { C } from '../theme';

/**
 * Screen 3 - the fake incoming call. Must NOT look like part of our app; the
 * deception is the design (Design.md 3).
 *
 * WHY A WEBVIEW: the live agent is an OpenAI Realtime session over WebRTC.
 * Rather than pull react-native-webrtc into the Android build (a native-module
 * fight we cannot afford with one RN dev on the clock), the server serves a
 * ~60-line page at /call that does the WebRTC handshake with an ephemeral token
 * and posts the transcript back. This screen renders the Android call chrome and
 * hides that page behind it, invisible and audio-only.
 *
 * Payoff: prompt + agent tuning happens entirely server-side with no app
 * rebuild, which is exactly what rules.md 3 asks for.
 */
export default function FakeCallScreen({
  event,
  onDone,
}: {
  event: FakeCallEvent;
  onDone: () => void;
}) {
  const [answered, setAnswered] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const transcript = useRef('');

  // Ring: vibrate pattern until answered or timeout. A missed call is canon.
  useEffect(() => {
    if (answered) return;
    Vibration.vibrate([0, 900, 700], true);
    const timeout = setTimeout(() => {
      Vibration.cancel();
      finish('missed');
    }, event.ring_timeout_s * 1000);
    return () => {
      Vibration.cancel();
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered]);

  // Hard cap the call: 60-90s by design, brevity preserves the illusion.
  useEffect(() => {
    if (!answered) return;
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    const cap = setTimeout(() => finish('timeout'), 100_000);
    return () => {
      clearInterval(tick);
      clearTimeout(cap);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered]);

  function finish(reason: string) {
    void postCallEnded(transcript.current || `[no speech: ${reason}]`, event.decision_id).catch(
      () => {}
    );
    onDone();
  }

  const callUrl = `${BASE}/call?agent=${encodeURIComponent(event.agent)}&decision_id=${encodeURIComponent(event.decision_id)}`;

  return (
    <View style={s.root}>
      {answered && (
        <WebView
          source={{ uri: callUrl }}
          style={s.hidden}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          onMessage={(e) => {
            // The page streams transcript lines; we only keep text.
            try {
              const msg = JSON.parse(e.nativeEvent.data);
              if (msg.type === 'transcript') transcript.current += `${msg.role}: ${msg.text}\n`;
              if (msg.type === 'hangup') finish('agent_hangup');
            } catch {
              /* ignore malformed frames */
            }
          }}
        />
      )}

      <View style={s.top}>
        <Text style={s.status}>
          {answered ? formatDuration(seconds) : 'Incoming call'}
        </Text>
        <View style={s.avatar}>
          <Text style={s.avatarText}>?</Text>
        </View>
        <Text style={s.number}>{event.from}</Text>
        <Text style={s.carrier}>Mobile · India</Text>
      </View>

      <View style={s.actions}>
        {!answered ? (
          <>
            <Pressable style={[s.btn, s.decline]} onPress={() => finish('declined')}>
              <Text style={s.btnText}>✕</Text>
            </Pressable>
            <Pressable style={[s.btn, s.accept]} onPress={() => setAnswered(true)}>
              <Text style={s.btnText}>✆</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={[s.btn, s.decline]} onPress={() => finish('user_hangup')}>
            <Text style={s.btnText}>✕</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function formatDuration(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const s = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#101014',
    justifyContent: 'space-between',
    paddingVertical: 80,
  },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  top: { alignItems: 'center' },
  status: { color: '#8A8A96', fontSize: 14, marginBottom: 40 },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#22222C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#4A4A58', fontSize: 44 },
  number: { color: '#FFF', fontSize: 26, marginTop: 24, letterSpacing: 0.5 },
  carrier: { color: '#6B6B76', fontSize: 13, marginTop: 8 },
  actions: { flexDirection: 'row', justifyContent: 'space-evenly', paddingHorizontal: 40 },
  btn: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  accept: { backgroundColor: '#2E7D32' },
  decline: { backgroundColor: C.red },
  btnText: { color: '#fff', fontSize: 26 },
});
