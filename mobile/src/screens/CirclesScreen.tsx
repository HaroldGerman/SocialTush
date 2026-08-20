import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';

interface Circle {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatarUrl: string;
  visibility: string;
  membersCount: number;
}

export default function CirclesScreen() {
  const { api } = useAuth();
  const { theme } = useAppTheme();
  
  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCircles = useCallback(async () => {
    try {
      const res = await api.get('/circles');
      setCircles(res.data || []);
    } catch (err) {
      setCircles([]);
    }
  }, [api]);

  const initData = useCallback(async () => {
    setLoading(true);
    await fetchCircles();
    setLoading(false);
  }, [fetchCircles]);

  useEffect(() => {
    initData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCircles();
    setRefreshing(false);
  };

  const renderCircleItem = ({ item }: { item: Circle }) => (
    <TouchableOpacity disabled accessibilityLabel="Detalle de círculo, disponible en web" style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, opacity: 0.75 }]}>
      <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: theme.textPrimary }]}>{item.name}</Text>
        <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>
          {item.description || 'Comunidad en SocialTush'}
        </Text>
        <View style={styles.statsRow}>
          <Ionicons name="people-outline" size={12} color={theme.accent} />
          <Text style={[styles.statsText, { color: theme.accent }]}>{item.membersCount} miembros</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Círculos</Text>
        <Text style={[styles.headerSub, { color: theme.textSecondary }]}>Descubre comunidades y grupos de interés</Text>
      </View>

      <FlatList
        data={circles}
        keyExtractor={(item) => item.id}
        renderItem={renderCircleItem}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh} 
            tintColor={theme.accent}
          />
        }
        contentContainerStyle={circles.length === 0 ? styles.emptyContainer : styles.listPadding}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBox, { backgroundColor: theme.surfaceSecondary }]}>
              <Ionicons name="people-outline" size={36} color={theme.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Aún no hay círculos disponibles</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>Sé el primero en crear una comunidad o explora más tarde.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerSub: {
    fontSize: 12,
    marginTop: 2,
  },
  listPadding: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 12,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  statsText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
  },
});
