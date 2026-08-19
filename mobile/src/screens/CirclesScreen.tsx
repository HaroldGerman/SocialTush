import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

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
    <TouchableOpacity style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.description} numberOfLines={2}>{item.description || 'Comunidad en SocialTush'}</Text>
        <View style={styles.statsRow}>
          <Ionicons name="people-outline" size={12} color="#14b8a6" />
          <Text style={styles.statsText}>{item.membersCount} miembros</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Círculos</Text>
        <Text style={styles.headerSub}>Descubre comunidades y grupos de interés</Text>
      </View>

      <FlatList
        data={circles}
        keyExtractor={(item) => item.id}
        renderItem={renderCircleItem}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh} 
            tintColor="#14b8a6"
          />
        }
        contentContainerStyle={circles.length === 0 ? styles.emptyContainer : styles.listPadding}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="people-outline" size={36} color="#64748b" />
            </View>
            <Text style={styles.emptyTitle}>Aún no hay círculos disponibles</Text>
            <Text style={styles.emptySub}>Sé el primero en crear una comunidad o explora más tarde.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  center: {
    flex: 1,
    backgroundColor: '#090d16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  headerSub: {
    color: '#94a3b8',
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
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 12,
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0f766e',
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
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  description: {
    color: '#94a3b8',
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
    color: '#14b8a6',
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
    backgroundColor: '#1e293b50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  emptySub: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
});
