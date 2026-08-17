'use client';

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Client } from '@stomp/stompjs';
import CallModal from '@/components/CallModal';
import { 
  Search, Plus, Send, Smile, Paperclip, Phone, Video, Info, User, ChevronLeft, LogOut, CheckCheck, Users, MessageSquare, X
} from 'lucide-react';

interface Conversation {
  conversationId: string;
  name: string;
  avatarUrl: string;
  isGroup: boolean;
  latestMessage: string;
  updatedAt: string;
}

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

function ChatContent() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetUsername = searchParams ? searchParams.get('username') : null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);

  // Call states
  const [activeCallUsername, setActiveCallUsername] = useState<string | null>(null);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [stompConnected, setStompConnected] = useState(false);

  // Modals state
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
  
  // Forms state
  const [searchUsername, setSearchUsername] = useState('');
  const [groupName, setGroupName] = useState('');
  const [groupParticipants, setGroupParticipants] = useState('');

  const stompClient = useRef<Client | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Load conversations helper
  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/chat/conversations');
      setConversations(res.data);
      return res.data as Conversation[];
    } catch (err) {
      const mocks = getMockConversations();
      setConversations(mocks);
      return mocks;
    }
  }, []);

  // Load conversations and handle query parameters
  useEffect(() => {
    if (!user) return;

    const initConversations = async () => {
      const currentConvs = await fetchConversations();

      if (targetUsername) {
        const existing = currentConvs.find(
          c => c.name.toLowerCase() === targetUsername.toLowerCase()
        );
        if (existing) {
          setActiveConversation(existing);
        } else {
          try {
            const createRes = await api.post('/chat/conversations', {
              recipientUsername: targetUsername.trim(),
              isGroup: false
            });
            const newConv: Conversation = {
              conversationId: createRes.data.conversationId,
              name: targetUsername,
              avatarUrl: '',
              isGroup: false,
              latestMessage: '',
              updatedAt: new Date().toISOString()
            };
            setConversations(prev => [newConv, ...prev]);
            setActiveConversation(newConv);
          } catch (err) {
            console.error('Error al crear conversación desde URL', err);
          }
        }
      }
    };

    initConversations();
  }, [user, targetUsername, fetchConversations]);

  // Connect to STOMP WebSocket
  useEffect(() => {
    if (!user) return;

    const client = new Client({
      brokerURL: 'ws://localhost:8080/ws/chat',
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (str) => {
        console.log(str);
      },
    });

    client.onConnect = () => {
      console.log('Connected to WebSocket STOMP');
      setStompConnected(true);
      
      // Subscribe to incoming calls signaling
      client.subscribe(`/topic/user.${user.username}.call`, (message) => {
        const signal = JSON.parse(message.body);
        if (signal.type === 'OFFER') {
          setActiveCallUsername(signal.senderUsername);
          setIsIncomingCall(true);
        }
      });
    };

    client.onDisconnect = () => {
      setStompConnected(false);
    };

    client.activate();
    stompClient.current = client;

    return () => {
      if (stompClient.current) stompClient.current.deactivate();
      setStompConnected(false);
    };
  }, [user]);

  // Load message history when active chat changes
  useEffect(() => {
    if (!activeConversation) return;

    const loadMessages = async () => {
      try {
        const res = await api.get(`/chat/conversations/${activeConversation.conversationId}/messages`);
        setMessages(res.data);
      } catch (err) {
        setMessages(getMockMessages(activeConversation.conversationId));
      }
    };

    loadMessages();
  }, [activeConversation]);

  // Subscribe to current conversation topic when STOMP is connected and active chat changes
  useEffect(() => {
    if (!stompClient.current || !stompConnected || !activeConversation) return;

    const client = stompClient.current;

    // Subscribe to chat topic
    const subscription = client.subscribe(
      `/topic/conversation.${activeConversation.conversationId}`,
      (message) => {
        const newMessage = JSON.parse(message.body) as Message;
        setMessages((prev) => {
          // Avoid duplicate appends
          if (prev.some((m) => m.messageId === newMessage.messageId)) return prev;
          return [...prev, newMessage];
        });
        
        // Update conversation in sidebar list
        setConversations(prev => prev.map(c => {
          if (c.conversationId === activeConversation.conversationId) {
            return { ...c, latestMessage: newMessage.content, updatedAt: newMessage.createdAt };
          }
          return c;
        }));
      }
    );

    // Subscribe to typing topic
    const typingSubscription = client.subscribe(
      `/topic/conversation.${activeConversation.conversationId}.typing`,
      (message) => {
        const data = JSON.parse(message.body);
        if (data.username !== user?.username) {
          setOtherUserTyping(data.isTyping);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
      typingSubscription.unsubscribe();
      setOtherUserTyping(false);
    };
  }, [activeConversation, stompConnected, user]);

  // Auto scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversation || !user) return;

    const messageContent = inputText.trim();
    setInputText('');

    // Optimistic UI append
    const tempId = 'temp-' + Date.now();
    const optimisticMessage: Message = {
      messageId: tempId,
      senderId: user.userId || 'me',
      senderUsername: user.username,
      senderDisplayName: user.displayName || user.username,
      senderAvatarUrl: '',
      content: messageContent,
      messageType: 'TEXT',
      createdAt: 'Ahora mismo'
    };

    setMessages(prev => [...prev, optimisticMessage]);

    // Update conversation latest message in sidebar
    setConversations(prev => prev.map(c => {
      if (c.conversationId === activeConversation.conversationId) {
        return { ...c, latestMessage: messageContent, updatedAt: new Date().toISOString() };
      }
      return c;
    }));

    if (stompClient.current && stompConnected) {
      try {
        stompClient.current.publish({
          destination: '/app/chat.sendMessage',
          body: JSON.stringify({
            conversationId: activeConversation.conversationId,
            senderUsername: user.username,
            content: messageContent,
            messageType: 'TEXT',
          }),
        });
      } catch (err) {
        console.error('STOMP publish error', err);
      }
    } else {
      try {
        await api.post(`/chat/conversations/${activeConversation.conversationId}/messages`, {
          content: messageContent,
          messageType: 'TEXT'
        });
      } catch (err) {}
    }

    sendTypingStatus(false);
  };

  const sendTypingStatus = (typing: boolean) => {
    if (!activeConversation || !stompClient.current || !stompConnected || !user) return;

    stompClient.current.publish({
      destination: '/app/chat.typing',
      body: JSON.stringify({
        conversationId: activeConversation.conversationId,
        username: user.username,
        isTyping: typing,
      }),
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (!isTyping) {
      setIsTyping(true);
      sendTypingStatus(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingStatus(false);
    }, 2000);
  };

  const handleStartNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUsername.trim()) return;

    try {
      const res = await api.post('/chat/conversations', {
        recipientUsername: searchUsername.trim(),
        isGroup: false
      });
      setIsNewChatModalOpen(false);
      setSearchUsername('');
      await fetchConversations();
      
      const createdChatId = res.data.conversationId;
      setActiveConversation({
        conversationId: createdChatId,
        name: searchUsername.trim(),
        avatarUrl: '',
        isGroup: false,
        latestMessage: '',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      alert('Error al iniciar conversación');
    }
  };

  const handleStartNewGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    const participants = groupParticipants.split(',').map(p => p.trim()).filter(p => p.length > 0);

    try {
      const res = await api.post('/chat/conversations', {
        name: groupName.trim(),
        isGroup: true,
        participantUsernames: participants
      });
      setIsNewGroupModalOpen(false);
      setGroupName('');
      setGroupParticipants('');
      await fetchConversations();
      
      const createdChatId = res.data.conversationId;
      setActiveConversation({
        conversationId: createdChatId,
        name: groupName.trim(),
        avatarUrl: '',
        isGroup: true,
        latestMessage: '',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      alert('Error al crear grupo');
    }
  };

  const triggerCall = () => {
    if (!activeConversation) return;
    setActiveCallUsername(activeConversation.name);
    setIsIncomingCall(false);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-0 md:p-6">
      <div className="w-full max-w-5xl h-screen md:h-[85vh] bg-zinc-900/60 border border-zinc-900 rounded-none md:rounded-2xl overflow-hidden backdrop-blur-md shadow-2xl flex">
        
        {/* Sidebar left */}
        <div className={`w-full md:w-80 border-r border-zinc-900 flex flex-col justify-between ${
          activeConversation ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Header */}
          <div className="p-4 border-b border-zinc-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/" className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-md shadow-indigo-600/10">S</Link>
              <h2 className="text-sm font-bold text-white">Chats</h2>
            </div>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsNewChatModalOpen(true)}
                className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 transition-all"
                title="Nuevo chat"
              >
                <Plus className="h-4 w-4 text-zinc-400" />
              </button>
              <button 
                onClick={() => setIsNewGroupModalOpen(true)}
                className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 transition-all"
                title="Crear grupo"
              >
                <Users className="h-4 w-4 text-zinc-400" />
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-600" />
              <input 
                type="text" 
                placeholder="Buscar chats..." 
                className="w-full pl-9 pr-4 py-2 bg-zinc-950/60 border border-zinc-800 rounded-xl text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto px-2 space-y-1.5">
            {conversations.map((c) => (
              <div 
                key={c.conversationId}
                onClick={() => setActiveConversation(c)}
                className={`p-3 rounded-xl cursor-pointer transition-all flex items-center gap-3 border ${
                  activeConversation?.conversationId === c.conversationId
                    ? 'bg-zinc-800/80 border-zinc-800 text-white' 
                    : 'bg-transparent border-transparent hover:bg-zinc-800/30'
                }`}
              >
                <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-200">
                  {c.isGroup ? <Users className="h-5 w-5 text-indigo-400" /> : c.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold block truncate">{c.name}</span>
                    <span className="text-[9px] text-zinc-500">hace un momento</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 block truncate">{c.latestMessage}</span>
                </div>
              </div>
            ))}

            {conversations.length === 0 && (
              <div className="text-center py-20 text-zinc-600 text-xs">No hay chats activos.</div>
            )}
          </div>
        </div>

        {/* Conversation central window */}
        <div className={`flex-1 flex flex-col justify-between ${
          !activeConversation ? 'hidden md:flex bg-zinc-950/20' : 'flex'
        }`}>
          {activeConversation ? (
            <>
              {/* Header */}
              <div className="p-4 border-b border-zinc-900 bg-zinc-900/60 backdrop-blur-md flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveConversation(null)}
                    className="p-1.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 md:hidden"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-white">
                    {activeConversation.isGroup ? <Users className="h-5 w-5 text-indigo-400" /> : activeConversation.name.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-white block">{activeConversation.name}</h3>
                    <span className="text-[10px] text-zinc-500 block">
                      {otherUserTyping ? (
                        <span className="text-indigo-400 font-semibold animate-pulse">escribiendo...</span>
                      ) : (
                        'Online'
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={triggerCall} className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white transition-colors" title="Llamada de voz">
                    <Phone className="h-4 w-4" />
                  </button>
                  <button onClick={triggerCall} className="p-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white transition-colors" title="Videollamada">
                    <Video className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-zinc-950/10">
                {messages.map((m) => {
                  const isOwn = m.senderUsername === user?.username;
                  return (
                    <div 
                      key={m.messageId} 
                      className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                    >
                      <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed border ${
                        isOwn 
                          ? 'bg-indigo-600 border-indigo-500 text-white rounded-tr-none' 
                          : 'bg-zinc-900 border-zinc-850 text-zinc-200 rounded-tl-none'
                      }`}>
                        {!isOwn && activeConversation.isGroup && (
                          <strong className="text-[9px] text-indigo-400 block mb-1">@{m.senderUsername}</strong>
                        )}
                        <p>{m.content}</p>
                      </div>
                      <div className="flex items-center gap-1 mt-1 px-1">
                        <span className="text-[9px] text-zinc-650">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isOwn && <CheckCheck className="h-3 w-3 text-indigo-400" />}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Footer */}
              <div className="p-4 border-t border-zinc-900 bg-zinc-900/60 flex items-center gap-3">
                <button className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400">
                  <Smile className="h-4 w-4" />
                </button>
                <button className="p-2 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400">
                  <Paperclip className="h-4 w-4" />
                </button>

                <form onSubmit={handleSendMessage} className="flex-1 flex gap-2">
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={handleInputChange}
                    placeholder="Escribe un mensaje..."
                    className="flex-grow px-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/50"
                  />
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold active:scale-95 transition-all"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center p-6 text-center">
              <MessageSquare className="h-10 w-10 text-zinc-800 mb-4" />
              <h3 className="text-sm font-bold text-zinc-300 mb-1">Tus Mensajes</h3>
              <p className="text-xs text-zinc-650 max-w-xs leading-relaxed">
                Selecciona un chat en la barra lateral o inicia una conversación para conectarte de forma inmediata.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Private Chat Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-850 rounded-2xl p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-white">Nuevo Chat</h3>
              <button onClick={() => setIsNewChatModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleStartNewChat} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Buscar por nombre de usuario</label>
                <input 
                  type="text" 
                  value={searchUsername}
                  onChange={(e) => setSearchUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                  placeholder="ej: sophia"
                  required
                />
              </div>
              <button 
                type="submit" 
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl"
              >
                Buscar e Iniciar Chat
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Group Chat Modal */}
      {isNewGroupModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-850 rounded-2xl p-6 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-bold text-white">Crear Grupo</h3>
              <button onClick={() => setIsNewGroupModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleStartNewGroup} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Nombre del grupo</label>
                <input 
                  type="text" 
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                  placeholder="ej: Desarrolladores"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Participantes (separados por coma)</label>
                <input 
                  type="text" 
                  value={groupParticipants}
                  onChange={(e) => setGroupParticipants(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                  placeholder="ej: alex, sophia"
                  required
                />
              </div>
              <button 
                type="submit" 
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl"
              >
                Crear Grupo
              </button>
            </form>
          </div>
        </div>
      )}

      {/* WebRTC Video Call Overlay Modal */}
      {activeCallUsername && (
        <CallModal 
          recipientUsername={activeCallUsername}
          isIncoming={isIncomingCall}
          stompClientRef={stompClient}
          onClose={() => {
            setActiveCallUsername(null);
            setIsIncomingCall(false);
          }}
        />
      )}
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="h-10 w-10 bg-indigo-500 rounded-xl" />
          <span className="text-zinc-500 text-sm">Cargando chats...</span>
        </div>
      </div>
    }>
      <ChatContent />
    </Suspense>
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
      name: 'Equipo de Diseño',
      avatarUrl: '',
      isGroup: true,
      latestMessage: 'Alex actualizó la guía visual del Design System.',
      updatedAt: new Date().toISOString()
    }
  ];
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
