import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { C } from '../theme';

/**
 * Screen 1 - reads as a real Pocket FM show page. Its only job is to make the
 * demo start from something that looks like a product, and to carry the one
 * in-fiction consent dialog (which is also a pitch slide).
 */
const EPISODES = [
  { n: 1, title: 'Pehli Call' },
  { n: 2, title: 'Jo Sunta Hai' },
  { n: 3, title: '1994' },
  { n: 4, title: 'Neem' },
  { n: 5, title: 'Sehore' },
  { n: 6, title: 'Gawah' },
  { n: 7, title: 'Kabootar' },
  { n: 8, title: 'Sutradhar', immersive: true },
];

export default function HomeScreen({ onEnter }: { onEnter: (classic: boolean) => void }) {
  const [consentOpen, setConsentOpen] = useState(false);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.cover}>
          <Text style={s.logo}>AAKHRI{'\n'}AWAAZ</Text>
          <Text style={s.meta}>True crime · Hinglish · 8 episodes</Text>
        </View>
        <Text style={s.hint}>Raat ko suno. Andhere mein.</Text>

        {EPISODES.map((ep) => (
          <Pressable
            key={ep.n}
            style={s.row}
            disabled={!ep.immersive}
            onPress={() => setConsentOpen(true)}
          >
            <Text style={[s.epTitle, !ep.immersive && s.locked]}>
              {ep.n}. {ep.title}
            </Text>
            {ep.immersive && <Text style={s.badge}>IMMERSIVE ⚡</Text>}
          </Pressable>
        ))}
      </ScrollView>

      <Modal visible={consentOpen} transparent animationType="fade">
        <View style={s.modalWrap}>
          <View style={s.modal}>
            <Text style={s.consent}>
              Yeh kahaani aapki torch, vibration aur microphone istemaal karna chahti hai.
              {'\n\n'}
              Yeh aapko kabhi record nahin karegi.
            </Text>
            <Pressable style={s.primary} onPress={() => onEnter(false)}>
              <Text style={s.primaryText}>Kahaani mein aao</Text>
            </Pressable>
            <Pressable onPress={() => onEnter(true)}>
              <Text style={s.secondaryText}>Classic mode</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 24, paddingTop: 64 },
  cover: {
    height: 260,
    borderWidth: 1,
    borderColor: '#1C1C24',
    justifyContent: 'flex-end',
    padding: 20,
    marginBottom: 20,
  },
  logo: { color: C.red, fontSize: 44, fontWeight: '800', letterSpacing: 2, lineHeight: 46 },
  meta: { color: C.muted, marginTop: 10, fontSize: 12 },
  hint: { color: C.muted, fontStyle: 'italic', marginBottom: 24, fontSize: 13 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#16161D',
  },
  epTitle: { color: C.text, fontSize: 15 },
  locked: { color: C.muted },
  badge: { color: C.red, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 28 },
  modal: { backgroundColor: '#14141B', padding: 24, borderWidth: 1, borderColor: '#22222C' },
  consent: { color: C.text, fontSize: 15, lineHeight: 23 },
  primary: { backgroundColor: C.red, paddingVertical: 14, alignItems: 'center', marginTop: 26 },
  primaryText: { color: '#fff', fontWeight: '700' },
  secondaryText: { color: C.muted, textAlign: 'center', marginTop: 18, fontSize: 13 },
});
