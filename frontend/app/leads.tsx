import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/src/api';
import { theme } from '@/src/theme';

type Lead = { id: string; company_name: string; industry?: string; location?: string; phone?: string; website?: string; email?: string; email_verification_status?: string; pipeline_stage?: string; google_maps_url?: string; email_source?: string; do_not_contact?: boolean; discovered_by?: string; discovery_query?: string; discovery_goal_id?: string };
type AgentRun = { task_id: string; title: string; objective?: string; status: string; execution_status?: string; progress: number; discovered: number; verified: number };
type LeadCampaign = { id: string; objective: string; target: number; unique_leads: number; verified_leads: number; approvals_queued: number; searches_completed: number; cursor: number; status: string; last_query?: string; last_location?: string };
type AgentLive = { runs: AgentRun[]; campaigns: LeadCampaign[]; leads: Lead[] };

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [agentLive, setAgentLive] = useState<AgentLive>({ runs: [], campaigns: [], leads: [] });
  const [query, setQuery] = useState('dental clinics');
  const [location, setLocation] = useState('Delhi NCR');
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    try {
      const [saved, live] = await Promise.all([api<Lead[]>('/leads'), api<AgentLive>('/leads/agent-live')]);
      setLeads(saved); setAgentLive(live);
    } catch {}
  }, []);
  useFocusEffect(useCallback(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [load]));

  const search = async () => {
    setBusy('search'); setMessage('');
    try { const r = await api<any>('/leads/search', { method: 'POST', body: { query, location, max_results: 10 } }); setMessage(`${r.count} real businesses saved`); await load(); }
    catch (e: any) { setMessage(e.message); } finally { setBusy(null); }
  };
  const enrich = async () => {
    setBusy('enrich'); setMessage('');
    try { const r = await api<any>('/leads/enrich', { method: 'POST', body: { limit: 3, verify_email: true } }); setMessage(`${r.count} leads checked for public emails`); await load(); }
    catch (e: any) { setMessage(e.message); } finally { setBusy(null); }
  };
  const prepareOutreach = async (lead: Lead) => {
    setBusy(lead.id); setMessage('');
    try {
      await api('/outreach/draft', { method: 'POST', body: { lead_id: lead.id, offer_context: 'Free 20-minute digital growth audit' } });
      await load(); router.push('/(tabs)/approvals' as any);
    } catch (e: any) { setMessage(e.message); } finally { setBusy(null); }
  };

  const agentLeadIds = new Set(agentLive.leads.map(lead => lead.id));
  const displayedLeads = [...agentLive.leads, ...leads.filter(lead => !agentLeadIds.has(lead.id))];
  const latestRun = agentLive.runs[0];
  const campaign = agentLive.campaigns?.[0];
  const campaignProgress = campaign ? Math.min(100, Math.round((campaign.unique_leads / campaign.target) * 100)) : 0;

  return <SafeAreaView style={s.safe} edges={['top']}>
    <View style={s.header}><Pressable onPress={() => router.back()} style={s.back}><Ionicons name="chevron-back" size={22} color={theme.color.onSurface} /></Pressable><Text style={s.headerTitle}>LIVE LEAD PIPELINE</Text><View style={{ width: 40 }} /></View>
    <ScrollView contentContainerStyle={s.scroll}>
      <Text style={s.title}>Find real clients.</Text>
      <Text style={s.sub}>Google Places → public website → Hunter verification. No invented contacts.</Text>
      <TextInput style={s.input} value={query} onChangeText={setQuery} placeholder="Business type" placeholderTextColor={theme.color.onSurfaceTertiary} />
      <TextInput style={s.input} value={location} onChangeText={setLocation} placeholder="Location" placeholderTextColor={theme.color.onSurfaceTertiary} />
      <View style={s.actions}>
        <Pressable onPress={search} disabled={!!busy} style={s.primary}>{busy === 'search' ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Search Google</Text>}</Pressable>
        <Pressable onPress={enrich} disabled={!!busy} style={s.secondary}>{busy === 'enrich' ? <ActivityIndicator color={theme.color.brand} /> : <Text style={s.secondaryText}>Find + verify emails</Text>}</Pressable>
      </View>
      {!!message && <Text style={s.message}>{message}</Text>}
      <Text style={s.section}>SALES AGENT LIVE RUN</Text>
      {campaign && <View style={s.runCard}>
        <View style={s.row}><Text style={s.runTitle}>Persistent Lead Campaign</Text><Text style={s.liveBadge}>{campaign.status === 'active' ? '● RUNNING' : campaign.status.replaceAll('_', ' ').toUpperCase()}</Text></View>
        <Text style={s.runObjective} numberOfLines={3}>{campaign.objective}</Text>
        <View style={s.runStats}><Text style={s.stat}>{campaignProgress}%</Text><Text style={s.stat}>{campaign.unique_leads}/{campaign.target} UNIQUE</Text><Text style={s.stat}>{campaign.verified_leads} VERIFIED</Text></View>
        <Text style={s.runObjective}>Searches: {campaign.searches_completed} · Approvals: {campaign.approvals_queued}</Text>
        {!!campaign.last_query && <Text style={s.runObjective}>Last batch: {campaign.last_query} · {campaign.last_location}</Text>}
        <Text style={s.refresh}>Next unused batch runs automatically. Screen refreshes every 5 seconds.</Text>
      </View>}
      {!campaign && latestRun ? <View style={s.runCard}>
        <View style={s.row}><Text style={s.runTitle}>{latestRun.title}</Text><Text style={s.liveBadge}>{latestRun.status === 'running' ? '● LIVE' : latestRun.execution_status?.replaceAll('_', ' ').toUpperCase()}</Text></View>
        <Text style={s.runObjective} numberOfLines={3}>{latestRun.objective}</Text>
        <View style={s.runStats}><Text style={s.stat}>{latestRun.progress}% PROGRESS</Text><Text style={s.stat}>{latestRun.discovered} FOUND</Text><Text style={s.stat}>{latestRun.verified} VERIFIED</Text></View>
        <Text style={s.refresh}>Auto-refreshes every 5 seconds</Text>
      </View> : !campaign && <View style={s.runCard}><Text style={s.runObjective}>No CEO-linked sales discovery run yet.</Text></View>}
      <Text style={s.section}>{agentLive.leads.length} AGENT FOUND · {leads.length} TOTAL SAVED</Text>
      {displayedLeads.map(lead => <View key={lead.id} style={[s.card, agentLeadIds.has(lead.id) && s.agentCard]}>
        <View style={s.row}><Text style={s.name}>{lead.company_name}</Text><Text style={[s.badge, lead.email_verification_status === 'verified' && s.verified]}>{(lead.email_verification_status || 'not checked').toUpperCase()}</Text></View>
        {agentLeadIds.has(lead.id) && <Text style={s.agentSource}>ARJUN MEHTA · LIVE AGENT · {lead.discovery_query?.toUpperCase()}</Text>}
        <Text style={s.meta}>{[lead.industry, lead.location].filter(Boolean).join(' · ')}</Text>
        <Text style={s.stage}>PIPELINE · {(lead.pipeline_stage || 'researched').replaceAll('_', ' ').toUpperCase()}</Text>
        {!!lead.email && <Text style={s.contact}>✉ {lead.email} · {lead.email_source}</Text>}
        {!!lead.phone && <Pressable onPress={() => Linking.openURL(`tel:${lead.phone}`)}><Text style={s.link}>☎ {lead.phone}</Text></Pressable>}
        <View style={s.links}>{!!lead.website && <Pressable onPress={() => Linking.openURL(lead.website!)}><Text style={s.link}>Website ↗</Text></Pressable>}{!!lead.google_maps_url && <Pressable onPress={() => Linking.openURL(lead.google_maps_url!)}><Text style={s.link}>Google source ↗</Text></Pressable>}</View>
        {lead.email_verification_status === 'verified' && !lead.do_not_contact && !['awaiting_approval','contacted','replied'].includes(lead.pipeline_stage || '') && (
          <Pressable onPress={() => prepareOutreach(lead)} disabled={!!busy} style={s.outreachBtn}>
            {busy === lead.id ? <ActivityIndicator color="#fff" /> : <Text style={s.outreachText}>Prepare personalized outreach</Text>}
          </Pressable>
        )}
      </View>)}
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:theme.color.surface},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:12},back:{width:40,height:40,alignItems:'center',justifyContent:'center'},headerTitle:{...theme.type.label,color:theme.color.onSurfaceTertiary},scroll:{padding:theme.spacing.xl,paddingBottom:60},title:{fontSize:28,fontWeight:'800',color:theme.color.onSurface},sub:{color:theme.color.onSurfaceSecondary,fontSize:13,lineHeight:19,marginTop:6,marginBottom:18},input:{backgroundColor:theme.color.surfaceSecondary,borderWidth:1,borderColor:theme.color.border,borderRadius:theme.radius.md,color:theme.color.onSurface,padding:13,marginBottom:10},actions:{flexDirection:'row',gap:10},primary:{flex:1,backgroundColor:theme.color.brand,padding:13,borderRadius:theme.radius.md,alignItems:'center'},primaryText:{color:'#fff',fontWeight:'700'},secondary:{flex:1,borderWidth:1,borderColor:theme.color.brand,padding:13,borderRadius:theme.radius.md,alignItems:'center'},secondaryText:{color:theme.color.brand,fontWeight:'700',fontSize:12},message:{color:theme.color.warning,marginTop:12},section:{...theme.type.label,color:theme.color.onSurfaceTertiary,marginTop:24,marginBottom:10},runCard:{backgroundColor:theme.color.surfaceSecondary,borderWidth:1,borderColor:theme.color.brand,borderRadius:theme.radius.md,padding:14},runTitle:{color:theme.color.onSurface,fontWeight:'800',fontSize:14,flex:1},runObjective:{color:theme.color.onSurfaceTertiary,fontSize:11,lineHeight:16,marginTop:7},liveBadge:{color:theme.color.success,fontSize:9,fontWeight:'900'},runStats:{flexDirection:'row',gap:14,marginTop:12},stat:{color:theme.color.brand,fontSize:10,fontWeight:'800'},refresh:{color:theme.color.onSurfaceTertiary,fontSize:9,marginTop:9},card:{backgroundColor:theme.color.surfaceSecondary,borderWidth:1,borderColor:theme.color.border,borderRadius:theme.radius.md,padding:14,marginBottom:10},agentCard:{borderColor:theme.color.brand},agentSource:{color:theme.color.success,fontSize:9,fontWeight:'900',marginTop:7},row:{flexDirection:'row',justifyContent:'space-between',gap:8},name:{color:theme.color.onSurface,fontWeight:'700',fontSize:15,flex:1},badge:{color:theme.color.warning,fontSize:9,fontWeight:'800'},verified:{color:theme.color.success},meta:{color:theme.color.onSurfaceTertiary,fontSize:11,marginTop:5},stage:{color:theme.color.brand,fontSize:9,fontWeight:'800',marginTop:7},contact:{color:theme.color.onSurface,fontSize:12,marginTop:10},link:{color:theme.color.info,fontSize:12,marginTop:8},links:{flexDirection:'row',gap:18},outreachBtn:{backgroundColor:theme.color.brand,borderRadius:theme.radius.sm,padding:11,alignItems:'center',marginTop:12},outreachText:{color:'#fff',fontWeight:'700',fontSize:12}
});
