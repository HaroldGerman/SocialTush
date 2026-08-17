'use client';

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Client } from '@stomp/stompjs';
import CallModal from '@/components/CallModal';
import { 
  Search, Plus, Send, Smile, Paperclip, Phone, Video, Info, User, ChevronLeft, LogOut, CheckCheck, 
  Users, MessageSquare, X, Filter, Home, Layers, Compass, Bell, Bookmark, Settings, Image as ImageIcon,
  Mic, Sparkles, Share2, MoreVertical, Network, ShieldCheck, Heart, ArrowUpRight
} from 'lucide-react';

interface Conversation {
  conversationId: string;
  name: string;
  avatarUrl: string;
  isGroup: boolean;
  latestMessage: string;
  latestMessageSenderUsername?: string;
  unreadCount?: number;
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
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [activeTab, setActiveTab] = useState<'directos' | 'circulos' | 'nodos'>('directos');
  const [filterCategory, setFilterCategory] = useState<'todos' | 'noleidos' | 'recientes'>('todos');

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

  // Format relative time for chat items
  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (diff < 60) return Math.max(1, diff) + ' s';
      if (diff < 3600) return Math.floor(diff / 60) + ' min';
      if (diff < 86400) return Math.floor(diff / 3600) + ' h';
      return Math.floor(diff / 86400) + ' d';
    } catch {
      return '';
    }
  };

  // Load conversations helper
  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/chat/conversations');
      const data = res.data || [];
      setConversations(data);
      return data as Conversation[];
    } catch (err) {
      console.error('Error al cargar conversaciones:', err);
      setConversations([]);
      return [];
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
        setMessages(res.data || []);

        // Mark only THIS active conversation as read
        await api.patch(`/chat/conversations/${activeConversation.conversationId}/read`).catch(() => {});
        setConversations(prev => prev.map(c => 
          c.conversationId === activeConversation.conversationId ? { ...c, unreadCount: 0 } : c
        ));
      } catch (err) {
        console.error('Error al cargar mensajes:', err);
        setMessages([]);
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
          if (prev.some((m) => m.messageId === newMessage.messageId)) return prev;
          return [...prev, newMessage];
        });
        
        // Update conversation in sidebar list
        setConversations(prev => prev.map(c => {
          if (c.conversationId === activeConversation.conversationId) {
            return { 
              ...c, 
              latestMessage: newMessage.content, 
              latestMessageSenderUsername: newMessage.senderUsername,
              updatedAt: newMessage.createdAt 
            };
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

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversation) return;

    const contentToSend = inputText.trim();
    setInputText('');

    try {
      const res = await api.post(`/chat/conversations/${activeConversation.conversationId}/messages`, {
        content: contentToSend,
        messageType: 'TEXT'
      });

      const newMsg: Message = res.data;
      setMessages((prev) => {
        if (prev.some((m) => m.messageId === newMsg.messageId)) return prev;
        return [...prev, newMsg];
      });

      setConversations(prev => prev.map(c => {
        if (c.conversationId === activeConversation.conversationId) {
          return { 
            ...c, 
            latestMessage: contentToSend, 
            latestMessageSenderUsername: user?.username,
            updatedAt: new Date().toISOString() 
          };
        }
        return c;
      }));

      // Send WS typing stop event
      sendTypingEvent(false);
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
    }
  };

  // Typing event
  const sendTypingEvent = (typing: boolean) => {
    if (!stompClient.current || !stompConnected || !activeConversation || !user) return;
    try {
      stompClient.current.publish({
        destination: `/app/chat.typing`,
        body: JSON.stringify({
          conversationId: activeConversation.conversationId,
          username: user.username,
          isTyping: typing
        })
      });
    } catch (err) {
      console.error('Error sending typing event', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (!isTyping) {
      setIsTyping(true);
      sendTypingEvent(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingEvent(false);
    }, 2000);
  };

  const handleCreateNewChat = async (e: React.FormEvent) => {
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
      alert('No se pudo encontrar el usuario o crear la conversación.');
    }
  };

  const handleCreateNewGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    const participants = groupParticipants
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

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

  const totalUnreadAll = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  return (
    <main className="min-h-screen bg-[#070913] text-slate-100 flex items-center justify-center p-0 select-none overflow-hidden font-sans">
      <div className="w-full h-screen bg-[#0b0e1b] border-none overflow-hidden shadow-2xl flex relative">
        
        {/* ================= FAR LEFT MINI NAVIGATION ================= */}
        <aside className="hidden lg:flex w-60 bg-[#080a15] border-r border-indigo-950/40 flex-col justify-between p-4 flex-shrink-0 z-20">
          <div className="space-y-6">
            {/* SocialTush Brand Logo */}
            <Link href="/feed" className="flex items-center gap-3 px-2 py-1 group">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 p-[2px] shadow-[0_0_15px_rgba(99,102,241,0.4)] group-hover:scale-105 transition-transform">
                <div className="w-full h-full bg-[#080a15] rounded-[10px] flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-cyan-400 animate-pulse" />
                </div>
              </div>
              <span className="text-lg font-black bg-gradient-to-r from-white via-indigo-200 to-cyan-400 bg-clip-text text-transparent tracking-tight">
                SocialTush
              </span>
            </Link>

            {/* Navigation Menu */}
            <nav className="space-y-1 text-xs font-semibold">
              <Link href="/feed" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-indigo-950/30 transition-all">
                <Home className="h-4 w-4 text-slate-400" />
                <span>Inicio</span>
              </Link>
              <Link href="/chat" className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-indigo-950/80 to-purple-950/50 text-white border-l-4 border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.2)]">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4 text-indigo-400" />
                  <span>Mensajes</span>
                </div>
                {totalUnreadAll > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-extrabold text-[10px]">
                    {totalUnreadAll}
                  </span>
                )}
              </Link>
              <Link href="/circles" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-indigo-950/30 transition-all">
                <Users className="h-4 w-4 text-slate-400" />
                <span>Círculos</span>
              </Link>
              <Link href="/circles" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-indigo-950/30 transition-all">
                <Network className="h-4 w-4 text-slate-400" />
                <span>Nodos</span>
              </Link>
              <Link href="/reels" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-indigo-950/30 transition-all">
                <Compass className="h-4 w-4 text-slate-400" />
                <span>Explorar</span>
              </Link>
              <Link href="/feed" className="flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-indigo-950/30 transition-all">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-slate-400" />
                  <span>Notificaciones</span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-indigo-900/60 text-indigo-300 font-bold text-[10px]">7</span>
              </Link>
              <Link href="/profile" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-indigo-950/30 transition-all">
                <Bookmark className="h-4 w-4 text-slate-400" />
                <span>Guardados</span>
              </Link>
              <Link href="/admin" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 hover:text-white hover:bg-indigo-950/30 transition-all">
                <Settings className="h-4 w-4 text-slate-400" />
                <span>Ajustes</span>
              </Link>
            </nav>
          </div>

          {/* User Profile & Network Level Badge */}
          <div className="p-3 bg-[#0d1021] border border-indigo-950/60 rounded-2xl space-y-3 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center font-extrabold text-white text-xs shadow-md">
                  {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[#0d1021]" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-white block truncate">{user?.username || 'Usuario'}</span>
                <span className="text-[10px] text-emerald-400 block font-medium">Conectado</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#090b17] border border-indigo-900/40 flex items-center gap-3">
              <div className="relative flex items-center justify-center h-9 w-9">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path className="text-indigo-950" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-cyan-400" strokeDasharray="72, 100" strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <span className="absolute text-[9px] font-black text-cyan-300">72%</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-slate-300 block">Tu red SocialTush</span>
                <span className="text-[9px] text-indigo-400 block">Nivel 4 · Explorador</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ================= MIDDLE COLUMN: CENTRO DE CONEXIONES ================= */}
        <div className={`w-full md:w-80 lg:w-80 bg-[#0a0d1a] border-r border-indigo-950/40 flex flex-col justify-between flex-shrink-0 ${
          activeConversation ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Header & Tabs */}
          <div className="p-4 border-b border-indigo-950/50 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-white tracking-wide">Centro de conexiones</h2>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="p-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800/60 transition-all text-indigo-300 hover:text-white"
                  title="Nuevo chat"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => setIsNewGroupModalOpen(true)}
                  className="p-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800/60 transition-all text-indigo-300 hover:text-white"
                  title="Crear grupo / nodo"
                >
                  <Users className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex bg-[#070914] p-1 rounded-xl border border-indigo-950/60 text-[11px] font-bold">
              <button 
                onClick={() => setActiveTab('directos')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'directos' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Directos ({conversations.filter(c => !c.isGroup).length})
              </button>
              <button 
                onClick={() => setActiveTab('circulos')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'circulos' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Círculos
              </button>
              <button 
                onClick={() => setActiveTab('nodos')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'nodos' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Nodos
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-indigo-400" />
              <input 
                type="text" 
                placeholder="Buscar conversaciones..." 
                className="w-full pl-9 pr-8 py-2 bg-[#070914] border border-indigo-950 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-all"
              />
              <button className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400">
                <Filter className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Category Filter Pills */}
            <div className="flex gap-1.5 text-[10px] font-bold pt-1">
              <button 
                onClick={() => setFilterCategory('todos')}
                className={`px-2.5 py-1 rounded-full border transition-all ${
                  filterCategory === 'todos' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-transparent border-indigo-950 text-slate-400'
                }`}
              >
                Todos ({conversations.length})
              </button>
              <button 
                onClick={() => setFilterCategory('noleidos')}
                className={`px-2.5 py-1 rounded-full border transition-all ${
                  filterCategory === 'noleidos' ? 'bg-purple-500/20 border-purple-500 text-purple-300' : 'bg-transparent border-indigo-950 text-slate-400'
                }`}
              >
                No leídos
              </button>
              <button 
                onClick={() => setFilterCategory('recientes')}
                className={`px-2.5 py-1 rounded-full border transition-all ${
                  filterCategory === 'recientes' ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300' : 'bg-transparent border-indigo-950 text-slate-400'
                }`}
              >
                Recientes
              </button>
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {conversations
              .filter(c => {
                if (filterCategory === 'noleidos') return (c.unreadCount || 0) > 0;
                if (activeTab === 'circulos') return c.isGroup;
                if (activeTab === 'directos') return !c.isGroup;
                return true;
              })
              .map((c) => {
                const hasUnread = (c.unreadCount || 0) > 0;
                const isSelected = activeConversation?.conversationId === c.conversationId;
                let previewText = c.latestMessage || '';
                if (c.latestMessageSenderUsername) {
                  if (c.latestMessageSenderUsername === user?.username) {
                    previewText = `Tú: ${c.latestMessage}`;
                  } else if (c.isGroup) {
                    previewText = `${c.latestMessageSenderUsername}: ${c.latestMessage}`;
                  }
                }

                return (
                  <div 
                    key={c.conversationId}
                    onClick={() => setActiveConversation(c)}
                    className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 border ${
                      isSelected
                        ? 'bg-gradient-to-r from-indigo-950/80 to-purple-950/40 border-indigo-500/80 shadow-[0_0_15px_rgba(99,102,241,0.15)] text-white' 
                        : 'bg-[#070914]/60 border-indigo-950/40 hover:bg-indigo-950/30'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white text-xs shadow-md">
                        {c.isGroup ? <Users className="h-5 w-5 text-cyan-300" /> : c.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[#0a0d1a]" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs block truncate ${hasUnread ? 'font-black text-white' : 'font-bold text-slate-200'}`}>
                          {c.name}
                        </span>
                        <span className="text-[9px] text-slate-500">{formatTimeAgo(c.updatedAt)}</span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`px-1.5 py-0.2 rounded text-[8px] font-extrabold ${
                          c.isGroup ? 'bg-purple-950 text-purple-300 border border-purple-800/40' : 'bg-indigo-950 text-indigo-300 border border-indigo-800/40'
                        }`}>
                          {c.isGroup ? 'Círculo' : 'Conexión directa'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-[10px] block truncate ${hasUnread ? 'font-bold text-indigo-200' : 'text-slate-400'}`}>
                          {previewText}
                        </span>
                        {hasUnread && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-black text-[9px] min-w-[16px] text-center shadow-md animate-pulse">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

            {conversations.length === 0 && (
              <div className="text-center py-20 text-slate-500 text-xs font-medium">
                No hay conexiones activas en esta sección.
              </div>
            )}
          </div>
        </div>

        {/* ================= CENTER MAIN CHAT CANVAS ================= */}
        <div className={`flex-1 flex flex-col justify-between bg-[#080a15] relative ${
          !activeConversation ? 'hidden md:flex' : 'flex'
        }`}>
          {activeConversation ? (
            <>
              {/* Main Chat Header */}
              <div className="p-3.5 px-5 border-b border-indigo-950/60 bg-[#090c1b]/80 backdrop-blur-md flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveConversation(null)}
                    className="p-1.5 rounded-lg bg-indigo-950 border border-indigo-900 md:hidden text-slate-400 hover:text-white"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-xs shadow-md">
                      {activeConversation.isGroup ? <Users className="h-5 w-5 text-cyan-300" /> : activeConversation.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[#080a15]" />
                  </div>

                  <div>
                    <h3 className="text-xs font-extrabold text-white block flex items-center gap-1.5">
                      {activeConversation.name}
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </h3>
                    <span className="text-[10px] text-slate-400 block font-medium">
                      {otherUserTyping ? (
                        <span className="text-cyan-400 font-bold animate-pulse">escribiendo...</span>
                      ) : (
                        `${activeConversation.isGroup ? 'Círculo activo' : 'Conexión directa'} · En línea`
                      )}
                    </span>
                  </div>
                </div>

                {/* Right Action Icons */}
                <div className="flex items-center gap-2">
                  <button onClick={triggerCall} className="p-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-900/60 text-slate-300 hover:text-white transition-colors" title="Llamada de voz">
                    <Phone className="h-4 w-4" />
                  </button>
                  <button onClick={triggerCall} className="p-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-900/60 text-slate-300 hover:text-white transition-colors" title="Videollamada">
                    <Video className="h-4 w-4" />
                  </button>
                  <button onClick={() => setShowRightPanel(!showRightPanel)} className="p-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-900/60 text-slate-300 hover:text-white transition-colors" title="Detalles">
                    <Info className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Chat Messages Area */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-[#070913] bg-[radial-gradient(#1e1b4b_1px,transparent_1px)] [background-size:16px_16px]">
                {/* Date separator */}
                <div className="flex items-center justify-center my-2">
                  <span className="px-3 py-1 rounded-full bg-indigo-950/60 border border-indigo-900/40 text-[10px] font-bold text-indigo-300 shadow-sm">
                    Hoy
                  </span>
                </div>

                {messages.map((m) => {
                  const isOwn = m.senderUsername === user?.username;
                  return (
                    <div 
                      key={m.messageId} 
                      className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                    >
                      <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-xs leading-relaxed border shadow-md ${
                        isOwn 
                          ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 border-purple-400/30 text-white rounded-tr-none shadow-[0_0_15px_rgba(99,102,241,0.25)]' 
                          : 'bg-[#0f1325] border-indigo-900/50 text-slate-200 rounded-tl-none'
                      }`}>
                        {!isOwn && activeConversation.isGroup && (
                          <strong className="text-[10px] text-cyan-400 block mb-1">@{m.senderUsername}</strong>
                        )}
                        
                        {/* Rich Story Reply Card */}
                        {m.messageType === 'STORY_REPLY' && (
                          <div className="mb-2.5 p-2.5 bg-[#080a15]/80 rounded-xl border-l-4 border-cyan-400 text-[11px] space-y-1">
                            <span className="font-bold text-cyan-400 block text-[9px] tracking-wider uppercase">
                              Respondió a una historia · hace 2 min
                            </span>
                            <div className="flex items-center gap-2 p-1.5 bg-indigo-950/40 rounded-lg border border-indigo-900/40">
                              <div className="h-8 w-8 rounded bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-xs font-black text-white">
                                📸
                              </div>
                              <span className="text-[10px] text-slate-300 font-medium">Tu historia: En la montaña</span>
                            </div>
                          </div>
                        )}

                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 px-1">
                        <span className="text-[9px] text-slate-500 font-medium">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isOwn && <CheckCheck className="h-3.5 w-3.5 text-cyan-400" />}
                      </div>
                    </div>
                  );
                })}

                {otherUserTyping && (
                  <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium animate-pulse py-1">
                    <div className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" />
                    <span>{activeConversation.name} está escribiendo...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div className="p-4 border-t border-indigo-950/60 bg-[#090c1b]/90 backdrop-blur-md flex items-center gap-3">
                <button className="p-2.5 rounded-xl bg-[#0d1022] hover:bg-indigo-950 border border-indigo-900/60 text-slate-400 hover:text-white transition-all">
                  <Plus className="h-4 w-4" />
                </button>

                <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2">
                  <div className="flex-grow relative flex items-center">
                    <input 
                      type="text" 
                      value={inputText}
                      onChange={handleInputChange}
                      placeholder="Escribe un mensaje..."
                      className="w-full pl-4 pr-24 py-2.5 bg-[#070914] border border-indigo-950 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/80 transition-all shadow-inner"
                    />
                    <div className="absolute right-3 flex items-center gap-2 text-slate-400">
                      <button type="button" className="hover:text-cyan-400 transition-colors"><Smile className="h-4 w-4" /></button>
                      <button type="button" className="hover:text-cyan-400 transition-colors"><ImageIcon className="h-4 w-4" /></button>
                      <button type="button" className="hover:text-cyan-400 transition-colors"><Mic className="h-4 w-4" /></button>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="p-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:brightness-110 text-white rounded-xl text-xs font-bold active:scale-95 transition-all shadow-[0_0_15px_rgba(99,102,241,0.4)] flex items-center justify-center"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-indigo-950/60 border border-indigo-900/60 flex items-center justify-center text-indigo-400 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                <MessageSquare className="h-8 w-8 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white mb-1">Tus Conexiones SocialTush</h3>
                <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                  Selecciona una conversación en el centro de conexiones o inicia un nuevo chat para enviar mensajes con seguridad neón.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ================= RIGHT DETAILS & CONNECTION PANEL ================= */}
        {activeConversation && showRightPanel && (
          <aside className="hidden xl:flex w-72 bg-[#090b17] border-l border-indigo-950/40 flex-col p-4 flex-shrink-0 z-20 space-y-5 overflow-y-auto">
            {/* User Details Header */}
            <div className="text-center p-4 bg-[#0c0e1e] border border-indigo-950/60 rounded-2xl space-y-3">
              <div className="relative mx-auto w-16 h-16">
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-lg shadow-lg">
                  {activeConversation.name.charAt(0).toUpperCase()}
                </div>
                <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-[#0c0e1e]" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-white">{activeConversation.name}</h4>
                <span className="text-[10px] text-slate-400 font-medium">@{activeConversation.name.toLowerCase()} · En línea</span>
              </div>
              <span className="inline-block px-2.5 py-1 rounded-full bg-indigo-950 border border-indigo-800/60 text-indigo-300 font-bold text-[9px]">
                Conexión directa · Desde 12 may 2024
              </span>
            </div>

            {/* Shared Nodes */}
            <div className="p-3 bg-[#0c0e1e] border border-indigo-950/60 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span>Nodos en común</span>
                <span className="text-indigo-400 text-[10px]">3</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-[#080a15] border border-indigo-950/40 text-xs text-slate-300">
                  <Network className="h-3.5 w-3.5 text-cyan-400" />
                  <span className="text-[11px] font-semibold">Diseño 3D</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-[#080a15] border border-indigo-950/40 text-xs text-slate-300">
                  <Network className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-[11px] font-semibold">Ilustración Digital</span>
                </div>
              </div>
            </div>

            {/* Shared Circles */}
            <div className="p-3 bg-[#0c0e1e] border border-indigo-950/60 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span>Círculos en común</span>
                <span className="text-indigo-400 text-[10px]">2</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 font-bold text-[10px]">
                  Círculo Creativo
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-800/60 text-indigo-300 font-bold text-[10px]">
                  Fotógrafos Urbanos
                </span>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="p-3 bg-[#0c0e1e] border border-indigo-950/60 rounded-2xl space-y-2">
              <span className="text-xs font-bold text-white block">Actividad reciente</span>
              <div className="space-y-2 text-[10px]">
                <div className="flex items-center gap-2 text-slate-300">
                  <Heart className="h-3 w-3 text-rose-500" />
                  <span>Respondió a tu historia · hace 2 min</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <MessageSquare className="h-3 w-3 text-indigo-400" />
                  <span>Comentó en tu post · Ayer</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-2 pt-2">
              <button className="w-full py-2.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800/60 text-indigo-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                <Paperclip className="h-3.5 w-3.5" />
                <span>Enviar archivo</span>
              </button>
              <button className="w-full py-2.5 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-800/60 text-indigo-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2">
                <Share2 className="h-3.5 w-3.5" />
                <span>Compartir nodo</span>
              </button>
            </div>
          </aside>
        )}

      </div>

      {/* ================= MODALS ================= */}
      {/* New Chat Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c0e1e] border border-indigo-900/60 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Nuevo Chat Directo</h3>
              <button onClick={() => setIsNewChatModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateNewChat} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Nombre de usuario</label>
                <input 
                  type="text" 
                  value={searchUsername}
                  onChange={(e) => setSearchUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-[#070914] border border-indigo-950 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="ej: kathely"
                  required
                />
              </div>
              <button 
                type="submit" 
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md"
              >
                Iniciar Conversación
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {isNewGroupModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c0e1e] border border-indigo-900/60 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Crear Círculo o Nodo</h3>
              <button onClick={() => setIsNewGroupModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateNewGroup} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Nombre del Grupo</label>
                <input 
                  type="text" 
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#070914] border border-indigo-950 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="ej: Círculo Creativo"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 block mb-1 uppercase">Integrantes (separados por coma)</label>
                <input 
                  type="text" 
                  value={groupParticipants}
                  onChange={(e) => setGroupParticipants(e.target.value)}
                  className="w-full px-3 py-2 bg-[#070914] border border-indigo-950 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  placeholder="ej: alex, kathely"
                  required
                />
              </div>
              <button 
                type="submit" 
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md"
              >
                Crear Círculo
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
      <div className="min-h-screen bg-[#070913] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="h-10 w-10 bg-indigo-600 rounded-xl" />
          <span className="text-slate-400 text-sm font-semibold">Cargando SocialTush Chat...</span>
        </div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
