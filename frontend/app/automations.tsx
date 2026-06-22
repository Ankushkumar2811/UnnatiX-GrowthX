import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, AGENT_META } from '@/src/theme';
import { api } from '@/src/api';

type Catalog = { triggers: Record<string, string>; actions: Record<string, string> };
type Automation = { id: string; name: string; trigger: string; action: string; action_config: any; enabled: boolean; fired_count: number };

export default function Automations() {
  const router = useRouter();
  const [items, setItems] = useState<Automation[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('goal_completed');
  const [action, setAction] = useState('log_only');
  const [agentId, setAgentId] = useState('operations');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, list] = await Promise.all([api<Catalog>('/automations/catalog'), api<Automation[]>('/automations')]);
      setCatalog(c); setItems(list);
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      const config = action === 'create_task' ? { agent_id: agentId, title: `${name} follow-up`, description: 'Auto-generated from automation' }
                    : action === 'add_knowledge_note' ? { title: `Auto: ${name}`, content: 'Triggered by automation' }
                    : {};
      await api('/automations', { method: 'POST', body: { name: name.trim(), trigger, action, action_config: config, enabled: true } });
      setName(''); setShow(false); load();
    } catch (e: any) { console.warn(e); }
    finally { setBusy(false); }
  };

  const toggle = async (a: Automation) => {
    try { await api(`/automations/${a.id}`, { method: 'PATCH', body: { enabled: !a.enabled } }); load(); } catch {}
  };
  const remove = async (id: string) => { try { await api(`/automations/${id}`, { method: 'DELETE' }); load(); } catch {} };

  const AGENT_IDS = ['marketing', 'sales', 'research', 'developer', 'operations', 'finance', 'hr'];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} testID="automations-back">
          <Ionicons name="chevron-back" size={22} color={theme.color.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable testID="automations-add" onPress={() => setShow(true)} style={s.addBtn}>
          <Ionicons name="add" size={18} color="#000" />
          <Text style={s.addBtnText}>New</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.eyebrow}>EXECUTION ENGINE</Text>
        <Text style={s.title}>Automations</Text>
        <Text style={s.sub}>Trigger → Action workflows. Fire automatically when events occur. Sensitive actions still flow through approval.</Text>

        {items.length === 0 && (
          <View style={s.emptyCard}>
            <Ionicons name="git-network-outline" size={36} color={theme.color.onSurfaceTertiary} />
            <Text style={s.emptyTitle}>No automations yet</Text>
            <Text style={s.emptySub}>Build your first trigger → action chain.</Text>
          </View>
        )}

        {items.map(a => (
          <View key={a.id} style={s.card} testID={`automation-${a.id}`}>
            <View style={s.cardHead}>
              <Text style={s.cardName} numberOfLines={1}>{a.name}</Text>
              <Pressable testID={`automation-toggle-${a.id}`} onPress={() => toggle(a)} style={[s.switch, a.enabled && s.switchOn]}>
                <View style={[s.switchKnob, a.enabled && s.switchKnobOn]} />
              </Pressable>
            </View>
            <View style={s.flowRow}>
              <View style={s.flowNode}><Text style={s.flowLabel}>WHEN</Text><Text style={s.flowText}>{catalog?.triggers[a.trigger] || a.trigger}</Text></View>
              <Ionicons name="arrow-forward" size={16} color={theme.color.brand} />
              <View style={s.flowNode}><Text style={s.flowLabel}>THEN</Text><Text style={s.flowText}>{catalog?.actions[a.action] || a.action}</Text></View>
            </View>
            <View style={s.cardFoot}>
              <Text style={s.fired}>Fired {a.fired_count}×</Text>
              <Pressable testID={`automation-delete-${a.id}`} onPress={() => remove(a.id)} style={s.delBtn}>
                <Ionicons name="trash-outline" size={14} color={theme.color.error} />
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalBackdrop}>
          <ScrollView contentContainerStyle={{ justifyContent: 'center', flexGrow: 1 }}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>New automation</Text>
              <TextInput testID="automation-name-input" style={s.input} placeholder="Automation name"
                placeholderTextColor={theme.color.onSurfaceTertiary} value={name} onChangeText={setName} />

              <Text style={s.label}>TRIGGER</Text>
              <View style={s.optsCol}>
                {catalog && Object.entries(catalog.triggers).map(([k, v]) => (
                  <Pressable key={k} testID={`automation-trigger-${k}`} onPress={() => setTrigger(k)} style={[s.opt, trigger === k && s.optActive]}>
                    <View style={[s.radio, trigger === k && { borderColor: theme.color.brand }]}>{trigger === k && <View style={s.radioInner} />}</View>
                    <Text style={[s.optText, trigger === k && { color: theme.color.onSurface }]}>{v}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.label}>ACTION</Text>
              <View style={s.optsCol}>
                {catalog && Object.entries(catalog.actions).map(([k, v]) => (
                  <Pressable key={k} testID={`automation-action-${k}`} onPress={() => setAction(k)} style={[s.opt, action === k && s.optActive]}>
                    <View style={[s.radio, action === k && { borderColor: theme.color.brand }]}>{action === k && <View style={s.radioInner} />}</View>
                    <Text style={[s.optText, action === k && { color: theme.color.onSurface }]}>{v}</Text>
                  </Pressable>
                ))}
              </View>

              {action === 'create_task' && (
                <>
                  <Text style={s.label}>ASSIGN TO AGENT</Text>
                  <View style={s.chipsRow}>
                    {AGENT_IDS.map(id => {
                      const m = AGENT_META[id]; const active = agentId === id;
                      return (
                        <Pressable key={id} testID={`automation-agent-${id}`} onPress={() => setAgentId(id)} style={[s.chip, active && { borderColor: m.accent, backgroundColor: m.accent + '15' }]}>
                          <Text style={[s.chipText, active && { color: m.accent }]}>{m.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              <View style={{ flexDirection: 'row', gap: 8, marginTop: theme.spacing.lg }}>
                <Pressable testID="automation-cancel" onPress={() => setShow(false)} style={[s.modalBtn, { borderWidth: 1, borderColor: theme.color.border }]}>
                  <Text style={{ color: theme.color.onSurfaceSecondary, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
                <Pressable testID="automation-create" disabled={busy} onPress={create} style={[s.modalBtn, { backgroundColor: theme.color.brand }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Create</Text>}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: theme.radius.md, backgroundColor: theme.color.brand },
  addBtnText: { color: '#000', fontWeight: '800', fontSize: 12, letterSpacing: 0.3 },
  scroll: { padding: theme.spacing.xl, paddingTop: 0, paddingBottom: theme.spacing.xl3 },
  eyebrow: { ...theme.type.label, color: theme.color.brand },
  title: { color: theme.color.onSurface, fontSize: 30, fontWeight: '800', marginTop: 2, letterSpacing: 0.2 },
  sub: { color: theme.color.onSurfaceTertiary, fontSize: 13, marginTop: 8, marginBottom: theme.spacing.lg, lineHeight: 18 },
  emptyCard: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.lg, padding: theme.spacing.xl, alignItems: 'center', gap: 8 },
  emptyTitle: { color: theme.color.onSurface, fontSize: 16, fontWeight: '700', marginTop: 4 },
  emptySub: { color: theme.color.onSurfaceTertiary, fontSize: 13 },
  card: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.md },
  cardName: { color: theme.color.onSurface, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  switch: { width: 40, height: 22, borderRadius: 11, backgroundColor: theme.color.surfaceTertiary, borderWidth: 1, borderColor: theme.color.border, justifyContent: 'center', paddingHorizontal: 2 },
  switchOn: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  switchKnob: { width: 16, height: 16, borderRadius: 8, backgroundColor: theme.color.onSurfaceTertiary, alignSelf: 'flex-start' },
  switchKnobOn: { backgroundColor: '#fff', alignSelf: 'flex-end' },
  flowRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flowNode: { flex: 1, backgroundColor: theme.color.surfaceTertiary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.sm, padding: 10 },
  flowLabel: { ...theme.type.label, color: theme.color.brand, fontSize: 9 },
  flowText: { color: theme.color.onSurface, fontSize: 12, marginTop: 4, lineHeight: 16 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.md, paddingTop: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.color.divider },
  fired: { color: theme.color.onSurfaceTertiary, fontSize: 11, letterSpacing: 0.3 },
  delBtn: { padding: 4 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', padding: theme.spacing.lg },
  modalCard: { backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.lg, padding: theme.spacing.xl, borderWidth: 1, borderColor: theme.color.border },
  modalTitle: { color: theme.color.onSurface, fontSize: 18, fontWeight: '800', marginBottom: theme.spacing.md },
  label: { ...theme.type.label, color: theme.color.onSurfaceTertiary, marginTop: theme.spacing.md, marginBottom: 8 },
  input: { backgroundColor: theme.color.surfaceTertiary, borderWidth: 1, borderColor: theme.color.border, color: theme.color.onSurface, padding: 12, borderRadius: theme.radius.sm, fontSize: 14 },
  optsCol: { gap: 6 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceTertiary },
  optActive: { borderColor: theme.color.brand, backgroundColor: theme.color.brand + '10' },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5, borderColor: theme.color.onSurfaceTertiary, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.brand },
  optText: { color: theme.color.onSurfaceSecondary, fontSize: 12, flex: 1 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceTertiary },
  chipText: { color: theme.color.onSurfaceSecondary, fontSize: 12, fontWeight: '600' },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: theme.radius.md, alignItems: 'center' },
});
