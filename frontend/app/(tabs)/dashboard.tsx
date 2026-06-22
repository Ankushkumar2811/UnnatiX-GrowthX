import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme, AGENT_META } from '@/src/theme';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth';

type Stats = {
  total_agents: number; active_tasks: number; completed_tasks: number; goals_running: number;
  approvals_pending: number; reports_generated: number; leads_researched: number; content_created: number;
  projects_running: number; total_tasks: number; system_status: string;
};
type Activity = { id: string; agent_id: string; message: string; kind: string; created_at: string };

export default function Dashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [feed, setFeed] = useState<Activity[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([api<Stats>('/stats/dashboard'), api<Activity[]>('/activity')]);
      setStats(s); setFeed(a);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View>
          <Text style={s.eyebrow}>UNNATIX · GROWTHX</Text>
          <Text style={s.title}>Command</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable testID="logout-button" onPress={logout} style={s.iconBtn}>
            <Ionicons name="log-out-outline" size={20} color={theme.color.onSurface} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl tintColor={theme.color.brand} refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={s.hero} testID="dashboard-hero">
          <View style={s.heroRow}>
            <View style={s.statusDot} />
            <Text style={s.heroLabel}>SYSTEM OPERATIONAL</Text>
          </View>
          <Text style={s.heroValue}>{user?.organization || 'Your AI Company'}</Text>
          <Text style={s.heroSub}>{stats?.total_agents ?? 8} AI employees on standby · {stats?.active_tasks ?? 0} tasks in motion</Text>

          <Pressable testID="dashboard-launch-goal" style={s.heroCta} onPress={() => router.push('/(tabs)/ceo')}>
            <Ionicons name="sparkles" size={16} color="#fff" />
            <Text style={s.heroCtaText}>Brief the CEO AI</Text>
          </Pressable>
        </View>

        <Text style={s.section}>OPERATIONAL METRICS</Text>
        <View style={s.grid}>
          <Stat icon="people" label="AI Employees" value={stats?.total_agents ?? 8} />
          <Stat icon="pulse" label="Active Tasks" value={stats?.active_tasks ?? 0} accent={theme.color.brand} />
          <Stat icon="checkmark-done" label="Completed" value={stats?.completed_tasks ?? 0} accent={theme.color.success} />
          <Stat icon="rocket" label="Goals Running" value={stats?.goals_running ?? 0} />
          <Stat icon="shield-checkmark" label="Pending Approvals" value={stats?.approvals_pending ?? 0} accent={theme.color.warning} />
          <Stat icon="document-text" label="Reports" value={stats?.reports_generated ?? 0} />
          <Stat icon="people-circle" label="Leads Researched" value={stats?.leads_researched ?? 0} />
          <Stat icon="color-palette" label="Content Created" value={stats?.content_created ?? 0} />
        </View>

        <Text style={s.section}>OPERATIONS</Text>
        <View style={s.quickRow}>
          <Pressable testID="dashboard-knowledge-link" onPress={() => router.push('/knowledge' as any)} style={s.quickTile}>
            <Ionicons name="library" size={18} color={theme.color.brand} />
            <Text style={s.quickTitle}>Knowledge</Text>
            <Text style={s.quickSub}>Notes + PDF/CSV</Text>
          </Pressable>
          <Pressable testID="dashboard-integrations-link" onPress={() => router.push('/integrations' as any)} style={s.quickTile}>
            <Ionicons name="link" size={18} color={theme.color.brand} />
            <Text style={s.quickTitle}>Integrations</Text>
            <Text style={s.quickSub}>Gmail · Slack · more</Text>
          </Pressable>
        </View>
        <View style={[s.quickRow, { marginTop: 10 }]}>
          <Pressable testID="dashboard-meetings-link" onPress={() => router.push('/meetings' as any)} style={s.quickTile}>
            <Ionicons name="videocam" size={18} color={theme.color.brand} />
            <Text style={s.quickTitle}>Meetings</Text>
            <Text style={s.quickSub}>Google Meet · calls</Text>
          </Pressable>
          <Pressable testID="dashboard-automations-link" onPress={() => router.push('/automations' as any)} style={s.quickTile}>
            <Ionicons name="git-network" size={18} color={theme.color.brand} />
            <Text style={s.quickTitle}>Automations</Text>
            <Text style={s.quickSub}>Trigger → action</Text>
          </Pressable>
        </View>
        <View style={[s.quickRow, { marginTop: 10 }]}>
          <Pressable testID="dashboard-admin-link" onPress={() => router.push('/admin' as any)} style={s.quickTile}>
            <Ionicons name="shield" size={18} color={theme.color.brand} />
            <Text style={s.quickTitle}>Admin</Text>
            <Text style={s.quickSub}>Team · invites · roles</Text>
          </Pressable>
          <Pressable testID="dashboard-analytics-link" onPress={() => router.push('/analytics' as any)} style={s.quickTile}>
            <Ionicons name="trending-up" size={18} color={theme.color.brand} />
            <Text style={s.quickTitle}>Analytics</Text>
            <Text style={s.quickSub}>Throughput · ROI</Text>
          </Pressable>
        </View>
        <View style={[s.quickRow, { marginTop: 10 }]}>
          <Pressable testID="dashboard-billing-link" onPress={() => router.push('/billing' as any)} style={s.quickTile}>
            <Ionicons name="card" size={18} color={theme.color.brand} />
            <Text style={s.quickTitle}>Billing</Text>
            <Text style={s.quickSub}>Stripe · plans</Text>
          </Pressable>
          <View style={[s.quickTile, { opacity: 0 }]} />
        </View>

        <Text style={s.section}>LIVE ACTIVITY FEED</Text>
        <View style={s.feed} testID="activity-feed">
          {feed.length === 0 && (
            <Text style={s.empty}>No activity yet. Brief your CEO AI to launch your first initiative.</Text>
          )}
          {feed.slice(0, 25).map(a => {
            const meta = AGENT_META[a.agent_id] || { name: a.agent_id, role: '', accent: theme.color.onSurface };
            return (
              <View key={a.id} style={s.feedRow}>
                <View style={[s.feedDot, { backgroundColor: meta.accent }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.feedAgent}>{meta.name} <Text style={s.feedRole}>· {meta.role}</Text></Text>
                  <Text style={s.feedMsg}>{a.message}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ icon, label, value, accent }: { icon: any; label: string; value: number | string; accent?: string }) {
  return (
    <View style={s.stat}>
      <View style={[s.statIcon, accent && { backgroundColor: accent + '22', borderColor: accent + '55' }]}>
        <Ionicons name={icon} size={16} color={accent || theme.color.onSurfaceSecondary} />
      </View>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: theme.spacing.xl, paddingBottom: theme.spacing.md, paddingTop: theme.spacing.md },
  eyebrow: { ...theme.type.label, color: theme.color.brand },
  title: { color: theme.color.onSurface, fontSize: 30, fontWeight: '800', letterSpacing: 0.3, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: theme.spacing.xl, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xl2 },
  hero: { backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.border, padding: theme.spacing.xl, overflow: 'hidden' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.success },
  heroLabel: { ...theme.type.label, color: theme.color.success, fontSize: 10 },
  heroValue: { color: theme.color.onSurface, fontSize: 22, fontWeight: '700', marginBottom: 4 },
  heroSub: { color: theme.color.onSurfaceTertiary, fontSize: 13, marginBottom: theme.spacing.lg },
  heroCta: { backgroundColor: theme.color.brand, paddingVertical: 12, paddingHorizontal: 16, borderRadius: theme.radius.md, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  heroCtaText: { color: '#fff', fontWeight: '700', fontSize: 13, letterSpacing: 0.5 },
  section: { ...theme.type.label, color: theme.color.onSurfaceTertiary, marginTop: theme.spacing.xl2, marginBottom: theme.spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { width: '47.5%', backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, padding: theme.spacing.md },
  statIcon: { width: 32, height: 32, borderRadius: theme.radius.sm, backgroundColor: theme.color.surfaceTertiary, borderWidth: 1, borderColor: theme.color.border, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { color: theme.color.onSurface, fontSize: 24, fontWeight: '800', letterSpacing: 0.2 },
  statLabel: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: 2, letterSpacing: 0.4 },
  feed: { backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, padding: theme.spacing.md, gap: theme.spacing.md },
  quickRow: { flexDirection: 'row', gap: 10 },
  quickTile: { flex: 1, backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, padding: theme.spacing.md },
  quickTitle: { color: theme.color.onSurface, fontSize: 14, fontWeight: '700', marginTop: 8 },
  quickSub: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: 4, lineHeight: 15 },
  feedRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  feedDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  feedAgent: { color: theme.color.onSurface, fontSize: 13, fontWeight: '700' },
  feedRole: { color: theme.color.onSurfaceTertiary, fontWeight: '400' },
  feedMsg: { color: theme.color.onSurfaceSecondary, fontSize: 13, marginTop: 2, lineHeight: 18 },
  empty: { color: theme.color.onSurfaceTertiary, fontSize: 13, textAlign: 'center', paddingVertical: theme.spacing.lg },
});
