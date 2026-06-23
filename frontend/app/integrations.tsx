import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api } from '@/src/api';

type Integration = { id: string; name: string; category: string; description: string; status: string; mode: string };

const ICONS: Record<string, any> = { smtp: 'mail', gmail: 'mail', slack: 'chatbubbles', hubspot: 'people-circle', calendar: 'calendar', notion: 'document-text' };

export default function Integrations() {
  const router = useRouter();
  const [items, setItems] = useState<Integration[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setItems(await api<Integration[]>('/integrations')); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (i: Integration) => {
    setBusy(i.id);
    try {
      const enabled = i.status === 'not_configured';
      await api(`/integrations/${i.id}/toggle`, { method: 'POST', body: { enabled } });
      await load();
    } catch {} finally { setBusy(null); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} testID="integrations-back">
          <Ionicons name="chevron-back" size={22} color={theme.color.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }} />
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.eyebrow}>OUTBOUND</Text>
        <Text style={s.title}>Integrations</Text>
        <View style={s.banner} testID="integrations-sandbox-banner">
          <Ionicons name="warning" size={16} color={theme.color.warning} />
          <View style={{ flex: 1 }}>
            <Text style={s.bannerTitle}>LIVE INTEGRATIONS</Text>
            <Text style={s.bannerText}>SMTP becomes live after secure server credentials are configured. Other providers remain sandboxed until connected.</Text>
          </View>
        </View>

        {items.map(i => {
          const connected = i.status === 'connected_sandbox' || i.status === 'connected_live';
          const live = i.status === 'connected_live';
          return (
            <View key={i.id} style={s.card} testID={`integration-${i.id}`}>
              <View style={[s.iconWrap, connected && { backgroundColor: theme.color.brand + '22', borderColor: theme.color.brand + '66' }]}>
                <Ionicons name={ICONS[i.id] || 'cube'} size={20} color={connected ? theme.color.brand : theme.color.onSurfaceSecondary} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.row}>
                  <Text style={s.name}>{i.name}</Text>
                  <Text style={s.category}>{i.category.toUpperCase()}</Text>
                </View>
                <Text style={s.desc}>{i.description}</Text>
                <View style={s.footRow}>
                  <View style={[s.statusPill, connected && { backgroundColor: theme.color.success + '22', borderColor: theme.color.success + '55' }]}>
                    <View style={[s.dot, { backgroundColor: connected ? theme.color.success : theme.color.onSurfaceTertiary }]} />
                    <Text style={[s.statusText, connected && { color: theme.color.success }]}>{live ? 'CONNECTED · LIVE' : connected ? 'CONNECTED · SANDBOX' : 'NOT CONFIGURED'}</Text>
                  </View>
                  <Pressable testID={`integration-toggle-${i.id}`} onPress={() => toggle(i)} disabled={busy === i.id} style={[s.btn, connected && s.btnDisconnect]}>
                    {busy === i.id ? <ActivityIndicator size="small" color={connected ? theme.color.error : '#fff'} />
                      : <Text style={[s.btnText, connected && { color: theme.color.error }]}>{connected ? 'Disconnect' : i.id === 'smtp' ? 'Connect live' : 'Connect sandbox'}</Text>}
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: theme.spacing.xl, paddingTop: 0, paddingBottom: theme.spacing.xl3 },
  eyebrow: { ...theme.type.label, color: theme.color.brand },
  title: { color: theme.color.onSurface, fontSize: 30, fontWeight: '800', marginTop: 2, letterSpacing: 0.2, marginBottom: theme.spacing.lg },
  banner: { flexDirection: 'row', gap: 12, padding: theme.spacing.md, backgroundColor: theme.color.warning + '12', borderWidth: 1, borderColor: theme.color.warning + '44', borderRadius: theme.radius.md, marginBottom: theme.spacing.lg },
  bannerTitle: { color: theme.color.warning, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  bannerText: { color: theme.color.onSurfaceSecondary, fontSize: 12, marginTop: 4, lineHeight: 17 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  iconWrap: { width: 44, height: 44, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceTertiary, borderWidth: 1, borderColor: theme.color.border, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: theme.color.onSurface, fontSize: 15, fontWeight: '700' },
  category: { color: theme.color.onSurfaceTertiary, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  desc: { color: theme.color.onSurfaceSecondary, fontSize: 12, marginTop: 4, lineHeight: 16 },
  footRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.md, gap: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceTertiary },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '700', color: theme.color.onSurfaceTertiary, letterSpacing: 0.5 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.sm, backgroundColor: theme.color.brand },
  btnDisconnect: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.color.error + '66' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
