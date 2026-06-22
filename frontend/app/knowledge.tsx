import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { theme } from '@/src/theme';
import { api } from '@/src/api';

type Knowledge = { id: string; kind: string; title: string; content: string; created_at: string };

export default function KnowledgeBase() {
  const router = useRouter();
  const [items, setItems] = useState<Knowledge[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setItems(await api<Knowledge[]>('/knowledge')); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    if (title.trim().length < 1 || content.trim().length < 1) return;
    setBusy(true);
    try {
      await api('/knowledge', { method: 'POST', body: { kind: 'note', title: title.trim(), content: content.trim() } });
      setTitle(''); setContent(''); await load();
    } catch (e: any) { console.warn(e); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await api(`/knowledge/${id}`, { method: 'DELETE' }); load(); } catch {}
  };

  const upload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/csv', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setBusy(true);
      // Fetch as blob → base64
      const fetched = await fetch(asset.uri);
      const blob = await fetched.blob();
      const reader = new FileReader();
      const b64: string = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const mime = asset.mimeType || 'text/plain';
      await api('/knowledge/upload', { method: 'POST', body: {
        title: asset.name || 'Uploaded file',
        mime,
        file_b64: b64,
      }});
      await load();
    } catch (e: any) { console.warn('Upload failed', e); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} testID="knowledge-back">
          <Ionicons name="chevron-back" size={22} color={theme.color.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <Text style={s.eyebrow}>HR · SAGE</Text>
          <Text style={s.title}>Knowledge Base</Text>
          <Text style={s.sub}>Notes you save here become business context for every AI employee when they generate outputs.</Text>

          <View style={s.form}>
            <Text style={s.label}>NEW NOTE</Text>
            <TextInput testID="knowledge-title-input" style={s.input} placeholder="Title (e.g. Brand voice)"
              placeholderTextColor={theme.color.onSurfaceTertiary} value={title} onChangeText={setTitle} />
            <TextInput testID="knowledge-content-input" style={[s.input, { height: 110, textAlignVertical: 'top' }]} multiline
              placeholder="Content — paste a SOP, brand brief, ICP, or any context AI should know..."
              placeholderTextColor={theme.color.onSurfaceTertiary} value={content} onChangeText={setContent} />
            <Pressable testID="knowledge-submit-button" disabled={busy} onPress={add} style={[s.cta, busy && { opacity: 0.6 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <><Ionicons name="bookmark" size={16} color="#fff" /><Text style={s.ctaText}>Save to knowledge base</Text></>}
            </Pressable>

            <Pressable testID="knowledge-upload-button" disabled={busy} onPress={upload} style={[s.uploadCta, busy && { opacity: 0.6 }]}>
              <Ionicons name="cloud-upload-outline" size={16} color={theme.color.brand} />
              <Text style={s.uploadText}>Or upload PDF / CSV / TXT</Text>
            </Pressable>
          </View>

          <Text style={[s.label, { marginTop: theme.spacing.xl }]}>SAVED · {items.length}</Text>

          {items.length === 0 && <Text style={s.empty}>No notes yet. Add your first business context above.</Text>}

          {items.map(k => (
            <View key={k.id} style={s.item} testID={`knowledge-${k.id}`}>
              <View style={s.itemHead}>
                <Ionicons name="document-text" size={16} color={theme.color.brand} />
                <Text style={s.itemTitle}>{k.title}</Text>
                <Pressable onPress={() => remove(k.id)} testID={`knowledge-delete-${k.id}`} style={s.delBtn}>
                  <Ionicons name="trash-outline" size={14} color={theme.color.error} />
                </Pressable>
              </View>
              <Text style={s.itemContent} numberOfLines={6}>{k.content}</Text>
              <Text style={s.itemDate}>{new Date(k.created_at).toLocaleString()}</Text>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
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
  sub: { color: theme.color.onSurfaceTertiary, fontSize: 13, marginTop: 8, lineHeight: 18, marginBottom: theme.spacing.lg },
  form: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.lg, padding: theme.spacing.lg },
  label: { ...theme.type.label, color: theme.color.onSurfaceTertiary, marginBottom: theme.spacing.sm },
  input: { backgroundColor: theme.color.surfaceTertiary, borderWidth: 1, borderColor: theme.color.border, color: theme.color.onSurface, padding: 12, borderRadius: theme.radius.sm, fontSize: 14, marginBottom: theme.spacing.sm },
  cta: { backgroundColor: theme.color.brand, paddingVertical: 14, borderRadius: theme.radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: theme.spacing.sm },
  ctaText: { color: '#fff', fontWeight: '700', letterSpacing: 0.4 },
  uploadCta: { marginTop: theme.spacing.sm, paddingVertical: 12, borderRadius: theme.radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: theme.color.brand + '66', backgroundColor: theme.color.brand + '10' },
  uploadText: { color: theme.color.brand, fontWeight: '700', fontSize: 13, letterSpacing: 0.3 },
  empty: { color: theme.color.onSurfaceTertiary, fontSize: 13, textAlign: 'center', paddingVertical: theme.spacing.xl },
  item: { backgroundColor: theme.color.surfaceSecondary, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.md, padding: theme.spacing.md, marginBottom: theme.spacing.sm },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: { color: theme.color.onSurface, fontSize: 14, fontWeight: '700', flex: 1 },
  delBtn: { padding: 6 },
  itemContent: { color: theme.color.onSurfaceSecondary, fontSize: 13, marginTop: 8, lineHeight: 18 },
  itemDate: { color: theme.color.onSurfaceTertiary, fontSize: 10, marginTop: 8, letterSpacing: 0.4 },
});
