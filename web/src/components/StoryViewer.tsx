'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Pause, Heart, Send } from 'lucide-react';

interface Story {
  storyId: string;
  mediaType: string;
  mediaUrl: string;
  textContent: string;
  backgroundColor: string;
  musicTitle: string;
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
}

export default function StoryViewer({ groupedStories, initialUserIndex, onClose }: StoryViewerProps) {
  const [userIndex, setUserIndex] = useState(initialUserIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [replyText, setReplyText] = useState('');

  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  const currentUserStories = groupedStories[userIndex];
  const currentStory = currentUserStories?.stories[storyIndex];

  // Reset story index when user index changes
  useEffect(() => {
    setStoryIndex(0);
    setProgress(0);
  }, [userIndex]);

  // Handle automatic progress timer (5 seconds per story)
  useEffect(() => {
    if (isPaused || !currentStory) return;

    progressInterval.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval.current!);
          handleNextStory();
          return 0;
        }
        return prev + 2; // Increments to reach 100 in ~5s
      });
    }, 100);

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [userIndex, storyIndex, isPaused, currentStory]);

  const handleNextStory = () => {
    if (storyIndex < currentUserStories.stories.length - 1) {
      setStoryIndex(storyIndex + 1);
      setProgress(0);
    } else if (userIndex < groupedStories.length - 1) {
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
        setStoryIndex(groupedStories[userIndex - 1].stories.length - 1);
      }, 50);
    }
  };

  const handleTouchStart = () => {
    setIsPaused(true);
  };

  const handleTouchEnd = () => {
    setIsPaused(false);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    alert(`Respuesta enviada a @${currentUserStories.username}: "${replyText}"`);
    setReplyText('');
    setIsPaused(false);
  };

  if (!currentUserStories || !currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between items-center animate-fade-in select-none">
      {/* Visual background wrapper */}
      <div className="absolute inset-0 z-0 opacity-40 blur-2xl scale-125 bg-cover bg-center pointer-events-none"
           style={{ backgroundImage: currentStory.mediaUrl ? `url(${currentStory.mediaUrl})` : 'none', backgroundColor: currentStory.backgroundColor || '#09090b' }} />

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
                className="h-full bg-indigo-500 rounded-full transition-all duration-75"
                style={{ 
                  width: idx < storyIndex ? '100%' : idx === storyIndex ? `${progress}%` : '0%' 
                }}
              />
            </div>
          ))}
        </div>

        {/* Top bar details (User Avatar, display name, close btn) */}
        <div className="absolute top-6 left-4 right-4 z-30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {currentUserStories.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentUserStories.avatarUrl} alt={currentUserStories.displayName} className="h-9 w-9 rounded-full object-cover border border-white/20" />
            ) : (
              <div className="h-9 w-9 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-white">
                {currentUserStories.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <span className="text-white text-xs font-bold block">{currentUserStories.displayName}</span>
              <span className="text-[10px] text-zinc-400 block">@{currentUserStories.username}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setIsPaused(!isPaused)} className="p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all">
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-full bg-black/40 text-white hover:bg-black/60 transition-all">
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

          {currentStory.mediaType === 'TEXT' && (
            <div 
              style={{ backgroundColor: currentStory.backgroundColor || '#6366f1' }}
              className="w-full h-full flex items-center justify-center p-8 text-center"
            >
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-relaxed font-sans max-w-sm">
                {currentStory.textContent}
              </h2>
            </div>
          )}

          {/* Music Tag overlay */}
          {currentStory.musicTitle && (
            <div className="absolute bottom-6 left-4 bg-black/60 border border-zinc-800 px-3 py-1.5 rounded-full text-xs text-white flex items-center gap-1.5 backdrop-blur-md">
              <span className="animate-spin text-indigo-400">🎵</span>
              <span>{currentStory.musicTitle}</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom quick action chat reply */}
      <div className="w-full max-w-lg p-4 bg-zinc-950 border-t border-zinc-900 z-25 flex items-center gap-3">
        <form onSubmit={handleSendReply} className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder={`Responder a ${currentUserStories.displayName}...`}
            value={replyText}
            onFocus={() => setIsPaused(true)}
            onChange={(e) => setReplyText(e.target.value)}
            className="flex-grow px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500/80 transition-all placeholder-zinc-500"
          />
          <button 
            type="submit"
            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl active:scale-95 transition-all flex items-center justify-center"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
