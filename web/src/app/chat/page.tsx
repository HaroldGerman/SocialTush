'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Client } from '@stomp/stompjs';
import {
  Bookmark, Camera, CheckCheck, ChevronLeft, Eye, Home, Image as ImageIcon, Info,
  MessageSquare, Mic, Moon, MoreVertical, Phone, Plus, Search, Send, Smile, Sun,
  Users, Video, X
} from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { WS_BASE_URL } from '@/config/api';
import MobileBottomBar from '@/components/MobileBottomBar';
import CallModal, { CallMode } from '@/components/CallModal';
import UserAvatar from '@/components/UserAvatar';
import { useRealtimeActivity } from '@/context/RealtimeActivityContext';

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
  isPinned?: boolean;
  pinnedAt?: string;
  nickname?: string;
  notificationsMuted?: boolean;
  mutedUntil?: string;
  chatTheme?: 'DEFAULT' | 'DEEP_TEAL' | 'OCEAN' | 'FOREST' | 'NIGHT';
}

interface Message {
  messageId: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl: string;
  content: string;
  messageType: string;
  storyPreviewId?: string;
  storyPreview?: {
    storyId: string;
    mediaType?: 'IMAGE' | 'VIDEO' | 'TEXT';
    mediaUrl?: string;
    textContent?: string;
    backgroundColor?: string;
    createdAt?: string;
    available: boolean;
  };
  createdAt: string;
  attachments?: MessageAttachment[];
  readByRecipient?: boolean;
  readReceiptVisible?: boolean;
  reactions?: Array<{ emoji: string; count: number; reactedByMe: boolean }>;
}

interface MessageAttachment {
  id: string;
  fileUrl: string;
  fileType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'STICKER' | 'GIF' | 'VIEW_ONCE_IMAGE' | 'VIEW_ONCE_IMAGE_VIEWED';
  fileName: string;
  fileSize: number;
  durationSeconds?: number;
  viewOnce?: boolean;
  viewed?: boolean;
}

const CHAT_EMOJIS = ['😊', '😂', '❤️', '😭', '🔥', '👍', '👎', '🎉', '😮', '🙏', '💀'];
const MESSAGE_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👍'];

function ChatContent() {
  const { user, isLoading, accessToken } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { markConversationReadLocal } = useRealtimeActivity();
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetUsername = searchParams?.get('username') || null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [activeTab, setActiveTab] = useState<'directos' | 'circulos'>('directos');
  const [filterCategory, setFilterCategory] = useState<'todos' | 'noleidos' | 'ancladas' | 'recientes'>('todos');
  const [conversationSearch, setConversationSearch] = useState('');
  const [chatError, setChatError] = useState('');
  const [conversationMenuId, setConversationMenuId] = useState<string | null>(null);
  const [deleteConversationId, setDeleteConversationId] = useState<string | null>(null);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<File | null>(null);
  const [attachmentPreviewUrl, setAttachmentPreviewUrl] = useState<string | null>(null);
  const [fullscreenImageUrl, setFullscreenImageUrl] = useState<string | null>(null);
  const [viewOnceSelected, setViewOnceSelected] = useState(false);
  const [viewOnceFullscreen, setViewOnceFullscreen] = useState<string | null>(null);
  const [openingViewOnceAttachmentId, setOpeningViewOnceAttachmentId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioDurationSeconds, setAudioDurationSeconds] = useState<number | null>(null);
  const [mediaError, setMediaError] = useState('');
  const [failedAttachmentUrls, setFailedAttachmentUrls] = useState<Record<string, boolean>>({});
  const [isSendingAttachment, setIsSendingAttachment] = useState(false);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [messageSearchResults, setMessageSearchResults] = useState<Message[]>([]);
  const [presence, setPresence] = useState<{ online: boolean; lastSeenAt?: string; onlineVisible: boolean; lastSeenVisible: boolean } | null>(null);
  const [commonCircles, setCommonCircles] = useState<Array<{ slug: string; name: string; avatarUrl?: string }>>([]);
  const [activeCallUsername, setActiveCallUsername] = useState<string | null>(null);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [activeCallMode, setActiveCallMode] = useState<CallMode>('AUDIO');
  const [incomingOfferSdp, setIncomingOfferSdp] = useState<string | null>(null);
  const [stompConnected, setStompConnected] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false);
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
  const activeUsernameRef = useRef<string | undefined>();

  useEffect(() => { activeUsernameRef.current = activeConversation?.otherUsername; }, [activeConversation?.otherUsername]);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = { html: html.style.overflow, body: body.style.overflow, position: body.style.position, width: body.style.width, height: body.style.height };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.width = '100%';
    body.style.height = '100%';
    return () => {
      html.style.overflow = previous.html;
      body.style.overflow = previous.body;
      body.style.position = previous.position;
      body.style.width = previous.width;
      body.style.height = previous.height;
    };
  }, []);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [user, isLoading, router]);

  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${Math.max(1, diff)} s`;
    if (diff < 3600) return `${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
    return `${Math.floor(diff / 86400)} d`;
  };

  const fetchConversations = useCallback(async () => {
    try {
      const response = await api.get('/chat/conversations');
      const data = response.data || [];
      setConversations(data);
      return data as Conversation[];
    } catch (error) {
      console.error('Error al cargar conversaciones:', error);
      setConversations([]);
      return [];
    }
  }, []);

  const createDraft = useCallback(async (username: string): Promise<Conversation> => {
    const response = await api.get(`/profiles/${encodeURIComponent(username.trim())}`);
    const profile = response.data;
    return {
      conversationId: null,
      isDraft: true,
      name: profile.displayName || profile.username,
      avatarUrl: profile.avatarUrl || '',
      isGroup: false,
      latestMessage: '',
      updatedAt: new Date().toISOString(),
      otherUserId: profile.userId,
      otherUsername: profile.username,
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    void fetchConversations().then(async current => {
      if (!targetUsername) return;
      const existing = current.find(item => item.otherUsername?.toLowerCase() === targetUsername.trim().toLowerCase());
      if (existing) setActiveConversation(existing);
      else {
        try { setActiveConversation(await createDraft(targetUsername)); }
        catch { setChatError('No pudimos abrir esta conversación. Verifica el usuario.'); }
      }
    });
  }, [user, targetUsername, fetchConversations, createDraft]);

  useEffect(() => {
    if (!user) return;
    const client = new Client({
      brokerURL: WS_BASE_URL,
      connectHeaders: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });
    client.onConnect = () => {
      setStompConnected(true);
      client.subscribe(`/topic/user.${user.username}.call`, frame => {
        const signal = JSON.parse(frame.body);
        if (signal.type === 'OFFER') {
          setActiveCallUsername(signal.senderUsername);
          setIsIncomingCall(true);
          setActiveCallMode(signal.callMode === 'VIDEO' ? 'VIDEO' : 'AUDIO');
          setIncomingOfferSdp(signal.sdp || null);
        }
      });
      client.subscribe('/topic/presence', frame => {
        const event = JSON.parse(frame.body);
        if (event.type === 'PRESENCE_CHANGED' && event.username?.toLowerCase() === activeUsernameRef.current?.toLowerCase()) {
          setPresence(previous => ({ online: Boolean(event.online), lastSeenAt: event.lastSeenAt || previous?.lastSeenAt, onlineVisible: true, lastSeenVisible: Boolean(event.lastSeenAt) }));
        }
      });
    };
    client.onDisconnect = () => setStompConnected(false);
    client.onStompError = () => setStompConnected(false);
    client.activate();
    stompClient.current = client;
    return () => { void client.deactivate(); };
  }, [user, accessToken]);

  useEffect(() => {
    if (!activeConversation?.otherUsername) return setPresence(null);
    void api.get(`/chat/presence/${encodeURIComponent(activeConversation.otherUsername)}`).then(response => setPresence(response.data)).catch(() => setPresence(null));
  }, [activeConversation?.otherUsername]);

  useEffect(() => {
    setNicknameDraft(activeConversation?.nickname || '');
    setMessageSearch('');
    setMessageSearchResults([]);
  }, [activeConversation?.conversationId, activeConversation?.nickname]);

  useEffect(() => {
    if (!user?.username || !activeConversation?.otherUsername) return setCommonCircles([]);
    void Promise.all([api.get(`/circles/user/${encodeURIComponent(user.username)}`), api.get(`/circles/user/${encodeURIComponent(activeConversation.otherUsername)}`)])
      .then(([mine, theirs]) => {
        const ownSlugs = new Set((mine.data || []).map((circle: { slug: string }) => circle.slug));
        setCommonCircles((theirs.data || []).filter((circle: { slug: string }) => ownSlugs.has(circle.slug)));
      }).catch(() => setCommonCircles([]));
  }, [user?.username, activeConversation?.otherUsername]);

  const markConversationRead = useCallback(async (conversationId: string) => {
    try {
      await api.patch(`/chat/conversations/${conversationId}/read`);
      setConversations(previous => previous.map(item => item.conversationId === conversationId ? { ...item, unreadCount: 0 } : item));
      markConversationReadLocal(conversationId);
    } catch (error) {
      console.error('No se pudo marcar la conversación como leída:', error);
    }
  }, [markConversationReadLocal]);

  const scrollToBottom = () => window.setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

  useEffect(() => {
    const conversationId = activeConversation?.conversationId;
    if (!conversationId || activeConversation?.isDraft) {
      setMessages([]);
      return;
    }
    void api.get(`/chat/conversations/${conversationId}/messages`).then(response => {
      setMessages(response.data?.content || response.data || []);
      void markConversationRead(conversationId);
      scrollToBottom();
    }).catch(() => setMessages([]));

    const client = stompClient.current;
    if (!client || !stompConnected) return;
    const subscription = client.subscribe(`/topic/conversation.${conversationId}`, frame => {
      const body = JSON.parse(frame.body);
      if (body.type === 'TYPING') {
        if (body.senderUsername !== user?.username) setOtherUserTyping(body.content === 'true');
        return;
      }
      if (body.type === 'VIEW_ONCE_CONSUMED') {
        setMessages(previous => previous.map(message => message.messageId !== body.messageId ? message : {
          ...message,
          attachments: message.attachments?.map(attachment => attachment.id === body.attachmentId
            ? { ...attachment, fileUrl: '', fileType: 'VIEW_ONCE_IMAGE_VIEWED', viewed: true }
            : attachment),
        }));
        return;
      }
      if (body.type === 'READ_RECEIPT') {
        if (body.readerUsername?.toLowerCase() !== user?.username?.toLowerCase()) {
          setMessages(previous => {
            const lastRead = previous.find(item => item.messageId === body.lastReadMessageId);
            if (!lastRead) return previous;
            const cutoff = new Date(lastRead.createdAt).getTime();
            return previous.map(item => item.senderUsername?.toLowerCase() === user?.username?.toLowerCase() && item.readReceiptVisible && new Date(item.createdAt).getTime() <= cutoff
              ? { ...item, readByRecipient: true }
              : item);
          });
        }
        return;
      }
      if (body.type === 'MESSAGE_REACTION_UPDATED') {
        void api.get(`/chat/conversations/${conversationId}/messages`).then(response => setMessages(response.data?.content || response.data || []));
        return;
      }
      if (body.messageId) {
        setMessages(previous => previous.some(item => item.messageId === body.messageId) ? previous : [...previous, body]);
        if (body.senderUsername?.toLowerCase() !== user?.username?.toLowerCase() && document.visibilityState === 'visible') void markConversationRead(conversationId);
        scrollToBottom();
      }
    });
    return () => subscription.unsubscribe();
  }, [activeConversation?.conversationId, activeConversation?.isDraft, stompConnected, markConversationRead, user?.username]);

  useEffect(() => {
    const conversationId = activeConversation?.conversationId;
    if (!conversationId || activeConversation?.isDraft) return;
    const handler = () => { if (document.visibilityState === 'visible') void markConversationRead(conversationId); };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [activeConversation?.conversationId, activeConversation?.isDraft, markConversationRead]);

  const toggleReaction = async (message: Message, emoji: string) => {
    try {
      const mine = message.reactions?.find(reaction => reaction.reactedByMe);
      if (mine?.emoji === emoji) await api.delete(`/chat/messages/${message.messageId}/reaction`);
      else await api.put(`/chat/messages/${message.messageId}/reaction`, { emoji });
      if (activeConversation?.conversationId) {
        const response = await api.get(`/chat/conversations/${activeConversation.conversationId}/messages`);
        setMessages(response.data?.content || response.data || []);
      }
      setReactionPickerMessageId(null);
    } catch { setChatError('No se pudo actualizar la reacción.'); }
  };

  const togglePin = async () => {
    if (!activeConversation?.conversationId) return;
    try {
      if (activeConversation.isPinned) await api.delete(`/chat/conversations/${activeConversation.conversationId}/pin`);
      else await api.patch(`/chat/conversations/${activeConversation.conversationId}/pin`);
      await fetchConversations();
      setActiveConversation(previous => previous ? { ...previous, isPinned: !previous.isPinned } : previous);
    } catch { setChatError('No se pudo cambiar el anclado.'); }
  };

  const saveNickname = async () => {
    if (!activeConversation?.conversationId) return;
    try {
      await api.patch(`/chat/conversations/${activeConversation.conversationId}/nickname`, { nickname: nicknameDraft });
      await fetchConversations();
      setActiveConversation(previous => previous ? { ...previous, name: nicknameDraft.trim() || previous.name, nickname: nicknameDraft.trim() || undefined } : previous);
    } catch { setChatError('No se pudo guardar el apodo.'); }
  };

  const updateConversationPreferences = async (values: { notificationsMuted?: boolean; mutedUntil?: string | null; chatTheme?: string }) => {
    if (!activeConversation?.conversationId) return;
    try {
      const response = await api.patch(`/chat/conversations/${activeConversation.conversationId}/preferences`, values);
      setActiveConversation(previous => previous ? { ...previous, ...response.data } : previous);
      await fetchConversations();
    } catch { setChatError('No se pudieron guardar los ajustes de la conversación.'); }
  };

  const searchInsideConversation = async () => {
    if (!activeConversation?.conversationId || messageSearch.trim().length < 2) return;
    try {
      const response = await api.get(`/chat/conversations/${activeConversation.conversationId}/messages/search`, { params: { q: messageSearch.trim() } });
      setMessageSearchResults(response.data?.content || []);
    } catch { setChatError('No se pudo buscar en la conversación.'); }
  };

  const sendTypingSignal = (state: boolean) => {
    if (stompClient.current && stompConnected && activeConversation?.conversationId && !activeConversation.isDraft) {
      stompClient.current.publish({ destination: '/app/chat.typing', body: JSON.stringify({ conversationId: activeConversation.conversationId, senderUsername: user?.username, content: state ? 'true' : 'false' }) });
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(event.target.value);
    if (!isTyping) { setIsTyping(true); sendTypingSignal(true); }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => { setIsTyping(false); sendTypingSignal(false); }, 2000);
  };

  const stopMicrophone = useCallback(() => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    microphoneStreamRef.current?.getTracks().forEach(track => track.stop());
    microphoneStreamRef.current = null;
    mediaRecorderRef.current = null;
    setIsRecording(false);
  }, []);

  const clearSelectedAttachment = useCallback(() => {
    setSelectedAttachment(null);
    setAudioDurationSeconds(null);
    setViewOnceSelected(false);
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
  }, [stopMicrophone]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (event: MouseEvent) => { if (!emojiPickerRef.current?.contains(event.target as Node)) setShowEmojiPicker(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showEmojiPicker]);

  const insertEmoji = (emoji: string) => {
    const input = messageInputRef.current;
    const start = input?.selectionStart ?? inputText.length;
    const end = input?.selectionEnd ?? start;
    setInputText(`${inputText.slice(0, start)}${emoji}${inputText.slice(end)}`);
    setShowEmojiPicker(false);
    requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + emoji.length, start + emoji.length); });
  };

  const selectAttachment = (file?: File) => {
    if (!file) return;
    setMediaError('');
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const videoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!imageTypes.includes(file.type) && !videoTypes.includes(file.type)) return setMediaError('Selecciona una imagen o un video compatible.');
    const maxBytes = imageTypes.includes(file.type) ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxBytes) return setMediaError(`El archivo supera el límite de ${maxBytes / 1024 / 1024} MB.`);
    clearSelectedAttachment();
    setSelectedAttachment(file);
    setAttachmentPreviewUrl(URL.createObjectURL(file));
    setViewOnceSelected(false);
  };

  const supportedRecorderMime = () => {
    if (typeof MediaRecorder === 'undefined') return null;
    return ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported(type)) || '';
  };

  const startRecording = async () => {
    setMediaError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return setMediaError('La grabación de audio no está disponible en este navegador.');
    const mimeType = supportedRecorderMime();
    if (mimeType === null) return setMediaError('La grabación de audio no está disponible en este navegador.');
    try {
      clearSelectedAttachment();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      microphoneStreamRef.current = stream;
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recordingChunksRef.current = [];
      recordingCancelledRef.current = false;
      recordingSecondsRef.current = 0;
      setRecordingSeconds(0);
      recorder.ondataavailable = event => { if (event.data.size > 0) recordingChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        if (recordingCancelledRef.current) { recordingChunksRef.current = []; stopMicrophone(); return; }
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
      recorder.onerror = () => { setMediaError('No se pudo completar la grabación de audio.'); stopMicrophone(); };
      recorder.start(250);
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => { recordingSecondsRef.current += 1; setRecordingSeconds(recordingSecondsRef.current); }, 1000);
    } catch {
      setMediaError('No se pudo acceder al micrófono. Revisa los permisos del navegador.');
      stopMicrophone();
    }
  };

  const stopRecording = () => { if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop(); };
  const cancelRecording = () => {
    recordingCancelledRef.current = true;
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    recordingChunksRef.current = [];
    setRecordingSeconds(0);
    stopMicrophone();
  };

  const persistDraftConversation = async (conversationId: string) => {
    const refreshed = await fetchConversations();
    const real = refreshed.find(item => item.conversationId === conversationId);
    if (real) setActiveConversation(real);
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
        const useViewOnce = viewOnceSelected && selectedAttachment.type.startsWith('image/') && !activeConversation.isGroup;
        const endpoint = useViewOnce
          ? (activeConversation.isDraft || !activeConversation.conversationId
            ? `/chat/view-once/direct/${encodeURIComponent(activeConversation.otherUsername || '')}/messages`
            : `/chat/view-once/conversations/${activeConversation.conversationId}/messages`)
          : (activeConversation.isDraft || !activeConversation.conversationId
            ? `/chat/direct/${encodeURIComponent(activeConversation.otherUsername || '')}/messages/media`
            : `/chat/conversations/${activeConversation.conversationId}/messages/media`);
        const response = await api.post(endpoint, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        const message = response.data.message || response.data;
        const conversationId = response.data.conversationId || activeConversation.conversationId;
        setMessages(previous => previous.some(item => item.messageId === message.messageId) ? previous : [...previous, message]);
        setInputText('');
        clearSelectedAttachment();
        if (activeConversation.isDraft && conversationId) await persistDraftConversation(conversationId);
      } else if (activeConversation.isDraft || !activeConversation.conversationId) {
        const response = await api.post(`/chat/direct/${encodeURIComponent(activeConversation.otherUsername || '')}/messages`, { content, messageType: 'TEXT' });
        setMessages([response.data.message]);
        setInputText('');
        await persistDraftConversation(response.data.conversationId);
      } else {
        const response = await api.post(`/chat/conversations/${activeConversation.conversationId}/messages`, { content, messageType: 'TEXT' });
        setInputText('');
        setMessages(previous => previous.some(item => item.messageId === response.data.messageId) ? previous : [...previous, response.data]);
      }
    } catch (error: any) {
      setChatError(selectedAttachment?.type.startsWith('audio/')
        ? 'No se pudo enviar el audio. Reintenta.'
        : error.response?.data?.message || 'No se pudo enviar el mensaje. Puedes reintentar.');
    } finally {
      setIsSendingAttachment(false);
    }
  };

  const openViewOnce = async (message: Message, attachment: MessageAttachment) => {
    const mine = message.senderUsername?.toLowerCase() === user?.username?.toLowerCase();
    if (mine || attachment.fileType === 'VIEW_ONCE_IMAGE_VIEWED' || openingViewOnceAttachmentId) return;
    setOpeningViewOnceAttachmentId(attachment.id);
    setChatError('');
    try {
      const response = await api.post(`/chat/view-once/attachments/${attachment.id}/open`);
      setViewOnceFullscreen(response.data.fileUrl);
      setMessages(previous => previous.map(item => item.messageId !== message.messageId ? item : {
        ...item,
        attachments: item.attachments?.map(value => value.id === attachment.id ? { ...value, fileUrl: '', fileType: 'VIEW_ONCE_IMAGE_VIEWED', viewed: true } : value),
      }));
    } catch (error: any) {
      if (error.response?.status === 410) {
        setMessages(previous => previous.map(item => item.messageId !== message.messageId ? item : {
          ...item,
          attachments: item.attachments?.map(value => value.id === attachment.id ? { ...value, fileUrl: '', fileType: 'VIEW_ONCE_IMAGE_VIEWED', viewed: true } : value),
        }));
        setChatError('Esta foto ya fue vista.');
      } else setChatError(error.response?.data?.message || 'No se pudo abrir la foto.');
    } finally {
      setOpeningViewOnceAttachmentId(null);
    }
  };

  const handleCreateNewChat = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!searchUsername.trim()) return;
    try {
      const existing = conversations.find(item => item.otherUsername?.toLowerCase() === searchUsername.trim().toLowerCase());
      setActiveConversation(existing || await createDraft(searchUsername));
      setIsNewChatModalOpen(false);
      setSearchUsername('');
    } catch (error: any) { setChatError(error.response?.data?.message || 'Error al iniciar conversación.'); }
  };

  const handleCreateNewGroup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!groupName.trim()) return;
    const participants = groupParticipants.split(',').map(value => value.trim()).filter(Boolean);
    try {
      const response = await api.post('/chat/conversations', { name: groupName.trim(), isGroup: true, participantUsernames: participants });
      const createdName = groupName.trim();
      setIsNewGroupModalOpen(false);
      setGroupName('');
      setGroupParticipants('');
      await fetchConversations();
      setActiveConversation({ conversationId: response.data.conversationId, name: createdName, avatarUrl: '', isGroup: true, latestMessage: '', updatedAt: new Date().toISOString() });
    } catch { setChatError('Error al crear grupo.'); }
  };

  const triggerCall = (mode: CallMode) => {
    if (!activeConversation || activeConversation.isGroup || !activeConversation.otherUsername) return;
    setActiveCallUsername(activeConversation.otherUsername);
    setIsIncomingCall(false);
    setActiveCallMode(mode);
    setIncomingOfferSdp(null);
  };

  const handleDeleteConversation = async () => {
    if (!deleteConversationId) return;
    setIsDeletingConversation(true);
    try {
      await api.delete(`/chat/conversations/${deleteConversationId}`);
      setConversations(previous => previous.filter(item => item.conversationId !== deleteConversationId));
      if (activeConversation?.conversationId === deleteConversationId) { setActiveConversation(null); setMessages([]); }
      setDeleteConversationId(null);
      setConversationMenuId(null);
    } catch (error: any) { setChatError(error.response?.data?.message || 'No se pudo eliminar la conversación.'); }
    finally { setIsDeletingConversation(false); }
  };

  const totalUnreadAll = conversations.reduce((total, item) => total + (item.unreadCount || 0), 0);
  const filteredConversations = conversations.filter(item => {
    if (activeTab === 'directos' && item.isGroup) return false;
    if (activeTab === 'circulos' && !item.isGroup) return false;
    if (filterCategory === 'noleidos' && !(item.unreadCount || 0)) return false;
    if (filterCategory === 'ancladas' && !item.isPinned) return false;
    const query = conversationSearch.trim().toLowerCase();
    return !query || item.name.toLowerCase().includes(query) || item.otherUsername?.toLowerCase().includes(query);
  });
  const recentDirectConversations = conversations.filter(item => !item.isGroup).slice(0, 8);
  const chatThemeBackground: Record<string, string> = {
    DEFAULT: '',
    DEEP_TEAL: 'radial-gradient(circle at 82% 12%, rgba(27,138,128,.16), transparent 28%), linear-gradient(150deg,#080e19,#0a1420)',
    OCEAN: 'radial-gradient(circle at 15% 85%, rgba(14,116,144,.18), transparent 32%), linear-gradient(150deg,#080e19,#0b1422)',
    FOREST: 'radial-gradient(circle at 75% 12%, rgba(22,101,92,.18), transparent 30%), linear-gradient(150deg,#080e19,#0b151d)',
    NIGHT: 'linear-gradient(145deg,#070b13,#101827)',
  };

  return (
    <main className="h-[100dvh] min-h-[100dvh] select-none overflow-hidden overscroll-none bg-[#edf2f4] font-sans text-slate-800 transition-colors dark:bg-[#060a12] dark:text-slate-100 lg:p-4">
      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[1500px] overflow-hidden bg-white dark:bg-[#080e19] lg:rounded-[28px] lg:border lg:border-slate-200 lg:dark:border-[#1b293b] lg:shadow-2xl">
        <aside className="z-20 hidden w-60 flex-shrink-0 flex-col justify-between border-r border-slate-200 bg-white p-4 shadow-sm dark:border-[#1b293b] dark:bg-[#0d1524] lg:flex">
          <div className="space-y-6">
            <Link href="/feed" className="flex items-center gap-3 px-2 py-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#177f76] text-xl font-extrabold text-white shadow-md shadow-[#177f76]/20">L</div>
              <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">Lifonk</span>
            </Link>
            <nav className="space-y-1 text-xs font-semibold">
              <Link href="/feed" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#131e2e]"><Home className="h-4 w-4"/>Ritmo</Link>
              <Link href="/chat" className="flex items-center justify-between rounded-xl border-l-4 border-[#1b8a80] bg-[#1b8a80]/10 px-3 py-2.5 font-bold text-[#136c65] dark:text-[#55c7bb]"><span className="flex items-center gap-3"><MessageSquare className="h-4 w-4"/>Conversaciones</span>{totalUnreadAll > 0 && <span className="rounded-full bg-[#177f76] px-2 py-0.5 text-[10px] text-white">{totalUnreadAll}</span>}</Link>
              <Link href="/circles" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#131e2e]"><Users className="h-4 w-4"/>Círculos</Link>
            </nav>
          </div>
          <button onClick={toggleTheme} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#131e2e]">{theme === 'light' ? <Moon className="h-4 w-4"/> : <Sun className="h-4 w-4 text-amber-400"/>}{theme === 'light' ? 'Usar tema oscuro' : 'Usar tema claro'}</button>
        </aside>

        <div className={`w-full flex-shrink-0 flex-col justify-between border-r border-slate-200 bg-slate-50 dark:border-[#1b293b] dark:bg-[#0b1220] md:w-80 lg:w-80 ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
          <div className="space-y-3 border-b border-slate-200 bg-white p-4 dark:border-[#1b293b] dark:bg-[#0d1524]">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-black uppercase tracking-[.24em] text-[#1b8a80] dark:text-[#48b8ad]">Lifonk</p><h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">Conversaciones</h2></div>
              <div className="flex items-center gap-1.5">
                <button onClick={toggleTheme} className="rounded-xl bg-slate-100 p-2 text-slate-700 dark:bg-[#162033] dark:text-slate-300 md:hidden">{theme === 'light' ? <Moon className="h-4 w-4"/> : <Sun className="h-4 w-4"/>}</button>
                <button onClick={() => setIsNewChatModalOpen(true)} className="rounded-xl border border-[#1b8a80]/40 bg-[#1b8a80]/10 p-2 text-[#177f76] dark:text-[#55c7bb]" title="Nueva conversación"><Plus className="h-4 w-4"/></button>
                <button onClick={() => setIsNewGroupModalOpen(true)} className="rounded-xl border border-[#1b8a80]/40 bg-[#1b8a80]/10 p-2 text-[#177f76] dark:text-[#55c7bb]" title="Crear grupo"><Users className="h-4 w-4"/></button>
              </div>
            </div>
            <label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={conversationSearch} onChange={event => setConversationSearch(event.target.value)} placeholder="Buscar conversaciones…" className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-xs outline-none focus:border-[#1b8a80] dark:border-[#203047] dark:bg-[#09111d] dark:text-white"/></label>
            {recentDirectConversations.length > 0 && <div><p className="mb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">Recientes</p><div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">{recentDirectConversations.map(item => <button key={item.conversationId} onClick={() => setActiveConversation(item)} className="w-12 shrink-0 text-center"><UserAvatar avatarUrl={item.avatarUrl} name={item.name} className="mx-auto h-10 w-10 rounded-full border border-[#2a968b]/60 text-[10px]"/><span className="mt-1 block truncate text-[9px] font-semibold text-slate-600 dark:text-slate-300">{item.name.split(' ')[0]}</span></button>)}</div></div>}
            <div className="flex rounded-2xl border border-slate-200 bg-slate-100 p-1 text-[11px] font-bold dark:border-[#203047] dark:bg-[#09111d]">
              <button onClick={() => setActiveTab('directos')} className={`flex-1 rounded-xl py-2 transition-all ${activeTab === 'directos' ? 'bg-[#177f76] text-white shadow-lg shadow-[#177f76]/15' : 'text-slate-600 dark:text-slate-400'}`}>Directos ({conversations.filter(item => !item.isGroup).length})</button>
              <button onClick={() => setActiveTab('circulos')} className={`flex-1 rounded-xl py-2 transition-all ${activeTab === 'circulos' ? 'bg-[#177f76] text-white shadow-lg shadow-[#177f76]/15' : 'text-slate-600 dark:text-slate-400'}`}>Círculos</button>
            </div>
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none]">{([['todos','Todas'],['noleidos','No leídas'],['ancladas','Ancladas'],['recientes','Recientes']] as const).map(([value,label]) => <button key={value} onClick={() => setFilterCategory(value)} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[10px] font-bold ${filterCategory === value ? 'border-[#1b8a80] bg-[#177f76] text-white' : 'border-slate-200 text-slate-500 dark:border-[#203047] dark:text-slate-400'}`}>{label}</button>)}</div>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto bg-[#f4f7f8] p-3 dark:bg-[#080e19]">
            {filteredConversations.map(item => {
              const hasUnread = (item.unreadCount || 0) > 0;
              let preview = item.latestMessage || '';
              if (item.latestMessageSenderUsername === user?.username) preview = `Tú: ${item.latestMessage}`;
              else if (item.isGroup && item.latestMessageSenderUsername) preview = `${item.latestMessageSenderUsername}: ${item.latestMessage}`;
              return <div key={item.conversationId} onClick={() => setActiveConversation(item)} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-all ${activeConversation?.conversationId === item.conversationId ? 'border-[#2a968b]/40 bg-[#1b8a80]/10 dark:bg-[#10242a]' : 'border-transparent bg-white/90 hover:bg-white dark:bg-transparent dark:hover:bg-[#101827]'}`}>
                {item.isGroup ? <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#177f76] text-white"><Users className="h-5 w-5"/></div> : <UserAvatar avatarUrl={item.avatarUrl} name={item.name} className="h-10 w-10 rounded-full text-xs"/>}
                <div className="min-w-0 flex-1"><div className="flex items-center justify-between"><span className={`truncate text-xs ${hasUnread ? 'font-black text-slate-950 dark:text-white' : 'font-bold text-slate-800 dark:text-slate-200'}`}>{item.isPinned && <Bookmark className="mr-1 inline h-3 w-3 fill-[#1b8a80] text-[#1b8a80]"/>}{item.name}</span><span className="text-[9px] text-slate-400">{formatTimeAgo(item.updatedAt)}</span></div><div className="mt-1 flex items-center justify-between"><span className={`truncate text-[10px] ${hasUnread ? 'font-bold text-[#177f76] dark:text-[#55c7bb]' : 'text-slate-500 dark:text-slate-400'}`}>{preview}</span>{hasUnread && <span className="ml-2 min-w-4 rounded-full bg-[#177f76] px-1.5 py-0.5 text-center text-[9px] font-black text-white">{item.unreadCount}</span>}</div></div>
                <div className="relative"><button onClick={event => { event.stopPropagation(); setConversationMenuId(conversationMenuId === item.conversationId ? null : item.conversationId); }} className="p-1 text-slate-400"><MoreVertical className="h-4 w-4"/></button>{conversationMenuId === item.conversationId && <div className="absolute right-0 top-7 z-30 min-w-44 overflow-hidden rounded-xl border border-slate-200 bg-white text-[11px] font-bold shadow-xl dark:border-[#203047] dark:bg-[#101827]"><button onClick={async event => { event.stopPropagation(); item.isPinned ? await api.delete(`/chat/conversations/${item.conversationId}/pin`) : await api.patch(`/chat/conversations/${item.conversationId}/pin`); await fetchConversations(); setConversationMenuId(null); }} className="block w-full px-3 py-2 text-left">{item.isPinned ? 'Desanclar conversación' : 'Anclar conversación'}</button><button onClick={event => { event.stopPropagation(); setDeleteConversationId(item.conversationId); }} className="block w-full border-t border-slate-100 px-3 py-2 text-left text-rose-600 dark:border-[#203047]">Eliminar conversación</button></div>}</div>
              </div>;
            })}
            {filteredConversations.length === 0 && <div className="py-20 text-center text-xs text-slate-400">No hay conversaciones en esta sección.</div>}
          </div>
        </div>

        <div className={`relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-[#080e19] ${!activeConversation ? 'hidden md:flex' : 'flex'}`}>
          {activeConversation ? <>
            <div className="z-10 flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-[#1b293b] dark:bg-[#0d1524]">
              <div className="flex min-w-0 items-center gap-3"><button onClick={() => { setActiveConversation(null); setMessages([]); setChatError(''); }} className="rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-600 dark:border-[#26364c] dark:bg-[#162033] dark:text-slate-300 md:hidden"><ChevronLeft className="h-4 w-4"/></button>{activeConversation.isGroup ? <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#177f76] text-white"><Users className="h-5 w-5"/></div> : <UserAvatar avatarUrl={activeConversation.avatarUrl} name={activeConversation.name} className="h-10 w-10 rounded-full text-xs"/>}<div className="min-w-0"><h3 className="truncate text-xs font-extrabold text-slate-900 dark:text-white">{activeConversation.name}</h3><span className="block text-[10px] font-semibold text-[#177f76] dark:text-[#55c7bb]">{otherUserTyping ? 'escribiendo…' : activeConversation.isGroup ? 'Conversación grupal' : presence?.online ? 'Disponible' : presence?.lastSeenVisible && presence.lastSeenAt ? `Activo ${formatTimeAgo(presence.lastSeenAt)}` : 'Conexión directa'}</span>{!activeConversation.isGroup && activeConversation.otherUsername && <span className="block text-[9px] text-slate-400">@{activeConversation.otherUsername}</span>}</div></div>
              <div className="flex items-center gap-1.5"><button disabled={activeConversation.isGroup || !activeConversation.otherUsername} onClick={() => triggerCall('AUDIO')} className="rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-600 disabled:opacity-40 dark:border-[#26364c] dark:bg-[#162033] dark:text-slate-300" title="Llamada de voz"><Phone className="h-4 w-4"/></button><button disabled={activeConversation.isGroup || !activeConversation.otherUsername} onClick={() => triggerCall('VIDEO')} className="rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-600 disabled:opacity-40 dark:border-[#26364c] dark:bg-[#162033] dark:text-slate-300" title="Videollamada"><Video className="h-4 w-4"/></button><button onClick={() => setShowRightPanel(value => !value)} className="rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-600 dark:border-[#26364c] dark:bg-[#162033] dark:text-slate-300" title="Información"><Info className="h-4 w-4"/></button></div>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_80%_8%,rgba(23,127,118,.08),transparent_26%),radial-gradient(circle_at_18%_70%,rgba(14,116,144,.06),transparent_30%)] p-4 dark:bg-[radial-gradient(circle_at_82%_8%,rgba(30,145,135,.10),transparent_26%),radial-gradient(circle_at_12%_75%,rgba(36,63,92,.24),transparent_32%),linear-gradient(155deg,#070c15,#0a111d_56%,#080f19)] md:p-6" style={activeConversation.chatTheme && activeConversation.chatTheme !== 'DEFAULT' ? { backgroundImage: chatThemeBackground[activeConversation.chatTheme] } : undefined}>
              {messages.map(message => {
                const isOwn = message.senderUsername === user?.username;
                return <div key={message.messageId} className={`flex max-w-[82%] flex-col ${isOwn ? 'ml-auto items-end' : 'items-start'} md:max-w-[75%]`}>
                  <div className={`rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${isOwn ? 'rounded-br-md bg-[linear-gradient(135deg,#1a8a80,#126f68)] text-white shadow-[#0a5d57]/10' : 'rounded-bl-md border border-slate-200/80 bg-white text-slate-800 dark:border-[#223047] dark:bg-[#121b2a] dark:text-slate-100'}`}>
                    {!isOwn && activeConversation.isGroup && <strong className="mb-1 block text-[10px] text-[#177f76] dark:text-[#55c7bb]">@{message.senderUsername}</strong>}
                    {(message.messageType === 'STORY_REPLY' || message.messageType === 'STORY_REACTION') && <div className="mb-2 overflow-hidden rounded-xl border border-white/20 bg-black/10 text-[10px]"><p className="px-2.5 pt-2 font-bold opacity-90">{isOwn ? 'Tu interacción con un momento' : 'Interacción con tu momento'}</p>{message.storyPreview?.available ? message.storyPreview.mediaType === 'IMAGE' && message.storyPreview.mediaUrl ? <img src={message.storyPreview.mediaUrl} alt="Momento" className="mt-1 h-24 w-full object-cover"/> : message.storyPreview.mediaType === 'VIDEO' && message.storyPreview.mediaUrl ? <video src={message.storyPreview.mediaUrl} muted playsInline controls preload="metadata" className="mt-1 h-24 w-full object-cover"/> : <div className="mx-2.5 my-1 rounded-lg px-2 py-3" style={{ background: message.storyPreview.backgroundColor || '#177f76' }}>{message.storyPreview.textContent || 'Momento de texto'}</div> : <div className="px-2.5 py-3 opacity-70">Momento no disponible</div>}</div>}
                    {message.attachments?.map(attachment => <div key={attachment.id} className={message.content ? 'mb-2' : ''}>
                      {attachment.fileType === 'IMAGE' && (failedAttachmentUrls[attachment.fileUrl] ? <div className="rounded-xl bg-slate-200/60 p-6 text-center text-[10px] text-slate-500 dark:bg-[#1a2536]">No se pudo cargar la imagen.</div> : <button onClick={() => setFullscreenImageUrl(attachment.fileUrl)} className="block overflow-hidden rounded-xl bg-black/10"><img src={attachment.fileUrl} alt={attachment.fileName || 'Imagen adjunta'} className="max-h-72 w-full object-contain" onError={() => setFailedAttachmentUrls(previous => ({ ...previous, [attachment.fileUrl]: true }))}/></button>)}
                      {attachment.fileType === 'VIDEO' && <video src={attachment.fileUrl} controls playsInline preload="metadata" className="max-h-72 w-full rounded-xl bg-black"/>}
                      {attachment.fileType === 'AUDIO' && <div className="min-w-52"><audio src={attachment.fileUrl} controls preload="metadata" className="w-full"/>{attachment.durationSeconds != null && <span className="mt-1 block text-[9px] opacity-75">{attachment.durationSeconds} s</span>}</div>}
                      {(attachment.fileType === 'VIEW_ONCE_IMAGE' || attachment.fileType === 'VIEW_ONCE_IMAGE_VIEWED') && <button type="button" disabled={isOwn || attachment.fileType === 'VIEW_ONCE_IMAGE_VIEWED' || openingViewOnceAttachmentId === attachment.id} onClick={() => void openViewOnce(message, attachment)} className={`flex min-w-56 items-center gap-3 rounded-xl border p-3 text-left transition-all ${attachment.fileType === 'VIEW_ONCE_IMAGE_VIEWED' ? 'border-white/10 bg-black/10 opacity-65' : 'border-white/20 bg-white/10 hover:bg-white/15'} disabled:cursor-default`}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10"><Eye className="h-5 w-5"/></span><span><strong className="block text-[11px]">{attachment.fileType === 'VIEW_ONCE_IMAGE_VIEWED' ? 'Foto vista' : 'Foto de una sola vista'}</strong><span className="mt-0.5 block text-[9px] opacity-75">{attachment.fileType === 'VIEW_ONCE_IMAGE_VIEWED' ? 'Ya no se puede volver a abrir' : isOwn ? 'Esperando a que la vea' : openingViewOnceAttachmentId === attachment.id ? 'Abriendo…' : 'Toca para verla una vez'}</span></span></button>}
                    </div>)}
                    {message.content && message.messageType !== 'STORY_REACTION' && <p className="whitespace-pre-wrap">{message.content}</p>}
                  </div>
                  <div className="relative mt-1 flex flex-wrap items-center gap-1">{message.reactions?.map(reaction => <button key={reaction.emoji} onClick={() => void toggleReaction(message, reaction.emoji)} className={`rounded-full border px-2 py-0.5 text-[10px] ${reaction.reactedByMe ? 'border-[#2a968b] bg-[#1b8a80]/10' : 'border-slate-200 bg-white dark:border-[#26364c] dark:bg-[#111a29]'}`}>{reaction.emoji} {reaction.count}</button>)}<button onClick={() => setReactionPickerMessageId(reactionPickerMessageId === message.messageId ? null : message.messageId)} className="rounded-full p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-[#182335]"><Smile className="h-3.5 w-3.5"/></button>{reactionPickerMessageId === message.messageId && <div className={`absolute bottom-7 z-30 flex gap-1 rounded-full border border-slate-200 bg-white p-1.5 shadow-xl dark:border-[#26364c] dark:bg-[#111a29] ${isOwn ? 'right-0' : 'left-0'}`}>{MESSAGE_REACTIONS.map(emoji => <button key={emoji} onClick={() => void toggleReaction(message, emoji)} className="rounded-full p-1 text-lg">{emoji}</button>)}</div>}</div>
                  <div className="mt-1 flex items-center gap-1.5 px-1"><span className="text-[9px] text-slate-400">{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>{isOwn && <span className="flex items-center gap-1 text-[9px] font-semibold text-slate-400"><CheckCheck className={`h-3.5 w-3.5 ${message.readReceiptVisible && message.readByRecipient ? 'text-[#2a968b]' : 'text-slate-400'}`}/>{message.readReceiptVisible && message.readByRecipient ? 'Leído' : 'Enviado'}</span>}</div>
                </div>;
              })}
              {otherUserTyping && <div className="flex items-center gap-2 py-1 text-xs font-bold text-[#2a968b]"><span className="h-2 w-2 animate-bounce rounded-full bg-[#2a968b]"/>{activeConversation.name} está escribiendo…</div>}
              <div ref={messagesEndRef}/>
            </div>

            {chatError && <div role="alert" className="mx-4 mb-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">{chatError}</div>}
            {mediaError && <div role="alert" className="mx-4 mb-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">{mediaError}</div>}
            {isRecording && <div className="mx-4 mb-2 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs dark:border-rose-900 dark:bg-rose-950/40"><span className="font-bold text-rose-700 dark:text-rose-300">Grabando… {String(Math.floor(recordingSeconds / 60)).padStart(2,'0')}:{String(recordingSeconds % 60).padStart(2,'0')}</span><div className="flex gap-2"><button onClick={cancelRecording} className="rounded-lg px-3 py-1.5 font-bold">Cancelar</button><button onClick={stopRecording} className="rounded-lg bg-rose-600 px-3 py-1.5 font-bold text-white">Detener</button></div></div>}
            {selectedAttachment && attachmentPreviewUrl && <div className="mx-4 mb-2 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-[#26364c] dark:bg-[#101827]">{selectedAttachment.type.startsWith('image/') && <img src={attachmentPreviewUrl} alt="Vista previa" className="h-16 w-16 rounded-xl object-cover"/>}{selectedAttachment.type.startsWith('video/') && <video src={attachmentPreviewUrl} className="h-16 w-24 rounded-xl object-cover" muted playsInline/>}{selectedAttachment.type.startsWith('audio/') && <audio src={attachmentPreviewUrl} controls className="h-10 flex-1"/>}<div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{selectedAttachment.name}</p><p className="text-[10px] text-slate-500">{(selectedAttachment.size / 1024 / 1024).toFixed(2)} MB</p></div><button disabled={isSendingAttachment} onClick={clearSelectedAttachment} className="rounded-lg p-2 text-slate-500"><X className="h-4 w-4"/></button>{selectedAttachment.type.startsWith('image/') && !activeConversation.isGroup && <button type="button" onClick={() => setViewOnceSelected(value => !value)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-[11px] font-bold sm:w-auto ${viewOnceSelected ? 'border-[#2a968b] bg-[#1b8a80]/12 text-[#177f76] dark:text-[#65d0c5]' : 'border-slate-200 dark:border-[#26364c]'}`}><span className="flex items-center gap-2"><Eye className="h-4 w-4"/>Ver una vez</span><span className={`ml-4 h-5 w-9 rounded-full p-0.5 transition ${viewOnceSelected ? 'bg-[#177f76]' : 'bg-slate-300 dark:bg-[#334155]'}`}><span className={`block h-4 w-4 rounded-full bg-white transition-transform ${viewOnceSelected ? 'translate-x-4' : ''}`}/></span></button>}{selectedAttachment.type.startsWith('audio/') && <button disabled={isSendingAttachment} onClick={() => void sendCurrentMessage()} className="ml-auto inline-flex items-center gap-2 rounded-xl bg-[#177f76] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{isSendingAttachment ? 'Enviando…' : 'Enviar audio'}<Send className="h-3.5 w-3.5"/></button>}</div>}

            <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-white p-3 shadow-[0_-8px_24px_rgba(15,23,42,.04)] dark:border-[#1b293b] dark:bg-[#0d1524]" style={{ paddingBottom: 'calc(.75rem + env(safe-area-inset-bottom))' }}>
              <button onClick={() => attachmentInputRef.current?.click()} className="rounded-xl border border-slate-200 bg-slate-100 p-2.5 text-slate-600 dark:border-[#26364c] dark:bg-[#162033] dark:text-slate-300"><Plus className="h-4 w-4"/></button>
              <input ref={attachmentInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" className="hidden" onChange={event => selectAttachment(event.target.files?.[0])}/>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={event => selectAttachment(event.target.files?.[0])}/>
              <form onSubmit={event => { event.preventDefault(); void sendCurrentMessage(); }} className="flex min-w-0 flex-1 items-center gap-2"><div className="relative flex flex-grow items-center"><input ref={messageInputRef} value={inputText} onChange={handleInputChange} placeholder="Escribe un mensaje…" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-4 pr-24 text-xs outline-none focus:border-[#1b8a80] dark:border-[#26364c] dark:bg-[#09111d] dark:text-slate-100"/><div className="absolute right-3 flex items-center gap-2 text-slate-400"><div className="relative" ref={emojiPickerRef}><button type="button" onClick={() => setShowEmojiPicker(value => !value)}><Smile className="h-4 w-4"/></button>{showEmojiPicker && <div className="absolute bottom-9 right-0 z-50 grid w-52 grid-cols-6 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-[#26364c] dark:bg-[#111a29]">{CHAT_EMOJIS.map(emoji => <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} className="p-1.5 text-lg">{emoji}</button>)}</div>}</div><button type="button" onClick={() => attachmentInputRef.current?.click()}><ImageIcon className="h-4 w-4"/></button><button type="button" onClick={() => cameraInputRef.current?.click()}><Camera className="h-4 w-4"/></button><button type="button" disabled={isRecording} onClick={startRecording}><Mic className="h-4 w-4"/></button></div></div><button type="submit" disabled={isRecording || isSendingAttachment || (!inputText.trim() && !selectedAttachment)} className="rounded-xl bg-[linear-gradient(135deg,#1b8a80,#126f68)] p-2.5 text-white shadow-lg shadow-[#0b5f59]/15 disabled:opacity-40"><Send className="h-4 w-4"/></button></form>
            </div>
          </> : <div className="flex flex-grow flex-col items-center justify-center space-y-4 p-6 text-center"><div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#2a968b]/30 bg-[#1b8a80]/10 text-[#177f76]"><MessageSquare className="h-8 w-8"/></div><div><h3 className="mb-1 text-base font-extrabold">Tus Conexiones Lifonk</h3><p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">Selecciona una conversación o inicia una nueva para comenzar.</p></div></div>}
        </div>

        {activeConversation && showRightPanel && <aside className="fixed inset-0 z-50 flex w-full flex-col space-y-5 overflow-y-auto border-l border-slate-200 bg-white p-4 shadow-sm dark:border-[#1b293b] dark:bg-[#0a111d] xl:static xl:z-20 xl:w-80 xl:flex-shrink-0"><div className="flex items-center justify-between"><h3 className="text-sm font-black">Información</h3><button onClick={() => setShowRightPanel(false)} className="rounded-full p-2"><X className="h-4 w-4"/></button></div><div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center dark:border-[#26364c] dark:bg-[#111a29]"><UserAvatar avatarUrl={activeConversation.avatarUrl} name={activeConversation.name} className="mx-auto h-16 w-16 rounded-full text-lg"/><div><h4 className="text-sm font-extrabold">{activeConversation.name}</h4><span className="text-[10px] font-semibold text-[#2a968b]">@{activeConversation.otherUsername || activeConversation.name}</span></div>{!activeConversation.isGroup && activeConversation.otherUsername && <Link href={`/profile/${encodeURIComponent(activeConversation.otherUsername)}`} className="block rounded-xl border border-slate-200 py-2 text-xs font-bold dark:border-[#26364c]">Ver espacio</Link>}</div>{!activeConversation.isGroup && activeConversation.otherUsername && <div className="grid grid-cols-2 gap-2"><button onClick={() => triggerCall('AUDIO')} className="rounded-2xl border border-slate-200 p-3 text-xs font-bold dark:border-[#26364c] dark:bg-[#111a29]"><Phone className="mx-auto mb-1 h-4 w-4"/>Llamar</button><button onClick={() => triggerCall('VIDEO')} className="rounded-2xl border border-slate-200 p-3 text-xs font-bold dark:border-[#26364c] dark:bg-[#111a29]"><Video className="mx-auto mb-1 h-4 w-4"/>Video</button></div>}<button onClick={() => void togglePin()} className="rounded-xl border border-slate-200 p-3 text-left text-xs font-bold dark:border-[#26364c]">{activeConversation.isPinned ? 'Desanclar conversación' : 'Anclar conversación'}</button>{!activeConversation.isGroup && <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400">Apodo privado</label><div className="flex gap-2"><input value={nicknameDraft} onChange={event => setNicknameDraft(event.target.value)} maxLength={40} placeholder="Añadir apodo" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs dark:border-[#26364c]"/><button onClick={() => void saveNickname()} className="rounded-xl bg-[#177f76] px-3 text-xs font-bold text-white">Guardar</button></div></div>}<div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400">Señales</label><select value={activeConversation.notificationsMuted ? 'MUTED' : 'ALL'} onChange={event => { const hours = Number(event.target.value); void updateConversationPreferences(event.target.value === 'ALL' ? { notificationsMuted: false } : { notificationsMuted: true, mutedUntil: Number.isFinite(hours) ? new Date(Date.now() + hours * 3600000).toISOString() : null }); }} className="w-full rounded-xl border border-slate-200 bg-transparent p-3 text-xs dark:border-[#26364c]"><option value="ALL">Todas</option><option value="1">Silenciar 1 hora</option><option value="8">Silenciar 8 horas</option><option value="24">Silenciar 1 día</option><option value="MUTED">Silenciar siempre</option></select></div><div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400">Fondo del chat</label><select value={activeConversation.chatTheme || 'DEFAULT'} onChange={event => void updateConversationPreferences({ chatTheme: event.target.value })} className="w-full rounded-xl border border-slate-200 bg-transparent p-3 text-xs dark:border-[#26364c]">{[['DEFAULT','Predeterminado'],['DEEP_TEAL','Teal profundo'],['OCEAN','Océano'],['FOREST','Bosque'],['NIGHT','Noche']].map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400">Buscar mensajes</label><div className="flex gap-2"><input value={messageSearch} onChange={event => setMessageSearch(event.target.value)} placeholder="Buscar texto…" className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs dark:border-[#26364c]"/><button onClick={() => void searchInsideConversation()} className="rounded-xl bg-[#177f76] p-2 text-white"><Search className="h-4 w-4"/></button></div>{messageSearchResults.map(result => <div key={result.messageId} className="rounded-lg bg-slate-50 p-2 text-[10px] dark:bg-[#111a29]"><strong>@{result.senderUsername}</strong> {result.content}</div>)}</div><div><p className="mb-2 text-[10px] font-black uppercase text-slate-400">Multimedia, enlaces y archivos</p><div className="grid grid-cols-3 gap-2">{messages.flatMap(message => message.attachments || []).filter(attachment => !attachment.fileType.startsWith('VIEW_ONCE_')).slice(0,9).map(attachment => attachment.fileType === 'IMAGE' ? <button key={attachment.id} onClick={() => setFullscreenImageUrl(attachment.fileUrl)}><img src={attachment.fileUrl} alt="Archivo compartido" className="aspect-square w-full rounded-xl object-cover"/></button> : <div key={attachment.id} className="flex aspect-square items-center justify-center rounded-xl bg-slate-100 text-[10px] dark:bg-[#111a29]">{attachment.fileType}</div>)}</div></div>{commonCircles.length > 0 && <div><p className="mb-2 text-[10px] font-black uppercase text-slate-400">Círculos en común</p><div className="flex gap-2 overflow-x-auto">{commonCircles.map(circle => <Link key={circle.slug} href={`/circles/${circle.slug}`} className="w-16 shrink-0 text-center"><UserAvatar avatarUrl={circle.avatarUrl} name={circle.name} className="mx-auto h-11 w-11 rounded-full text-[10px]"/><span className="mt-1 block truncate text-[9px]">{circle.name}</span></Link>)}</div></div>}{!activeConversation.isDraft && <button onClick={() => setDeleteConversationId(activeConversation.conversationId)} className="mt-auto rounded-xl border border-rose-200 px-4 py-3 text-left text-xs font-bold text-rose-600 dark:border-rose-950">Eliminar conversación</button>}</aside>}
      </div>

      {fullscreenImageUrl && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/92 p-4" onClick={() => setFullscreenImageUrl(null)}><button onClick={() => setFullscreenImageUrl(null)} className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white"><X className="h-5 w-5"/></button><img src={fullscreenImageUrl} alt="Imagen ampliada" className="max-h-[90dvh] max-w-full object-contain" onClick={event => event.stopPropagation()}/></div>}
      {viewOnceFullscreen && <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-black p-4" onClick={() => setViewOnceFullscreen(null)}><div className="absolute left-0 right-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4 text-white"><div><p className="text-sm font-black">Una sola vista</p><p className="text-[10px] text-white/65">Al cerrar no podrás volver a abrir esta foto.</p></div><button onClick={() => setViewOnceFullscreen(null)} className="rounded-full bg-white/10 p-2"><X className="h-5 w-5"/></button></div><img src={viewOnceFullscreen} alt="Foto de una sola vista" className="max-h-[88dvh] max-w-full object-contain" onClick={event => event.stopPropagation()}/></div>}

      {isNewChatModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"><div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#26364c] dark:bg-[#111a29]"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Nueva conversación</h3><button onClick={() => setIsNewChatModalOpen(false)}><X className="h-4 w-4"/></button></div><form onSubmit={handleCreateNewChat} className="space-y-3"><input value={searchUsername} onChange={event => setSearchUsername(event.target.value)} placeholder="Nombre de usuario" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none dark:border-[#26364c] dark:bg-[#09111d]" required/><button className="w-full rounded-xl bg-[#177f76] py-2.5 text-xs font-bold text-white">Iniciar conversación</button></form></div></div>}
      {isNewGroupModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"><div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#26364c] dark:bg-[#111a29]"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Crear Círculo o Nodo</h3><button onClick={() => setIsNewGroupModalOpen(false)}><X className="h-4 w-4"/></button></div><form onSubmit={handleCreateNewGroup} className="space-y-3"><input value={groupName} onChange={event => setGroupName(event.target.value)} placeholder="Nombre del grupo" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-[#26364c] dark:bg-[#09111d]" required/><input value={groupParticipants} onChange={event => setGroupParticipants(event.target.value)} placeholder="alex, kathely" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-[#26364c] dark:bg-[#09111d]" required/><button className="w-full rounded-xl bg-[#177f76] py-2.5 text-xs font-bold text-white">Crear Círculo</button></form></div></div>}
      {deleteConversationId && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4" onClick={() => !isDeletingConversation && setDeleteConversationId(null)}><div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#26364c] dark:bg-[#0c1320]" onClick={event => event.stopPropagation()}><h3 className="text-sm font-extrabold">¿Eliminar este chat?</h3><p className="text-xs text-slate-500 dark:text-slate-400">Se eliminará de tus mensajes. La otra persona conservará su conversación.</p><div className="flex gap-3"><button disabled={isDeletingConversation} onClick={() => setDeleteConversationId(null)} className="flex-1 rounded-xl border border-slate-300 py-2.5 text-xs font-bold dark:border-[#26364c]">Cancelar</button><button disabled={isDeletingConversation} onClick={() => void handleDeleteConversation()} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white">{isDeletingConversation ? 'Eliminando…' : 'Eliminar'}</button></div></div></div>}

      {activeCallUsername && <CallModal recipientUsername={activeCallUsername} isIncoming={isIncomingCall} callMode={activeCallMode} initialOfferSdp={incomingOfferSdp} stompClientRef={stompClient} onClose={() => { setActiveCallUsername(null); setIsIncomingCall(false); setIncomingOfferSdp(null); }}/>}      
      {!activeConversation && <MobileBottomBar/>}
    </main>
  );
}

export default function ChatPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#f8fafc] dark:bg-[#070b13]"><div className="flex animate-pulse flex-col items-center gap-3"><div className="h-10 w-10 rounded-xl bg-[#177f76]"/><span className="text-sm font-semibold text-[#177f76] dark:text-[#55c7bb]">Cargando conversaciones…</span></div></div>}><ChatContent/></Suspense>;
}
