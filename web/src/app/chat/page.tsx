'use client';

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { WS_BASE_URL } from '@/config/api';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Client } from '@stomp/stompjs';
import NotificationBell from '@/components/NotificationBell';
import MobileBottomBar from '@/components/MobileBottomBar';
import CallModal from '@/components/CallModal';
import { 
  Search, Plus, Send, Smile, Paperclip, Phone, Video, Info, User, ChevronLeft, LogOut, CheckCheck, 
  Users, MessageSquare, X, Filter, Home, Layers, Compass, Bell, Bookmark, Settings, Image as ImageIcon,
  Mic, Sparkles, Share2, MoreVertical, Network, ShieldCheck, Heart, ArrowUpRight, Sun, Moon
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
  otherUserId?: string;
  otherUsername?: string;
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
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetUsername = searchParams ? searchParams.get('username') : null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
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
      if (targetUsername) {
        try {
          const createRes = await api.post('/chat/conversations', {
            recipientUsername: targetUsername.trim(),
            isGroup: false
          });
          const conversationId = createRes.data.conversationId;
          const currentConvs = await fetchConversations();
          const existing = currentConvs.find(c => c.conversationId === conversationId);
          
          if (existing) {
            setActiveConversation(existing);
          } else {
            const newConv: Conversation = {
              conversationId,
              name: targetUsername,
              avatarUrl: '',
              isGroup: false,
              latestMessage: '',
              updatedAt: new Date().toISOString()
            };
            setConversations(prev => [newConv, ...prev]);
            setActiveConversation(newConv);
          }
        } catch (err) {
          console.error('Error al iniciar o recuperar conversación desde URL', err);
          await fetchConversations();
        }
      } else {
        await fetchConversations();
      }
    };

    initConversations();
  }, [user, targetUsername, fetchConversations]);

  // Connect to STOMP WebSocket
  useEffect(() => {
    if (!user) return;

    const client = new Client({
      brokerURL: WS_BASE_URL,
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
      client.deactivate();
    };
  }, [user]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversation) return;

    const loadMessages = async () => {
      try {
        const res = await api.get(`/chat/conversations/${activeConversation.conversationId}/messages`);
        const list = res.data?.content || res.data || [];
        // The API returns messages ordered descending (newest first). Let's reverse to show oldest first.
        const sorted = [...list].reverse();
        setMessages(sorted);
        scrollToBottom();
      } catch (err) {
        console.error('Error al cargar mensajes:', err);
        setMessages([]);
      }
    };

    loadMessages();

    // Subscribe to STOMP channel for this conversation
    if (stompClient.current && stompConnected) {
      const subscription = stompClient.current.subscribe(
        `/topic/conversation.${activeConversation.conversationId}`,
        (msg) => {
          const body = JSON.parse(msg.body);
          
          if (body.type === 'TYPING') {
            if (body.senderUsername !== user?.username) {
              setOtherUserTyping(body.content === 'true');
            }
          } else {
            // Actual message
            setMessages((prev) => {
              if (prev.some(m => m.messageId === body.messageId)) return prev;
              return [...prev, body];
            });
            scrollToBottom();
          }
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [activeConversation, stompConnected]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    
    // Trigger typing state
    if (!isTyping) {
      setIsTyping(true);
      sendTypingSignal(true);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      sendTypingSignal(false);
    }, 2000);
  };

  const sendTypingSignal = (state: boolean) => {
    if (stompClient.current && stompConnected && activeConversation) {
      stompClient.current.publish({
        destination: `/app/chat.typing`,
        body: JSON.stringify({
          conversationId: activeConversation.conversationId,
          senderUsername: user?.username,
          content: state ? 'true' : 'false'
        })
      });
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !activeConversation) return;

    const content = inputText.trim();
    setInputText('');
    setIsTyping(false);
    sendTypingSignal(false);

    try {
      await api.post(`/chat/conversations/${activeConversation.conversationId}/messages`, {
        content: content,
        messageType: 'TEXT'
      });
      // STOMP subscription handles displaying the message.
    } catch (err) {
      console.error('Error al enviar mensaje:', err);
    }
  };

  const handleCreateNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUsername.trim()) return;

    try {
      const res = await api.post('/chat/conversations', {
        recipientUsername: searchUsername.toLowerCase().trim(),
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
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al iniciar conversación');
    }
  };

  const handleCreateNewGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;

    const participants = groupParticipants.split(',')
      .map(p => p.trim())
      .filter(p => p.length > 0);

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
    <main className="min-h-[100dvh] h-[100dvh] bg-[#f4f6f9] dark:bg-[#090d16] text-slate-800 dark:text-slate-100 flex items-stretch justify-stretch p-0 select-none overflow-hidden font-sans transition-colors duration-200">
      <div className="w-full h-full border-none overflow-hidden flex relative">
        
        {/* ================= FAR LEFT MINI NAVIGATION ================= */}
        <aside className="hidden lg:flex w-60 bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800 flex-col justify-between p-4 flex-shrink-0 z-20 shadow-sm">
          <div className="space-y-6">
            {/* SocialTush Brand Logo */}
            <Link href="/feed" className="flex items-center gap-3 px-2 py-1 group">
              <div className="h-10 w-10 rounded-2xl bg-teal-705 flex items-center justify-center text-white font-extrabold shadow-md shadow-teal-700/20 group-hover:scale-105 transition-transform">
                <span className="text-xl">S</span>
              </div>
              <span className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                SocialTush
              </span>
            </Link>

            {/* Navigation Menu */}
            <nav className="space-y-1 text-xs font-semibold">
              <Link href="/feed" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-teal-800 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                <Home className="h-4 w-4" />
                <span>Inicio</span>
              </Link>
              <Link href="/chat" className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-800/30 text-teal-900 dark:text-teal-405 border-l-4 border-teal-700 font-bold shadow-sm">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4 text-teal-700 dark:text-teal-405" />
                  <span>Mensajes</span>
                </div>
                {totalUnreadAll > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-teal-700 text-white font-extrabold text-[10px]">
                    {totalUnreadAll}
                  </span>
                )}
              </Link>
              <Link href="/circles" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-teal-800 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                <Users className="h-4 w-4" />
                <span>Círculos</span>
              </Link>
            </nav>
          </div>

          {/* Bottom Settings / Theme Selector */}
          <div className="space-y-4">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-xs font-bold"
            >
              {theme === 'light' ? (
                <>
                  <Moon className="h-4.5 w-4.5 text-slate-650" />
                  <span>Usar tema oscuro</span>
                </>
              ) : (
                <>
                  <Sun className="h-4.5 w-4.5 text-amber-400" />
                  <span>Usar tema claro</span>
                </>
              )}
            </button>

            {/* Profile widget */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-9 w-9 rounded-full bg-teal-700 flex items-center justify-center font-extrabold text-white text-xs shadow-md">
                    {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-slate-50 dark:border-slate-900" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-slate-200 block truncate">{user?.username || 'Usuario'}</span>
                  <span className="text-[10px] text-teal-700 dark:text-teal-400 block font-semibold">Conectado</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* ================= MIDDLE COLUMN: CENTRO DE CONEXIONES ================= */}
        <div className={`w-full md:w-80 lg:w-80 bg-slate-50 dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between flex-shrink-0 ${
          activeConversation ? 'hidden md:flex' : 'flex'
        }`}>
          {/* Header & Tabs */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 bg-white dark:bg-[#0f172a]">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-wide">Centro de conexiones</h2>
              <div className="flex items-center gap-1.5">
                {/* Mobile Theme switch */}
                <button
                  onClick={toggleTheme}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 md:hidden hover:text-teal-600"
                >
                  {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                </button>

                <button 
                  onClick={() => setIsNewChatModalOpen(true)}
                  className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/80 hover:bg-teal-100 border border-teal-200 dark:border-teal-800 transition-all text-teal-800 dark:text-teal-400"
                  title="Nuevo chat"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => setIsNewGroupModalOpen(true)}
                  className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/80 hover:bg-teal-100 border border-teal-200 dark:border-teal-800 transition-all text-teal-800 dark:text-teal-400"
                  title="Crear grupo / nodo"
                >
                  <Users className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold">
              <button 
                onClick={() => setActiveTab('directos')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'directos' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-650 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Directos ({conversations.filter(c => !c.isGroup).length})
              </button>
              <button 
                onClick={() => setActiveTab('circulos')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'circulos' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-650 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Círculos
              </button>
              <button 
                onClick={() => setActiveTab('nodos')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'nodos' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-650 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Nodos
              </button>
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#f4f6f9] dark:bg-slate-900/50">
            {conversations
              .filter(c => {
                if (activeTab === 'directos') return !c.isGroup;
                if (activeTab === 'circulos') return c.isGroup;
                return false; // Nodes fallback mock
              })
              .map(c => {
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
                        ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-300 dark:border-teal-900 text-slate-900 dark:text-slate-100 shadow-sm' 
                        : 'bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 hover:bg-slate-100/60 dark:hover:bg-slate-850/60'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="h-10 w-10 rounded-full bg-teal-700 text-white flex items-center justify-center font-extrabold text-xs shadow-sm">
                        {c.isGroup ? <Users className="h-5 w-5 text-teal-100" /> : c.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs block truncate ${hasUnread ? 'font-black text-slate-950 dark:text-white' : 'font-bold text-slate-800 dark:text-slate-200'}`}>
                          {c.name}
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium">{formatTimeAgo(c.updatedAt)}</span>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        <span className={`text-[10px] block truncate ${hasUnread ? 'font-bold text-teal-900 dark:text-teal-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {previewText}
                        </span>
                        {hasUnread && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-teal-700 text-white font-black text-[9px] min-w-[16px] text-center shadow-sm animate-pulse">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

            {conversations.length === 0 && (
              <div className="text-center py-20 text-slate-405 dark:text-slate-400 text-xs font-medium">
                No hay conexiones activas en esta sección.
              </div>
            )}
          </div>
        </div>

        {/* ================= CENTER MAIN CHAT CANVAS ================= */}
        <div className={`flex-1 flex flex-col justify-between bg-slate-50 dark:bg-slate-900/40 relative ${
          !activeConversation ? 'hidden md:flex' : 'flex'
        }`}>
          {activeConversation ? (
            <>
              {/* Main Chat Header */}
              <div className="p-3.5 px-5 border-b border-slate-205 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setActiveConversation(null)}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 md:hidden text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="relative">
                    <div className="h-10 w-10 rounded-full bg-teal-700 flex items-center justify-center font-extrabold text-white text-xs shadow-sm">
                      {activeConversation.isGroup ? <Users className="h-5 w-5 text-teal-100" /> : activeConversation.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                  </div>

                  <div>
                    <h3 className="text-xs font-extrabold text-slate-900 dark:text-white block flex items-center gap-1.5">
                      {activeConversation.name}
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    </h3>
                    <span className="text-[10px] text-teal-700 dark:text-teal-400 block font-semibold">
                      {otherUserTyping ? (
                        <span className="text-teal-700 font-bold animate-pulse">escribiendo...</span>
                      ) : (
                        `${activeConversation.isGroup ? 'Círculo activo' : 'Conexión directa'} · En línea`
                      )}
                    </span>
                  </div>
                </div>

                {/* Right Action Icons */}
                <div className="flex items-center gap-2">
                  <button onClick={triggerCall} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors" title="Llamada de voz">
                    <Phone className="h-4 w-4" />
                  </button>
                  <button onClick={triggerCall} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors" title="Videollamada">
                    <Video className="h-4 w-4" />
                  </button>
                  <button onClick={() => setShowRightPanel(!showRightPanel)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors" title="Detalles">
                    <Info className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Chat Messages Area */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-100/60 dark:bg-slate-900/40">
                {/* Date separator */}
                <div className="flex items-center justify-center my-2">
                  <span className="px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-[10px] font-bold text-teal-800 dark:text-teal-400 shadow-sm">
                    Hoy
                  </span>
                </div>

                {messages.map((m) => {
                  const isOwn = m.senderUsername === user?.username;
                  return (
                    <div 
                      key={m.messageId}
                      className={`flex flex-col max-w-[75%] ${isOwn ? 'ml-auto items-end' : 'items-start'}`}
                    >
                      <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                        isOwn 
                          ? 'bg-teal-700 text-white rounded-br-none shadow-sm' 
                          : 'bg-white dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none shadow-sm'
                      }`}>
                        {!isOwn && activeConversation.isGroup && (
                          <strong className="text-[10px] text-teal-750 dark:text-teal-400 block mb-1">@{m.senderUsername}</strong>
                        )}
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 px-1">
                        <span className="text-[9px] text-slate-400 font-medium">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isOwn && <CheckCheck className="h-3.5 w-3.5 text-teal-605" />}
                      </div>
                    </div>
                  );
                })}

                {otherUserTyping && (
                  <div className="flex items-center gap-2 text-xs text-teal-700 dark:text-teal-400 font-bold animate-pulse py-1">
                    <div className="h-2 w-2 rounded-full bg-teal-600 animate-bounce" />
                    <span>{activeConversation.name} está escribiendo...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar */}
              <div 
                className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm flex items-center gap-3"
                style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
              >
                <button className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-all">
                  <Plus className="h-4 w-4" />
                </button>

                <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2">
                  <div className="flex-grow relative flex items-center">
                    <input 
                      type="text" 
                      value={inputText}
                      onChange={handleInputChange}
                      placeholder="Escribe un mensaje..."
                      className="w-full pl-4 pr-24 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-202 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-700 transition-all"
                    />
                    <div className="absolute right-3 flex items-center gap-2 text-slate-400">
                      <button type="button" className="hover:text-teal-700 transition-colors"><Smile className="h-4 w-4" /></button>
                      <button type="button" className="hover:text-teal-700 transition-colors"><ImageIcon className="h-4 w-4" /></button>
                      <button type="button" className="hover:text-teal-700 transition-colors"><Mic className="h-4 w-4" /></button>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="p-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold active:scale-95 transition-all shadow-md flex items-center justify-center"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-900 flex items-center justify-center text-teal-700 shadow-sm">
                <MessageSquare className="h-8 w-8 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">Tus Conexiones SocialTush</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                  Selecciona una conversación en el centro de conexiones o inicia un nuevo chat para enviar mensajes.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ================= RIGHT DETAILS & CONNECTION PANEL ================= */}
        {activeConversation && showRightPanel && (
          <aside className="hidden xl:flex w-72 bg-white dark:bg-[#0f172a] border-l border-slate-200 dark:border-slate-800 flex-col p-4 flex-shrink-0 z-20 space-y-5 overflow-y-auto shadow-sm">
            {/* User Details Header */}
            <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div className="relative mx-auto w-16 h-16">
                <div className="w-full h-full rounded-full bg-teal-700 flex items-center justify-center font-black text-white text-lg shadow-md">
                  {activeConversation.name.charAt(0).toUpperCase()}
                </div>
                <span className="absolute bottom-1 right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{activeConversation.name}</h4>
                <span className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold">@{activeConversation.name.toLowerCase()} · En línea</span>
              </div>
              <span className="inline-block px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-900 text-teal-800 dark:text-teal-300 font-bold text-[9px]">
                Conexión directa · Desde 12 may 2024
              </span>
            </div>

            {/* Shared Nodes */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-202 dark:border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-900 dark:text-white">
                <span>Nodos en común</span>
                <span className="text-teal-700 dark:text-teal-400 text-[10px]">3</span>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 shadow-sm">
                  <Network className="h-3.5 w-3.5 text-teal-600" />
                  <span className="text-[11px] font-bold">Diseño 3D</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 shadow-sm">
                  <Network className="h-3.5 w-3.5 text-teal-600" />
                  <span className="text-[11px] font-bold">Ilustración Digital</span>
                </div>
              </div>
            </div>

            {/* Shared Circles */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-202 dark:border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-900 dark:text-white">
                <span>Círculos en común</span>
                <span className="text-teal-700 dark:text-teal-400 text-[10px]">2</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-850 text-teal-800 dark:text-teal-300 font-bold text-[10px]">
                  Círculo Creativo
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-855 text-teal-800 dark:text-teal-300 font-bold text-[10px]">
                  Fotógrafos Urbanos
                </span>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-202 dark:border-slate-800 rounded-2xl space-y-2">
              <span className="text-xs font-extrabold text-slate-900 dark:text-white block">Actividad reciente</span>
              <div className="space-y-2 text-[10px]">
                <div className="flex items-center gap-2 text-slate-650 dark:text-slate-400">
                  <Heart className="h-3 w-3 text-rose-500" />
                  <span>Respondió a tu historia · hace 2 min</span>
                </div>
                <div className="flex items-center gap-2 text-slate-655 dark:text-slate-400">
                  <MessageSquare className="h-3 w-3 text-teal-700" />
                  <span>Comentó en tu post · Ayer</span>
                </div>
              </div>
            </div>
          </aside>
        )}

      </div>

      {/* ================= MODALS ================= */}
      {/* New Chat Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Nuevo Chat Directo</h3>
              <button onClick={() => setIsNewChatModalOpen(false)} className="text-slate-450 hover:text-slate-600 dark:hover:text-slate-350">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateNewChat} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1 uppercase">Nombre de usuario</label>
                <input 
                  type="text" 
                  value={searchUsername}
                  onChange={(e) => setSearchUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-105 focus:outline-none focus:border-teal-700"
                  placeholder="ej: kathely"
                  required
                />
              </div>
              <button 
                type="submit" 
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition-all shadow-md"
              >
                Iniciar Conversación
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Group Modal */}
      {isNewGroupModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Crear Círculo o Nodo</h3>
              <button onClick={() => setIsNewGroupModalOpen(false)} className="text-slate-450 hover:text-slate-600 dark:hover:text-slate-350">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateNewGroup} className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1 uppercase">Nombre del Grupo</label>
                <input 
                  type="text" 
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-105 focus:outline-none focus:border-teal-700"
                  placeholder="ej: Círculo Creativo"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1 uppercase">Integrantes (separados por coma)</label>
                <input 
                  type="text" 
                  value={groupParticipants}
                  onChange={(e) => setGroupParticipants(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-105 focus:outline-none focus:border-teal-700"
                  placeholder="ej: alex, kathely"
                  required
                />
              </div>
              <button 
                type="submit" 
                className="w-full py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition-all shadow-md"
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
      {/* Mobile Bottom Navigation Bar (Hidden when inside a chat conversation) */}
      {!activeConversation && <MobileBottomBar />}
    </main>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090d16] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="h-10 w-10 bg-teal-700 rounded-xl" />
          <span className="text-teal-805 dark:text-teal-400 text-sm font-semibold">Cargando SocialTush Chat...</span>
        </div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
