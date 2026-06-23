import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, AGENT_META } from '@/src/theme';
import { api } from '@/src/api';

type Task = { id: string; agent_id: string; title: string; description: string; priority: string; status: string; progress: number; requires_approval: boolean; output: string | null; delivery_type?: string; execution_status?: string; evidence?: string[] };
type Goal = { id: string; objective: string; summary: string; status: string; created_at: string; tasks: Task[] };

const STATUS_LABEL: Record<string, string> = { pending: 'PENDING', planning: 'PLANNING', running: 'RUNNING', waiting_approval: 'AWAITING APPROVAL', completed: 'COMPLETED', cancelled: 'CANCELLED' };
const STATUS_COLOR: Record<string, string> = { pending: theme.color.onSurfaceTertiary, planning: theme.color.info, running: theme.color.brand, waiting_approval: theme.color.warning, completed: theme.color.success, cancelled: theme.color.error };

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setGoal(await api<Goal>(`/goals/${id}`)); } catch {}
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!goal || busy || autoError || !goal.tasks.some(t => t.status === 'planning')) return;
    const timer = setTimeout(async () => {
      setBusy('auto'); setAutoError(null);
      try { await api(`/goals/${id}/run-next`, { method: 'POST' }); await load(); }
      catch (e: any) { setAutoError(e.message || 'Employee execution paused'); }
      finally { setBusy(null); }
    }, 10000);
    return () => clearTimeout(timer);
  }, [goal, busy, autoError, id, load]);

  const generate = async (taskId: string) => {
    setBusy(taskId);
    try { await api(`/tasks/${taskId}/generate`, { method: 'POST' }); await load(); }
    catch {} finally { setBusy(null); }
  };

  if (!goal) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <View style={s.center}><ActivityIndicator color={theme.color.brand} size="large" /></View>
      </SafeAreaView>
    );
  }

  const done = goal.tasks.filter(t => t.status === 'completed').length;
  const pct = goal.tasks.length === 0 ? 0 : Math.round((done / goal.tasks.length) * 100);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} testID="goal-back">
          <Ionicons name="chevron-back" size={22} color={theme.color.onSurface} />
        </Pressable>
        <Text style={s.headerTitle}>Goal</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.eyebrow}>OBJECTIVE</Text>
        <Text style={s.objective}>"{goal.objective}"</Text>
        <Text style={s.summary}>{goal.summary}</Text>

        <View style={s.progBox}>
          <View style={s.progLabel}>
            <Text style={s.progText}>{done} of {goal.tasks.length} tasks complete</Text>
            <Text style={s.progPct}>{pct}%</Text>
          </View>
          <View style={s.progTrack}><View style={[s.progFill, { width: `${pct}%` }]} /></View>
        </View>

        <Text style={s.section}>EXECUTION WORKFLOW</Text>

        <View style={s.autoBox}>
          <Ionicons name={busy === 'auto' ? 'sync' : 'flash'} size={15} color={theme.color.brand} />
          <Text style={s.autoText}>{busy === 'auto' ? 'AI employee is working automatically…' : 'Autopilot is on — safe tasks run without separate clicks.'}</Text>
        </View>
        {autoError && <View style={s.retryBox}><Text style={s.autoError}>{autoError}</Text><Pressable onPress={() => setAutoError(null)} style={s.retryBtn}><Text style={s.retryText}>Retry after cooldown</Text></Pressable></View>}

        {goal.tasks.map((t, i) => {
          const meta = AGENT_META[t.agent_id] || { name: t.agent_id, role: '', accent: theme.color.onSurface };
          const canGen = !t.output && t.status !== 'waiting_approval' && t.status !== 'cancelled' && t.status !== 'completed';
          return (
            <View key={t.id} style={s.row} testID={`goal-task-${t.id}`}>
              <View style={s.rowGutter}>
                <View style={[s.node, { backgroundColor: meta.accent }]}><Text style={s.nodeNum}>{i + 1}</Text></View>
                {i < goal.tasks.length - 1 && <View style={s.line} />}
              </View>
              <View style={s.card}>
                <View style={s.cardHead}>
                  <Text style={[s.agentLabel, { color: meta.accent }]}>{meta.name.toUpperCase()} · {meta.role.toUpperCase()}</Text>
                  <View style={[s.statBadge, { borderColor: STATUS_COLOR[t.status] + '66', backgroundColor: STATUS_COLOR[t.status] + '15' }]}>
                    <Text style={[s.statText, { color: STATUS_COLOR[t.status] }]}>{STATUS_LABEL[t.status]}</Text>
                  </View>
                </View>
                <Text style={s.taskTitle}>{t.title}</Text>
                <Text style={s.taskDesc}>{t.description}</Text>

                {!!t.execution_status && (
                  <Text style={[s.execution, t.execution_status.includes('needs_integration') && { color: theme.color.warning }]}>Execution: {t.execution_status.replaceAll('_', ' ')}</Text>
                )}

                {t.output ? (
                  <View style={s.outputBox}>
                    <Text style={s.outputLabel}>{meta.name.toUpperCase()}'S DELIVERABLE</Text>
                    <Text style={s.outputText}>{t.output}</Text>
                  </View>
                ) : t.status === 'waiting_approval' ? (
                  <View style={s.gateRow}>
                    <Ionicons name="shield-checkmark" size={14} color={theme.color.warning} />
                    <Text style={s.gateText}>Waiting on founder approval</Text>
                  </View>
                ) : t.status === 'completed' ? (
                  <Text style={s.subText}>Output generated — no preview captured.</Text>
                ) : canGen ? (
                  <Pressable onPress={() => generate(t.id)} disabled={busy === t.id} style={[s.genBtn, { borderColor: meta.accent }]} testID={`goal-generate-${t.id}`}>
                    {busy === t.id
                      ? <><ActivityIndicator size="small" color={meta.accent} /><Text style={[s.genText, { color: meta.accent }]}>  Generating…</Text></>
                      : <><Ionicons name="sparkles" size={14} color={meta.accent} /><Text style={[s.genText, { color: meta.accent }]}>Generate {meta.name}'s output</Text></>}
                  </Pressable>
                ) : null}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: theme.color.onSurfaceSecondary, fontSize: 13, letterSpacing: 0.6, fontWeight: '600' },
  scroll: { padding: theme.spacing.xl, paddingBottom: theme.spacing.xl3 },
  eyebrow: { ...theme.type.label, color: theme.color.brand },
  objective: { color: theme.color.onSurface, fontSize: 22, fontWeight: '700', fontStyle: 'italic', marginTop: 6 },
  summary: { color: theme.color.onSurfaceSecondary, fontSize: 14, lineHeight: 20, marginTop: theme.spacing.md },
  progBox: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md, marginTop: theme.spacing.lg },
  progLabel: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progText: { color: theme.color.onSurfaceSecondary, fontSize: 13, fontWeight: '600' },
  progPct: { color: theme.color.brand, fontSize: 13, fontWeight: '800' },
  progTrack: { height: 4, backgroundColor: theme.color.surfaceTertiary, borderRadius: 2, overflow: 'hidden' },
  progFill: { height: '100%', backgroundColor: theme.color.brand },
  section: { ...theme.type.label, color: theme.color.onSurfaceTertiary, marginTop: theme.spacing.xl, marginBottom: theme.spacing.md },
  autoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 11, borderWidth: 1, borderColor: theme.color.brand + '55', backgroundColor: theme.color.brand + '10', borderRadius: theme.radius.sm, marginBottom: theme.spacing.md },
  autoText: { color: theme.color.onSurfaceSecondary, fontSize: 12, flex: 1 },
  retryBox: { marginBottom: theme.spacing.md },
  autoError: { color: theme.color.error, fontSize: 12 },
  retryBtn: { alignSelf: 'flex-start', borderWidth: 1, borderColor: theme.color.brand, borderRadius: theme.radius.sm, paddingHorizontal: 10, paddingVertical: 7, marginTop: 8 },
  retryText: { color: theme.color.brand, fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12 },
  rowGutter: { alignItems: 'center', width: 28 },
  node: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  nodeNum: { color: '#000', fontWeight: '800', fontSize: 13 },
  line: { flex: 1, width: 2, backgroundColor: theme.color.border, marginTop: 2 },
  card: { flex: 1, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  agentLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, flex: 1, marginRight: 8 },
  statBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm, borderWidth: 1 },
  statText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  taskTitle: { color: theme.color.onSurface, fontSize: 15, fontWeight: '700' },
  taskDesc: { color: theme.color.onSurfaceSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 },
  execution: { color: theme.color.success, fontSize: 10, fontWeight: '700', marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  outputBox: { marginTop: theme.spacing.md, backgroundColor: theme.color.surfaceTertiary, borderRadius: theme.radius.sm, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.color.border },
  outputLabel: { ...theme.type.label, color: theme.color.onSurfaceTertiary, fontSize: 9 },
  outputText: { color: theme.color.onSurface, fontSize: 13, marginTop: 8, lineHeight: 20 },
  gateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: theme.spacing.md, padding: 10, backgroundColor: theme.color.warning + '15', borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.color.warning + '44' },
  gateText: { color: theme.color.warning, fontSize: 12 },
  subText: { color: theme.color.onSurfaceTertiary, fontSize: 12, marginTop: theme.spacing.md, fontStyle: 'italic' },
  genBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: theme.radius.sm, borderWidth: 1, marginTop: theme.spacing.md, backgroundColor: theme.color.surfaceTertiary },
  genText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
});
