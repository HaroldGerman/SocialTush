import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';

interface UserResult {
  username: string;
  displayName: string;
  avatarUrl: string;
  bio: string;
}

interface CircleResult {
  name: string;
  slug: string;
  description: string;
}

interface SearchScreenProps {
  onSelectUser: (username: string) => void;
  onSelectCircle: (slug: string) => void;
  onClose: () => void;
}

export default function SearchScreen({ onSelectUser, onSelectCircle, onClose }: SearchScreenProps) {
  const { api } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [circles, setCircles] = useState<CircleResult[]>([]);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setUsers([]);
      setCircles([]);
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/search?query=${encodeURIComponent(query.trim())}`);
        setUsers(res.data.users || []);
        setCircles(res.data.circles || []);
      } catch (err) {
        setUsers([]);
        setCircles([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query, api]);

  return (
    <View style={styles.container}>
      {/* Header Bar with Search Input */}
      <View style={styles.header}>
        <View style={styles.searchInputBox}>
          <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
          <TextInput
            style={styles.input}
            placeholder="Buscar usuarios o círculos..."
            placeholderTextColor={theme.colors.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>Cancelar</Text>
        </TouchableOpacity>
      </View>

      {/* Results Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={theme.colors.accent} />
        </View>
      ) : query.trim() && users.length === 0 && circles.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={40} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>Sin resultados</Text>
          <Text style={styles.emptySub}>No encontramos ningún resultado para "{query}"</Text>
        </View>
      ) : (
        <FlatList
          data={[
            ...users.map(u => ({ type: 'USER' as const, data: u })),
            ...circles.map(c => ({ type: 'CIRCLE' as const, data: c }))
          ]}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          contentContainerStyle={{ padding: theme.spacing.lg }}
          renderItem={({ item }) => {
            if (item.type === 'USER') {
              const u = item.data as UserResult;
              return (
                <TouchableOpacity 
                  style={styles.resultCard}
                  onPress={() => { onSelectUser(u.username); onClose(); }}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {(u.displayName || u.username).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{u.displayName || u.username}</Text>
                    <Text style={styles.subtitle}>@{u.username}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              );
            } else {
              const c = item.data as CircleResult;
              return (
                <TouchableOpacity 
                  style={styles.resultCard}
                  onPress={() => { onSelectCircle(c.slug); onClose(); }}
                >
                  <View style={[styles.avatar, { backgroundColor: theme.colors.surfaceSecondary }]}>
                    <Ionicons name="people-outline" size={20} color={theme.colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title}>{c.name}</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>{c.description || 'Círculo de la comunidad'}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
                </TouchableOpacity>
              );
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  searchInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  input: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 14,
  },
  closeBtn: {
    paddingVertical: 8,
  },
  closeBtnText: {
    color: theme.colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
  },
  emptySub: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
});
