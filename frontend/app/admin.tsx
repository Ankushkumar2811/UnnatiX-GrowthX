import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';

type Member = { id: string; name: string; email: string; role: string; joined_at: string };
type Org = { organization: string; role: string; members: Member[] };
type Invite = { code: string; organization: string; created_at: string };

export default function Admin() {
  const router = useRouter();
  const { user } = useAuth();
  const [org, setOrg] = useState<Org | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'err' | 'ok'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [o, i] = await Promise.all([api<Org>('/org/me'), api<Invite[]>('/org/invites')]);
      setOrg(o); setInvites(i);
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const newInvite = async () => {
    setBusy(true); setMsg(null);
    try { await api('/org/invite', { method: 'POST' }); load(); }
    catch (e: any) { setMsg({ kind: 'err', text: e.message }); }
    finally { setBusy(false); }
  };

  const joinOrg = async () => {
    if (joinCode.trim().length < 4) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ organization: string }>('/org/join', { method: 'POST', body: { code: joinCode.trim().toUpperCase() } });
      setMsg({ kind: 'ok', text: `Joined ${r.organization}` }); setJoinCode(''); load();
    } catch (e: any) { setMsg({ kind: 'err', text: e.message }); }
    finally { setBusy(false); }
  };

  const removeMember = async (id: string) => {
    setBusy(true);
    try { await api(`/org/members/${id}`, { method: 'DELETE' }); load(); }
    catch (e: any) { setMsg({ kind: 'err', text: e.message }); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} testID="admin-back">
          <Ionicons name="chevron-back" size={22} color={theme.color.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }} />
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.eyebrow}>FOUNDER PANEL</Text>
        <Text style={s.title}>Admin</Text>

        <View style={s.orgCard}>
          <Text style={s.cardLabel}>ORGANIZATION</Text>
          <Text style={s.orgName}>{org?.organization || '—'}</Text>
          <Text style={s.cardMeta}>You are <Text style={{ color: theme.color.brand, fontWeight: '700' }}>{(org?.role || 'owner').toUpperCase()}</Text></Text>
        </View>

        <Text style={s.section}>TEAM · {org?.members.length || 0}</Text>
        {org?.members.map(m => (
          <View key={m.id} style={s.memberRow} testID={`member-${m.id}`}>
            <View style={[s.memberAvatar, { backgroundColor: theme.color.brand + '22' }]}>
              <Text style={s.memberInitial}>{m.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.memberName}>{m.name} {m.id === user?.id && <Text style={s.youTag}>· YOU</Text>}</Text>
              <Text style={s.memberEmail}>{m.email}</Text>
            </View>
            <View style={[s.roleBadge, m.role === 'owner' && { borderColor: theme.color.brand + '66', backgroundColor: theme.color.brand + '15' }]}>
              <Text style={[s.roleText, m.role === 'owner' && { color: theme.color.brand }]}>{m.role.toUpperCase()}</Text>
            </View>
            {org.role === 'owner' && m.id !== user?.id && (
              <Pressable testID={`member-remove-${m.id}`} onPress={() => removeMember(m.id)} style={s.removeBtn}>
                <Ionicons name="close" size={16} color={theme.color.error} />
              </Pressable>
            )}
          </View>
        ))}

        <Text style={s.section}>INVITE TEAMMATES</Text>
        <Pressable testID="admin-new-invite" disabled={busy} onPress={newInvite} style={s.inviteBtn}>
          {busy ? <ActivityIndicator color="#fff" /> : <><Ionicons name="add-circle-outline" size={16} color="#fff" /><Text style={s.inviteBtnText}>Generate invite code</Text></>}
        </Pressable>

        {invites.map(i => (
          <View key={i.code} style={s.codeCard} testID={`invite-${i.code}`}>
            <View style={{ flex: 1 }}>
              <Text style={s.codeLabel}>INVITE CODE</Text>
              <Text style={s.codeText} selectable>{i.code}</Text>
            </View>
            <View style={s.codeBadge}>
              <Text style={s.codeBadgeText}>SHARE</Text>
            </View>
          </View>
        ))}

        <Text style={s.section}>JOIN ANOTHER ORG</Text>
        <View style={s.joinRow}>
          <TextInput testID="admin-join-input" style={s.joinInput} placeholder="Enter invite code" autoCapitalize="characters"
            placeholderTextColor={theme.color.onSurfaceTertiary} value={joinCode} onChangeText={setJoinCode} />
          <Pressable testID="admin-join-button" disabled={busy} onPress={joinOrg} style={s.joinBtn}>
            <Text style={s.joinBtnText}>Join</Text>
          </Pressable>
        </View>

        {msg && <Text style={[s.msg, msg.kind === 'err' && { color: theme.color.error }, msg.kind === 'ok' && { color: theme.color.success }]}>{msg.text}</Text>}

        <View style={s.billingCard} testID="admin-billing">
          <Ionicons name="card" size={20} color={theme.color.brand} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.billingTitle}>Billing · Free tier</Text>
            <Text style={s.billingSub}>Unlimited goals · 9 AI employees · Claude Sonnet 4.5</Text>
          </View>
        </View>
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
  orgCard: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.lg, padding: theme.spacing.lg },
  cardLabel: { ...theme.type.label, color: theme.color.onSurfaceTertiary },
  orgName: { color: theme.color.onSurface, fontSize: 22, fontWeight: '800', marginTop: 6 },
  cardMeta: { color: theme.color.onSurfaceSecondary, fontSize: 12, marginTop: 6 },
  section: { ...theme.type.label, color: theme.color.onSurfaceTertiary, marginTop: theme.spacing.xl, marginBottom: theme.spacing.md },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  memberAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  memberInitial: { color: theme.color.brand, fontSize: 16, fontWeight: '800' },
  memberName: { color: theme.color.onSurface, fontSize: 14, fontWeight: '700' },
  youTag: { color: theme.color.brand, fontSize: 10, letterSpacing: 0.6 },
  memberEmail: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceTertiary },
  roleText: { fontSize: 9, fontWeight: '700', color: theme.color.onSurfaceTertiary, letterSpacing: 0.6 },
  removeBtn: { padding: 4 },
  inviteBtn: { backgroundColor: theme.color.brand, paddingVertical: 12, borderRadius: theme.radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  inviteBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  codeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md, marginTop: theme.spacing.sm },
  codeLabel: { ...theme.type.label, color: theme.color.onSurfaceTertiary, fontSize: 9 },
  codeText: { color: theme.color.brand, fontSize: 22, fontWeight: '800', letterSpacing: 4, marginTop: 4, fontFamily: 'monospace' },
  codeBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm, backgroundColor: theme.color.brand + '15', borderWidth: 1, borderColor: theme.color.brand + '55' },
  codeBadgeText: { color: theme.color.brand, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  joinRow: { flexDirection: 'row', gap: 8 },
  joinInput: { flex: 1, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, color: theme.color.onSurface, padding: 12, borderRadius: theme.radius.md, fontSize: 14, letterSpacing: 2 },
  joinBtn: { paddingHorizontal: 20, justifyContent: 'center', borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceTertiary, borderWidth: 1, borderColor: theme.color.borderStrong },
  joinBtnText: { color: theme.color.onSurface, fontWeight: '700' },
  msg: { fontSize: 12, marginTop: theme.spacing.sm },
  billingCard: { flexDirection: 'row', alignItems: 'center', marginTop: theme.spacing.xl2, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md },
  billingTitle: { color: theme.color.onSurface, fontSize: 14, fontWeight: '700' },
  billingSub: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: 4 },
});
