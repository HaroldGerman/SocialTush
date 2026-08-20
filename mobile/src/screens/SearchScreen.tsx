import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';
import UserAvatar from '../components/UserAvatar';

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
  const { theme } = useAppTheme();
  
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [circles, setCircles] = useState<CircleResult[]>([]);
  const [error,setError]=useState('');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setUsers([]);
      setCircles([]);
      setError('');
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get(`/search?query=${encodeURIComponent(query.trim())}`);
        setUsers(res.data.users || []);
        setCircles(res.data.circles || []);
        setError('');
      } catch (err) {
        console.error(err);setError('No se pudo realizar la búsqueda.');
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query, api]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header Bar with Search Input */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={[styles.searchInputBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={18} color={theme.textMuted} />
          <TextInput
            style={[styles.input, { color: theme.textPrimary }]}
            placeholder="Buscar usuarios o círculos..."
            placeholderTextColor={theme.textMuted}
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={[styles.closeBtnText, { color: theme.accent }]}>Cancelar</Text>
        </TouchableOpacity>
      </View>

      {/* Results Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={theme.accent} />
        </View>
      ) : error ? <View style={styles.emptyState}><Ionicons name="alert-circle-outline" size={40} color={theme.textMuted}/><Text style={[styles.emptyTitle,{color:theme.textPrimary}]}>{error}</Text><TouchableOpacity onPress={()=>setQuery(value=>`${value} `)}><Text style={{color:theme.accent,marginTop:8}}>Reintentar</Text></TouchableOpacity></View> : query.trim() && users.length === 0 && circles.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={40} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Sin resultados</Text>
          <Text style={[styles.emptySub, { color: theme.textMuted }]}>No encontramos ningún resultado para "{query}"</Text>
        </View>
      ) : (
        <FlatList
          data={[
            ...users.map(u => ({ type: 'USER' as const, data: u })),
            ...circles.map(c => ({ type: 'CIRCLE' as const, data: c }))
          ]}
          keyExtractor={(item, index) => `${item.type}-${index}`}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => {
            if (item.type === 'USER') {
              const u = item.data as UserResult;
              return (
                <TouchableOpacity 
                  style={[styles.resultCard, { borderBottomColor: theme.border }]}
                  onPress={() => { onSelectUser(u.username); onClose(); }}
                >
                  <UserAvatar avatarUrl={u.avatarUrl} displayName={u.displayName} username={u.username} size={42}/>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: theme.textPrimary }]}>{u.displayName || u.username}</Text>
                    <Text style={[styles.subtitle, { color: theme.textSecondary }]}>@{u.username}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                </TouchableOpacity>
              );
            } else {
              const c = item.data as CircleResult;
              return (
                <TouchableOpacity 
                  style={[styles.resultCard, { borderBottomColor: theme.border }]}
                  onPress={() => { onSelectCircle(c.slug); onClose(); }}
                >
                  <View style={[styles.avatar, { backgroundColor: theme.surfaceSecondary }]}>
                    <Ionicons name="people-outline" size={20} color={theme.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: theme.textPrimary }]}>{c.name}</Text>
                    <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>
                      {c.description || 'Círculo de la comunidad'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  searchInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
  },
  closeBtn: {
    paddingVertical: 8,
  },
  closeBtnText: {
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
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 12,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
});
