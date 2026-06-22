import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, AGENT_META } from '@/src/theme';
import { api } from '@/src/api';

type Approval = { id: string; task_id: string; agent_id: string; action: string; impact: string; payload_preview: string; status: 'pending' | 'approved' | 'rejected'; created_at: string };

export default function Approvals() {
  const [items, setItems] = useState<Approval[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => { try { setItems(await api<Approval[]>('/approvals')); } catch {} }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const decide = async (id: string, decision: 'approved' | 'rejected') => {
    setBusy(id);
    try { await api(`/approvals/${id}/decision`, { method: 'POST', body: { decision } }); await load(); }
    catch {} finally { setBusy(null); }
  };

  const pending = items.filter(i => i.status === 'pending');
  const history = items.filter(i => i.status !== 'pending');

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.eyebrow}>FOUNDER CONTROL</Text>
        <Text style={s.title}>Approvals</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl tintColor={theme.color.brand} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Text style={s.intro}>Sensitive actions (sending emails, publishing, deploying) wait here for your green light.</Text>

        {pending.length === 0 && (
          <View style={s.emptyCard}>
            <Ionicons name="checkmark-circle" size={36} color={theme.color.success} />
            <Text style={s.emptyTitle}>Zero pending approvals</Text>
            <Text style={s.emptySub}>Your AI team has nothing waiting on you right now.</Text>
          </View>
        )}

        {pending.map(a => {
          const meta = AGENT_META[a.agent_id] || { name: a.agent_id, role: '', accent: theme.color.onSurface };
          return (
            <View key={a.id} style={s.card} testID={`approval-${a.id}`}>
              <View style={s.cardHead}>
                <View style={[s.agentChip, { backgroundColor: meta.accent + '22', borderColor: meta.accent + '55' }]}>
                  <Text style={[s.agentChipText, { color: meta.accent }]}>{meta.name} · {meta.role}</Text>
                </View>
                <Text style={s.time}>{new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={s.action}>{a.action}</Text>
              <Text style={s.impact}>{a.impact}</Text>
              <View style={s.previewBox}>
                <Text style={s.previewLabel}>PAYLOAD PREVIEW</Text>
                <Text style={s.previewText}>{a.payload_preview}</Text>
              </View>
              <View style={s.actionsRow}>
                <Pressable testID={`approval-reject-${a.id}`} disabled={busy === a.id} onPress={() => decide(a.id, 'rejected')} style={[s.btn, s.btnReject]}>
                  <Ionicons name="close" size={18} color={theme.color.error} />
                  <Text style={[s.btnText, { color: theme.color.error }]}>Reject</Text>
                </Pressable>
                <Pressable testID={`approval-approve-${a.id}`} disabled={busy === a.id} onPress={() => decide(a.id, 'approved')} style={[s.btn, s.btnApprove]}>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                  <Text style={[s.btnText, { color: '#fff' }]}>Approve</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        {history.length > 0 && (
          <>
            <Text style={s.section}>HISTORY</Text>
            {history.map(h => {
              const meta = AGENT_META[h.agent_id] || { name: h.agent_id, role: '', accent: theme.color.onSurface };
              const c = h.status === 'approved' ? theme.color.success : theme.color.error;
              return (
                <View key={h.id} style={s.histRow}>
                  <View style={[s.histDot, { backgroundColor: c }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.histAction} numberOfLines={1}>{h.action}</Text>
                    <Text style={s.histMeta}>{meta.name} · {h.status.toUpperCase()}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md },
  eyebrow: { ...theme.type.label, color: theme.color.brand },
  title: { color: theme.color.onSurface, fontSize: 30, fontWeight: '800', letterSpacing: 0.3, marginTop: 2 },
  scroll: { padding: theme.spacing.xl, paddingBottom: theme.spacing.xl3 },
  intro: { color: theme.color.onSurfaceTertiary, fontSize: 13, marginBottom: theme.spacing.lg, lineHeight: 18 },
  emptyCard: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.lg, padding: theme.spacing.xl, alignItems: 'center', gap: 8 },
  emptyTitle: { color: theme.color.onSurface, fontSize: 16, fontWeight: '700', marginTop: 4 },
  emptySub: { color: theme.color.onSurfaceTertiary, fontSize: 13, textAlign: 'center' },
  card: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.md },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  agentChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radius.pill, borderWidth: 1 },
  agentChipText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  time: { color: theme.color.onSurfaceTertiary, fontSize: 11 },
  action: { color: theme.color.onSurface, fontSize: 17, fontWeight: '700' },
  impact: { color: theme.color.warning, fontSize: 12, marginTop: 6 },
  previewBox: { backgroundColor: theme.color.surfaceTertiary, borderRadius: theme.radius.sm, padding: theme.spacing.md, marginTop: theme.spacing.md, borderWidth: 1, borderColor: theme.color.border },
  previewLabel: { ...theme.type.label, color: theme.color.onSurfaceTertiary, fontSize: 9 },
  previewText: { color: theme.color.onSurfaceSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: theme.spacing.lg },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: theme.radius.md, borderWidth: 1 },
  btnReject: { borderColor: theme.color.error + '66', backgroundColor: theme.color.error + '10' },
  btnApprove: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  btnText: { fontWeight: '700', fontSize: 14 },
  section: { ...theme.type.label, color: theme.color.onSurfaceTertiary, marginTop: theme.spacing.xl2, marginBottom: theme.spacing.md },
  histRow: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.color.divider },
  histDot: { width: 8, height: 8, borderRadius: 4 },
  histAction: { color: theme.color.onSurface, fontSize: 13, fontWeight: '600' },
  histMeta: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: 2, letterSpacing: 0.4 },
});
