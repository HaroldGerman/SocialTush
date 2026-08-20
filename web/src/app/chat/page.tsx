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
import CallModal, { CallMode } from '@/components/CallModal';
import UserAvatar from '@/components/UserAvatar';
import { useRealtimeActivity } from '@/context/RealtimeActivityContext';
import { 
  Search, Plus, Send, Smile, Paperclip, Phone, Video, Info, User, ChevronLeft, LogOut, CheckCheck, 
  Users, MessageSquare, X, Filter, Home, Layers, Compass, Bell, Bookmark, Settings, Image as ImageIcon,
  Mic, Camera, Sparkles, Share2, MoreVertical, Network, ShieldCheck, Heart, ArrowUpRight, Sun, Moon
} from 'lucide-react';

interface Conversation {
  conversationId: string | null;
  isDraft?: boolean;
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
  attachments?: MessageAttachment[];
  readByRecipient?: boolean;
  readReceiptVisible?: boolean;
}

interface MessageAttachment {
  id: string;
  fileUrl: string;
  fileType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'STICKER' | 'GIF';
  fileName: string;
  fileSize: number;
  durationSeconds?: number;
}

const CHAT_EMOJIS = ['😊', '😂', '❤️', '😭', '🔥', '👍', '👎', '🎉', '😮', '🙏', '💀'];

function ChatContent() {
  const { user, isLoading, accessToken } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { markConversationReadLocal } = useRealtimeActivity();
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
  const [chatError, setChatError] = useState('');
  const [conversationMenuId, setConversationMenuId] = useState<string | null>(null);
  const [deleteConversationId, setDeleteConversationId] = useState<string | null>(null);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<File | null>(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioDurationSeconds, setAudioDurationSeconds] = useState<number | null>(null);
  const [mediaError, setMediaError] = useState('');
  const [failedAttachmentUrls, setFailedAttachmentUrls] = useState<Record<string, boolean>>({});
  const [isSendingAttachment, setIsSendingAttachment] = useState(false);

  // Call states
  const [activeCallUsername, setActiveCallUsername] = useState<string | null>(null);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [activeCallMode, setActiveCallMode] = useState<CallMode>('AUDIO');
  const [incomingOfferSdp, setIncomingOfferSdp] = useState<string | null>(null);
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
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingSecondsRef = useRef(0);
  const recordingCancelledRef = useRef(false);

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

  const createDraft = useCallback(async (username: string): Promise<Conversation> => {
    const normalized = username.trim();
    const profileRes = await api.get(`/profiles/${encodeURIComponent(normalized)}`);
    const profile = profileRes.data;
    return {
      conversationId: null,
      isDraft: true,
      name: profile.displayName || profile.username,
      avatarUrl: profile.avatarUrl || '',
      isGroup: false,
      latestMessage: '',
      updatedAt: new Date().toISOString(),
      otherUserId: profile.userId,
      otherUsername: profile.username
    };
  }, []);

  // Load conversations and handle query parameters
  useEffect(() => {
    if (!user) return;

    const initConversations = async () => {
      const currentConvs = await fetchConversations();
      if (!targetUsername) return;
      const existing = currentConvs.find(c => c.otherUsername?.toLowerCase() === targetUsername.trim().toLowerCase());
      if (existing) return setActiveConversation(existing);
      try {
        setActiveConversation(await createDraft(targetUsername));
      } catch (err) {
        console.error('Error al cargar perfil para el borrador de chat:', err);
        setChatError('No pudimos abrir esta conversación. Verifica el usuario.');
      }
    };

    initConversations();
  }, [user, targetUsername, fetchConversations, createDraft]);

  // Connect to STOMP WebSocket
  useEffect(() => {
    if (!user) return;

    const client = new Client({
      brokerURL: WS_BASE_URL,
      connectHeaders: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
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
          setActiveCallMode(signal.callMode === 'VIDEO' ? 'VIDEO' : 'AUDIO');
          setIncomingOfferSdp(signal.sdp || null);
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
  }, [user, accessToken]);

  const markConversationRead = useCallback(async (conversationId: string) => {
    try {
      await api.patch(`/chat/conversations/${conversationId}/read`);
      setConversations(previous => previous.map(conversation =>
        conversation.conversationId === conversationId ? { ...conversation, unreadCount: 0 } : conversation
      ));
      markConversationReadLocal(conversationId);
      return true;
    } catch (error) {
      console.error('No se pudo marcar la conversación como leída:', error);
      setChatError('Los mensajes se cargaron, pero no pudimos marcar la conversación como leída. Reintenta al abrirla.');
      return false;
    }
  }, [markConversationReadLocal]);

  // Load messages when active conversation changes
  useEffect(() => {
    if (!activeConversation || activeConversation.isDraft || !activeConversation.conversationId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        const res = await api.get(`/chat/conversations/${activeConversation.conversationId}/messages`);
        const list = res.data?.content || res.data || [];
        setMessages(list);
        await markConversationRead(activeConversation.conversationId!);
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
          } else if (body.type === 'READ_RECEIPT') {
            if (body.readerUsername?.toLowerCase() !== user?.username?.toLowerCase()) {
              setMessages(previous => {
                const lastRead = previous.find(item => item.messageId === body.lastReadMessageId);
                if (!lastRead) return previous;
                const cutoff = new Date(lastRead.createdAt).getTime();
                return previous.map(item =>
                  item.senderUsername?.toLowerCase() === user?.username?.toLowerCase()
                  && item.readReceiptVisible
                  && new Date(item.createdAt).getTime() <= cutoff
                    ? { ...item, readByRecipient: true }
                    : item
                );
              });
            }
          } else if (body.messageId) {
            // Actual message
            setMessages((prev) => {
              if (prev.some(m => m.messageId === body.messageId)) return prev;
              return [...prev, body];
            });
            if (body.senderUsername?.toLowerCase() !== user?.username?.toLowerCase()
                && document.visibilityState === 'visible') {
              void markConversationRead(activeConversation.conversationId!);
            }
            scrollToBottom();
          }
        }
      );

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [activeConversation, stompConnected, markConversationRead, user?.username]);

  useEffect(() => {
    const conversationId = activeConversation?.conversationId;
    if (!conversationId || activeConversation?.isDraft) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void markConversationRead(conversationId);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [activeConversation?.conversationId, activeConversation?.isDraft, markConversationRead]);

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
    if (stompClient.current && stompConnected && activeConversation?.conversationId && !activeConversation.isDraft) {
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

  const stopMicrophone = useCallback(() => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    microphoneStreamRef.current?.getTracks().forEach(track => track.stop());
    microphoneStreamRef.current = null;
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  const clearSelectedAttachment = useCallback(() => {
    setSelectedAttachment(null);
    setAudioDurationSeconds(null);
    setAttachmentPreviewUrl(previous => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, []);

  useEffect(() => {
    setShowEmojiPicker(false);
    setMediaError('');
    clearSelectedAttachment();
    if (mediaRecorderRef.current?.state === 'recording') {
      recordingCancelledRef.current = true;
      mediaRecorderRef.current.stop();
    }
    stopMicrophone();
  }, [activeConversation?.conversationId, activeConversation?.otherUsername, clearSelectedAttachment, stopMicrophone]);

  useEffect(() => () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      recordingCancelledRef.current = true;
      mediaRecorderRef.current.stop();
    }
    stopMicrophone();
    if (attachmentPreviewUrl) URL.revokeObjectURL(attachmentPreviewUrl);
  }, [attachmentPreviewUrl, stopMicrophone]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!emojiPickerRef.current?.contains(event.target as Node)) setShowEmojiPicker(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [showEmojiPicker]);

  const insertEmoji = (emoji: string) => {
    const input = messageInputRef.current;
    const start = input?.selectionStart ?? inputText.length;
    const end = input?.selectionEnd ?? start;
    setInputText(`${inputText.slice(0, start)}${emoji}${inputText.slice(end)}`);
    setShowEmojiPicker(false);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const selectAttachment = (file?: File) => {
    if (!file) return;
    setMediaError('');
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const videoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!imageTypes.includes(file.type) && !videoTypes.includes(file.type)) {
      setMediaError('Selecciona una imagen o un video compatible.');
      return;
    }
    const maxBytes = imageTypes.includes(file.type) ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxBytes) {
      setMediaError(`El archivo supera el límite de ${maxBytes / 1024 / 1024} MB.`);
      return;
    }
    clearSelectedAttachment();
    setSelectedAttachment(file);
    setAttachmentPreviewUrl(URL.createObjectURL(file));
  };

  const supportedRecorderMime = () => {
    if (typeof MediaRecorder === 'undefined') return null;
    return ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm']
      .find(type => MediaRecorder.isTypeSupported(type)) || '';
  };

  const startRecording = async () => {
    setMediaError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMediaError('La grabación de audio no está disponible en este navegador.');
      return;
    }
    const mimeType = supportedRecorderMime();
    if (mimeType === null) {
      setMediaError('La grabación de audio no está disponible en este navegador.');
      return;
    }
    try {
      clearSelectedAttachment();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      microphoneStreamRef.current = stream;
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recordingCancelledRef.current = false;
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;
      recorder.ondataavailable = event => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        if (recordingCancelledRef.current) {
          recordingChunksRef.current = [];
          stopMicrophone();
          return;
        }
        const actualMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(recordingChunksRef.current, { type: actualMime });
        if (blob.size > 0) {
          const extension = actualMime.includes('ogg') ? 'ogg' : actualMime.includes('mp4') ? 'm4a' : 'webm';
          const file = new File([blob], `nota-de-voz.${extension}`, { type: actualMime.split(';')[0] });
          setSelectedAttachment(file);
          setAttachmentPreviewUrl(URL.createObjectURL(file));
          setAudioDurationSeconds(Math.max(1, recordingSecondsRef.current));
        }
        stopMicrophone();
      };
      recorder.onerror = () => {
        setMediaError('No se pudo completar la grabación de audio.');
        stopMicrophone();
      };
      recorder.start(250);
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => {
        recordingSecondsRef.current += 1;
        setRecordingSeconds(recordingSecondsRef.current);
      }, 1000);
    } catch (error) {
      console.error('No se pudo acceder al micrófono:', error);
      setMediaError('No se pudo acceder al micrófono. Revisa los permisos del navegador.');
      stopMicrophone();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
  };

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    recordingCancelledRef.current = true;
    if (recorder?.state === 'recording') recorder.stop();
    recordingChunksRef.current = [];
    setRecordingSeconds(0);
    stopMicrophone();
  };

  const sendCurrentMessage = async () => {
    if ((!inputText.trim() && !selectedAttachment) || !activeConversation || isRecording) return;

    const content = inputText.trim();
    setIsTyping(false);
    sendTypingSignal(false);
    setChatError('');
    if (selectedAttachment) setIsSendingAttachment(true);

    try {
      if (selectedAttachment) {
        const formData = new FormData();
        if (content) formData.append('content', content);
        formData.append('file', selectedAttachment);
        if (audioDurationSeconds != null) formData.append('durationSeconds', String(audioDurationSeconds));
        const endpoint = activeConversation.isDraft || !activeConversation.conversationId
          ? `/chat/direct/${encodeURIComponent(activeConversation.otherUsername || '')}/messages/media`
          : `/chat/conversations/${activeConversation.conversationId}/messages/media`;
        const res = await api.post(endpoint, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        const message = res.data.message || res.data;
        const conversationId = res.data.conversationId || activeConversation.conversationId;
        setMessages(prev => prev.some(item => item.messageId === message.messageId) ? prev : [...prev, message]);
        setInputText('');
        clearSelectedAttachment();
        if (activeConversation.isDraft && conversationId) {
          const refreshed = await fetchConversations();
          const real = refreshed.find(c => c.conversationId === conversationId);
          if (real) setActiveConversation(real);
        }
      } else if (activeConversation.isDraft || !activeConversation.conversationId) {
        const res = await api.post(`/chat/direct/${encodeURIComponent(activeConversation.otherUsername || '')}/messages`, { content, messageType: 'TEXT' });
        const conversationId = res.data.conversationId as string;
        setMessages([res.data.message]);
        setInputText('');
        const refreshed = await fetchConversations();
        const real = refreshed.find(c => c.conversationId === conversationId);
        if (real) setActiveConversation(real);
      } else {
        const res = await api.post(`/chat/conversations/${activeConversation.conversationId}/messages`, { content, messageType: 'TEXT' });
        setInputText('');
        setMessages(prev => prev.some(m => m.messageId === res.data.messageId) ? prev : [...prev, res.data]);
      }
    } catch (err: any) {
      console.error('Error al enviar mensaje:', err);
      setChatError(selectedAttachment?.type.startsWith('audio/')
        ? 'No se pudo enviar el audio. Reintentar.'
        : err.response?.data?.message || 'No se pudo enviar el mensaje. Puedes reintentar.');
    } finally {
      setIsSendingAttachment(false);
    }
  };

  const handleSendMessage = (event: React.FormEvent) => {
    event.preventDefault();
    void sendCurrentMessage();
  };

  const handleCreateNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUsername.trim()) return;

    try {
      const existing = conversations.find(c => c.otherUsername?.toLowerCase() === searchUsername.trim().toLowerCase());
      const next = existing || await createDraft(searchUsername);
      setIsNewChatModalOpen(false);
      setSearchUsername('');
      setActiveConversation(next);
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

  const triggerCall = (mode: CallMode) => {
    if (!activeConversation || activeConversation.isGroup || !activeConversation.otherUsername) return;
    setActiveCallUsername(activeConversation.otherUsername || null);
    setIsIncomingCall(false);
    setActiveCallMode(mode);
    setIncomingOfferSdp(null);
  };

  const handleDeleteConversation = async () => {
    if (!deleteConversationId) return;
    setIsDeletingConversation(true);
    setChatError('');
    try {
      await api.delete(`/chat/conversations/${deleteConversationId}`);
      setConversations(prev => prev.filter(c => c.conversationId !== deleteConversationId));
      if (activeConversation?.conversationId === deleteConversationId) {
        setActiveConversation(null);
        setMessages([]);
      }
      setDeleteConversationId(null);
      setConversationMenuId(null);
    } catch (err: any) {
      console.error('Error al eliminar chat:', err);
      setChatError(err.response?.data?.message || 'No se pudo eliminar la conversación.');
    } finally {
      setIsDeletingConversation(false);
    }
  };

  const totalUnreadAll = conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0);

  return (
    <main className="min-h-[100dvh] h-[100dvh] bg-[#eef4f4] dark:bg-[#061217] text-slate-800 dark:text-slate-100 flex items-stretch justify-stretch p-0 select-none overflow-hidden font-sans transition-colors duration-200 lg:p-4">
      <div className="mx-auto w-full h-full max-w-[1500px] border-none overflow-hidden flex relative bg-white dark:bg-[#07151d] lg:rounded-[28px] lg:border lg:border-slate-200 lg:dark:border-cyan-950/70 lg:shadow-2xl">
        
        {/* ================= FAR LEFT MINI NAVIGATION ================= */}
        <aside className="hidden lg:flex w-60 bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-slate-800 flex-col justify-between p-4 flex-shrink-0 z-20 shadow-sm">
          <div className="space-y-6">
            {/* SocialTush Brand Logo */}
            <Link href="/feed" className="flex items-center gap-3 px-2 py-1 group">
              <div className="h-10 w-10 rounded-2xl bg-teal-700 flex items-center justify-center text-white font-extrabold shadow-md shadow-teal-700/20 group-hover:scale-105 transition-transform">
                <span className="text-xl">L</span>
              </div>
              <span className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                Lifonk
              </span>
            </Link>

            {/* Navigation Menu */}
            <nav className="space-y-1 text-xs font-semibold">
              <Link href="/feed" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:text-teal-800 dark:hover:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                <Home className="h-4 w-4" />
                <span>Ritmo</span>
              </Link>
              <Link href="/chat" className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-800/30 text-teal-900 dark:text-teal-400 border-l-4 border-teal-700 font-bold shadow-sm">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-4 w-4 text-teal-700 dark:text-teal-400" />
                  <span>Conversaciones</span>
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
                  <Moon className="h-[18px] w-[18px] text-slate-600" />
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
                  <UserAvatar avatarUrl={user?.avatarUrl} name={user?.displayName || user?.username} className="h-9 w-9 rounded-full text-xs shadow-md" />
                  <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-slate-50 dark:border-slate-900" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-extrabold text-slate-900 dark:text-slate-200 block truncate">{user?.username || 'Usuario'}</span>
                  <span className="text-[10px] text-slate-400 block font-semibold">Tu espacio</span>
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
              <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-teal-600">Lifonk</p><h2 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">Conversaciones</h2></div>
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
                  title="Nueva conversación"
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
            <div className="flex bg-slate-100 dark:bg-[#07151d] p-1 rounded-xl border border-slate-200 dark:border-cyan-950/70 text-[11px] font-bold">
              <button 
                onClick={() => setActiveTab('directos')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'directos' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Directos ({conversations.filter(c => !c.isGroup).length})
              </button>
              <button 
                onClick={() => setActiveTab('circulos')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  activeTab === 'circulos' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Círculos
              </button>
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1 bg-[#f4f7f7] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(15,118,110,.12),transparent_38%),#07151d]">
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
                        : 'bg-white/90 dark:bg-transparent border-transparent hover:bg-white dark:hover:bg-cyan-950/35'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      {c.isGroup
                        ? <div className="h-10 w-10 rounded-full bg-teal-700 text-white flex items-center justify-center shadow-sm"><Users className="h-5 w-5 text-teal-100" /></div>
                        : <UserAvatar avatarUrl={c.avatarUrl} name={c.name} className="h-10 w-10 rounded-full text-xs shadow-sm" />}
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
                    <div className="relative">
                      <button type="button" onClick={(event) => { event.stopPropagation(); setConversationMenuId(conversationMenuId === c.conversationId ? null : c.conversationId); }} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white" aria-label="Opciones del chat"><MoreVertical className="h-4 w-4" /></button>
                      {conversationMenuId === c.conversationId && <button type="button" onClick={(event) => { event.stopPropagation(); setDeleteConversationId(c.conversationId); }} className="absolute right-0 top-7 z-30 whitespace-nowrap rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-[11px] font-bold text-rose-600 shadow-xl">Eliminar chat</button>}
                    </div>
                  </div>
                );
              })}

            {conversations.filter(c => activeTab === 'directos' ? !c.isGroup : c.isGroup).length === 0 && (
              <div className="text-center py-20 text-slate-400 dark:text-slate-400 text-xs font-medium">
                No hay conversaciones en esta sección.
              </div>
            )}
          </div>
        </div>

        {/* ================= CENTER MAIN CHAT CANVAS ================= */}
        <div className={`flex-1 flex flex-col justify-between bg-slate-50 dark:bg-[#07151d] relative ${
          !activeConversation ? 'hidden md:flex' : 'flex'
        }`}>
          {activeConversation ? (
            <>
              {/* Main Chat Header */}
              <div className="p-3.5 px-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => { setActiveConversation(null); setMessages([]); setChatError(''); }}
                    className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 md:hidden text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <div className="relative">
                    {activeConversation.isGroup
                      ? <div className="h-10 w-10 rounded-full bg-teal-700 flex items-center justify-center text-white"><Users className="h-5 w-5 text-teal-100" /></div>
                      : <UserAvatar avatarUrl={activeConversation.avatarUrl} name={activeConversation.name} className="h-10 w-10 rounded-full text-xs shadow-sm" />}
                  </div>

                  <div>
                    <h3 className="text-xs font-extrabold text-slate-900 dark:text-white block flex items-center gap-1.5">
                      {activeConversation.name}
                    </h3>
                    <span className="text-[10px] text-teal-700 dark:text-teal-400 block font-semibold">
                      {otherUserTyping ? (
                        <span className="text-teal-700 font-bold animate-pulse">escribiendo...</span>
                      ) : (
                        activeConversation.isGroup ? 'Conversación grupal' : 'Conexión directa'
                      )}
                    </span>
                    {!activeConversation.isGroup && activeConversation.otherUsername && <span className="text-[9px] text-slate-400">@{activeConversation.otherUsername}</span>}
                  </div>
                </div>

                {/* Right Action Icons */}
                <div className="flex items-center gap-2">
                  <button disabled={activeConversation.isGroup || !activeConversation.otherUsername} onClick={() => triggerCall('AUDIO')} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors" title="Llamada de voz">
                    <Phone className="h-4 w-4" />
                  </button>
                  <button disabled={activeConversation.isGroup || !activeConversation.otherUsername} onClick={() => triggerCall('VIDEO')} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 disabled:opacity-40 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors" title="Videollamada">
                    <Video className="h-4 w-4" />
                  </button>
                  <button onClick={() => setShowRightPanel(!showRightPanel)} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors" title="Detalles">
                    <Info className="h-4 w-4" />
                  </button>
                  {!activeConversation.isDraft && <button onClick={() => setDeleteConversationId(activeConversation.conversationId)} className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600" title="Opciones"><MoreVertical className="h-4 w-4" /></button>}
                </div>
              </div>

              {/* Chat Messages Area */}
              <div className="flex-1 p-4 md:p-6 overflow-y-auto space-y-4 bg-[radial-gradient(circle_at_80%_10%,rgba(20,184,166,.08),transparent_25%),radial-gradient(circle_at_20%_60%,rgba(14,116,144,.07),transparent_30%)] dark:bg-[radial-gradient(circle_at_75%_15%,rgba(20,184,166,.10),transparent_26%),radial-gradient(circle_at_20%_65%,rgba(8,47,73,.45),transparent_32%),#07151d]">
                {/* Date separator */}
                <div className="flex items-center justify-center my-2">
                  <span className="px-3 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-teal-800 dark:text-teal-400 shadow-sm">
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
                          <strong className="text-[10px] text-teal-700 dark:text-teal-400 block mb-1">@{m.senderUsername}</strong>
                        )}
                        {m.attachments?.map(attachment => (
                          <div key={attachment.id} className={m.content ? 'mb-2' : ''}>
                            {attachment.fileType === 'IMAGE' && (
                              failedAttachmentUrls[attachment.fileUrl]
                                ? <div className="rounded-xl bg-slate-200/60 p-6 text-center text-[10px] text-slate-500 dark:bg-slate-800">No se pudo cargar la imagen.</div>
                                : <button type="button" onClick={() => setFullscreenImageUrl(attachment.fileUrl)} className="block overflow-hidden rounded-xl bg-black/10">
                                    <img src={attachment.fileUrl} alt={attachment.fileName || 'Imagen adjunta'} className="max-h-72 w-full object-contain" onError={() => setFailedAttachmentUrls(previous => ({ ...previous, [attachment.fileUrl]: true }))} />
                                  </button>
                            )}
                            {attachment.fileType === 'VIDEO' && <video src={attachment.fileUrl} controls playsInline preload="metadata" className="max-h-72 w-full rounded-xl bg-black" />}
                            {attachment.fileType === 'AUDIO' && (
                              <div className="min-w-52">
                                <audio src={attachment.fileUrl} controls preload="metadata" className="w-full" />
                                {attachment.durationSeconds != null && <span className="mt-1 block text-[9px] opacity-75">{attachment.durationSeconds} s</span>}
                              </div>
                            )}
                          </div>
                        ))}
                        {m.content && <p className="whitespace-pre-wrap">{m.content}</p>}
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 px-1">
                        <span className="text-[9px] text-slate-400 font-medium">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isOwn && (
                          <span className="flex items-center gap-1 text-[9px] font-semibold text-slate-400">
                            <CheckCheck className={`h-3.5 w-3.5 ${m.readReceiptVisible && m.readByRecipient ? 'text-teal-600' : 'text-slate-400'}`} />
                            {m.readReceiptVisible && m.readByRecipient ? 'Leído' : 'Enviado'}
                          </span>
                        )}
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
              {chatError && <div role="alert" className="mx-4 mb-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">{chatError}</div>}
              {mediaError && <div role="alert" className="mx-4 mb-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">{mediaError}</div>}
              {isRecording && (
                <div className="mx-4 mb-2 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs dark:border-rose-900 dark:bg-rose-950/40">
                  <span className="font-bold text-rose-700 dark:text-rose-300">Grabando… {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={cancelRecording} className="rounded-lg px-3 py-1.5 font-bold text-slate-600 dark:text-slate-300">Cancelar</button>
                    <button type="button" onClick={stopRecording} className="rounded-lg bg-rose-600 px-3 py-1.5 font-bold text-white">Detener</button>
                  </div>
                </div>
              )}
              {selectedAttachment && attachmentPreviewUrl && (
                <div className="mx-4 mb-2 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                  {selectedAttachment.type.startsWith('image/') && <img src={attachmentPreviewUrl} alt="Vista previa" className="h-16 w-16 rounded-lg object-cover" />}
                  {selectedAttachment.type.startsWith('video/') && <video src={attachmentPreviewUrl} className="h-16 w-24 rounded-lg object-cover" muted playsInline />}
                  {selectedAttachment.type.startsWith('audio/') && <audio src={attachmentPreviewUrl} controls className="h-10 flex-1" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-100">{selectedAttachment.name}</p>
                    <p className="text-[10px] text-slate-500">{(selectedAttachment.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button type="button" disabled={isSendingAttachment} onClick={clearSelectedAttachment} className="rounded-lg p-2 text-slate-500 hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-800" aria-label="Quitar archivo"><X className="h-4 w-4" /></button>
                  {selectedAttachment.type.startsWith('audio/') && (
                    <button
                      type="button"
                      disabled={isSendingAttachment}
                      onClick={() => void sendCurrentMessage()}
                      className="ml-auto inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {isSendingAttachment ? 'Enviando…' : 'Enviar audio'} <Send className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
              <div 
                className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] shadow-sm flex items-center gap-3"
                style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
              >
                <button type="button" onClick={() => attachmentInputRef.current?.click()} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-all" aria-label="Adjuntar foto o video">
                  <Plus className="h-4 w-4" />
                </button>
                <input ref={attachmentInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" className="hidden" onChange={event => selectAttachment(event.target.files?.[0])} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={event => selectAttachment(event.target.files?.[0])} />

                <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2">
                  <div className="flex-grow relative flex items-center">
                    <input
                      ref={messageInputRef}
                      type="text" 
                      value={inputText}
                      onChange={handleInputChange}
                      placeholder="Escribe un mensaje..."
                      className="w-full pl-4 pr-24 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-700 transition-all"
                    />
                    <div className="absolute right-3 flex items-center gap-2 text-slate-400">
                      <div className="relative" ref={emojiPickerRef}>
                        <button type="button" onClick={() => setShowEmojiPicker(value => !value)} className="hover:text-teal-700 transition-colors" aria-label="Elegir emoji"><Smile className="h-4 w-4" /></button>
                        {showEmojiPicker && (
                          <div className="absolute bottom-9 right-0 z-50 grid w-52 grid-cols-6 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                            {CHAT_EMOJIS.map(emoji => <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="rounded-lg p-1.5 text-lg hover:bg-slate-100 dark:hover:bg-slate-800">{emoji}</button>)}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => attachmentInputRef.current?.click()} className="hover:text-teal-700 transition-colors" aria-label="Elegir foto o video"><ImageIcon className="h-4 w-4" /></button>
                      <button type="button" onClick={() => cameraInputRef.current?.click()} className="hover:text-teal-700 transition-colors" aria-label="Tomar una foto"><Camera className="h-4 w-4" /></button>
                      <button type="button" disabled={isRecording} onClick={startRecording} className="hover:text-teal-700 transition-colors disabled:opacity-40" aria-label="Grabar nota de voz"><Mic className="h-4 w-4" /></button>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={isRecording || isSendingAttachment || (!inputText.trim() && !selectedAttachment)}
                    className="p-2.5 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold active:scale-95 transition-all shadow-md flex items-center justify-center disabled:opacity-40"
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
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">Tus Conexiones Lifonk</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                  Selecciona una conversación o inicia una nueva para comenzar.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ================= RIGHT DETAILS & CONNECTION PANEL ================= */}
        {activeConversation && showRightPanel && (
          <aside className="hidden xl:flex w-72 bg-white dark:bg-[#07151d] border-l border-slate-200 dark:border-cyan-950/70 flex-col p-4 flex-shrink-0 z-20 space-y-5 overflow-y-auto shadow-sm">
            {/* User Details Header */}
            <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
              <div className="relative mx-auto w-16 h-16">
                <UserAvatar avatarUrl={activeConversation.avatarUrl} name={activeConversation.name} className="w-full h-full rounded-full text-lg shadow-md" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">{activeConversation.name}</h4>
                <span className="text-[10px] text-teal-700 dark:text-teal-400 font-semibold">@{activeConversation.otherUsername || activeConversation.name}</span>
              </div>
              {!activeConversation.isGroup && activeConversation.otherUsername && <Link href={`/profile/${encodeURIComponent(activeConversation.otherUsername)}`} className="block rounded-xl border border-slate-200 py-2 text-xs font-bold text-slate-700 dark:border-cyan-950 dark:text-slate-200">Ver espacio</Link>}
            </div>
            {!activeConversation.isGroup && activeConversation.otherUsername && <div className="grid grid-cols-2 gap-2"><button onClick={() => triggerCall('AUDIO')} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-700 dark:border-cyan-950 dark:bg-[#0b2028] dark:text-slate-200"><Phone className="mx-auto mb-1 h-4 w-4"/>Llamar</button><button onClick={() => triggerCall('VIDEO')} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-700 dark:border-cyan-950 dark:bg-[#0b2028] dark:text-slate-200"><Video className="mx-auto mb-1 h-4 w-4"/>Video</button></div>}
            {!activeConversation.isDraft && <button onClick={() => setDeleteConversationId(activeConversation.conversationId)} className="mt-auto rounded-xl border border-rose-200 px-4 py-3 text-left text-xs font-bold text-rose-600 dark:border-rose-950">Eliminar conversación</button>}
          </aside>
        )}

      </div>

      {/* ================= MODALS ================= */}
      {fullscreenImageUrl && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4" onClick={() => setFullscreenImageUrl(null)}>
          <button type="button" onClick={() => setFullscreenImageUrl(null)} className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white" aria-label="Cerrar imagen"><X className="h-5 w-5" /></button>
          <img src={fullscreenImageUrl} alt="Imagen adjunta ampliada" className="max-h-[90dvh] max-w-full object-contain" onClick={event => event.stopPropagation()} />
        </div>
      )}
      {/* New Chat Modal */}
      {isNewChatModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Nueva conversación</h3>
              <button onClick={() => setIsNewChatModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-700"
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
              <button onClick={() => setIsNewGroupModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-700"
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-700"
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

      {deleteConversationId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => !isDeletingConversation && setDeleteConversationId(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-5 space-y-4 shadow-2xl" onClick={event => event.stopPropagation()}>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">¿Eliminar este chat?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Se eliminará de tus mensajes. La otra persona conservará su conversación.</p>
            {chatError && <p role="alert" className="text-xs text-rose-600">{chatError}</p>}
            <div className="flex gap-3">
              <button disabled={isDeletingConversation} onClick={() => setDeleteConversationId(null)} className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 py-2.5 text-xs font-bold">Cancelar</button>
              <button disabled={isDeletingConversation} onClick={handleDeleteConversation} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">{isDeletingConversation ? 'Eliminando...' : 'Eliminar'}</button>
            </div>
          </div>
        </div>
      )}

      {/* WebRTC Video Call Overlay Modal */}
      {activeCallUsername && (
        <CallModal 
          recipientUsername={activeCallUsername}
          isIncoming={isIncomingCall}
          callMode={activeCallMode}
          initialOfferSdp={incomingOfferSdp}
          stompClientRef={stompClient}
          onClose={() => {
            setActiveCallUsername(null);
            setIsIncomingCall(false);
            setIncomingOfferSdp(null);
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
          <span className="text-teal-800 dark:text-teal-400 text-sm font-semibold">Cargando conversaciones...</span>
        </div>
      </div>
    }>
      <ChatContent />
    </Suspense>
  );
}
