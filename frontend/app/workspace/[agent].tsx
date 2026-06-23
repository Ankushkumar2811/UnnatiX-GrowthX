import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, AGENT_META } from '@/src/theme';
import { AgentAvatar } from '@/src/AgentAvatar';
import { api } from '@/src/api';

type Task = { id: string; agent_id: string; title: string; description: string; priority: string; status: string; progress: number; requires_approval: boolean; output: string | null; created_at: string };

const DEPT_META: Record<string, { eyebrow: string; sections: { id: string; label: string }[] }> = {
  seo: { eyebrow: 'ORGANIC GROWTH · SEO', sections: [{ id: 'all', label: 'All Work' }, { id: 'running', label: 'Audits & Rankings' }, { id: 'completed', label: 'Delivered' }] },
  marketing: { eyebrow: 'CREATIVE MARKETING', sections: [{ id: 'all', label: 'All' }, { id: 'content', label: 'Social & Content' }, { id: 'campaigns', label: 'Campaigns' }] },
  sales:     { eyebrow: 'SALES GENERATION', sections: [{ id: 'all', label: 'Pipeline' }, { id: 'leads', label: 'Leads & Offers' }, { id: 'outreach', label: 'Pitch & Follow-ups' }] },
  research:  { eyebrow: 'STRATEGY & RESEARCH', sections: [{ id: 'all', label: 'All' }, { id: 'reports', label: 'Client Research' }, { id: 'trends', label: 'Trends & Ads' }] },
  developer: { eyebrow: 'WEB & APP DELIVERY', sections: [{ id: 'all', label: 'All' }, { id: 'projects', label: 'Sites & Apps' }, { id: 'docs', label: 'Tracking & Docs' }] },
  operations:{ eyebrow: 'CLIENT OPERATIONS', sections: [{ id: 'all', label: 'All' }, { id: 'planning', label: 'Onboarding' }, { id: 'running', label: 'In Delivery' }, { id: 'completed', label: 'Reported' }] },
  finance:   { eyebrow: 'FINANCE · ROI & ROAS', sections: [{ id: 'all', label: 'Budgets & Returns' }] },
  hr:        { eyebrow: 'PEOPLE · SOP & TRAINING', sections: [{ id: 'all', label: 'All' }, { id: 'sops', label: 'Agency SOPs' }, { id: 'knowledge', label: 'Training & Knowledge' }] },
};

export default function Workspace() {
  const { agent } = useLocalSearchParams<{ agent: string }>();
  const router = useRouter();
  const meta = AGENT_META[agent] || { name: agent, role: '', accent: theme.color.brand };
  const dept = DEPT_META[agent] || DEPT_META.operations;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [section, setSection] = useState('all');
  const [generating, setGenerating] = useState<string | null>(null);
  const [showQuick, setShowQuick] = useState(false);
  const [qTitle, setQTitle] = useState('');
  const [qDesc, setQDesc] = useState('');
  const [qApproval, setQApproval] = useState(agent === 'sales');
  const [qBusy, setQBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await api<Task[]>('/tasks');
      setTasks(all.filter(t => t.agent_id === agent));
    } catch {}
  }, [agent]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = useMemo(() => {
    if (section === 'all') return tasks;
    if (section === 'planning' || section === 'running' || section === 'completed') return tasks.filter(t => t.status === section);
    if (section === 'outreach') return tasks.filter(t => t.requires_approval);
    return tasks; // other tags ('content', 'leads', 'sops'...) — for MVP just show all
  }, [tasks, section]);

  const generate = async (taskId: string) => {
    setGenerating(taskId);
    try { await api(`/tasks/${taskId}/generate`, { method: 'POST' }); await load(); }
    catch (e: any) { console.warn(e); }
    finally { setGenerating(null); }
  };

  const submitQuick = async () => {
    if (qTitle.trim().length < 2 || qDesc.trim().length < 2) return;
    setQBusy(true);
    try {
      await api('/tasks/quick', { method: 'POST', body: {
        agent_id: agent, title: qTitle.trim(), description: qDesc.trim(),
        priority: 'medium', requires_approval: qApproval,
      }});
      setQTitle(''); setQDesc(''); setShowQuick(false); load();
    } catch (e: any) { console.warn(e); }
    finally { setQBusy(false); }
  };

  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    pending: tasks.filter(t => t.requires_approval && t.status === 'waiting_approval').length,
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} testID="workspace-back">
          <Ionicons name="chevron-back" size={22} color={theme.color.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable testID="workspace-add-task" onPress={() => setShowQuick(true)} style={[s.addBtn, { backgroundColor: meta.accent }]}>
          <Ionicons name="add" size={18} color="#000" />
          <Text style={s.addBtnText}>New task</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.heroRow}>
          <AgentAvatar agentId={agent} accent={meta.accent} size={64} />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={s.eyebrow}>{dept.eyebrow}</Text>
            <Text style={s.title}>{meta.name}</Text>
            <Text style={[s.role, { color: meta.accent }]}>{meta.role}</Text>
          </View>
        </View>

        <View style={s.statsRow}>
          <WStat label="Total" value={stats.total} />
          <WStat label="Completed" value={stats.completed} color={theme.color.success} />
          <WStat label="Awaiting" value={stats.pending} color={theme.color.warning} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipsRow}>
          {dept.sections.map(sec => {
            const active = section === sec.id;
            return (
              <Pressable key={sec.id} testID={`workspace-section-${sec.id}`} onPress={() => setSection(sec.id)} style={[s.chip, active && { borderColor: meta.accent, backgroundColor: meta.accent + '15' }]}>
                <Text style={[s.chipText, active && { color: meta.accent }]}>{sec.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {visible.length === 0 && (
          <View style={s.emptyCard}>
            <Ionicons name="folder-open-outline" size={36} color={theme.color.onSurfaceTertiary} />
            <Text style={s.emptyTitle}>No outputs yet</Text>
            <Text style={s.emptySub}>Brief Shri Nath or add a quick task to put {meta.name} to work.</Text>
          </View>
        )}

        {visible.map(t => {
          const hasOutput = !!t.output;
          const canGenerate = !hasOutput && t.status !== 'waiting_approval' && t.status !== 'cancelled';
          return (
            <View key={t.id} style={s.outputCard} testID={`workspace-task-${t.id}`}>
              <View style={s.outputHead}>
                <View style={[s.priDot, { backgroundColor: t.priority === 'high' ? theme.color.brand : t.priority === 'medium' ? theme.color.warning : theme.color.onSurfaceTertiary }]} />
                <Text style={s.outputTitle} numberOfLines={2}>{t.title}</Text>
              </View>
              <Text style={s.outputDesc}>{t.description}</Text>

              {hasOutput ? (
                <View style={s.outputPreview}>
                  <Text style={s.outputLabel}>DELIVERABLE</Text>
                  <Text style={s.outputText}>{t.output}</Text>
                </View>
              ) : t.status === 'waiting_approval' ? (
                <View style={s.gateBox}>
                  <Ionicons name="shield-checkmark" size={16} color={theme.color.warning} />
                  <Text style={s.gateText}>Waiting on founder approval before generation.</Text>
                </View>
              ) : canGenerate && (
                <Pressable onPress={() => generate(t.id)} disabled={generating === t.id} style={[s.genBtn, { borderColor: meta.accent }]} testID={`workspace-generate-${t.id}`}>
                  {generating === t.id
                    ? <><ActivityIndicator size="small" color={meta.accent} /><Text style={[s.genBtnText, { color: meta.accent }]}>  Generating…</Text></>
                    : <><Ionicons name="sparkles" size={14} color={meta.accent} /><Text style={[s.genBtnText, { color: meta.accent }]}>Generate output</Text></>}
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showQuick} transparent animationType="fade" onRequestClose={() => setShowQuick(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>New task for {meta.name}</Text>
            <TextInput testID="workspace-quick-title" style={s.input} placeholder="Task title"
              placeholderTextColor={theme.color.onSurfaceTertiary} value={qTitle} onChangeText={setQTitle} />
            <TextInput testID="workspace-quick-desc" style={[s.input, { height: 90, textAlignVertical: 'top' }]} multiline
              placeholder="Brief description / deliverable expected"
              placeholderTextColor={theme.color.onSurfaceTertiary} value={qDesc} onChangeText={setQDesc} />
            <Pressable testID="workspace-quick-approval" onPress={() => setQApproval(v => !v)} style={s.approvalToggle}>
              <View style={[s.checkbox, qApproval && { backgroundColor: meta.accent, borderColor: meta.accent }]}>
                {qApproval && <Ionicons name="checkmark" size={12} color="#000" />}
              </View>
              <Text style={s.toggleText}>Requires founder approval (sensitive action)</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: theme.spacing.md }}>
              <Pressable testID="workspace-quick-cancel" onPress={() => setShowQuick(false)} style={[s.modalBtn, { borderWidth: 1, borderColor: theme.color.border }]}>
                <Text style={{ color: theme.color.onSurfaceSecondary, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable testID="workspace-quick-submit" disabled={qBusy} onPress={submitQuick} style={[s.modalBtn, { backgroundColor: meta.accent }]}>
                {qBusy ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: '800' }}>Create</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function WStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={s.wstat}>
      <Text style={[s.wstatVal, color && { color }]}>{value}</Text>
      <Text style={s.wstatLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: theme.radius.md },
  addBtnText: { color: '#000', fontWeight: '800', fontSize: 12, letterSpacing: 0.3 },
  scroll: { padding: theme.spacing.xl, paddingTop: 0, paddingBottom: theme.spacing.xl3 },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.lg },
  eyebrow: { ...theme.type.label, color: theme.color.brand },
  title: { color: theme.color.onSurface, fontSize: 28, fontWeight: '800', letterSpacing: 0.2, marginTop: 2 },
  role: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: theme.spacing.lg },
  wstat: { flex: 1, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md },
  wstatVal: { color: theme.color.onSurface, fontSize: 22, fontWeight: '800' },
  wstatLabel: { color: theme.color.onSurfaceTertiary, fontSize: 10, letterSpacing: 0.6, marginTop: 2 },
  chipsRow: { gap: 8, paddingBottom: 4 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceSecondary, justifyContent: 'center', flexShrink: 0 },
  chipText: { color: theme.color.onSurfaceSecondary, fontSize: 12, fontWeight: '600' },
  emptyCard: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.lg, padding: theme.spacing.xl, alignItems: 'center', gap: 8, marginTop: theme.spacing.lg },
  emptyTitle: { color: theme.color.onSurface, fontSize: 15, fontWeight: '700', marginTop: 4 },
  emptySub: { color: theme.color.onSurfaceTertiary, fontSize: 12, textAlign: 'center' },
  outputCard: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md, marginTop: theme.spacing.md },
  outputHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  priDot: { width: 6, height: 6, borderRadius: 3 },
  outputTitle: { color: theme.color.onSurface, fontSize: 15, fontWeight: '700', flex: 1 },
  outputDesc: { color: theme.color.onSurfaceSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 },
  outputPreview: { marginTop: theme.spacing.md, backgroundColor: theme.color.surfaceTertiary, borderRadius: theme.radius.sm, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.color.border },
  outputLabel: { ...theme.type.label, color: theme.color.onSurfaceTertiary, fontSize: 9 },
  outputText: { color: theme.color.onSurface, fontSize: 13, marginTop: 8, lineHeight: 20 },
  gateBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: theme.spacing.md, padding: 10, backgroundColor: theme.color.warning + '15', borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.color.warning + '44' },
  gateText: { color: theme.color.warning, fontSize: 12, flex: 1 },
  genBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: theme.radius.sm, borderWidth: 1, marginTop: theme.spacing.md, backgroundColor: theme.color.surfaceTertiary },
  genBtnText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: theme.spacing.xl },
  modalCard: { backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.lg, padding: theme.spacing.xl, borderWidth: 1, borderColor: theme.color.border },
  modalTitle: { color: theme.color.onSurface, fontSize: 18, fontWeight: '800', marginBottom: theme.spacing.md },
  input: { backgroundColor: theme.color.surfaceTertiary, borderWidth: 1, borderColor: theme.color.border, color: theme.color.onSurface, padding: 12, borderRadius: theme.radius.sm, fontSize: 14, marginBottom: theme.spacing.sm },
  approvalToggle: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: theme.spacing.sm },
  checkbox: { width: 20, height: 20, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  toggleText: { color: theme.color.onSurfaceSecondary, fontSize: 12, flex: 1 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: theme.radius.md, alignItems: 'center' },
});
