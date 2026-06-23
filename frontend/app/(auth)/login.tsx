import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/auth';

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try { await login(email.trim(), password); router.replace('/(tabs)/dashboard'); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.brandRow}>
            <View style={s.brandMark}><Text style={s.brandMarkText}>U</Text></View>
            <View>
              <Text style={s.brand}>UNNATIX</Text>
              <Text style={s.brandSub}>GROWTHX · AI COMPANY OS</Text>
            </View>
          </View>

          <Text style={s.h1}>Welcome back, founder.</Text>
          <Text style={s.sub}>Your executive AI team is standing by.</Text>

          <View style={s.field}>
            <Text style={s.label}>Email</Text>
            <TextInput testID="login-email-input" style={s.input} autoCapitalize="none" keyboardType="email-address"
              placeholder="you@company.com" placeholderTextColor={theme.color.onSurfaceTertiary}
              value={email} onChangeText={setEmail} />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Password</Text>
            <TextInput testID="login-password-input" style={s.input} secureTextEntry
              placeholder="••••••••" placeholderTextColor={theme.color.onSurfaceTertiary}
              value={password} onChangeText={setPassword} />
          </View>

          {err && <Text testID="login-error" style={s.err}>{err}</Text>}

          <Pressable testID="login-submit-button" style={[s.cta, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <>
              <Text style={s.ctaText}>Sign in</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </>}
          </Pressable>

          <Link href="/(auth)/register" asChild>
            <Pressable testID="login-go-register" style={s.linkBtn}>
              <Text style={s.linkText}>New here? <Text style={{ color: theme.color.brand }}>Create your AI company →</Text></Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  scroll: { padding: theme.spacing.xl, paddingTop: theme.spacing.xl2 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: theme.spacing.xl2 },
  brandMark: { width: 44, height: 44, borderRadius: theme.radius.md, backgroundColor: theme.color.brand, alignItems: 'center', justifyContent: 'center' },
  brandMarkText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  brand: { color: theme.color.onSurface, fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  brandSub: { color: theme.color.onSurfaceTertiary, fontSize: 10, letterSpacing: 1.5, marginTop: 2 },
  h1: { color: theme.color.onSurface, fontSize: 28, fontWeight: '700', marginTop: theme.spacing.xl, letterSpacing: 0.3 },
  sub: { color: theme.color.onSurfaceTertiary, fontSize: 14, marginTop: 6, marginBottom: theme.spacing.xl },
  field: { marginBottom: theme.spacing.lg },
  label: { ...theme.type.label, color: theme.color.onSurfaceTertiary, marginBottom: 8 },
  input: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, color: theme.color.onSurface, padding: 14, borderRadius: theme.radius.md, fontSize: 15 },
  err: { color: theme.color.error, marginBottom: theme.spacing.md, fontSize: 13 },
  cta: { backgroundColor: theme.color.brand, padding: 16, borderRadius: theme.radius.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: theme.spacing.sm },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.4 },
  linkBtn: { marginTop: theme.spacing.xl, alignItems: 'center' },
  linkText: { color: theme.color.onSurfaceSecondary, fontSize: 13 },
});
