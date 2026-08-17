import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useAuth } from '../context/AuthContext';

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
  const { api, user } = useAuth();
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      setNotifications(getMockNotifications());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

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
        <Text style={styles.avatarText}>{item.senderDisplayName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.text}>
          <Text style={styles.username}>@{item.senderUsername} </Text>
          {item.notificationType === 'LIKE_POST' && 'le dio me gusta a tu post.'}
          {item.notificationType === 'COMMENT' && 'comentó en tu post.'}
          {item.notificationType === 'FOLLOW' && 'comenzó a seguirte.'}
          {item.notificationType === 'FOLLOW_REQUEST' && 'te envió una solicitud de seguimiento.'}
        </Text>
        <Text style={styles.time}>hace un momento</Text>
      </View>
      {!item.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
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
        contentContainerStyle={{ paddingHorizontal: 16 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Sin actividad reciente</Text>
          </View>
        }
      />
    </View>
  );
}

function getMockNotifications(): Notification[] {
  return [
    {
      notificationId: 'n1',
      senderUsername: 'sophia',
      senderDisplayName: 'Sophia Loren',
      senderAvatarUrl: '',
      notificationType: 'LIKE_POST',
      targetId: 't1',
      isRead: false,
      createdAt: new Date().toISOString()
    },
    {
      notificationId: 'n2',
      senderUsername: 'alex_futurist',
      senderDisplayName: 'Alex',
      senderAvatarUrl: '',
      notificationType: 'FOLLOW',
      targetId: 't2',
      isRead: true,
      createdAt: new Date().toISOString()
    }
  ];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  center: {
    flex: 1,
    backgroundColor: '#09090b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    height: 60,
    borderBottomWidth: 1,
    borderColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#18181b',
    gap: 12,
  },
  unreadCard: {
    backgroundColor: '#6366f108',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272a',
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
    color: '#d4d4d8',
    fontSize: 12,
    lineHeight: 18,
  },
  username: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  time: {
    color: '#71717a',
    fontSize: 9,
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#3f3f46',
    fontSize: 13,
    fontWeight: '600',
  },
});
