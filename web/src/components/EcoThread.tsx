'use client';

import React, { useEffect, useState } from 'react';
import { Heart, MessageCircle, Send, Trash2 } from 'lucide-react';
import { api, useAuth } from '@/context/AuthContext';
import UserAvatar from '@/components/UserAvatar';

export interface EcoDto {
  commentId: string;
  content: string;
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  parentId?: string | null;
  resonanceCount?: number;
  resonatedByMe?: boolean;
  createdAt?: string;
}

interface EcoThreadProps {
  postId: string;
  onCommentAdded?: () => void;
}

export default function EcoThread({ postId, onCommentAdded }: EcoThreadProps) {
  const { user } = useAuth();
  const [ecos, setEcos] = useState<EcoDto[]>([]);
  const [replies, setReplies] = useState<Record<string, EcoDto[]>>({});
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});
  const [text, setText] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ rootId: string; username: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void api.get(`/comments/${postId}`)
      .then((response) => active && setEcos(Array.isArray(response.data) ? response.data : []))
      .catch(() => {
        if (active) {
          setEcos([]);
          setError('No se pudieron cargar los ecos.');
        }
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [postId]);

  const loadReplies = async (rootId: string, forceOpen = false) => {
    if (replies[rootId]) {
      setExpandedReplies((prev) => ({ ...prev, [rootId]: forceOpen ? true : !prev[rootId] }));
      return;
    }
    try {
      setError('');
      const response = await api.get(`/comments/replies/${rootId}`);
      setReplies((prev) => ({ ...prev, [rootId]: Array.isArray(response.data) ? response.data : [] }));
      setExpandedReplies((prev) => ({ ...prev, [rootId]: true }));
    } catch {
      setReplies((prev) => ({ ...prev, [rootId]: [] }));
      setError('No se pudieron cargar las respuestas.');
    }
  };

  const submitTopLevel = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    try {
      const response = await api.post(`/comments/${postId}`, { content });
      setEcos((prev) => [...prev, response.data]);
      setText('');
      onCommentAdded?.();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'No se pudo publicar el eco.');
    } finally {
      setSending(false);
    }
  };

  const submitReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!replyTarget || sending) return;
    const raw = text.trim();
    if (!raw) return;
    setSending(true);
    setError('');
    try {
      const response = await api.post(`/comments/${postId}`, {
        content: raw,
        parentId: replyTarget.rootId,
      });
      setReplies((prev) => ({ ...prev, [replyTarget.rootId]: [...(prev[replyTarget.rootId] || []), response.data] }));
      setExpandedReplies((prev) => ({ ...prev, [replyTarget.rootId]: true }));
      setText('');
      setReplyTarget(null);
      onCommentAdded?.();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'No se pudo publicar la respuesta.');
    } finally {
      setSending(false);
    }
  };

  const toggleResonance = async (eco: EcoDto, rootId?: string) => {
    try {
      setError('');
      const response = await api.post(`/comments/${eco.commentId}/resonate`);
      const patch = { resonatedByMe: Boolean(response.data.resonated), resonanceCount: Number(response.data.count || 0) };
      if (rootId) {
        setReplies((prev) => ({
          ...prev,
          [rootId]: (prev[rootId] || []).map((item) => item.commentId === eco.commentId ? { ...item, ...patch } : item),
        }));
      } else {
        setEcos((prev) => prev.map((item) => item.commentId === eco.commentId ? { ...item, ...patch } : item));
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'No se pudo actualizar la resonancia.');
    }
  };

  const isOwnEco = (eco: EcoDto) => {
    const sameId = user?.userId && String(user.userId) === String(eco.userId);
    const sameUsername = user?.username && eco.username && user.username.toLowerCase() === eco.username.toLowerCase();
    return Boolean(sameId || sameUsername);
  };

  const deleteEco = async (eco: EcoDto, rootId?: string) => {
    if (!isOwnEco(eco) || deletingId) return;
    if (!window.confirm('¿Eliminar este eco?')) return;
    setDeletingId(eco.commentId);
    setError('');
    try {
      await api.delete(`/comments/${eco.commentId}`);
      if (rootId) {
        setReplies((prev) => ({
          ...prev,
          [rootId]: (prev[rootId] || []).filter((item) => item.commentId !== eco.commentId),
        }));
      } else {
        setEcos((prev) => prev.filter((item) => item.commentId !== eco.commentId));
        setReplies((prev) => {
          const next = { ...prev };
          delete next[eco.commentId];
          return next;
        });
        setExpandedReplies((prev) => {
          const next = { ...prev };
          delete next[eco.commentId];
          return next;
        });
      }
      if (replyTarget?.rootId === eco.commentId) {
        setReplyTarget(null);
        setText('');
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.message || 'No se pudo eliminar el eco.');
    } finally {
      setDeletingId(null);
    }
  };

  const beginReply = (rootId: string, username: string) => {
    setReplyTarget({ rootId, username });
    setText(`@${username} `);
    void loadReplies(rootId, true);
  };

  const renderEco = (eco: EcoDto, rootId?: string) => (
    <div key={eco.commentId} className={rootId ? 'ml-8 rounded-xl border border-slate-200/80 bg-white/70 p-2.5 dark:border-slate-800 dark:bg-slate-950/40' : 'rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60'}>
      <div className="flex items-start gap-2.5">
        <UserAvatar avatarUrl={eco.avatarUrl} name={eco.displayName || eco.username} className="h-8 w-8 shrink-0 rounded-full text-[10px]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[11px] font-extrabold text-teal-700 dark:text-teal-400">@{eco.username}</span>
          </div>
          <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-slate-700 dark:text-slate-300">{eco.content}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
            <button type="button" onClick={() => void toggleResonance(eco, rootId)} className={`inline-flex items-center gap-1 transition-colors ${eco.resonatedByMe ? 'text-rose-500' : 'hover:text-rose-500'}`}>
              <Heart className={`h-3.5 w-3.5 ${eco.resonatedByMe ? 'fill-current' : ''}`} />
              Resonar{(eco.resonanceCount || 0) > 0 ? ` ${eco.resonanceCount}` : ''}
            </button>
            <button type="button" onClick={() => beginReply(rootId || eco.commentId, eco.username)} className="inline-flex items-center gap-1 hover:text-teal-600 dark:hover:text-teal-400">
              <MessageCircle className="h-3.5 w-3.5" />Responder
            </button>
            {isOwnEco(eco) && (
              <button type="button" disabled={deletingId === eco.commentId} onClick={() => void deleteEco(eco, rootId)} className="inline-flex items-center gap-1 text-rose-500 hover:text-rose-600 disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" />{deletingId === eco.commentId ? 'Eliminando…' : 'Eliminar'}
              </button>
            )}
            {!rootId && (
              <button type="button" onClick={() => void loadReplies(eco.commentId)} className="hover:text-teal-600 dark:hover:text-teal-400">
                {expandedReplies[eco.commentId] ? 'Ocultar respuestas' : 'Ver respuestas'}
              </button>
            )}
          </div>
        </div>
      </div>
      {!rootId && expandedReplies[eco.commentId] && (
        <div className="mt-2 space-y-2">
          {(replies[eco.commentId] || []).map((reply) => renderEco(reply, eco.commentId))}
          {(replies[eco.commentId] || []).length === 0 && <p className="ml-10 text-[10px] text-slate-400">Aún no hay respuestas.</p>}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      <form onSubmit={replyTarget ? submitReply : submitTopLevel} className="space-y-2">
        {replyTarget && (
          <div className="flex items-center justify-between rounded-lg bg-teal-50 px-3 py-2 text-[10px] font-bold text-teal-700 dark:bg-teal-950/30 dark:text-teal-300">
            <span>Respondiendo a @{replyTarget.username}</span>
            <button type="button" onClick={() => { setReplyTarget(null); setText(''); }} className="text-slate-500 hover:text-slate-800 dark:hover:text-white">Cancelar</button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder={replyTarget ? `Responder a @${replyTarget.username}...` : 'Escribe un eco...'}
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 outline-none focus:border-teal-600 dark:border-slate-800 dark:bg-[#090d16] dark:text-white"
          />
          <button type="submit" disabled={!text.trim() || sending} className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-teal-600 disabled:opacity-50">
            <Send className="h-3.5 w-3.5" />{replyTarget ? 'Responder' : 'Enviar'}
          </button>
        </div>
      </form>

      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}

      {loading ? <p className="text-[11px] italic text-slate-500">Cargando ecos...</p> : (
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {ecos.map((eco) => renderEco(eco))}
          {ecos.length === 0 && <p className="text-[11px] text-slate-500">Sé el primero en dejar un eco.</p>}
        </div>
      )}
    </div>
  );
}
