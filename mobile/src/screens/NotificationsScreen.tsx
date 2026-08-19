import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';

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
  const { theme } = useAppTheme();
  
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
      style={[
        styles.card, 
        { borderColor: theme.border },
        !item.isRead && { backgroundColor: theme.surfaceSecondary }
      ]} 
      onPress={() => handleMarkRead(item.notificationId)}
      activeOpacity={0.8}
    >
      <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
        <Text style={styles.avatarText}>
          {(item.senderDisplayName || item.senderUsername || 'U').charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.content}>
        <Text style={[styles.text, { color: theme.textSecondary }]}>
          <Text style={[styles.username, { color: theme.textPrimary }]}>@{item.senderUsername} </Text>
          {item.notificationType === 'LIKE_POST' && 'le dio me gusta a tu post.'}
          {item.notificationType === 'COMMENT' && 'comentó en tu post.'}
          {item.notificationType === 'FOLLOW' && 'comenzó a seguirte.'}
          {item.notificationType === 'FOLLOW_REQUEST' && 'te envió una solicitud de seguimiento.'}
          {item.notificationType !== 'LIKE_POST' && item.notificationType !== 'COMMENT' && item.notificationType !== 'FOLLOW' && item.notificationType !== 'FOLLOW_REQUEST' && 'interactuó contigo.'}
        </Text>
      </View>
      {!item.isRead && <View style={[styles.unreadDot, { backgroundColor: theme.accent }]} />}
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
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Actividad</Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.notificationId}
        renderItem={renderItem}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContainer : { paddingHorizontal: 16 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBox, { backgroundColor: theme.surfaceSecondary }]}>
              <Ionicons name="notifications-outline" size={36} color={theme.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Sin actividad reciente</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>Las interacciones con tus posts e historias aparecerán aquí.</Text>
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    fontSize: 13,
    lineHeight: 18,
  },
  username: {
    fontWeight: 'bold',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
