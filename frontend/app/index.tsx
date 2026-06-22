import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '@/src/theme';

export default function Index() {
  return (
    <View style={s.c}>
      <ActivityIndicator color={theme.color.brand} size="large" />
    </View>
  );
}
const s = StyleSheet.create({ c: { flex: 1, backgroundColor: theme.color.surface, alignItems: 'center', justifyContent: 'center' } });
