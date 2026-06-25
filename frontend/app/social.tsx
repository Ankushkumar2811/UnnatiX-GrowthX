import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api } from '@/src/api';

type Platform = 'instagram' | 'facebook' | 'linkedin' | 'x' | 'youtube';
type SocialAccount = {
  platform: Platform;
  label: string;
  configured: boolean;
  status: string;
  profile_name?: string;
  profile_handle?: string;
  oauth_ready?: boolean;
};
type SocialPost = {
  id: string;
  campaign_name: string;
  objective: string;
  platforms: Platform[];
  status: string;
  summary?: string;
  asset_brief?: string;
  per_platform?: Record<string, { title?: string; description?: string; caption?: string; hashtags?: string[]; creative_brief?: string; label?: string }>;
  media_attached?: boolean;
  media_name?: string;
  media_mime?: string;
  platform_results?: Record<string, { status?: string; video_id?: string; url?: string }>;
  scheduled_at?: string;
  created_at: string;
};

const PLATFORM_ICONS: Record<Platform, keyof typeof Ionicons.glyphMap> = {
  instagram: 'logo-instagram',
  facebook: 'logo-facebook',
  linkedin: 'logo-linkedin',
  x: 'logo-twitter',
  youtube: 'logo-youtube',
};

const STATUS_LABELS: Record<string, string> = {
  waiting_approval: 'WAITING FOUNDER APPROVAL',
  draft: 'DRAFT',
  scheduled: 'SCHEDULED',
  approved_ready_to_publish: 'APPROVED · READY TO PUBLISH',
  approved_needs_platform_connection: 'APPROVED · CONNECT LIVE PLATFORM',
  published_partial: 'PUBLISHED · PARTIAL',
  rejected: 'REJECTED',
};

export default function SocialManager() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [connectPlatform, setConnectPlatform] = useState<Platform>('instagram');
  const [profileName, setProfileName] = useState('UnnatiX Technologies');
  const [profileHandle, setProfileHandle] = useState('@unnatixtechnologies');
  const [objective, setObjective] = useState('Create a 7-day content push for Delhi NCR businesses showing how UnnatiX improves SEO, social media, ads and website lead generation.');
  const [campaignName, setCampaignName] = useState('Delhi NCR Growth Campaign');
  const [selected, setSelected] = useState<Platform[]>(['instagram', 'facebook', 'linkedin', 'youtube']);
  const [mediaB64, setMediaB64] = useState('');
  const [mediaFile, setMediaFile] = useState<any>(null);
  const [mediaName, setMediaName] = useState('');
  const [mediaMime, setMediaMime] = useState('');
  const [mediaSize, setMediaSize] = useState(0);
  const [mediaError, setMediaError] = useState('');

  const load = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([api<SocialAccount[]>('/social/accounts'), api<SocialPost[]>('/social/posts')]);
      setAccounts(a);
      setPosts(p);
    } catch {}
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const configuredCount = useMemo(() => accounts.filter(a => a.configured).length, [accounts]);
  const pendingCount = useMemo(() => posts.filter(p => p.status === 'waiting_approval').length, [posts]);

  const togglePlatform = (platform: Platform) => {
    setSelected(prev => prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]);
  };

  const pickMedia = async () => {
    setMediaError('');
    if (typeof document === 'undefined') {
      setMediaError('File upload is available on web only right now.');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*,image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      setMediaFile(file);
      setMediaB64('');
      setMediaName(file.name);
      setMediaMime(file.type || 'application/octet-stream');
      setMediaSize(file.size);
    };
    input.click();
  };

  const uploadMediaIfNeeded = async () => {
    if (!mediaFile) return {};
    const signed = await api<any>('/social/media/sign', { method: 'POST', body: { resource_type: 'auto' } });
    const form = new FormData();
    form.append('file', mediaFile);
    form.append('api_key', signed.api_key);
    form.append('timestamp', String(signed.timestamp));
    form.append('folder', signed.folder);
    form.append('signature', signed.signature);
    const res = await fetch(signed.upload_url, { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || 'Media upload failed');
    return {
      media_url: data.secure_url,
      media_public_id: data.public_id,
      media_resource_type: data.resource_type,
      media_mime: mediaMime,
      media_name: mediaName,
    };
  };

  const connect = async () => {
    setBusy(true);
    try {
      await api('/social/accounts', {
        method: 'POST',
        body: { platform: connectPlatform, profile_name: profileName, profile_handle: profileHandle },
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    if (!objective.trim() || selected.length === 0) return;
    setBusy(true);
    try {
      const uploaded = await uploadMediaIfNeeded();
      await api('/social/drafts', {
        method: 'POST',
        body: {
          objective: objective.trim(),
          campaign_name: campaignName.trim() || 'Harshita Social Campaign',
          platforms: selected,
          requires_approval: true,
          media_b64: mediaB64 || undefined,
          media_mime: mediaMime || undefined,
          media_name: mediaName || undefined,
          ...uploaded,
        },
      });
      setMediaB64('');
      setMediaFile(null);
      setMediaName('');
      setMediaMime('');
      setMediaSize(0);
      await load();
    } catch (e: any) {
      setMediaError(e?.message || 'Could not upload/generate social post.');
    } finally {
      setBusy(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} testID="social-back">
          <Ionicons name="chevron-back" size={22} color={theme.color.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={load} style={s.iconBtn}>
          <Ionicons name="refresh" size={18} color={theme.color.onSurface} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl tintColor={theme.color.brand} refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={s.eyebrow}>HARSHITA GAUR · SOCIAL MEDIA MANAGER</Text>
        <Text style={s.title}>One panel. Every platform.</Text>
        <Text style={s.subtitle}>Connect profiles, generate platform-wise posts, approve them, and keep a social calendar in one place.</Text>

        <View style={s.metrics}>
          <Metric icon="link" label="Profiles" value={configuredCount} />
          <Metric icon="shield-checkmark" label="Approval Queue" value={pendingCount} accent={theme.color.warning} />
          <Metric icon="calendar" label="Posts" value={posts.length} accent={theme.color.brandSecondary} />
        </View>

        <Text style={s.section}>CONNECTED PROFILES</Text>
        <View style={s.accountGrid}>
          {accounts.map(a => (
            <View key={a.platform} style={[s.accountCard, a.configured && { borderColor: theme.color.brand + '66' }]}>
              <Ionicons name={PLATFORM_ICONS[a.platform]} size={20} color={a.configured ? theme.color.brand : theme.color.onSurfaceTertiary} />
              <Text style={s.accountName}>{a.label}</Text>
              <Text style={s.accountHandle}>{a.configured ? `${a.profile_name} · ${a.profile_handle}` : 'Not connected'}</Text>
              <Text style={[s.pill, a.configured && { color: theme.color.success, borderColor: theme.color.success + '55' }]}>
                {a.status === 'connected_live' ? 'CONNECTED · LIVE' : a.configured ? 'MANUAL PROFILE ADDED' : a.oauth_ready ? 'OAUTH READY' : 'CONNECT PROFILE'}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}>Add a profile to Harshita panel</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {accounts.map(a => (
              <Pressable key={a.platform} onPress={() => setConnectPlatform(a.platform)} style={[s.chip, connectPlatform === a.platform && s.chipActive]}>
                <Ionicons name={PLATFORM_ICONS[a.platform]} size={14} color={connectPlatform === a.platform ? '#fff' : theme.color.onSurfaceSecondary} />
                <Text style={[s.chipText, connectPlatform === a.platform && { color: '#fff' }]}>{a.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput style={s.input} placeholder="Profile name" placeholderTextColor={theme.color.onSurfaceTertiary} value={profileName} onChangeText={setProfileName} />
          <TextInput style={s.input} placeholder="@handle or page name" placeholderTextColor={theme.color.onSurfaceTertiary} value={profileHandle} onChangeText={setProfileHandle} />
          <Pressable disabled={busy} onPress={connect} style={s.primaryBtn}>
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryText}>Add profile</Text>}
          </Pressable>
        </View>

        <Text style={s.section}>ASK HARSHITA TO CREATE POSTS</Text>
        <View style={s.card}>
          <TextInput style={s.input} placeholder="Campaign name" placeholderTextColor={theme.color.onSurfaceTertiary} value={campaignName} onChangeText={setCampaignName} />
          <TextInput
            style={[s.input, s.textarea]}
            multiline
            placeholder="Brief Harshita..."
            placeholderTextColor={theme.color.onSurfaceTertiary}
            value={objective}
            onChangeText={setObjective}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {accounts.map(a => (
              <Pressable key={a.platform} onPress={() => togglePlatform(a.platform)} style={[s.chip, selected.includes(a.platform) && s.chipActive]}>
                <Ionicons name={PLATFORM_ICONS[a.platform]} size={14} color={selected.includes(a.platform) ? '#fff' : theme.color.onSurfaceSecondary} />
                <Text style={[s.chipText, selected.includes(a.platform) && { color: '#fff' }]}>{a.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={s.uploadBox}>
            <View style={{ flex: 1 }}>
              <Text style={s.uploadTitle}>Upload one video/creative</Text>
              <Text style={s.uploadSub}>
                {mediaName ? `${mediaName} · ${(mediaSize / 1024 / 1024).toFixed(2)} MB · ${mediaMime}` : 'Same media uploads to Cloudinary, then Harshita adapts captions, title and description per platform.'}
              </Text>
            </View>
            <Pressable onPress={pickMedia} style={s.secondaryBtn}>
              <Ionicons name="cloud-upload" size={15} color={theme.color.brand} />
              <Text style={s.secondaryText}>{mediaName ? 'Change' : 'Choose file'}</Text>
            </Pressable>
          </View>
          {!!mediaError && <Text style={s.errorText}>{mediaError}</Text>}
          <View style={s.destinationHead}>
            <View>
              <Text style={s.destinationTitle}>Where should this upload go?</Text>
              <Text style={s.destinationSub}>{selected.length} platform{selected.length === 1 ? '' : 's'} selected</Text>
            </View>
            <Pressable onPress={() => setSelected(accounts.map(a => a.platform))} style={s.selectAllBtn}>
              <Text style={s.selectAllText}>Select all</Text>
            </Pressable>
          </View>
          <View style={s.destinationGrid}>
            {accounts.map(a => {
              const active = selected.includes(a.platform);
              return (
                <Pressable key={a.platform} onPress={() => togglePlatform(a.platform)} style={[s.destinationCard, active && s.destinationActive]}>
                  <View style={s.destinationTop}>
                    <Ionicons name={PLATFORM_ICONS[a.platform]} size={18} color={active ? '#fff' : theme.color.onSurfaceSecondary} />
                    <Ionicons name={active ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={active ? '#fff' : theme.color.onSurfaceTertiary} />
                  </View>
                  <Text style={[s.destinationName, active && { color: '#fff' }]}>{a.label}</Text>
                  <Text style={[s.destinationStatus, active && { color: '#FFE6DC' }]}>
                    {a.status === 'connected_live' ? 'Live publish' : a.configured ? 'Draft/manual' : a.oauth_ready ? 'OAuth ready' : 'Not connected'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={s.notice}>
            <Ionicons name="shield-checkmark" size={16} color={theme.color.warning} />
            <Text style={s.noticeText}>Generated posts go to Founder Approvals first. YouTube can publish after approval; Meta/LinkedIn/X still need live publisher tokens.</Text>
          </View>
          <Pressable disabled={busy || selected.length === 0} onPress={generate} style={[s.primaryBtn, selected.length === 0 && { opacity: 0.5 }]}>
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.primaryText}>Generate for {selected.length} platform{selected.length === 1 ? '' : 's'} + send to approval</Text>}
          </Pressable>
        </View>

        <Text style={s.section}>SOCIAL CALENDAR</Text>
        {posts.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>No social posts yet. Give Harshita a campaign brief to create the first pack.</Text>
          </View>
        ) : posts.map(post => (
          <View key={post.id} style={s.postCard}>
            <View style={s.postTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.postTitle}>{post.campaign_name}</Text>
                <Text style={s.postSub}>{post.summary || post.objective}</Text>
              </View>
              <Text style={s.status}>{STATUS_LABELS[post.status] || post.status.toUpperCase()}</Text>
            </View>
            <View style={s.platformRow}>
              {post.platforms.map(p => (
                <View key={p} style={s.platformPill}>
                  <Ionicons name={PLATFORM_ICONS[p]} size={12} color={theme.color.brand} />
                  <Text style={s.platformText}>{p}</Text>
                </View>
              ))}
            </View>
            {!!post.asset_brief && <Text style={s.assetBrief}>Creative: {post.asset_brief}</Text>}
            {post.media_attached && <Text style={s.mediaTag}>MEDIA ATTACHED · {post.media_name || post.media_mime || 'creative/video'}</Text>}
            {!!post.platform_results?.youtube?.url && <Text style={s.youtubeUrl}>YouTube: {post.platform_results.youtube.url}</Text>}
            {post.platforms.slice(0, 5).map(p => {
              const item = post.per_platform?.[p];
              if (!item?.caption && !item?.title && !item?.description) return null;
              return (
                <View key={`${post.id}-${p}`} style={s.captionBox}>
                  <Text style={s.captionLabel}>{item.label || p}</Text>
                  {!!item.title && <Text style={s.ytTitle}>{item.title}</Text>}
                  {!!item.description && <Text style={s.caption} numberOfLines={4}>{item.description}</Text>}
                  {!!item.caption && <Text style={s.caption} numberOfLines={5}>{item.caption}</Text>}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ icon, label, value, accent }: { icon: any; label: string; value: number; accent?: string }) {
  return (
    <View style={s.metric}>
      <Ionicons name={icon} size={16} color={accent || theme.color.brand} />
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconBtn: { width: 40, height: 40, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: theme.spacing.xl, paddingTop: 0, paddingBottom: theme.spacing.xl3 },
  eyebrow: { ...theme.type.label, color: theme.color.brandSecondary },
  title: { color: theme.color.onSurface, fontSize: 32, fontWeight: '900', marginTop: 4, letterSpacing: 0.1 },
  subtitle: { color: theme.color.onSurfaceSecondary, fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: theme.spacing.lg },
  section: { ...theme.type.label, color: theme.color.onSurfaceTertiary, marginTop: theme.spacing.xl2, marginBottom: theme.spacing.md },
  metrics: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md },
  metricValue: { color: theme.color.onSurface, fontSize: 24, fontWeight: '900', marginTop: 8 },
  metricLabel: { color: theme.color.onSurfaceTertiary, fontSize: 10, marginTop: 2, letterSpacing: 0.4 },
  accountGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  accountCard: { width: '47.5%', backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md },
  accountName: { color: theme.color.onSurface, fontSize: 13, fontWeight: '800', marginTop: 8 },
  accountHandle: { color: theme.color.onSurfaceTertiary, fontSize: 11, lineHeight: 15, marginTop: 4 },
  pill: { alignSelf: 'flex-start', color: theme.color.onSurfaceTertiary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.pill, paddingHorizontal: 8, paddingVertical: 4, fontSize: 8, fontWeight: '800', marginTop: 10, letterSpacing: 0.5 },
  card: { backgroundColor: theme.color.surfaceSecondary, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, padding: theme.spacing.md, gap: 10 },
  cardTitle: { color: theme.color.onSurface, fontSize: 15, fontWeight: '800' },
  chips: { gap: 8, paddingVertical: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surfaceTertiary, borderRadius: theme.radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  chipActive: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  chipText: { color: theme.color.onSurfaceSecondary, fontSize: 12, fontWeight: '700' },
  input: { backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 12, color: theme.color.onSurface, fontSize: 13 },
  textarea: { minHeight: 120, textAlignVertical: 'top', lineHeight: 18 },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: theme.color.warning + '12', borderWidth: 1, borderColor: theme.color.warning + '44', borderRadius: theme.radius.md, padding: theme.spacing.md },
  noticeText: { color: theme.color.onSurfaceSecondary, flex: 1, fontSize: 12, lineHeight: 17 },
  uploadBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md },
  uploadTitle: { color: theme.color.onSurface, fontSize: 13, fontWeight: '800' },
  uploadSub: { color: theme.color.onSurfaceTertiary, fontSize: 11, lineHeight: 16, marginTop: 3 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: theme.color.brand + '66', borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 10 },
  secondaryText: { color: theme.color.brand, fontSize: 12, fontWeight: '800' },
  errorText: { color: theme.color.error, fontSize: 12, lineHeight: 17 },
  destinationHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 2 },
  destinationTitle: { color: theme.color.onSurface, fontSize: 14, fontWeight: '900' },
  destinationSub: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: 2 },
  selectAllBtn: { borderWidth: 1, borderColor: theme.color.brand + '66', borderRadius: theme.radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  selectAllText: { color: theme.color.brand, fontSize: 11, fontWeight: '900' },
  destinationGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  destinationCard: { width: '48%', backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md },
  destinationActive: { backgroundColor: theme.color.brand, borderColor: theme.color.brand },
  destinationTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  destinationName: { color: theme.color.onSurface, fontSize: 13, fontWeight: '900', marginTop: 10 },
  destinationStatus: { color: theme.color.onSurfaceTertiary, fontSize: 10, marginTop: 3, fontWeight: '700' },
  primaryBtn: { backgroundColor: theme.color.brand, borderRadius: theme.radius.md, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '900', letterSpacing: 0.3 },
  empty: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.xl },
  emptyText: { color: theme.color.onSurfaceTertiary, textAlign: 'center', fontSize: 13 },
  postCard: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.md },
  postTop: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  postTitle: { color: theme.color.onSurface, fontSize: 16, fontWeight: '900' },
  postSub: { color: theme.color.onSurfaceSecondary, fontSize: 12, lineHeight: 17, marginTop: 4 },
  status: { color: theme.color.warning, fontSize: 9, fontWeight: '900', letterSpacing: 0.5, textAlign: 'right', maxWidth: 110 },
  platformRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: theme.spacing.md },
  platformPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 5, borderRadius: theme.radius.pill, backgroundColor: theme.color.brand + '14', borderWidth: 1, borderColor: theme.color.brand + '44' },
  platformText: { color: theme.color.brand, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  assetBrief: { color: theme.color.onSurfaceSecondary, fontSize: 12, lineHeight: 17, marginTop: theme.spacing.md },
  mediaTag: { alignSelf: 'flex-start', color: theme.color.success, borderWidth: 1, borderColor: theme.color.success + '55', borderRadius: theme.radius.pill, paddingHorizontal: 8, paddingVertical: 4, fontSize: 9, fontWeight: '900', marginTop: theme.spacing.md, letterSpacing: 0.4 },
  youtubeUrl: { color: theme.color.info, fontSize: 12, lineHeight: 17, marginTop: theme.spacing.md },
  captionBox: { marginTop: theme.spacing.md, backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md },
  captionLabel: { color: theme.color.brandSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  ytTitle: { color: theme.color.onSurface, fontSize: 13, fontWeight: '900', marginTop: 6, lineHeight: 18 },
  caption: { color: theme.color.onSurfaceSecondary, fontSize: 12, lineHeight: 18, marginTop: 6 },
});
