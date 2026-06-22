import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api } from '@/src/api';

type Meeting = { id: string; title: string; participants: string[]; start_time: string; duration_min: number; meet_link: string; status: string; description: string };

const QUICK_TIMES: { label: string; offsetMin: number }[] = [
  { label: 'In 1 hour', offsetMin: 60 },
  { label: 'In 3 hours', offsetMin: 180 },
  { label: 'Tomorrow 10am', offsetMin: -1 },   // special-handled
  { label: 'Next Monday 2pm', offsetMin: -2 },
];

function resolveQuickTime(offset: number): Date {
  const now = new Date();
  if (offset === -1) { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d; }
  if (offset === -2) {
    const d = new Date(now); const dayOfWeek = d.getDay();
    const daysUntilMon = (8 - dayOfWeek) % 7 || 7;
    d.setDate(d.getDate() + daysUntilMon); d.setHours(14, 0, 0, 0); return d;
  }
  return new Date(now.getTime() + offset * 60000);
}

export default function Meetings() {
  const router = useRouter();
  const [items, setItems] = useState<Meeting[]>([]);
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState('');
  const [participants, setParticipants] = useState('');
  const [duration, setDuration] = useState('30');
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [startTime, setStartTime] = useState<Date>(resolveQuickTime(60));
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => { try { setItems(await api<Meeting[]>('/meetings')); } catch {} }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const create = async () => {
    if (title.trim().length < 2) return;
    setBusy(true);
    try {
      await api('/meetings', { method: 'POST', body: {
        title: title.trim(),
        participants: participants.split(',').map(p => p.trim()).filter(Boolean),
        start_time: startTime.toISOString(),
        duration_min: parseInt(duration) || 30,
        requires_approval: requiresApproval,
      }});
      setTitle(''); setParticipants(''); setDuration('30'); setShow(false);
      load();
    } catch (e: any) { console.warn(e); }
    finally { setBusy(false); }
  };

  const cancel = async (id: string) => {
    try { await api(`/meetings/${id}`, { method: 'DELETE' }); load(); } catch {}
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} testID="meetings-back">
          <Ionicons name="chevron-back" size={22} color={theme.color.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable testID="meetings-add" onPress={() => setShow(true)} style={s.addBtn}>
          <Ionicons name="add" size={18} color="#000" />
          <Text style={s.addBtnText}>Schedule</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.eyebrow}>OPERATIONS · ORION</Text>
        <Text style={s.title}>Meetings & Calls</Text>
        <View style={s.sandboxBanner} testID="meetings-sandbox-banner">
          <Ionicons name="warning" size={14} color={theme.color.warning} />
          <Text style={s.sandboxText}>Google Meet links are SANDBOX · MOCKED until you share Google credentials.</Text>
        </View>

        {items.length === 0 && (
          <View style={s.emptyCard}>
            <Ionicons name="videocam-outline" size={36} color={theme.color.onSurfaceTertiary} />
            <Text style={s.emptyTitle}>No meetings scheduled</Text>
            <Text style={s.emptySub}>Tap Schedule to plan a call or sync.</Text>
          </View>
        )}

        {items.map(m => {
          const start = new Date(m.start_time);
          const isCancelled = m.status === 'cancelled';
          const isPending = m.status === 'pending_approval';
          return (
            <View key={m.id} style={[s.card, isCancelled && { opacity: 0.5 }]} testID={`meeting-${m.id}`}>
              <View style={s.cardTop}>
                <View style={s.dateCol}>
                  <Text style={s.dateMon}>{start.toLocaleString('en', { month: 'short' }).toUpperCase()}</Text>
                  <Text style={s.dateDay}>{start.getDate()}</Text>
                  <Text style={s.dateTime}>{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{m.title}</Text>
                  <Text style={s.cardMeta}>{m.duration_min} min · {m.participants.length} participants</Text>
                  {m.participants.length > 0 && <Text style={s.cardParts} numberOfLines={1}>{m.participants.join(', ')}</Text>}
                  <View style={s.cardFoot}>
                    <View style={[s.statusBadge, isPending && { borderColor: theme.color.warning + '66', backgroundColor: theme.color.warning + '15' }, isCancelled && { borderColor: theme.color.error + '66', backgroundColor: theme.color.error + '15' }]}>
                      <Text style={[s.statusText, isPending && { color: theme.color.warning }, isCancelled && { color: theme.color.error }]}>
                        {isCancelled ? 'CANCELLED' : isPending ? 'AWAITING APPROVAL' : 'SCHEDULED'}
                      </Text>
                    </View>
                    {!isCancelled && (
                      <Pressable testID={`meeting-cancel-${m.id}`} onPress={() => cancel(m.id)} style={s.cancelBtn}>
                        <Text style={s.cancelText}>Cancel</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
              <View style={s.linkBox}>
                <Ionicons name="link" size={12} color={theme.color.brand} />
                <Text style={s.linkText} numberOfLines={1}>{m.meet_link}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.modalBackdrop}>
          <ScrollView contentContainerStyle={{ justifyContent: 'center', flexGrow: 1 }}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Schedule a meeting</Text>
              <TextInput testID="meeting-title-input" style={s.input} placeholder="Meeting title"
                placeholderTextColor={theme.color.onSurfaceTertiary} value={title} onChangeText={setTitle} />
              <TextInput testID="meeting-participants-input" style={s.input} placeholder="Participants (comma-separated emails)"
                placeholderTextColor={theme.color.onSurfaceTertiary} value={participants} onChangeText={setParticipants} autoCapitalize="none" />

              <Text style={s.label}>WHEN</Text>
              <View style={s.chipsRow}>
                {QUICK_TIMES.map(q => {
                  const d = resolveQuickTime(q.offsetMin);
                  const active = Math.abs(d.getTime() - startTime.getTime()) < 60000;
                  return (
                    <Pressable key={q.label} testID={`meeting-time-${q.label}`} onPress={() => setStartTime(d)} style={[s.chip, active && s.chipActive]}>
                      <Text style={[s.chipText, active && { color: theme.color.brand }]}>{q.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={s.helper}>Selected: {startTime.toLocaleString()}</Text>

              <Text style={s.label}>DURATION (MIN)</Text>
              <TextInput style={s.input} keyboardType="number-pad" value={duration} onChangeText={setDuration} />

              <Pressable testID="meeting-approval-toggle" onPress={() => setRequiresApproval(v => !v)} style={s.toggleRow}>
                <View style={[s.cb, requiresApproval && { backgroundColor: theme.color.brand, borderColor: theme.color.brand }]}>
                  {requiresApproval && <Ionicons name="checkmark" size={12} color="#000" />}
                </View>
                <Text style={s.toggleText}>Require approval before sending invites</Text>
              </Pressable>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: theme.spacing.md }}>
                <Pressable testID="meeting-cancel-btn" onPress={() => setShow(false)} style={[s.modalBtn, { borderWidth: 1, borderColor: theme.color.border }]}>
                  <Text style={{ color: theme.color.onSurfaceSecondary, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
                <Pressable testID="meeting-create-btn" disabled={busy} onPress={create} style={[s.modalBtn, { backgroundColor: theme.color.brand }]}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Schedule</Text>}
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
  title: { color: theme.color.onSurface, fontSize: 30, fontWeight: '800', marginTop: 2, letterSpacing: 0.2, marginBottom: theme.spacing.md },
  sandboxBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: theme.color.warning + '12', borderWidth: 1, borderColor: theme.color.warning + '44', borderRadius: theme.radius.sm, marginBottom: theme.spacing.lg },
  sandboxText: { color: theme.color.onSurfaceSecondary, fontSize: 11, flex: 1, lineHeight: 15 },
  emptyCard: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.lg, padding: theme.spacing.xl, alignItems: 'center', gap: 8 },
  emptyTitle: { color: theme.color.onSurface, fontSize: 16, fontWeight: '700', marginTop: 4 },
  emptySub: { color: theme.color.onSurfaceTertiary, fontSize: 13 },
  card: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  cardTop: { flexDirection: 'row', gap: 14 },
  dateCol: { width: 60, alignItems: 'center', paddingTop: 4 },
  dateMon: { color: theme.color.brand, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  dateDay: { color: theme.color.onSurface, fontSize: 28, fontWeight: '800', marginTop: -4 },
  dateTime: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: -2 },
  cardTitle: { color: theme.color.onSurface, fontSize: 15, fontWeight: '700' },
  cardMeta: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: 4, letterSpacing: 0.4 },
  cardParts: { color: theme.color.onSurfaceSecondary, fontSize: 11, marginTop: 4 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.sm, gap: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.color.success + '66', backgroundColor: theme.color.success + '15' },
  statusText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, color: theme.color.success },
  cancelBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  cancelText: { color: theme.color.error, fontSize: 11, fontWeight: '700' },
  linkBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: theme.spacing.md, paddingTop: theme.spacing.md, borderTopWidth: 1, borderTopColor: theme.color.divider },
  linkText: { color: theme.color.onSurfaceSecondary, fontSize: 11, flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', padding: theme.spacing.lg },
  modalCard: { backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.lg, padding: theme.spacing.xl, borderWidth: 1, borderColor: theme.color.border },
  modalTitle: { color: theme.color.onSurface, fontSize: 18, fontWeight: '800', marginBottom: theme.spacing.md },
  label: { ...theme.type.label, color: theme.color.onSurfaceTertiary, marginTop: theme.spacing.sm, marginBottom: 8 },
  input: { backgroundColor: theme.color.surfaceTertiary, borderWidth: 1, borderColor: theme.color.border, color: theme.color.onSurface, padding: 12, borderRadius: theme.radius.sm, fontSize: 14, marginBottom: theme.spacing.sm },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceTertiary },
  chipActive: { borderColor: theme.color.brand, backgroundColor: theme.color.brand + '15' },
  chipText: { color: theme.color.onSurfaceSecondary, fontSize: 12, fontWeight: '600' },
  helper: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: 8, fontStyle: 'italic' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: theme.spacing.sm },
  cb: { width: 20, height: 20, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.color.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.surfaceTertiary },
  toggleText: { color: theme.color.onSurfaceSecondary, fontSize: 12, flex: 1 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: theme.radius.md, alignItems: 'center' },
});
