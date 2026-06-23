import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, AGENT_META } from '@/src/theme';
import { api } from '@/src/api';

type Task = { id: string; agent_id: string; title: string; description: string; priority: string; status: string; progress: number; requires_approval: boolean };
type Goal = { id: string; objective: string; summary: string; status: string; created_at: string; tasks: Task[] };

export default function CEOPage() {
  const router = useRouter();
  const [objective, setObjective] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [recent, setRecent] = useState<any[]>([]);

  const loadRecent = useCallback(async () => {
    try { setRecent(await api('/goals')); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { loadRecent(); }, [loadRecent]));

  const submit = async () => {
    if (objective.trim().length < 4) { setErr('Objective is too short'); return; }
    setBusy(true); setErr(null); setGoal(null);
    try {
      const g = await api<Goal>('/goals', { method: 'POST', body: { objective: objective.trim() } });
      setGoal(g); setObjective(''); loadRecent();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const SUGGESTIONS = [
    'Win 10 new digital marketing clients in Delhi NCR',
    'Build a ₹5 lakh sales pipeline with qualified prospects and proposals',
    'Build a 90-day SEO and content plan for a client',
    'Launch a Google and Meta Ads lead-generation campaign',
    'Create a website, social and performance marketing proposal',
  ];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.eyebrow}>CEO ORCHESTRATION</Text>
          <Text style={s.h1}>Brief Shri Nath.</Text>
          <Text style={s.sub}>Drop a business objective. Your CEO AI will break it down and delegate across departments.</Text>

          <View style={s.inputWrap}>
            <TextInput
              testID="ceo-objective-input"
              style={s.input}
              multiline
              placeholder="e.g. Help me grow my AI business..."
              placeholderTextColor={theme.color.onSurfaceTertiary}
              value={objective}
              onChangeText={setObjective}
            />
          </View>

          <View style={s.chipsRow}>
            {SUGGESTIONS.map(sug => (
              <Pressable key={sug} style={s.chip} onPress={() => setObjective(sug)} testID={`ceo-suggestion-${sug.slice(0,12)}`}>
                <Text style={s.chipText}>{sug}</Text>
              </Pressable>
            ))}
          </View>

          {err && <Text style={s.err}>{err}</Text>}

          <Pressable testID="ceo-synthesize-button" style={[s.cta, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
            {busy ? <><ActivityIndicator color="#fff" /><Text style={s.ctaText}>  Shri Nath is synthesizing…</Text></>
              : <><Ionicons name="sparkles" size={18} color="#fff" /><Text style={s.ctaText}>Synthesize plan</Text></>}
          </Pressable>

          {goal && (
            <Pressable testID="ceo-plan-open-detail" onPress={() => router.push(`/goal/${goal.id}` as any)} style={s.openDetailBtn}>
              <Ionicons name="open-outline" size={14} color={theme.color.brand} />
              <Text style={s.openDetailText}>Open full goal detail · generate outputs</Text>
            </Pressable>
          )}

          {goal && (
            <View style={s.plan} testID="ceo-plan-output">
              <Text style={s.planEyebrow}>EXECUTION PLAN</Text>
              <Text style={s.planObjective}>"{goal.objective}"</Text>
              <Text style={s.planSummary}>{goal.summary}</Text>

              <Text style={s.workflowLabel}>WORKFLOW · {goal.tasks.length} TASKS</Text>
              {goal.tasks.map((t, i) => {
                const meta = AGENT_META[t.agent_id] || { name: t.agent_id, role: '', accent: theme.color.onSurface };
                return (
                  <View key={t.id} style={s.workflowRow}>
                    <View style={s.workflowGutter}>
                      <View style={[s.workflowNode, { backgroundColor: meta.accent }]}><Text style={s.workflowNodeText}>{i + 1}</Text></View>
                      {i < goal.tasks.length - 1 && <View style={s.workflowLine} />}
                    </View>
                    <View style={s.workflowCard}>
                      <View style={s.workflowHead}>
                        <Text style={[s.workflowAgent, { color: meta.accent }]}>{meta.name.toUpperCase()} · {meta.role.toUpperCase()}</Text>
                        <PriorityBadge priority={t.priority} />
                      </View>
                      <Text style={s.workflowTitle}>{t.title}</Text>
                      <Text style={s.workflowDesc}>{t.description}</Text>
                      <View style={s.workflowFoot}>
                        <StatusBadge status={t.status} />
                        {t.requires_approval && (
                          <View style={s.approvalBadge}>
                            <Ionicons name="shield-checkmark" size={11} color={theme.color.warning} />
                            <Text style={s.approvalText}>REQUIRES APPROVAL</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {!goal && recent.length > 0 && (
            <>
              <Text style={s.section}>RECENT OBJECTIVES</Text>
              {recent.slice(0, 5).map(g => (
                <Pressable key={g.id} onPress={() => router.push(`/goal/${g.id}` as any)} style={s.recentRow} testID={`ceo-recent-${g.id}`}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.recentText} numberOfLines={2}>{g.objective}</Text>
                    <Text style={s.recentDate}>{new Date(g.created_at).toLocaleDateString()}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.color.onSurfaceTertiary} />
                </Pressable>
              ))}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const c = priority === 'high' ? theme.color.brand : priority === 'medium' ? theme.color.warning : theme.color.onSurfaceTertiary;
  return (
    <View style={[ss.pBadge, { borderColor: c + '66', backgroundColor: c + '15' }]}>
      <Text style={[ss.pBadgeText, { color: c }]}>{priority.toUpperCase()}</Text>
    </View>
  );
}
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    pending: { color: theme.color.onSurfaceTertiary, label: 'PENDING' },
    planning: { color: theme.color.info, label: 'PLANNING' },
    running: { color: theme.color.brand, label: 'RUNNING' },
    waiting_approval: { color: theme.color.warning, label: 'AWAITING APPROVAL' },
    completed: { color: theme.color.success, label: 'COMPLETED' },
    cancelled: { color: theme.color.error, label: 'CANCELLED' },
  };
  const m = map[status] || map.pending;
  return (
    <View style={[ss.pBadge, { borderColor: m.color + '66', backgroundColor: m.color + '15' }]}>
      <Text style={[ss.pBadgeText, { color: m.color }]}>{m.label}</Text>
    </View>
  );
}

const ss = StyleSheet.create({
  pBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm, borderWidth: 1 },
  pBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  scroll: { padding: theme.spacing.xl, paddingBottom: theme.spacing.xl3 },
  eyebrow: { ...theme.type.label, color: theme.color.brand },
  h1: { color: theme.color.onSurface, fontSize: 30, fontWeight: '800', letterSpacing: 0.3, marginTop: 2 },
  sub: { color: theme.color.onSurfaceTertiary, fontSize: 14, marginTop: 6, marginBottom: theme.spacing.xl, lineHeight: 20 },
  inputWrap: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: 4 },
  input: { color: theme.color.onSurface, padding: 14, fontSize: 16, minHeight: 90, textAlignVertical: 'top' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.md },
  chip: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.pill, paddingVertical: 7, paddingHorizontal: 12 },
  chipText: { color: theme.color.onSurfaceSecondary, fontSize: 12 },
  err: { color: theme.color.error, marginTop: theme.spacing.md, fontSize: 13 },
  cta: { backgroundColor: theme.color.brand, paddingVertical: 16, borderRadius: theme.radius.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginTop: theme.spacing.lg, gap: 8 },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.4 },
  plan: { marginTop: theme.spacing.xl2 },
  planEyebrow: { ...theme.type.label, color: theme.color.brand },
  planObjective: { color: theme.color.onSurface, fontSize: 18, fontWeight: '700', fontStyle: 'italic', marginTop: 6 },
  planSummary: { color: theme.color.onSurfaceSecondary, fontSize: 14, marginTop: 8, lineHeight: 20 },
  workflowLabel: { ...theme.type.label, color: theme.color.onSurfaceTertiary, marginTop: theme.spacing.xl, marginBottom: theme.spacing.md },
  workflowRow: { flexDirection: 'row', gap: 12 },
  workflowGutter: { alignItems: 'center', width: 28 },
  workflowNode: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  workflowNodeText: { color: '#000', fontWeight: '800', fontSize: 13 },
  workflowLine: { flex: 1, width: 2, backgroundColor: theme.color.border, marginTop: 2 },
  workflowCard: { flex: 1, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  workflowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  workflowAgent: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  workflowTitle: { color: theme.color.onSurface, fontSize: 15, fontWeight: '700' },
  workflowDesc: { color: theme.color.onSurfaceSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 },
  workflowFoot: { flexDirection: 'row', gap: 6, marginTop: theme.spacing.md, flexWrap: 'wrap' },
  approvalBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: theme.color.warning + '15', borderWidth: 1, borderColor: theme.color.warning + '66', paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm },
  approvalText: { color: theme.color.warning, fontSize: 9, fontWeight: '700', letterSpacing: 0.6 },
  section: { ...theme.type.label, color: theme.color.onSurfaceTertiary, marginTop: theme.spacing.xl2, marginBottom: theme.spacing.md },
  recentRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm, gap: 12 },
  recentText: { color: theme.color.onSurface, fontSize: 13 },
  recentDate: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: 4 },
  openDetailBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.brand + '66', backgroundColor: theme.color.brand + '15', marginTop: theme.spacing.lg },
  openDetailText: { color: theme.color.brand, fontWeight: '700', fontSize: 13, letterSpacing: 0.3 },
});
