import { useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { api } from '@/src/api';

type Plan = { id: 'free' | 'pro' | 'scale'; name: string; price_label: string; features: string[] };
type Plans = { current_tier: string; plans: Plan[] };

export default function Billing() {
  const router = useRouter();
  const params = useLocalSearchParams<{ success?: string; session_id?: string; cancelled?: string }>();
  const [data, setData] = useState<Plans | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);

  const load = useCallback(async () => {
    try { setData(await api<Plans>('/billing/plans')); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Handle redirect from Stripe Checkout
  useEffect(() => {
    if (params.success === '1' && params.session_id) {
      setBanner({ kind: 'info', text: 'Confirming payment with Stripe…' });
      (async () => {
        try {
          const r = await api<{ payment_status: string; plan: string | null }>(`/billing/session/${params.session_id}`);
          if (r.payment_status === 'paid' || r.payment_status === 'complete') {
            setBanner({ kind: 'ok', text: `Subscription active · ${(r.plan || '').toUpperCase()} tier` });
          } else {
            setBanner({ kind: 'info', text: `Payment ${r.payment_status} — your tier will update shortly.` });
          }
          await load();
        } catch (e: any) { setBanner({ kind: 'err', text: e.message }); }
      })();
    } else if (params.cancelled === '1') {
      setBanner({ kind: 'info', text: 'Checkout cancelled — no charge made.' });
    }
  }, [params.success, params.session_id, params.cancelled]);

  const startCheckout = async (planId: 'pro' | 'scale') => {
    setBusy(planId); setBanner(null);
    try {
      const r = await api<{ url: string; session_id: string }>('/billing/checkout-session', { method: 'POST', body: { plan: planId } });
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = r.url;
      } else {
        await Linking.openURL(r.url);
      }
    } catch (e: any) { setBanner({ kind: 'err', text: e.message }); setBusy(null); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} testID="billing-back">
          <Ionicons name="chevron-back" size={22} color={theme.color.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }} />
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.eyebrow}>BILLING · STRIPE</Text>
        <Text style={s.title}>Plans & subscription</Text>
        <Text style={s.sub}>Real Stripe Checkout · use test card <Text style={s.code}>4242 4242 4242 4242</Text> + any future date + any CVC.</Text>

        {banner && (
          <View testID="billing-banner" style={[s.banner, banner.kind === 'ok' && { backgroundColor: theme.color.success + '15', borderColor: theme.color.success + '55' }, banner.kind === 'err' && { backgroundColor: theme.color.error + '15', borderColor: theme.color.error + '55' }]}>
            <Ionicons name={banner.kind === 'ok' ? 'checkmark-circle' : banner.kind === 'err' ? 'alert-circle' : 'information-circle'} size={16} color={banner.kind === 'ok' ? theme.color.success : banner.kind === 'err' ? theme.color.error : theme.color.brand} />
            <Text style={[s.bannerText, banner.kind === 'ok' && { color: theme.color.success }, banner.kind === 'err' && { color: theme.color.error }]}>{banner.text}</Text>
          </View>
        )}

        {data?.plans.map(p => {
          const current = data.current_tier === p.id;
          const highlight = p.id === 'pro';
          return (
            <View key={p.id} style={[s.card, highlight && s.cardHighlight, current && s.cardCurrent]} testID={`plan-${p.id}`}>
              {highlight && <View style={s.popularBadge}><Text style={s.popularBadgeText}>MOST POPULAR</Text></View>}
              <View style={s.cardHead}>
                <Text style={s.planName}>{p.name}</Text>
                {current && <View style={s.currentBadge}><Text style={s.currentBadgeText}>CURRENT</Text></View>}
              </View>
              <Text style={s.priceLine}><Text style={s.price}>{p.price_label}</Text><Text style={s.priceCadence}>{p.id === 'free' ? '' : '/month'}</Text></Text>
              {p.features.map(f => (
                <View key={f} style={s.featRow}>
                  <Ionicons name="checkmark" size={14} color={theme.color.brand} />
                  <Text style={s.featText}>{f}</Text>
                </View>
              ))}
              {p.id !== 'free' && !current && (
                <Pressable testID={`plan-cta-${p.id}`} disabled={!!busy} onPress={() => startCheckout(p.id as 'pro' | 'scale')} style={[s.cta, highlight && { backgroundColor: theme.color.brand }]}>
                  {busy === p.id
                    ? <ActivityIndicator color={highlight ? '#fff' : theme.color.brand} />
                    : <><Ionicons name="lock-closed" size={14} color={highlight ? '#fff' : theme.color.brand} /><Text style={[s.ctaText, highlight && { color: '#fff' }]}>Upgrade to {p.name.includes('Pro') ? 'Pro' : 'Scale'}</Text></>}
                </Pressable>
              )}
              {p.id === 'free' && !current && <Text style={s.note}>Default tier</Text>}
              {current && <Text style={s.note}>You're on this plan.</Text>}
            </View>
          );
        })}
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
  title: { color: theme.color.onSurface, fontSize: 30, fontWeight: '800', marginTop: 2, letterSpacing: 0.2 },
  sub: { color: theme.color.onSurfaceTertiary, fontSize: 12, marginTop: 8, marginBottom: theme.spacing.lg, lineHeight: 17 },
  code: { color: theme.color.brand, fontFamily: 'monospace' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.brand + '55', backgroundColor: theme.color.brand + '15', marginBottom: theme.spacing.lg },
  bannerText: { color: theme.color.brand, fontSize: 13, flex: 1, fontWeight: '600' },
  card: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.lg, padding: theme.spacing.lg, marginBottom: theme.spacing.md, position: 'relative' },
  cardHighlight: { borderColor: theme.color.brand + '88', borderWidth: 2 },
  cardCurrent: { backgroundColor: theme.color.brand + '08' },
  popularBadge: { position: 'absolute', top: -10, right: 16, backgroundColor: theme.color.brand, paddingHorizontal: 10, paddingVertical: 4, borderRadius: theme.radius.sm },
  popularBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planName: { color: theme.color.onSurface, fontSize: 18, fontWeight: '800', letterSpacing: 0.2 },
  currentBadge: { backgroundColor: theme.color.success + '22', paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radius.sm, borderWidth: 1, borderColor: theme.color.success + '55' },
  currentBadgeText: { color: theme.color.success, fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  priceLine: { marginTop: 12, marginBottom: theme.spacing.md },
  price: { color: theme.color.onSurface, fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  priceCadence: { color: theme.color.onSurfaceTertiary, fontSize: 14, fontWeight: '600' },
  featRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  featText: { color: theme.color.onSurfaceSecondary, fontSize: 13 },
  cta: { marginTop: theme.spacing.md, paddingVertical: 12, borderRadius: theme.radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: theme.color.brand, backgroundColor: 'transparent' },
  ctaText: { color: theme.color.brand, fontWeight: '700', fontSize: 14 },
  note: { color: theme.color.onSurfaceTertiary, fontSize: 11, marginTop: theme.spacing.md, fontStyle: 'italic' },
});
