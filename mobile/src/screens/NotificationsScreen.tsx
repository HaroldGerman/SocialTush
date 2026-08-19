import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

interface Notification {
  notificationId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl: string;
  notificationType: string;
  targetId: string;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsScreen() {
  const { api } = useAuth();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data || []);
    } catch (err) {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.notificationId === id ? { ...n, isRead: true } : n));
    } catch (err) {
      setNotifications(prev => prev.map(n => n.notificationId === id ? { ...n, isRead: true } : n));
    }
  };

  const renderItem = ({ item }: { item: Notification }) => (
    <TouchableOpacity 
      style={[styles.card, !item.isRead && styles.unreadCard]} 
      onPress={() => handleMarkRead(item.notificationId)}
      activeOpacity={0.8}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {(item.senderDisplayName || item.senderUsername || 'U').charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.text}>
          <Text style={styles.username}>@{item.senderUsername} </Text>
          {item.notificationType === 'LIKE_POST' && 'le dio me gusta a tu post.'}
          {item.notificationType === 'COMMENT' && 'comentó en tu post.'}
          {item.notificationType === 'FOLLOW' && 'comenzó a seguirte.'}
          {item.notificationType === 'FOLLOW_REQUEST' && 'te envió una solicitud de seguimiento.'}
          {item.notificationType !== 'LIKE_POST' && item.notificationType !== 'COMMENT' && item.notificationType !== 'FOLLOW' && item.notificationType !== 'FOLLOW_REQUEST' && 'interactuó contigo.'}
        </Text>
      </View>
      {!item.isRead && <View style={styles.unreadDot} />}
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
        <Text style={styles.headerTitle}>Actividad</Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.notificationId}
        renderItem={renderItem}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : { paddingHorizontal: 16 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="notifications-outline" size={36} color="#64748b" />
            </View>
            <Text style={styles.emptyTitle}>Sin actividad reciente</Text>
            <Text style={styles.emptySub}>Las interacciones con tus posts e historias aparecerán aquí.</Text>
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
    gap: 12,
  },
  unreadCard: {
    backgroundColor: '#0f766e15',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  text: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 18,
  },
  username: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#14b8a6',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
