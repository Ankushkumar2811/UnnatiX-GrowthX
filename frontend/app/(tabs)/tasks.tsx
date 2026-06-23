import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, AGENT_META } from '@/src/theme';
import { api } from '@/src/api';

type Task = { id: string; agent_id: string; title: string; description: string; priority: string; status: string; progress: number; requires_approval: boolean };

const FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'planning', label: 'Planning' },
  { id: 'running', label: 'Running' },
  { id: 'waiting_approval', label: 'Awaiting' },
  { id: 'completed', label: 'Completed' },
];

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setTasks(await api<Task[]>('/tasks')); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = useMemo(() => filter === 'all' ? tasks : tasks.filter(t => t.status === filter), [tasks, filter]);

  const advance = async (t: Task) => {
    const next = t.status === 'planning' ? 'running' : t.status === 'running' ? 'completed' : t.status;
    if (next === t.status) return;
    try { await api(`/tasks/${t.id}`, { method: 'PATCH', body: { status: next } }); load(); } catch {}
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.eyebrow}>EXECUTION LAYER</Text>
        <Text style={s.title}>Tasks</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow} style={s.chipsScroll}>
        {FILTERS.map(f => {
          const active = filter === f.id;
          return (
            <Pressable key={f.id} testID={`task-filter-${f.id}`} onPress={() => setFilter(f.id)} style={[s.chip, active && s.chipActive]}>
              <Text style={[s.chipText, active && s.chipTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={visible}
        keyExtractor={t => t.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl tintColor={theme.color.brand} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListEmptyComponent={<Text style={s.empty}>No tasks here. Brief Shri Nath to get to work.</Text>}
        renderItem={({ item }) => {
          const meta = AGENT_META[item.agent_id] || { name: item.agent_id, role: '', accent: theme.color.onSurface };
          const status = item.status;
          const sMap: Record<string, string> = { pending: 'PENDING', planning: 'PLANNING', running: 'RUNNING', waiting_approval: 'AWAITING APPROVAL', completed: 'COMPLETED', cancelled: 'CANCELLED' };
          const sColor: Record<string, string> = { pending: theme.color.onSurfaceTertiary, planning: theme.color.info, running: theme.color.brand, waiting_approval: theme.color.warning, completed: theme.color.success, cancelled: theme.color.error };
          const pColor = item.priority === 'high' ? theme.color.brand : item.priority === 'medium' ? theme.color.warning : theme.color.onSurfaceTertiary;
          return (
            <View style={s.row} testID={`task-${item.id}`}>
              <View style={s.rowHead}>
                <View style={[s.priDot, { backgroundColor: pColor }]} />
                <Text style={[s.agentLabel, { color: meta.accent }]}>{meta.name.toUpperCase()}</Text>
                <View style={{ flex: 1 }} />
                <View style={[s.statusBadge, { borderColor: sColor[status] + '66', backgroundColor: sColor[status] + '15' }]}>
                  <Text style={[s.statusBadgeText, { color: sColor[status] }]}>{sMap[status]}</Text>
                </View>
              </View>
              <Text style={s.taskTitle}>{item.title}</Text>
              <Text style={s.taskDesc} numberOfLines={2}>{item.description}</Text>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${item.progress}%`, backgroundColor: meta.accent }]} />
              </View>
              <View style={s.rowFoot}>
                <Text style={s.progressText}>{item.progress}%</Text>
                {(status === 'planning' || status === 'running') && (
                  <Pressable onPress={() => advance(item)} style={s.advanceBtn} testID={`task-advance-${item.id}`}>
                    <Ionicons name="play-forward" size={12} color={theme.color.brand} />
                    <Text style={s.advanceText}>{status === 'planning' ? 'Start' : 'Complete'}</Text>
                  </Pressable>
                )}
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { paddingHorizontal: theme.spacing.xl, paddingVertical: theme.spacing.md },
  eyebrow: { ...theme.type.label, color: theme.color.brand },
  title: { color: theme.color.onSurface, fontSize: 30, fontWeight: '800', letterSpacing: 0.3, marginTop: 2 },
  chipsScroll: { maxHeight: 56, marginBottom: 4 },
  chipsRow: { paddingHorizontal: theme.spacing.xl, gap: 8, paddingVertical: 10 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceSecondary, justifyContent: 'center', flexShrink: 0 },
  chipActive: { borderColor: theme.color.brand, backgroundColor: theme.color.brand + '15' },
  chipText: { color: theme.color.onSurfaceSecondary, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: theme.color.brand },
  list: { paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.xl3, gap: 10 },
  empty: { color: theme.color.onSurfaceTertiary, textAlign: 'center', marginTop: theme.spacing.xl2, fontSize: 13 },
  row: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  priDot: { width: 6, height: 6, borderRadius: 3 },
  agentLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm, borderWidth: 1 },
  statusBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  taskTitle: { color: theme.color.onSurface, fontSize: 15, fontWeight: '700' },
  taskDesc: { color: theme.color.onSurfaceSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 },
  progressTrack: { height: 3, backgroundColor: theme.color.surfaceTertiary, borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%' },
  rowFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  progressText: { color: theme.color.onSurfaceTertiary, fontSize: 11, fontWeight: '600' },
  advanceBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: theme.color.brand + '15', borderRadius: theme.radius.sm },
  advanceText: { color: theme.color.brand, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
});
