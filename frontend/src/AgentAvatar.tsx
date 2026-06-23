import React from 'react';
import { View, ViewStyle } from 'react-native';
import { theme } from './theme';

// Abstract geometric agent avatar — uses layered shapes; no images required.
export function AgentAvatar({ agentId, accent, size = 56 }: { agentId: string; accent: string; size?: number }) {
  const s = size;
  const base: ViewStyle = {
    width: s, height: s, borderRadius: theme.radius.md,
    backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: theme.color.border,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  };

  const inner = (() => {
    switch (agentId) {
      case 'ceo': // prism
        return (
          <View style={{ width: s * 0.55, height: s * 0.55, transform: [{ rotate: '45deg' }], backgroundColor: accent, opacity: 0.9 }} />
        );
      case 'marketing': // wave bars
        return (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
            {[0.4, 0.8, 0.55, 0.95, 0.5].map((h, i) => (
              <View key={i} style={{ width: 4, height: s * h * 0.6, backgroundColor: accent, borderRadius: 1 }} />
            ))}
          </View>
        );
      case 'seo': // search target
        return (
          <>
            <View style={{ width: s * 0.48, height: s * 0.48, borderRadius: s, borderWidth: 2, borderColor: accent }} />
            <View style={{ position: 'absolute', width: s * 0.25, height: 3, backgroundColor: accent, transform: [{ rotate: '45deg' }], right: s * 0.13, bottom: s * 0.18, borderRadius: 2 }} />
            <View style={{ position: 'absolute', width: s * 0.12, height: s * 0.12, borderRadius: s, backgroundColor: accent }} />
          </>
        );
      case 'sales': // spiral rings
        return (
          <>
            <View style={{ position: 'absolute', width: s * 0.65, height: s * 0.65, borderRadius: s, borderWidth: 1.5, borderColor: accent, opacity: 0.5 }} />
            <View style={{ position: 'absolute', width: s * 0.4, height: s * 0.4, borderRadius: s, borderWidth: 1.5, borderColor: accent }} />
            <View style={{ width: s * 0.18, height: s * 0.18, borderRadius: s, backgroundColor: accent }} />
          </>
        );
      case 'research': // orbit
        return (
          <>
            <View style={{ position: 'absolute', width: s * 0.7, height: s * 0.35, borderRadius: s, borderWidth: 1, borderColor: accent, opacity: 0.6, transform: [{ rotate: '-25deg' }] }} />
            <View style={{ width: s * 0.22, height: s * 0.22, borderRadius: s, backgroundColor: accent }} />
          </>
        );
      case 'developer': // grid
        return (
          <View style={{ width: s * 0.6, height: s * 0.6, flexDirection: 'row', flexWrap: 'wrap', gap: 3 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <View key={i} style={{ width: (s * 0.6 - 6) / 3, height: (s * 0.6 - 6) / 3, backgroundColor: i % 2 === 0 ? accent : 'transparent', borderRadius: 1, borderWidth: 0.5, borderColor: accent }} />
            ))}
          </View>
        );
      case 'operations': // hex
        return (
          <View style={{ width: s * 0.55, height: s * 0.55, transform: [{ rotate: '30deg' }], borderRadius: 6, borderWidth: 2, borderColor: accent, backgroundColor: accent + '22' }} />
        );
      case 'finance': // diamond stack
        return (
          <>
            <View style={{ position: 'absolute', width: s * 0.5, height: s * 0.5, transform: [{ rotate: '45deg' }], borderWidth: 1.5, borderColor: accent, opacity: 0.5 }} />
            <View style={{ width: s * 0.28, height: s * 0.28, transform: [{ rotate: '45deg' }], backgroundColor: accent }} />
          </>
        );
      case 'hr': // knot
      default:
        return (
          <>
            <View style={{ position: 'absolute', width: s * 0.35, height: s * 0.35, borderRadius: s, borderWidth: 2, borderColor: accent, left: s * 0.2, top: s * 0.22 }} />
            <View style={{ position: 'absolute', width: s * 0.35, height: s * 0.35, borderRadius: s, borderWidth: 2, borderColor: accent, right: s * 0.2, top: s * 0.22 }} />
          </>
        );
    }
  })();

  return <View style={base}>{inner}</View>;
}
