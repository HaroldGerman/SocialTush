import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';

interface Conversation {
  conversationId: string;
  name: string;
  avatarUrl: string;
  isGroup: boolean;
  latestMessage: string;
  updatedAt: string;
}

interface ChatListScreenProps {
  onSelectConversation: (conversation: Conversation) => void;
}

export default function ChatListScreen({ onSelectConversation }: ChatListScreenProps) {
  const { api } = useAuth();
  const { theme } = useAppTheme();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/chat/conversations');
      setConversations(res.data || []);
    } catch (err) {
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleStartConversation = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await api.post('/chat/conversations', {
        recipientUsername: searchQuery.trim(),
        isGroup: false
      });
      setSearchQuery('');
      await fetchConversations();
      
      const newConv: Conversation = {
        conversationId: res.data.conversationId,
        name: searchQuery.trim(),
        avatarUrl: '',
        isGroup: false,
        latestMessage: '',
        updatedAt: new Date().toISOString()
      };
      onSelectConversation(newConv);
    } catch (err) {
      // User search error handled gracefully
    }
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity 
      style={[styles.chatCard, { borderColor: theme.border }]} 
      onPress={() => onSelectConversation(item)}
      activeOpacity={0.8}
    >
      <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
        {item.isGroup ? (
          <Ionicons name="people" size={18} color="#ffffff" />
        ) : (
          <Text style={styles.avatarText}>
            {(item.name || 'U').charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.chatName, { color: theme.textPrimary }]}>{item.name}</Text>
        </View>
        <Text style={[styles.latestMessage, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.latestMessage || 'Inicia la conversación...'}
        </Text>
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
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Mensajería</Text>
      </View>

      {/* Start Chat Form */}
      <View style={styles.searchSection}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
          placeholder="Escribe un usuario para chatear..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={[styles.searchBtn, { backgroundColor: theme.primary }]} onPress={handleStartConversation}>
          <Ionicons name="paper-plane-outline" size={16} color="#ffffff" />
          <Text style={styles.searchBtnText}>Chat</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.conversationId}
        renderItem={renderConversationItem}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContainer : { paddingHorizontal: 16 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBox, { backgroundColor: theme.surfaceSecondary }]}>
              <Ionicons name="chatbubbles-outline" size={36} color={theme.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>No tienes conversaciones activas</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>Escribe un usuario arriba para iniciar un chat.</Text>
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
  searchSection: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 13,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  latestMessage: {
    fontSize: 12,
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
