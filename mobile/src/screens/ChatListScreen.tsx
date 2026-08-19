import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

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
  const { api, user } = useAuth();
  
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
      style={styles.chatCard} 
      onPress={() => onSelectConversation(item)}
      activeOpacity={0.8}
    >
      <View style={styles.avatar}>
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
          <Text style={styles.chatName}>{item.name}</Text>
        </View>
        <Text style={styles.latestMessage} numberOfLines={1}>
          {item.latestMessage || 'Inicia la conversación...'}
        </Text>
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
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mensajería</Text>
      </View>

      {/* Start Chat Form */}
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Escribe un usuario para chatear..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleStartConversation}>
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
            <View style={styles.emptyIconBox}>
              <Ionicons name="chatbubbles-outline" size={36} color="#64748b" />
            </View>
            <Text style={styles.emptyTitle}>No tienes conversaciones activas</Text>
            <Text style={styles.emptySub}>Escribe un usuario arriba para iniciar un chat.</Text>
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
  searchSection: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 44,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    color: '#ffffff',
    fontSize: 13,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0f766e',
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
    borderColor: '#1e293b',
    gap: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#0f766e',
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
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  latestMessage: {
    color: '#94a3b8',
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
