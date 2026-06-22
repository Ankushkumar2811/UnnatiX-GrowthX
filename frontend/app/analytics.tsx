import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api } from '@/src/api';

type AgentRow = { agent_id: string; name: string; accent: string; completed: number; active: number };
type StatusRow = { status: string; count: number };
type TimelineRow = { date: string; goals: number };
type Overview = {
  agent_throughput: AgentRow[];
  status_breakdown: StatusRow[];
  approvals: { approved: number; rejected: number; pending: number };
  goals_timeline: TimelineRow[];
  headlines: { total_outputs_generated: number; meetings_scheduled: number; knowledge_items: number; automations_active: number };
};

const STATUS_COLOR: Record<string, string> = {
  pending: theme.color.onSurfaceTertiary,
  planning: theme.color.info,
  running: theme.color.brand,
  waiting_approval: theme.color.warning,
  completed: theme.color.success,
  cancelled: theme.color.error,
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', planning: 'Planning', running: 'Running', waiting_approval: 'Awaiting', completed: 'Completed', cancelled: 'Cancelled',
};

export default function Analytics() {
  const router = useRouter();
  const [data, setData] = useState<Overview | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api<Overview>('/analytics/overview')); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const maxThroughput = Math.max(1, ...(data?.agent_throughput.map(a => a.completed + a.active) || [1]));
  const maxStatus = Math.max(1, ...(data?.status_breakdown.map(s => s.count) || [1]));
  const maxTimeline = Math.max(1, ...(data?.goals_timeline.map(t => t.goals) || [1]));
  const totalApprovals = (data?.approvals.approved || 0) + (data?.approvals.rejected || 0) + (data?.approvals.pending || 0);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} testID="analytics-back">
          <Ionicons name="chevron-back" size={22} color={theme.color.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }} />
      </View>
      <ScrollView contentContainerStyle={s.scroll} refreshControl={<RefreshControl tintColor={theme.color.brand} refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
        <Text style={s.eyebrow}>INSIGHTS</Text>
        <Text style={s.title}>Analytics</Text>

        <View style={s.headlinesRow}>
          <Headline label="Outputs" value={data?.headlines.total_outputs_generated ?? 0} icon="document-text" />
          <Headline label="Meetings" value={data?.headlines.meetings_scheduled ?? 0} icon="videocam" />
        </View>
        <View style={[s.headlinesRow, { marginTop: 10 }]}>
          <Headline label="Knowledge" value={data?.headlines.knowledge_items ?? 0} icon="library" />
          <Headline label="Automations" value={data?.headlines.automations_active ?? 0} icon="git-network" />
        </View>

        {/* Goals over 14 days */}
        <Text style={s.section}>GOALS · LAST 14 DAYS</Text>
        <View style={s.chartCard} testID="chart-timeline">
          <View style={s.timelineRow}>
            {data?.goals_timeline.map((t, idx) => (
              <View key={t.date} style={s.timelineBarWrap}>
                <View style={[s.timelineBar, { height: Math.max(4, (t.goals / maxTimeline) * 80), backgroundColor: t.goals > 0 ? theme.color.brand : theme.color.surfaceTertiary }]} />
                {(idx === 0 || idx === 13) && <Text style={s.timelineLabel}>{new Date(t.date).getDate()}</Text>}
              </View>
            ))}
          </View>
        </View>

        {/* Agent throughput bars */}
        <Text style={s.section}>AGENT THROUGHPUT</Text>
        <View style={s.chartCard} testID="chart-throughput">
          {data?.agent_throughput.map(a => {
            const total = a.completed + a.active;
            const pct = (total / maxThroughput) * 100;
            return (
              <View key={a.agent_id} style={s.throughRow}>
                <Text style={s.throughName}>{a.name}</Text>
                <View style={s.throughTrack}>
                  <View style={[s.throughFill, { width: `${pct}%`, backgroundColor: a.accent }]} />
                </View>
                <Text style={s.throughVal}>{a.completed}/{total}</Text>
              </View>
            );
          })}
        </View>

        {/* Status breakdown */}
        <Text style={s.section}>TASK STATUS</Text>
        <View style={s.chartCard} testID="chart-status">
          {data?.status_breakdown.map(st => {
            const pct = (st.count / maxStatus) * 100;
            return (
              <View key={st.status} style={s.statusRow}>
                <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[st.status] }]} />
                <Text style={s.statusLabel}>{STATUS_LABEL[st.status]}</Text>
                <View style={s.statusTrack}><View style={[s.statusFill, { width: `${pct}%`, backgroundColor: STATUS_COLOR[st.status] }]} /></View>
                <Text style={s.statusVal}>{st.count}</Text>
              </View>
            );
          })}
        </View>

        {/* Approvals donut-ish */}
        <Text style={s.section}>APPROVALS</Text>
        <View style={s.chartCard} testID="chart-approvals">
          <View style={s.apprRow}>
            <ApprovalSeg label="Approved" count={data?.approvals.approved ?? 0} total={totalApprovals} color={theme.color.success} />
            <ApprovalSeg label="Rejected" count={data?.approvals.rejected ?? 0} total={totalApprovals} color={theme.color.error} />
            <ApprovalSeg label="Pending"  count={data?.approvals.pending  ?? 0} total={totalApprovals} color={theme.color.warning} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Headline({ label, value, icon }: { label: string; value: number; icon: any }) {
  return (
    <View style={s.headline}>
      <Ionicons name={icon} size={16} color={theme.color.brand} />
      <Text style={s.headlineVal}>{value}</Text>
      <Text style={s.headlineLabel}>{label}</Text>
    </View>
  );
}

function ApprovalSeg({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <View style={s.apprSeg}>
      <Text style={[s.apprVal, { color }]}>{count}</Text>
      <Text style={s.apprLabel}>{label}</Text>
      <Text style={s.apprPct}>{pct}%</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: theme.spacing.xl, paddingTop: 0, paddingBottom: theme.spacing.xl3 },
  eyebrow: { ...theme.type.label, color: theme.color.brand },
  title: { color: theme.color.onSurface, fontSize: 30, fontWeight: '800', marginTop: 2, letterSpacing: 0.2, marginBottom: theme.spacing.lg },
  headlinesRow: { flexDirection: 'row', gap: 10 },
  headline: { flex: 1, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md },
  headlineVal: { color: theme.color.onSurface, fontSize: 26, fontWeight: '800', marginTop: 6 },
  headlineLabel: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: 4, letterSpacing: 0.4 },
  section: { ...theme.type.label, color: theme.color.onSurfaceTertiary, marginTop: theme.spacing.xl, marginBottom: theme.spacing.md },
  chartCard: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 4 },
  timelineBarWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  timelineBar: { width: '100%', borderRadius: 2, minHeight: 4 },
  timelineLabel: { color: theme.color.onSurfaceTertiary, fontSize: 9, marginTop: 4 },
  throughRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  throughName: { color: theme.color.onSurfaceSecondary, fontSize: 12, fontWeight: '600', width: 70 },
  throughTrack: { flex: 1, height: 8, backgroundColor: theme.color.surfaceTertiary, borderRadius: 4, overflow: 'hidden' },
  throughFill: { height: '100%' },
  throughVal: { color: theme.color.onSurfaceTertiary, fontSize: 11, width: 40, textAlign: 'right' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { color: theme.color.onSurfaceSecondary, fontSize: 12, width: 70 },
  statusTrack: { flex: 1, height: 6, backgroundColor: theme.color.surfaceTertiary, borderRadius: 3, overflow: 'hidden' },
  statusFill: { height: '100%' },
  statusVal: { color: theme.color.onSurfaceTertiary, fontSize: 11, width: 24, textAlign: 'right' },
  apprRow: { flexDirection: 'row', justifyContent: 'space-around' },
  apprSeg: { alignItems: 'center', flex: 1 },
  apprVal: { fontSize: 28, fontWeight: '800' },
  apprLabel: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: 4, letterSpacing: 0.4 },
  apprPct: { color: theme.color.onSurfaceSecondary, fontSize: 11, fontWeight: '700', marginTop: 2 },
});
