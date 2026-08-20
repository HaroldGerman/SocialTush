'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Client } from '@stomp/stompjs';
import { ArrowLeft, Camera, CheckCheck, Eye, Image as ImageIcon, Loader2, MessageCircle, Plus, Search, Send, X } from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';
import { WS_BASE_URL } from '@/config/api';
import { useTheme } from '@/context/ThemeContext';
import UserAvatar from '@/components/UserAvatar';
import MobileBottomBar from '@/components/MobileBottomBar';

interface Conversation {
  conversationId: string | null;
  isDraft?: boolean;
  name: string;
  avatarUrl: string;
  isGroup: boolean;
  latestMessage: string;
  updatedAt: string;
  unreadCount?: number;
  otherUsername?: string;
}

interface Attachment {
  id: string;
  fileUrl: string;
  fileType: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'VIEW_ONCE_IMAGE' | 'VIEW_ONCE_IMAGE_VIEWED';
  fileName?: string;
  durationSeconds?: number;
  viewOnce?: boolean;
  viewed?: boolean;
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
  attachments?: Attachment[];
  readByRecipient?: boolean;
  readReceiptVisible?: boolean;
}

function timeLabel(value?: string) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function MobileChatPage() {
  const { user, accessToken } = useAuth();
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const targetUsername = searchParams?.get('username') || '';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [viewOnce, setViewOnce] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);
  const [viewOnceFullscreen, setViewOnceFullscreen] = useState<string | null>(null);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [startingChat, setStartingChat] = useState(false);
  const [connected, setConnected] = useState(false);

  const stompRef = useRef<Client | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const response = await api.get('/chat/conversations');
      const data = response.data || [];
      setConversations(data);
      return data as Conversation[];
    } catch {
      setConversations([]);
      return [];
    }
  }, []);

  const createDraft = useCallback(async (username: string) => {
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
      otherUsername: profile.username,
    } satisfies Conversation;
  }, []);

  useEffect(() => {
    if (!user) return;
    void fetchConversations().then(async list => {
      if (!targetUsername) return;
      const existing = list.find(item => item.otherUsername?.toLowerCase() === targetUsername.toLowerCase());
      if (existing) setActiveConversation(existing);
      else {
        try { setActiveConversation(await createDraft(targetUsername)); }
        catch { setError('No pudimos abrir esa conversación.'); }
      }
    }).finally(() => setLoading(false));
  }, [user, targetUsername, fetchConversations, createDraft]);

  useEffect(() => {
    if (!user || !accessToken) return;
    const client = new Client({
      brokerURL: WS_BASE_URL,
      connectHeaders: { Authorization: `Bearer ${accessToken}` },
      reconnectDelay: 4000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
    });
    client.onConnect = () => setConnected(true);
    client.onDisconnect = () => setConnected(false);
    client.onStompError = () => setConnected(false);
    client.activate();
    stompRef.current = client;
    return () => { void client.deactivate(); };
  }, [user, accessToken]);

  const markRead = useCallback(async (conversationId: string) => {
    try {
      await api.patch(`/chat/conversations/${conversationId}/read`);
      setConversations(previous => previous.map(item => item.conversationId === conversationId ? { ...item, unreadCount: 0 } : item));
    } catch {}
  }, []);

  useEffect(() => {
    const conversationId = activeConversation?.conversationId;
    if (!conversationId || activeConversation?.isDraft) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    api.get(`/chat/conversations/${conversationId}/messages`)
      .then(response => setMessages(response.data?.content || response.data || []))
      .then(() => markRead(conversationId))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  }, [activeConversation?.conversationId, activeConversation?.isDraft, markRead]);

  useEffect(() => {
    const conversationId = activeConversation?.conversationId;
    const client = stompRef.current;
    if (!conversationId || !client || !connected) return;
    const subscription = client.subscribe(`/topic/conversation.${conversationId}`, frame => {
      try {
        const body = JSON.parse(frame.body);
        if (body.type === 'VIEW_ONCE_CONSUMED') {
          setMessages(previous => previous.map(message => message.messageId !== body.messageId ? message : {
            ...message,
            attachments: message.attachments?.map(attachment => attachment.id === body.attachmentId
              ? { ...attachment, fileUrl: '', fileType: 'VIEW_ONCE_IMAGE_VIEWED', viewed: true }
              : attachment)
          }));
          return;
        }
        if (body.type === 'READ_RECEIPT') {
          if (body.readerUsername?.toLowerCase() === user?.username?.toLowerCase()) return;
          setMessages(previous => {
            const lastRead = previous.find(message => message.messageId === body.lastReadMessageId);
            if (!lastRead) return previous;
            const cutoff = new Date(lastRead.createdAt).getTime();
            return previous.map(message => message.senderUsername?.toLowerCase() === user?.username?.toLowerCase()
              && new Date(message.createdAt).getTime() <= cutoff
              ? { ...message, readByRecipient: true }
              : message);
          });
          return;
        }
        if (body.messageId) {
          setMessages(previous => previous.some(message => message.messageId === body.messageId) ? previous : [...previous, body]);
          if (body.senderUsername?.toLowerCase() !== user?.username?.toLowerCase()) void markRead(conversationId);
        }
      } catch {}
    });
    return () => subscription.unsubscribe();
  }, [activeConversation?.conversationId, connected, markRead, user?.username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeConversation?.conversationId]);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setViewOnce(false);
    setPreviewUrl(previous => {
      if (previous) URL.revokeObjectURL(previous);
      return null;
    });
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }, []);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const chooseFile = (file?: File) => {
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (!allowed.includes(file.type)) return setError('Formato no compatible.');
    const max = file.type.startsWith('image/') ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > max) return setError(`El archivo supera ${max / 1024 / 1024} MB.`);
    clearFile();
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setViewOnce(false);
    setError('');
  };

  const persistDraftConversation = async (conversationId: string) => {
    const refreshed = await fetchConversations();
    const real = refreshed.find(item => item.conversationId === conversationId);
    if (real) setActiveConversation(real);
  };

  const send = async () => {
    if ((!input.trim() && !selectedFile) || !activeConversation || sending) return;
    setSending(true);
    setError('');
    const content = input.trim();
    try {
      if (selectedFile) {
        const data = new FormData();
        if (content) data.append('content', content);
        data.append('file', selectedFile);
        const useViewOnce = viewOnce && selectedFile.type.startsWith('image/') && !activeConversation.isGroup;
        const endpoint = useViewOnce
          ? (activeConversation.isDraft || !activeConversation.conversationId
              ? `/chat/view-once/direct/${encodeURIComponent(activeConversation.otherUsername || '')}/messages`
              : `/chat/view-once/conversations/${activeConversation.conversationId}/messages`)
          : (activeConversation.isDraft || !activeConversation.conversationId
              ? `/chat/direct/${encodeURIComponent(activeConversation.otherUsername || '')}/messages/media`
              : `/chat/conversations/${activeConversation.conversationId}/messages/media`);
        const response = await api.post(endpoint, data, { headers: { 'Content-Type': 'multipart/form-data' } });
        const message = response.data.message || response.data;
        const conversationId = response.data.conversationId || activeConversation.conversationId;
        setMessages(previous => previous.some(item => item.messageId === message.messageId) ? previous : [...previous, message]);
        setInput('');
        clearFile();
        if (activeConversation.isDraft && conversationId) await persistDraftConversation(conversationId);
      } else if (activeConversation.isDraft || !activeConversation.conversationId) {
        const response = await api.post(`/chat/direct/${encodeURIComponent(activeConversation.otherUsername || '')}/messages`, { content, messageType: 'TEXT' });
        setMessages([response.data.message]);
        setInput('');
        await persistDraftConversation(response.data.conversationId);
      } else {
        const response = await api.post(`/chat/conversations/${activeConversation.conversationId}/messages`, { content, messageType: 'TEXT' });
        setMessages(previous => previous.some(item => item.messageId === response.data.messageId) ? previous : [...previous, response.data]);
        setInput('');
      }
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'No se pudo enviar.');
    } finally {
      setSending(false);
    }
  };

  const openViewOnce = async (message: Message, attachment: Attachment) => {
    const mine = message.senderUsername?.toLowerCase() === user?.username?.toLowerCase();
    if (mine || attachment.fileType === 'VIEW_ONCE_IMAGE_VIEWED' || openingAttachmentId) return;
    setOpeningAttachmentId(attachment.id);
    setError('');
    try {
      const response = await api.post(`/chat/view-once/attachments/${attachment.id}/open`);
      setViewOnceFullscreen(response.data.fileUrl);
      setMessages(previous => previous.map(item => item.messageId !== message.messageId ? item : {
        ...item,
        attachments: item.attachments?.map(value => value.id === attachment.id ? { ...value, fileUrl: '', fileType: 'VIEW_ONCE_IMAGE_VIEWED', viewed: true } : value)
      }));
    } catch (requestError: any) {
      setMessages(previous => previous.map(item => item.messageId !== message.messageId ? item : {
        ...item,
        attachments: item.attachments?.map(value => value.id === attachment.id ? { ...value, fileUrl: '', fileType: 'VIEW_ONCE_IMAGE_VIEWED', viewed: true } : value)
      }));
      setError(requestError.response?.status === 410 ? 'Esta foto ya fue vista.' : requestError.response?.data?.message || 'No se pudo abrir la foto.');
    } finally {
      setOpeningAttachmentId(null);
    }
  };

  const startNewChat = async () => {
    if (!newUsername.trim() || startingChat) return;
    setStartingChat(true);
    setError('');
    try {
      const existing = conversations.find(item => item.otherUsername?.toLowerCase() === newUsername.trim().toLowerCase());
      setActiveConversation(existing || await createDraft(newUsername));
      setNewChatOpen(false);
      setNewUsername('');
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || 'Usuario no encontrado.');
    } finally {
      setStartingChat(false);
    }
  };

  const filtered = conversations.filter(item => {
    const query = search.trim().toLowerCase();
    return !query || item.name?.toLowerCase().includes(query) || item.otherUsername?.toLowerCase().includes(query);
  });

  if (loading) return <div className="flex h-[100dvh] items-center justify-center bg-slate-50 dark:bg-[#07151d]"><Loader2 className="h-7 w-7 animate-spin text-teal-600" /></div>;

  if (!activeConversation) {
    return (
      <div className="flex h-[100dvh] flex-col bg-slate-50 text-slate-900 dark:bg-[#07151d] dark:text-white pb-20">
        <header className="shrink-0 border-b border-slate-200 bg-white px-4 pb-3 pt-[calc(.75rem+env(safe-area-inset-top))] dark:border-slate-800 dark:bg-[#0f172a]">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-teal-600">Lifonk</p><h1 className="text-xl font-black">Conversaciones</h1></div><button onClick={() => setNewChatOpen(true)} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-700 text-white"><Plus className="h-5 w-5" /></button></div>
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar conversación" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-[#07151d]"/></div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto p-3">
          {filtered.map(conversation => <button key={conversation.conversationId || conversation.otherUsername} onClick={() => setActiveConversation(conversation)} className="mb-1 flex w-full items-center gap-3 rounded-2xl p-3 text-left active:bg-slate-100 dark:active:bg-slate-800"><UserAvatar avatarUrl={conversation.avatarUrl} name={conversation.name} className="h-12 w-12 rounded-full text-sm"/><div className="min-w-0 flex-1"><div className="flex items-center justify-between"><p className="truncate text-sm font-extrabold">{conversation.name}</p><span className="text-[10px] text-slate-400">{timeLabel(conversation.updatedAt)}</span></div><div className="mt-1 flex items-center justify-between"><p className="truncate text-xs text-slate-500 dark:text-slate-400">{conversation.latestMessage || 'Empieza una conversación'}</p>{Boolean(conversation.unreadCount) && <span className="ml-2 min-w-5 rounded-full bg-teal-700 px-1.5 py-0.5 text-center text-[10px] font-black text-white">{conversation.unreadCount}</span>}</div></div></button>)}
          {!filtered.length && <div className="flex h-48 flex-col items-center justify-center text-slate-400"><MessageCircle className="mb-2 h-7 w-7"/><p className="text-sm font-bold">No hay conversaciones</p></div>}
        </main>
        <MobileBottomBar />
        {newChatOpen && <div className="fixed inset-0 z-50 flex items-end bg-black/50" onClick={() => setNewChatOpen(false)}><div className="w-full rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] dark:bg-[#0f172a]" onClick={event => event.stopPropagation()}><div className="mb-4 flex items-center justify-between"><h2 className="font-black">Nueva conversación</h2><button onClick={() => setNewChatOpen(false)}><X className="h-5 w-5"/></button></div><div className="flex gap-2"><input value={newUsername} onChange={event => setNewUsername(event.target.value)} placeholder="@usuario" autoFocus className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-[#07151d]"/><button onClick={() => void startNewChat()} disabled={!newUsername.trim() || startingChat} className="rounded-2xl bg-teal-700 px-4 font-bold text-white disabled:opacity-50">Abrir</button></div></div></div>}
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#f4f7f7] text-slate-900 dark:bg-[#07151d] dark:text-white">
      <header className="shrink-0 border-b border-slate-200 bg-white px-3 pb-2 pt-[calc(.5rem+env(safe-area-inset-top))] dark:border-slate-800 dark:bg-[#0f172a]">
        <div className="flex items-center gap-2"><button onClick={() => { clearFile(); setActiveConversation(null); setMessages([]); }} className="flex h-10 w-10 items-center justify-center rounded-xl"><ArrowLeft className="h-5 w-5"/></button><UserAvatar avatarUrl={activeConversation.avatarUrl} name={activeConversation.name} className="h-10 w-10 rounded-full text-xs"/><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{activeConversation.name}</p><p className="truncate text-[10px] text-slate-400">{activeConversation.isGroup ? 'Conversación grupal' : `@${activeConversation.otherUsername || ''}`}</p></div><span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-slate-400'}`}/></div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loadingMessages ? <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-teal-600"/></div> : messages.map(message => {
          const mine = message.senderUsername?.toLowerCase() === user?.username?.toLowerCase();
          return <div key={message.messageId} className={`mb-3 flex flex-col ${mine ? 'items-end' : 'items-start'}`}><div className={`max-w-[82%] overflow-hidden rounded-2xl ${mine ? 'rounded-br-md bg-teal-700 text-white' : 'rounded-bl-md border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0f172a]'}`}>
            {!mine && activeConversation.isGroup && <p className="px-3 pt-2 text-[10px] font-black text-teal-500">@{message.senderUsername}</p>}
            {message.attachments?.map(attachment => {
              if (attachment.fileType === 'VIEW_ONCE_IMAGE' || attachment.fileType === 'VIEW_ONCE_IMAGE_VIEWED') {
                const consumed = attachment.fileType === 'VIEW_ONCE_IMAGE_VIEWED' || attachment.viewed;
                return <button key={attachment.id} type="button" disabled={mine || consumed || openingAttachmentId === attachment.id} onClick={() => void openViewOnce(message, attachment)} className={`m-2 flex min-w-[210px] items-center gap-3 rounded-2xl border px-4 py-4 text-left ${mine ? 'border-white/25 bg-white/10' : 'border-teal-200 bg-teal-50 dark:border-teal-900 dark:bg-teal-950/30'} disabled:opacity-80`}><div className="flex h-10 w-10 items-center justify-center rounded-full border border-current"><Eye className="h-4 w-4"/></div><div><p className="text-xs font-black">{consumed ? 'Foto vista' : mine ? 'Foto de una sola vista' : 'Ver foto una vez'}</p><p className="mt-0.5 text-[10px] opacity-70">{consumed ? 'Ya no está disponible' : mine ? 'Esperando a que la abra' : 'Se cerrará después de verla'}</p></div>{openingAttachmentId === attachment.id && <Loader2 className="ml-auto h-4 w-4 animate-spin"/>}</button>;
              }
              if (attachment.fileType === 'IMAGE') return <button key={attachment.id} onClick={() => setFullscreenUrl(attachment.fileUrl)} className="block"><img src={attachment.fileUrl} alt={attachment.fileName || 'Imagen'} className="max-h-72 w-full object-cover"/></button>;
              if (attachment.fileType === 'VIDEO') return <video key={attachment.id} src={attachment.fileUrl} controls playsInline preload="metadata" className="max-h-72 w-full bg-black"/>;
              if (attachment.fileType === 'AUDIO') return <audio key={attachment.id} src={attachment.fileUrl} controls preload="metadata" className="m-2 max-w-[240px]"/>;
              return null;
            })}
            {message.content && <p className="whitespace-pre-wrap px-3 py-2.5 text-sm leading-relaxed">{message.content}</p>}
          </div><div className="mt-1 flex items-center gap-1 px-1 text-[9px] text-slate-400"><span>{timeLabel(message.createdAt)}</span>{mine && <><CheckCheck className={`h-3 w-3 ${message.readByRecipient ? 'text-teal-500' : ''}`}/><span>{message.readByRecipient ? 'Leído' : 'Enviado'}</span></>}</div></div>;
        })}
        <div ref={messagesEndRef}/>
      </main>

      {error && <div className="mx-3 mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">{error}</div>}

      {selectedFile && previewUrl && <div className="mx-3 mb-2 rounded-2xl border border-slate-200 bg-white p-2.5 dark:border-slate-800 dark:bg-[#0f172a]"><div className="flex items-center gap-3">{selectedFile.type.startsWith('image/') ? <img src={previewUrl} alt="Vista previa" className="h-14 w-14 rounded-xl object-cover"/> : <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800"><ImageIcon className="h-5 w-5"/></div>}<div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{selectedFile.name || 'Archivo seleccionado'}</p><p className="text-[10px] text-slate-400">{selectedFile.type.startsWith('image/') ? 'Foto' : 'Video'}</p></div><button onClick={clearFile}><X className="h-5 w-5 text-slate-400"/></button></div>{selectedFile.type.startsWith('image/') && !activeConversation.isGroup && <button type="button" onClick={() => setViewOnce(value => !value)} className={`mt-2 flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${viewOnce ? 'border-teal-500 bg-teal-50 text-teal-800 dark:bg-teal-950/30 dark:text-teal-300' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'}`}><div className="flex items-center gap-2"><Eye className="h-4 w-4"/><div><p className="text-xs font-black">Ver una vez</p><p className="text-[10px] opacity-70">La foto no podrá abrirse de nuevo.</p></div></div><div className={`h-5 w-9 rounded-full p-0.5 ${viewOnce ? 'bg-teal-600' : 'bg-slate-300 dark:bg-slate-700'}`}><div className={`h-4 w-4 rounded-full bg-white transition-transform ${viewOnce ? 'translate-x-4' : ''}`}/></div></button>}</div>}

      <footer className="shrink-0 border-t border-slate-200 bg-white px-3 pb-[calc(.6rem+env(safe-area-inset-bottom))] pt-2 dark:border-slate-800 dark:bg-[#0f172a]">
        <div className="flex items-end gap-2"><input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" className="hidden" onChange={event => chooseFile(event.target.files?.[0])}/><input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={event => chooseFile(event.target.files?.[0])}/><button onClick={() => galleryInputRef.current?.click()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500"><ImageIcon className="h-5 w-5"/></button><button onClick={() => cameraInputRef.current?.click()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500"><Camera className="h-5 w-5"/></button><textarea value={input} onChange={event => setInput(event.target.value)} rows={1} placeholder="Mensaje…" className="max-h-28 min-h-10 min-w-0 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-[#07151d]"/><button disabled={sending || (!input.trim() && !selectedFile)} onClick={() => void send()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white disabled:opacity-40">{sending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4"/>}</button></div>
      </footer>

      {fullscreenUrl && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95 p-3" onClick={() => setFullscreenUrl(null)}><button className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] text-white"><X className="h-6 w-6"/></button><img src={fullscreenUrl} alt="Imagen" className="max-h-full max-w-full object-contain"/></div>}
      {viewOnceFullscreen && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black p-3" onClick={() => setViewOnceFullscreen(null)}><div className="absolute left-4 right-4 top-[calc(1rem+env(safe-area-inset-top))] flex items-center justify-between text-white"><div><p className="text-xs font-black">Foto de una sola vista</p><p className="text-[10px] text-white/60">Al cerrar no podrás verla otra vez</p></div><button onClick={() => setViewOnceFullscreen(null)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><X className="h-5 w-5"/></button></div><img src={viewOnceFullscreen} alt="Foto de una sola vista" className="max-h-[86dvh] max-w-full object-contain"/></div>}
    </div>
  );
}
