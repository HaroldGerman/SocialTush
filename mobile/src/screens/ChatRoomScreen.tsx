import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getWebSocketUrl } from '../config/api';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';

interface Message {
  messageId: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl: string;
  content: string;
  messageType: string;
  createdAt: string;
  readByRecipient?: boolean;
  readReceiptVisible?: boolean;
}

interface Conversation {
  conversationId: string | null;
  isDraft?: boolean;
  otherUsername?: string;
  name: string;
  avatarUrl: string;
  isGroup: boolean;
  latestMessage: string;
  updatedAt: string;
  unreadCount?: number;
}

interface ChatRoomScreenProps {
  conversation: Conversation;
  onBack: () => void;
  onConversationPersisted: (conversation: Conversation) => void;
}

export default function ChatRoomScreen({ conversation, onBack, onConversationPersisted }: ChatRoomScreenProps) {
  const { api, user, accessToken } = useAuth();
  const { theme } = useAppTheme();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendError, setSendError] = useState('');

  const ws = useRef<WebSocket | null>(null);

  const markRead = async () => {
    if (!conversation.conversationId) return false;
    try {
      await api.patch(`/chat/conversations/${conversation.conversationId}/read`);
      return true;
    } catch (err) {
      setSendError('Los mensajes se cargaron, pero no pudimos marcarlos como leídos.');
      return false;
    }
  };

  const fetchMessages = async () => {
    if (!conversation.conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/chat/conversations/${conversation.conversationId}/messages`);
      setMessages(res.data || []);
      await markRead();
    } catch (err) {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    if (!conversation.conversationId || !accessToken) return;

    const wsUrl = getWebSocketUrl();
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      const connectFrame = `CONNECT\naccept-version:1.1,1.2\nheart-beat:10000,10000\nAuthorization:Bearer ${accessToken}\n\n\u0000`;
      socket.send(connectFrame);
    };

    socket.onmessage = (e) => {
      const data = e.data;
      if (typeof data === 'string' && data.startsWith('CONNECTED')) {
        socket.send(`SUBSCRIBE\nid:sub-0\ndestination:/topic/conversation.${conversation.conversationId}\n\n\u0000`);
        return;
      }
      if (typeof data === 'string' && data.includes('MESSAGE')) {
        const bodyMatch = data.match(/\n\n([\s\S]*)\u0000$/);
        if (bodyMatch && bodyMatch[1]) {
          try {
            const parsed = JSON.parse(bodyMatch[1]);
            if (parsed.type === 'READ_RECEIPT') {
              if (parsed.readerUsername?.toLowerCase() !== user?.username?.toLowerCase()) {
                setMessages((prev) => {
                  const lastRead = prev.find(message => message.messageId === parsed.lastReadMessageId);
                  if (!lastRead) return prev;
                  const cutoff = new Date(lastRead.createdAt).getTime();
                  return prev.map(message =>
                    (message.senderId === user?.userId || message.senderUsername === user?.username)
                    && message.readReceiptVisible
                    && new Date(message.createdAt).getTime() <= cutoff
                      ? { ...message, readByRecipient: true }
                      : message
                  );
                });
              }
            } else if (parsed.messageId) {
              setMessages((prev) => {
                if (prev.some((m) => m.messageId === parsed.messageId)) return prev;
                return [...prev, parsed];
              });
              if (parsed.senderId !== user?.userId && AppState.currentState === 'active') {
                void markRead();
              }
            }
          } catch (err) {}
        }
      }
    };

    ws.current = socket;

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [conversation.conversationId, accessToken, user?.userId, user?.username]);

  useEffect(() => {
    if (!conversation.conversationId) return;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void markRead();
    });
    return () => subscription.remove();
  }, [conversation.conversationId]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const contentToSend = inputText.trim();
    setSendError('');

    try {
      const res = conversation.conversationId
        ? await api.post(`/chat/conversations/${conversation.conversationId}/messages`, {
            content: contentToSend,
            messageType: 'TEXT'
          })
        : await api.post(`/chat/direct/${encodeURIComponent(conversation.otherUsername || '')}/messages`, {
            content: contentToSend,
            messageType: 'TEXT'
          });

      const newMsg: Message = conversation.conversationId ? res.data : res.data.message;
      if (!conversation.conversationId) {
        onConversationPersisted({
          ...conversation,
          conversationId: res.data.conversationId,
          isDraft: false,
          latestMessage: newMsg.content,
          updatedAt: newMsg.createdAt
        });
      }
      setInputText('');
      setMessages((prev) => {
        if (prev.some((m) => m.messageId === newMsg.messageId)) return prev;
        return [...prev, newMsg];
      });
    } catch (err) {
      setSendError('No se pudo enviar el mensaje. Inténtalo de nuevo.');
    }
  };

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isOwn = item.senderUsername === user?.username || item.senderId === user?.userId;

    return (
      <View style={[styles.messageRow, isOwn ? styles.ownRow : styles.otherRow]}>
        {!isOwn && (
          <Text style={[styles.senderName, { color: theme.accent }]}>@{item.senderUsername}</Text>
        )}
        <View style={[
          styles.bubble, 
          isOwn 
            ? [styles.ownBubble, { backgroundColor: theme.primary }] 
            : [styles.otherBubble, { backgroundColor: theme.surface, borderColor: theme.border }]
        ]}>
          <Text style={[styles.messageText, isOwn ? styles.ownText : [styles.otherText, { color: theme.textPrimary }]]}>
            {item.content}
          </Text>
        </View>
        {isOwn && (
          <Text style={[styles.receipt, { color: item.readReceiptVisible && item.readByRecipient ? theme.accent : theme.textMuted }]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {item.readReceiptVisible && item.readByRecipient ? 'Leído' : 'Enviado'}
          </Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{conversation.name}</Text>
          <Text style={[styles.status, { color: theme.textSecondary }]}>Conversación directa</Text>
        </View>

        <Text style={[styles.webCallNotice, { color: theme.textMuted }]}>Llamadas disponibles en web</Text>
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.messageId}
        renderItem={renderMessageItem}
        contentContainerStyle={messages.length === 0 ? styles.emptyContainer : { paddingHorizontal: 16, paddingVertical: 12 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-ellipses-outline" size={36} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Sin mensajes aún</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>Escribe el primer mensaje para comenzar la conversación.</Text>
          </View>
        }
      />

      {/* Input */}
      {sendError ? <Text style={[styles.sendError, { color: theme.danger }]}>{sendError}</Text> : null}
      <View style={[styles.inputRow, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.textPrimary }]}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={theme.textMuted}
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: theme.primary }]} onPress={handleSend}>
          <Ionicons name="send" size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    padding: 4,
  },
  headerInfo: {
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  status: {
    fontSize: 11,
    marginTop: 1,
  },
  webCallNotice: {
    maxWidth: 90,
    fontSize: 9,
    textAlign: 'right',
  },
  messageRow: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  ownRow: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherRow: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
  },
  ownBubble: {
    borderTopRightRadius: 2,
  },
  otherBubble: {
    borderWidth: 1,
    borderTopLeftRadius: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 19,
  },
  ownText: {
    color: '#ffffff',
  },
  otherText: {},
  senderName: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  receipt: {
    fontSize: 10,
    marginTop: 3,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendError: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
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
  emptyTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
  },
});
