import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getWebSocketUrl } from '../config/api';
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
      setMessages(res.data);
    } catch (err) {
      setMessages(getMockMessages(conversation.conversationId));
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

    socket.onmessage = (e) => {
      // Simple parse of STOMP frame body
      const dataStr = e.data as string;
      if (dataStr.includes('MESSAGE')) {
        const bodyStart = dataStr.indexOf('\n\n') + 2;
        const bodyEnd = dataStr.lastIndexOf('\u0000');
        if (bodyStart > 1 && bodyEnd > bodyStart) {
          try {
            const bodyJson = dataStr.substring(bodyStart, bodyEnd);
            const newMessage = JSON.parse(bodyJson) as Message;
            setMessages((prev) => {
              if (prev.some((m) => m.messageId === newMessage.messageId)) return prev;
              return [...prev, newMessage];
            });
          } catch (err) {
            // JSON parsing error
          }
        }
      }
    };

    ws.current = socket;

    return () => {
      socket.close();
    };
  }, [conversation]);

  const handleSend = () => {
    if (!inputText.trim() || !user) return;

    const payload = {
      conversationId: conversation.conversationId,
      senderUsername: user.username,
      content: inputText.trim(),
      messageType: 'TEXT'
    };

    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      const sendFrame = `SEND\ndestination:/app/chat.sendMessage\ncontent-type:application/json\n\n${JSON.stringify(payload)}\u0000`;
      ws.current.send(sendFrame);
    } else {
      // Local simulated fallback
      const localMsg: Message = {
        messageId: Math.random().toString(),
        senderId: user.userId,
        senderUsername: user.username,
        senderDisplayName: user.displayName,
        senderAvatarUrl: '',
        content: inputText.trim(),
        messageType: 'TEXT',
        createdAt: new Date().toISOString()
      };
      setMessages((prev) => [...prev, localMsg]);

      // Simulate a reply after 1.5s
      setTimeout(() => {
        const replyMsg: Message = {
          messageId: Math.random().toString(),
          senderId: 'mock-reply',
          senderUsername: 'sophia',
          senderDisplayName: conversation.name,
          senderAvatarUrl: '',
          content: 'Mensaje recibido. Conexión local simulada.',
          messageType: 'TEXT',
          createdAt: new Date().toISOString()
        };
        setMessages((prev) => [...prev, replyMsg]);
      }, 1500);
    }

    setInputText('');
  };

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isOwn = item.senderUsername === user?.username;
    return (
      <View style={[styles.messageRow, isOwn ? styles.ownRow : styles.otherRow]}>
        <View style={[styles.bubble, isOwn ? styles.ownBubble : styles.otherBubble]}>
          {!isOwn && conversation.isGroup ? (
            <Text style={styles.senderName}>@{item.senderUsername}</Text>
          ) : null}
          <Text style={[styles.messageText, isOwn ? styles.ownText : styles.otherText]}>
            {item.content}
          </Text>
        </View>
        <Text style={styles.timeText}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (activeCall) {
    return (
      <CallScreen 
        recipientUsername={conversation.name}
        isIncoming={false}
        onHangUp={() => setActiveCall(false)}
      />
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={{ color: '#a1a1aa', fontSize: 13 }}>&lt; Atrás</Text>
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.title}>{conversation.name}</Text>
          <Text style={styles.status}>Online</Text>
        </View>

        <TouchableOpacity 
          style={{ paddingHorizontal: 12, paddingVertical: 8 }} 
          onPress={() => setActiveCall(true)}
        >
          <Text style={{ color: '#6366f1', fontSize: 13, fontWeight: 'bold' }}>Llamar</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.messageId}
        renderItem={renderMessageItem}
        contentContainerStyle={{ padding: 16 }}
      />

      {/* Input row */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Escribe un mensaje..."
          placeholderTextColor="#71717a"
          value={inputText}
          onChangeText={setInputText}
          autoCorrect={false}
        />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Text style={styles.sendBtnText}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function getMockMessages(conversationId: string): Message[] {
  return [
    {
      messageId: 'm1',
      senderId: 'mock-2',
      senderUsername: 'sophia',
      senderDisplayName: 'Sophia Loren',
      senderAvatarUrl: '',
      content: 'Hola. ¿Cómo va el avance del proyecto?',
      messageType: 'TEXT',
      createdAt: new Date(Date.now() - 60000).toISOString()
    },
    {
      messageId: 'm2',
      senderId: 'own-id',
      senderUsername: 'alex_futurist',
      senderDisplayName: 'Alex',
      senderAvatarUrl: '',
      content: 'Todo excelente. Ya integré la mensajería y bases de datos.',
      messageType: 'TEXT',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backBtn: {
    paddingVertical: 8,
  },
  headerInfo: {
    alignItems: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  status: {
    color: '#10b981',
    fontSize: 10,
    marginTop: 2,
  },
  messageRow: {
    marginVertical: 6,
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
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  ownBubble: {
    backgroundColor: '#6366f1',
    borderColor: '#4f46e5',
    borderTopRightRadius: 0,
  },
  otherBubble: {
    backgroundColor: '#18181b',
    borderColor: '#27272a',
    borderTopLeftRadius: 0,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  ownText: {
    color: '#ffffff',
  },
  otherText: {
    color: '#d4d4d8',
  },
  senderName: {
    color: '#6366f1',
    fontSize: 9,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  timeText: {
    color: '#3f3f46',
    fontSize: 9,
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#18181b50',
    borderTopWidth: 1,
    borderColor: '#18181b',
    gap: 10,
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 13,
  },
  sendBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});
