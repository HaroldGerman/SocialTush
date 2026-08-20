'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, Send, MoreHorizontal, Eye } from 'lucide-react';

import { api, useAuth } from '@/context/AuthContext';
import UserAvatar from '@/components/UserAvatar';

interface Story {
  storyId: string;
  mediaType: string;
  mediaUrl: string;
  textContent: string;
  backgroundColor: string;
  musicTitle: string;
  overlayData?: string;
  createdAt: string;
}

interface GroupedStory {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  stories: Story[];
}

interface StoryViewerProps {
  groupedStories: GroupedStory[];
  initialUserIndex: number;
  onClose: () => void;
  onStoriesChange?: (stories: GroupedStory[]) => void;
}

interface StoryViewerItem { userId: string; username: string; displayName: string; avatarUrl?: string; viewedAt: string }

export default function StoryViewer({ groupedStories, initialUserIndex, onClose, onStoriesChange }: StoryViewerProps) {
  const { user } = useAuth();
  const [userIndex, setUserIndex] = useState(initialUserIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [stories, setStories] = useState(groupedStories);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isViewersOpen, setIsViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<StoryViewerItem[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [viewersError, setViewersError] = useState('');
  const [videoDuration, setVideoDuration] = useState(5);

  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const storyVideoRef = useRef<HTMLVideoElement>(null);

  const currentUserStories = stories[userIndex];
  const currentStory = currentUserStories?.stories[storyIndex];
  const isOwnStory = Boolean(
    user
    && currentUserStories
    && (
      (user.userId && currentUserStories.userId && String(user.userId) === String(currentUserStories.userId))
      || (user.username && currentUserStories.username
        && user.username.toLowerCase() === currentUserStories.username.toLowerCase())
    )
  );

  // Reset story index when user index changes
  useEffect(() => {
    setStoryIndex(0);
    setProgress(0);
  }, [userIndex]);

  // Record view automatically
  useEffect(() => {
    if (currentStory && !isOwnStory) {
      api.post(`/stories/${currentStory.storyId}/view`).catch(() => {});
    }
  }, [currentStory, isOwnStory]);

  // Handle automatic progress timer (5 seconds per story)
  useEffect(() => {
    if (isPaused || isMenuOpen || isDeleteOpen || isViewersOpen || !currentStory) return;

    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval.current!);
          handleNextStory();
          return 0;
        }
        return prev + (10 / Math.max(videoDuration, 0.1));
      });
    }, 100);

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [userIndex, storyIndex, isPaused, isMenuOpen, isDeleteOpen, isViewersOpen, currentStory, videoDuration]);

  useEffect(() => {
    const video = storyVideoRef.current;
    if (!video) return;
    if (isPaused || isMenuOpen || isDeleteOpen || isViewersOpen) video.pause();
    else video.play().catch(error => console.error('No se pudo reproducir la historia de video:', error));
  }, [isPaused, isMenuOpen, isDeleteOpen, isViewersOpen, currentStory]);

  const openViewers = async () => {
    if (!currentStory || !isOwnStory) return;
    setIsViewersOpen(true);
    setViewersLoading(true);
    setViewersError('');
    try { const response = await api.get(`/stories/${currentStory.storyId}/viewers`); setViewers(response.data || []); }
    catch (error: any) { setViewersError(error.response?.data?.message || 'No se pudieron cargar las vistas.'); }
    finally { setViewersLoading(false); }
  };

  const handleNextStory = () => {
    if (storyIndex < currentUserStories.stories.length - 1) {
      setStoryIndex(storyIndex + 1);
      setProgress(0);
    } else if (userIndex < stories.length - 1) {
      setUserIndex(userIndex + 1);
    } else {
      onClose();
    }
  };

  const handlePrevStory = () => {
    if (storyIndex > 0) {
      setStoryIndex(storyIndex - 1);
      setProgress(0);
    } else if (userIndex > 0) {
      setUserIndex(userIndex - 1);
      // Set to last story of previous user
      setTimeout(() => {
        setStoryIndex(stories[userIndex - 1].stories.length - 1);
      }, 50);
    }
  };

  const handleDeleteStory = async () => {
    if (!currentStory) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/stories/${currentStory.storyId}`);
      const remainingStories = currentUserStories.stories.filter(story => story.storyId !== currentStory.storyId);
      const removedCurrentGroup = remainingStories.length === 0;
      const nextGroups = removedCurrentGroup
        ? stories.filter((_, index) => index !== userIndex)
        : stories.map((group, index) => index === userIndex ? { ...group, stories: remainingStories } : group);
      setStories(nextGroups);
      onStoriesChange?.(nextGroups);
      setIsDeleteOpen(false);
      setIsMenuOpen(false);
      if (removedCurrentGroup || nextGroups.length === 0) return onClose();
      setStoryIndex(index => Math.min(index, remainingStories.length - 1));
      setProgress(0);
    } catch (error: any) {
      console.error('Error al eliminar historia:', error);
      setDeleteError(error.response?.data?.message || 'No se pudo eliminar el momento.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTouchStart = () => {
    setIsPaused(true);
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
  };

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
      if (diff < 60) return ' · hace ' + Math.max(1, diff) + ' s';
      if (diff < 3600) return ' · hace ' + Math.floor(diff / 60) + ' min';
      return ' · hace ' + Math.floor(diff / 3600) + ' h';
    } catch {
      return '';
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !currentStory) return;
    if (isOwnStory) {
      alert("Es tu propio momento.");
      return;
    }
    const textToSend = replyText.trim();
    setIsPaused(false);

    try {
      await api.post(`/chat/direct/${encodeURIComponent(currentUserStories.username)}/messages`, {
        content: textToSend,
        messageType: 'STORY_REPLY',
        storyPreviewId: currentStory.storyId
      });
      setReplyText('');
      alert(`Respuesta enviada a @${currentUserStories.username}`);
    } catch (err) {
      console.error('Error enviando respuesta a historia:', err);
      alert('No se pudo enviar la respuesta. Inténtalo de nuevo.');
    }
  };

  const handleSendEmojiReaction = async (emojiType: string) => {
    if (!currentStory) return;
    try {
      await api.post(`/stories/${currentStory.storyId}/reaction`, { reactionType: emojiType });
    } catch (err) {
      console.error('Error enviando reacción:', err);
    }
  };

  if (!currentUserStories || !currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between items-center animate-fade-in select-none h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Visual background wrapper */}
      <div className="absolute inset-0 z-0 opacity-40 blur-2xl scale-125 bg-cover bg-center pointer-events-none"
           style={{ backgroundImage: currentStory.mediaUrl ? `url(${currentStory.mediaUrl})` : 'none', background: currentStory.mediaUrl ? undefined : (currentStory.backgroundColor || '#09090b') }} />

      {/* Story Content Card */}
      <div 
        className="w-full max-w-lg h-full max-h-[85vh] md:max-h-[90vh] md:mt-4 bg-zinc-950 md:rounded-2xl overflow-hidden relative border border-zinc-900/60 z-10 flex flex-col items-center justify-center"
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Progress Bars */}
        <div className="absolute top-3 left-3 right-3 z-30 flex gap-1">
          {currentUserStories.stories.map((s, idx) => (
            <div key={s.storyId} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
              <div 
                className="h-full bg-teal-500 rounded-full transition-all duration-75"
                style={{ 
                  width: idx < storyIndex ? '100%' : idx === storyIndex ? `${progress}%` : '0%' 
                }}
              />
            </div>
          ))}
        </div>

        {/* Top bar details (User Avatar, display name, options and controls) */}
        <div className="absolute top-6 left-4 right-4 z-30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserAvatar avatarUrl={currentUserStories.avatarUrl} name={currentUserStories.displayName} className="h-9 w-9 rounded-full text-xs border border-white/20" />
            <div>
              <span className="text-white text-xs font-bold block">{currentUserStories.displayName}</span>
              <span className="text-[10px] text-zinc-400 block">@{currentUserStories.username}{formatRelativeTime(currentStory.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              {isOwnStory && <button type="button" aria-label="Opciones de momento" onClick={(event) => { event.stopPropagation(); setDeleteError(''); setIsMenuOpen(open => !open); }} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white transition-all hover:bg-black/60"><MoreHorizontal className="h-5 w-5" /></button>}
              {isOwnStory && isMenuOpen && <div className="absolute right-0 top-full z-50 mt-2 w-48 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 p-1 shadow-2xl"><button type="button" onClick={(event) => { event.stopPropagation(); setIsMenuOpen(false); void openViewers(); }} className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-bold text-white hover:bg-zinc-900">Ver quién lo vio</button><button type="button" onClick={(event) => { event.stopPropagation(); setIsMenuOpen(false); setIsDeleteOpen(true); }} className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-bold text-rose-400 hover:bg-zinc-900">Eliminar momento</button></div>}
            </div>
            {isOwnStory && <button type="button" aria-label="Opciones de momento" onClick={(event) => { event.stopPropagation(); setDeleteError(''); setIsMenuOpen(true); }} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white transition-all hover:bg-black/60 md:hidden"><MoreHorizontal className="h-5 w-5" /></button>}
            <button type="button" aria-label={isPaused ? 'Reanudar momento' : 'Pausar momento'} onClick={() => setIsPaused(!isPaused)} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-all">
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button type="button" aria-label="Cerrar momentos" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 transition-all">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Dynamic Story render */}
        <div className="w-full h-full flex items-center justify-center relative">
          {/* L/R Border Click Zones */}
          <div className="absolute top-0 bottom-0 left-0 w-1/4 z-20 cursor-pointer" onClick={(e) => { e.stopPropagation(); handlePrevStory(); }} />
          <div className="absolute top-0 bottom-0 right-0 w-1/4 z-20 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleNextStory(); }} />

          {currentStory.mediaType === 'IMAGE' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={currentStory.mediaUrl} 
              alt="story-media" 
              className="w-full h-full object-contain pointer-events-none"
            />
          )}

          {currentStory.mediaType === 'VIDEO' && (
            <video ref={storyVideoRef} src={currentStory.mediaUrl} autoPlay playsInline onLoadedMetadata={(event) => setVideoDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 5)} onEnded={handleNextStory} className="w-full h-full object-contain" />
          )}

          {currentStory.mediaType === 'TEXT' && (
            <div 
              style={{ background: currentStory.backgroundColor || '#6366f1' }}
              className="w-full h-full flex items-center justify-center p-8 text-center"
            >
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-relaxed font-sans max-w-sm">
                {currentStory.textContent}
              </h2>
            </div>
          )}

          {/* Overlays Rendering */}
          {(() => {
            let parsedOverlays: any[] = [];
            if ((currentStory as any).overlayData) {
              try {
                parsedOverlays = JSON.parse((currentStory as any).overlayData);
              } catch (e) {}
            }
            return parsedOverlays.map((o: any) => (
              <div
                key={o.id}
                className="absolute pointer-events-none select-none origin-center z-20"
                style={{
                  left: `${o.x * 100}%`,
                  top: `${o.y * 100}%`,
                  transform: `translate(-50%, -50%) scale(${o.scale})`,
                  color: o.color || '#ffffff'
                }}
              >
                <div className={`px-3 py-1.5 rounded-xl font-bold text-center ${o.bg ? 'bg-black/75 text-white' : ''}`}>
                  {o.value}
                </div>
              </div>
            ));
          })()}

          {/* Music Tag overlay */}
          {currentStory.musicTitle && (
            <div className="absolute bottom-6 left-4 bg-black/60 border border-zinc-800 px-3 py-1.5 rounded-full text-xs text-white flex items-center gap-1.5 backdrop-blur-md">
              <span className="animate-spin text-indigo-400">🎵</span>
              <span>{currentStory.musicTitle}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom quick action chat reply & reactions */}
      {!isOwnStory && <div className="w-full max-w-lg p-4 bg-zinc-950 border-t border-zinc-900 z-20 flex flex-col gap-2">
        {/* Quick Emoji Reactions */}
        <div className="flex items-center justify-around py-1 text-lg">
          {['❤️', '😂', '😮', '😢', '🔥'].map((emoji, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendEmojiReaction(emoji)}
              className="hover:scale-125 transition-transform p-1"
            >
              {emoji}
            </button>
          ))}
        </div>

        <form onSubmit={handleSendReply} className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder={`Responder a ${currentUserStories.displayName}...`}
            value={replyText}
            onFocus={() => setIsPaused(true)}
            onChange={(e) => setReplyText(e.target.value)}
            className="flex-grow px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500/80 transition-all placeholder-zinc-500"
          />
          <button 
            type="submit"
            className="p-2.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl active:scale-95 transition-all flex items-center justify-center font-bold text-xs"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>}

      {isOwnStory && <button type="button" onClick={() => void openViewers()} className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/55 px-4 py-2 text-xs font-bold text-white backdrop-blur-md"><Eye className="h-4 w-4"/> Vistas</button>}

      {isOwnStory && isMenuOpen && <div className="fixed inset-0 z-40 bg-black/45 md:hidden" onClick={() => setIsMenuOpen(false)}>
        <div className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-zinc-700 bg-zinc-950 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl" onClick={event => event.stopPropagation()}>
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700" />
          <button type="button" onClick={() => { setIsMenuOpen(false); void openViewers(); }} className="min-h-12 w-full rounded-xl px-4 text-left text-sm font-bold text-white hover:bg-zinc-900">Ver quién lo vio</button><button type="button" onClick={() => { setIsMenuOpen(false); setIsDeleteOpen(true); }} className="min-h-12 w-full rounded-xl px-4 text-left text-sm font-bold text-rose-400 hover:bg-zinc-900">Eliminar momento</button>
        </div>
      </div>}

      {isDeleteOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => !isDeleting && setIsDeleteOpen(false)}>
        <div className="w-full max-w-sm rounded-2xl border border-zinc-700 bg-zinc-950 p-5 space-y-4" onClick={event => event.stopPropagation()}>
          <h3 className="font-bold text-white">¿Eliminar este momento?</h3>
          <p className="text-sm text-zinc-400">Esta acción no se puede deshacer.</p>
          {deleteError && <p role="alert" className="text-xs text-rose-400">{deleteError}</p>}
          <div className="flex gap-3"><button disabled={isDeleting} onClick={() => setIsDeleteOpen(false)} className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm text-white">Cancelar</button><button disabled={isDeleting} onClick={handleDeleteStory} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">{isDeleting ? 'Eliminando...' : 'Eliminar'}</button></div>
        </div>
      </div>}

      {isViewersOpen && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/65 md:items-center" onClick={() => setIsViewersOpen(false)}><div className="max-h-[70vh] w-full max-w-md overflow-hidden rounded-t-3xl border border-zinc-700 bg-zinc-950 md:rounded-3xl" onClick={event => event.stopPropagation()}><div className="flex items-center justify-between border-b border-zinc-800 p-4"><div><h3 className="font-bold text-white">Vistas del momento</h3><p className="text-xs text-zinc-400">{viewers.length} {viewers.length === 1 ? 'persona' : 'personas'}</p></div><button onClick={() => setIsViewersOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-white"><X className="h-4 w-4"/></button></div><div className="max-h-[55vh] overflow-y-auto p-3">{viewersLoading ? <p className="p-6 text-center text-sm text-zinc-400">Cargando vistas…</p> : viewersError ? <div className="p-6 text-center"><p className="text-sm text-rose-400">{viewersError}</p><button onClick={() => void openViewers()} className="mt-3 text-xs font-bold text-teal-400">Reintentar</button></div> : viewers.length ? viewers.map(viewer => <div key={viewer.userId} className="flex items-center gap-3 rounded-2xl p-3 hover:bg-zinc-900"><UserAvatar avatarUrl={viewer.avatarUrl} name={viewer.displayName || viewer.username} className="h-11 w-11 rounded-full text-xs"/><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{viewer.displayName || viewer.username}</p><p className="text-xs text-zinc-400">@{viewer.username}{formatRelativeTime(viewer.viewedAt)}</p></div></div>) : <p className="p-8 text-center text-sm text-zinc-400">Aún nadie ha visto este momento.</p>}</div></div></div>}
    </div>
  );
}
