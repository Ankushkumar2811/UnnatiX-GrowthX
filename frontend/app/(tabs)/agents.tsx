import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api } from '@/src/api';
import { AgentAvatar } from '@/src/AgentAvatar';

type Agent = {
  id: string; name: string; role: string; department: string; tagline: string;
  responsibilities: string[]; accent: string; status: 'active' | 'idle';
  current_task: string | null; completed_tasks: number; performance: number;
};

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    try { setAgents(await api<Agent[]>('/agents')); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.eyebrow}>AI WORKFORCE</Text>
        <Text style={s.title}>Agents</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl tintColor={theme.color.brand} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Text style={s.intro}>Your 8 executive AI employees. Status updates in real-time as tasks flow through the system.</Text>
        <View style={s.grid}>
          {agents.map(a => (
            <View key={a.id} style={s.card} testID={`agent-card-${a.id}`}>
              <View style={s.cardTop}>
                <AgentAvatar agentId={a.id} accent={a.accent} size={48} />
                <View style={[s.statusPill, { backgroundColor: (a.status === 'active' ? theme.color.success : theme.color.onSurfaceTertiary) + '22', borderColor: (a.status === 'active' ? theme.color.success : theme.color.onSurfaceTertiary) + '55' }]}>
                  <View style={[s.statusDot, { backgroundColor: a.status === 'active' ? theme.color.success : theme.color.onSurfaceTertiary }]} />
                  <Text style={[s.statusText, { color: a.status === 'active' ? theme.color.success : theme.color.onSurfaceTertiary }]}>{a.status.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={s.name}>{a.name}</Text>
              <Text style={[s.role, { color: a.accent }]}>{a.role}</Text>
              <Text style={s.tagline}>{a.tagline}</Text>

              <View style={s.divider} />

              <Text style={s.metaLabel}>CURRENT TASK</Text>
              <Text style={s.metaValue} numberOfLines={2}>{a.current_task || '—'}</Text>

              <View style={s.statsRow}>
                <View style={s.statBlock}>
                  <Text style={s.statNum}>{a.completed_tasks}</Text>
                  <Text style={s.statL}>Completed</Text>
                </View>
                <View style={s.statBlock}>
                  <Text style={s.statNum}>{a.performance}<Text style={{ fontSize: 12 }}>%</Text></Text>
                  <Text style={s.statL}>Performance</Text>
                </View>
              </View>

              <View style={s.perfTrack}>
                <View style={[s.perfFill, { width: `${a.performance}%`, backgroundColor: a.accent }]} />
              </View>

              {a.id !== 'ceo' && (
                <Pressable
                  onPress={() => router.push(`/workspace/${a.id}` as any)}
                  testID={`agent-open-workspace-${a.id}`}
                  style={[s.workspaceBtn, { borderColor: a.accent }]}
                >
                  <Ionicons name="enter-outline" size={14} color={a.accent} />
                  <Text style={[s.workspaceBtnText, { color: a.accent }]}>Open workspace</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md },
  eyebrow: { ...theme.type.label, color: theme.color.brand },
  title: { color: theme.color.onSurface, fontSize: 30, fontWeight: '800', letterSpacing: 0.3, marginTop: 2 },
  intro: { color: theme.color.onSurfaceTertiary, fontSize: 13, marginBottom: theme.spacing.lg, lineHeight: 18 },
  scroll: { paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xl3 },
  grid: { gap: 12 },
  card: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.lg, padding: theme.spacing.lg },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.pill, borderWidth: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  name: { color: theme.color.onSurface, fontSize: 22, fontWeight: '800', letterSpacing: 0.2 },
  role: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 2 },
  tagline: { color: theme.color.onSurfaceSecondary, fontSize: 13, marginTop: 6 },
  divider: { height: 1, backgroundColor: theme.color.divider, marginVertical: theme.spacing.md },
  metaLabel: { ...theme.type.label, color: theme.color.onSurfaceTertiary, fontSize: 10 },
  metaValue: { color: theme.color.onSurface, fontSize: 13, marginTop: 4, minHeight: 18 },
  statsRow: { flexDirection: 'row', gap: 24, marginTop: theme.spacing.md },
  statBlock: { },
  statNum: { color: theme.color.onSurface, fontSize: 22, fontWeight: '800' },
  statL: { color: theme.color.onSurfaceTertiary, fontSize: 10, letterSpacing: 0.4, marginTop: 2 },
  perfTrack: { height: 3, backgroundColor: theme.color.surfaceTertiary, borderRadius: 2, marginTop: theme.spacing.md, overflow: 'hidden' },
  perfFill: { height: '100%' },
  workspaceBtn: { marginTop: theme.spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: theme.radius.sm, borderWidth: 1, backgroundColor: theme.color.surfaceTertiary },
  workspaceBtnText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
});
