import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/src/theme';
import { useAuth } from '@/src/auth';

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true); setErr(null);
    try { await register(email.trim(), password, name.trim() || 'Founder'); router.replace('/(tabs)/dashboard'); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top','bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Pressable testID="register-back" onPress={() => router.back()} style={s.back}>
            <Ionicons name="chevron-back" size={22} color={theme.color.onSurface} />
          </Pressable>

          <Text style={s.h1}>Found your AI company</Text>
          <Text style={s.sub}>Nine AI employees, ready to work for you in seconds.</Text>

          <View style={s.field}>
            <Text style={s.label}>Founder name</Text>
            <TextInput testID="register-name-input" style={s.input} placeholder="Your name"
              placeholderTextColor={theme.color.onSurfaceTertiary} value={name} onChangeText={setName} />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Email</Text>
            <TextInput testID="register-email-input" style={s.input} autoCapitalize="none" keyboardType="email-address"
              placeholder="you@company.com" placeholderTextColor={theme.color.onSurfaceTertiary}
              value={email} onChangeText={setEmail} />
          </View>
          <View style={s.field}>
            <Text style={s.label}>Password</Text>
            <TextInput testID="register-password-input" style={s.input} secureTextEntry
              placeholder="At least 6 characters" placeholderTextColor={theme.color.onSurfaceTertiary}
              value={password} onChangeText={setPassword} />
          </View>

          {err && <Text testID="register-error" style={s.err}>{err}</Text>}

          <Pressable testID="register-submit-button" style={[s.cta, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <>
              <Text style={s.ctaText}>Launch my AI company</Text>
              <Ionicons name="rocket" size={18} color="#fff" />
            </>}
          </Pressable>

          <Link href="/(auth)/login" asChild>
            <Pressable testID="register-go-login" style={{ marginTop: theme.spacing.xl, alignItems: 'center' }}>
              <Text style={{ color: theme.color.onSurfaceSecondary, fontSize: 13 }}>Already onboarded? <Text style={{ color: theme.color.brand }}>Sign in</Text></Text>
            </Pressable>
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.color.surface },
  scroll: { padding: theme.spacing.xl },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: theme.spacing.lg, marginLeft: -8 },
  h1: { color: theme.color.onSurface, fontSize: 28, fontWeight: '700', letterSpacing: 0.3 },
  sub: { color: theme.color.onSurfaceTertiary, fontSize: 14, marginTop: 6, marginBottom: theme.spacing.xl },
  field: { marginBottom: theme.spacing.lg },
  label: { ...theme.type.label, color: theme.color.onSurfaceTertiary, marginBottom: 8 },
  input: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, color: theme.color.onSurface, padding: 14, borderRadius: theme.radius.md, fontSize: 15 },
  err: { color: theme.color.error, marginBottom: theme.spacing.md, fontSize: 13 },
  cta: { backgroundColor: theme.color.brand, padding: 16, borderRadius: theme.radius.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: theme.spacing.sm },
  ctaText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.4 },
});
