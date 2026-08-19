import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getWebSocketUrl } from '../config/api';
import { Ionicons } from '@expo/vector-icons';
import CallScreen from './CallScreen';

interface Message {
  messageId: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl: string;
  content: string;
  messageType: string;
  createdAt: string;
}

interface Conversation {
  conversationId: string;
  name: string;
  avatarUrl: string;
  isGroup: boolean;
  latestMessage: string;
  updatedAt: string;
}

interface ChatRoomScreenProps {
  conversation: Conversation;
  onBack: () => void;
}

export default function ChatRoomScreen({ conversation, onBack }: ChatRoomScreenProps) {
  const { api, user } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeCall, setActiveCall] = useState(false);

  const ws = useRef<WebSocket | null>(null);

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/chat/conversations/${conversation.conversationId}/messages`);
      setMessages(res.data || []);
    } catch (err) {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Establish WebSocket connection for mobile STOMP frames
    const wsUrl = getWebSocketUrl();
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      // Send CONNECT frame
      const connectFrame = 'CONNECT\naccept-version:1.1,1.2\nheart-beat:10000,10000\n\n\u0000';
      socket.send(connectFrame);

      // Send SUBSCRIBE frame
      const subscribeFrame = `SUBSCRIBE\nid:sub-0\ndestination:/topic/conversation.${conversation.conversationId}\n\n\u0000`;
      socket.send(subscribeFrame);
    };

    socket.onmessage = (event) => {
      const rawData = event.data as string;
      if (rawData.startsWith('MESSAGE')) {
        const bodyIndex = rawData.indexOf('\n\n');
        if (bodyIndex !== -1) {
          const bodyStr = rawData.substring(bodyIndex + 2, rawData.length - 1);
          try {
            const incomingMsg = JSON.parse(bodyStr);
            setMessages((prev) => [...prev, incomingMsg]);
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    };

    ws.current = socket;

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [conversation.conversationId]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    const content = inputText.trim();
    setInputText('');

    // Optimistic append
    const localMsg: Message = {
      messageId: Date.now().toString(),
      senderId: user?.userId || '',
      senderUsername: user?.username || '',
      senderDisplayName: user?.displayName || user?.username || '',
      senderAvatarUrl: '',
      content,
      messageType: 'TEXT',
      createdAt: new Date().toISOString()
    };
    setMessages(prev => [...prev, localMsg]);

    // Send via WebSocket STOMP SEND frame if connected
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const payload = JSON.stringify({
        conversationId: conversation.conversationId,
        content,
        messageType: 'TEXT'
      });
      const sendFrame = `SEND\ndestination:/app/chat.sendMessage\ncontent-type:application/json\n\n${payload}\u0000`;
      ws.current.send(sendFrame);
    } else {
      // Fallback via HTTP REST
      api.post(`/chat/conversations/${conversation.conversationId}/messages`, {
        content,
        messageType: 'TEXT'
      }).catch(() => {});
    }
  };

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isOwn = item.senderUsername === user?.username || item.senderId === user?.userId;
    return (
      <View style={[styles.messageRow, isOwn ? styles.ownRow : styles.otherRow]}>
        {!isOwn && (
          <Text style={styles.senderName}>{item.senderDisplayName || item.senderUsername}</Text>
        )}
        <View style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
          <Text style={[styles.messageText, isOwn ? styles.ownText : styles.otherText]}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  if (activeCall) {
    return (
      <CallScreen 
        recipientUsername={conversation.name}
        onHangUp={() => setActiveCall(false)}
      />
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.title}>{conversation.name}</Text>
          <Text style={styles.status}>En línea</Text>
        </View>

        <TouchableOpacity onPress={() => setActiveCall(true)} style={styles.callBtn}>
          <Ionicons name="call-outline" size={20} color="#14b8a6" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.messageId}
        renderItem={renderMessageItem}
        contentContainerStyle={messages.length === 0 ? styles.emptyContainer : { paddingHorizontal: 16, paddingVertical: 12 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-ellipses-outline" size={36} color="#64748b" />
            <Text style={styles.emptyTitle}>Sin mensajes aún</Text>
            <Text style={styles.emptySub}>Escribe el primer mensaje para comenzar la conversación.</Text>
          </View>
        }
      />

      {/* Input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje..."
          placeholderTextColor="#64748b"
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Ionicons name="send" size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
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
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  status: {
    color: '#10b981',
    fontSize: 11,
    marginTop: 1,
  },
  callBtn: {
    padding: 6,
    backgroundColor: '#0f766e20',
    borderRadius: 10,
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
    backgroundColor: '#0f766e',
    borderTopRightRadius: 2,
  },
  otherBubble: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderTopLeftRadius: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 19,
  },
  ownText: {
    color: '#ffffff',
  },
  otherText: {
    color: '#e2e8f0',
  },
  senderName: {
    color: '#14b8a6',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderColor: '#1e293b',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 44,
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 14,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 14,
  },
  sendBtn: {
    backgroundColor: '#0f766e',
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 4,
  },
  emptySub: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
});
