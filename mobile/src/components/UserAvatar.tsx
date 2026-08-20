import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme';

interface UserAvatarProps {
  avatarUrl?: string | null;
  displayName?: string | null;
  username?: string | null;
  size?: number;
  ring?: boolean;
}

export default function UserAvatar({ avatarUrl, displayName, username, size = 40, ring = false }: UserAvatarProps) {
  const { theme } = useAppTheme();
  const [failed, setFailed] = useState(false);
  const initial = (displayName || username || 'U').trim().charAt(0).toUpperCase();
  const radius = size / 2;

  return (
    <View style={[styles.ring, { width: size + (ring ? 6 : 0), height: size + (ring ? 6 : 0), borderRadius: radius + 3, borderColor: ring ? theme.accent : 'transparent' }]}>
      {avatarUrl && !failed ? (
        <Image source={{ uri: avatarUrl }} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: radius }} />
      ) : (
        <View style={[styles.fallback, { width: size, height: size, borderRadius: radius, backgroundColor: theme.primary }]}>
          <Text style={[styles.initial, { fontSize: Math.max(12, size * 0.38) }]}>{initial}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { color: '#fff', fontWeight: '800' },
});
