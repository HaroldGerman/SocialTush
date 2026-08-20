import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';

export function LoadingState({ label = 'Cargando…' }: { label?: string }) {
  const { theme } = useAppTheme();
  return <View style={styles.container}><ActivityIndicator color={theme.accent}/><Text style={[styles.body, { color: theme.textMuted }]}>{label}</Text></View>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { theme } = useAppTheme();
  return <View style={styles.container}><Ionicons name="alert-circle-outline" size={36} color={theme.textMuted}/><Text style={[styles.title, { color: theme.textPrimary }]}>{message}</Text>{onRetry ? <TouchableOpacity onPress={onRetry} style={[styles.button, { backgroundColor: theme.primary }]}><Text style={styles.buttonText}>Reintentar</Text></TouchableOpacity> : null}</View>;
}

export function EmptyState({ title, description, icon = 'sparkles-outline' }: { title: string; description?: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const { theme } = useAppTheme();
  return <View style={styles.container}><Ionicons name={icon} size={38} color={theme.textMuted}/><Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>{description ? <Text style={[styles.body, { color: theme.textMuted }]}>{description}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  title: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  button: { marginTop: 4, minHeight: 42, paddingHorizontal: 20, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontWeight: '800' },
});
