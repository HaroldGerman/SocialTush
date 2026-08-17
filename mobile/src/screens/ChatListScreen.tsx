import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, TextInput } from 'react-native';
import { useAuth } from '../context/AuthContext';

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

  const fetchConversations = async () => {
    try {
      const res = await api.get('/chat/conversations');
      setConversations(res.data);
    } catch (err) {
      setConversations(getMockConversations());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

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
      alert('Error al buscar usuario');
    }
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity 
      style={styles.chatCard} 
      onPress={() => onSelectConversation(item)}
      activeOpacity={0.8}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {item.isGroup ? '👥' : item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.chatName}>{item.name}</Text>
          <Text style={styles.chatTime}>hace un momento</Text>
        </View>
        <Text style={styles.latestMessage} numberOfLines={1}>
          {item.latestMessage || 'Escribe tu primer mensaje'}
        </Text>
      </View>
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
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mensajería</Text>
      </View>

      {/* Start Chat Form */}
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="Escribe un usuario para chatear..."
          placeholderTextColor="#71717a"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={handleStartConversation}>
          <Text style={styles.searchBtnText}>Chat</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.conversationId}
        renderItem={renderConversationItem}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No tienes chats abiertos</Text>
          </View>
        }
      />
    </View>
  );
}

// Fallback mocks
function getMockConversations(): Conversation[] {
  return [
    {
      conversationId: 'c-mock-1',
      name: 'Sophia Loren',
      avatarUrl: '',
      isGroup: false,
      latestMessage: '¡Hola! Nos vemos más tarde.',
      updatedAt: new Date().toISOString()
    },
    {
      conversationId: 'c-mock-2',
      name: 'Grupo de Diseño',
      avatarUrl: '',
      isGroup: true,
      latestMessage: 'Se actualizó la guía visual.',
      updatedAt: new Date().toISOString()
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
  searchSection: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
    paddingHorizontal: 12,
    color: '#ffffff',
    fontSize: 13,
  },
  searchBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#18181b',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#27272a',
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
    fontSize: 14,
    fontWeight: 'bold',
  },
  chatTime: {
    color: '#71717a',
    fontSize: 9,
  },
  latestMessage: {
    color: '#71717a',
    fontSize: 11,
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
