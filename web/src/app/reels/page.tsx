'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Heart, MessageCircle, Bookmark, Music, Play, Pause, Volume2, VolumeX, ArrowLeft, MoreVertical, Compass
} from 'lucide-react';

interface ReelDto {
  postId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  caption: string;
  location: string;
  musicTitle: string;
  mediaUrls: string[];
  likesCount: number;
  commentsCount: number;
  hasLiked: boolean;
  isSaved: boolean;
  createdAt: string;
}

export default function ReelsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [reels, setReels] = useState<ReelDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Load reels
  useEffect(() => {
    const fetchReels = async () => {
      try {
        const res = await api.get('/posts/reels?page=0&size=10');
        setReels(res.data.posts);
      } catch (err) {
        setReels(getMockReels());
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchReels();
    }
  }, [user]);

  // Play/pause video based on active scroll index
  useEffect(() => {
    reels.forEach((reel, index) => {
      const vid = videoRefs.current[reel.postId];
      if (vid) {
        if (index === activeIndex) {
          vid.play().catch(() => {});
        } else {
          vid.pause();
          vid.currentTime = 0;
        }
      }
    });
  }, [activeIndex, reels]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollPos = containerRef.current.scrollTop;
    const itemHeight = containerRef.current.clientHeight || 500;
    const newIndex = Math.round(scrollPos / itemHeight);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < reels.length) {
      setActiveIndex(newIndex);
    }
  };

  const handleLikeToggle = async (postId: string) => {
    try {
      const res = await api.post(`/likes/${postId}`);
      setReels(prev => prev.map(r => {
        if (r.postId === postId) {
          return {
            ...r,
            hasLiked: res.data.liked,
            likesCount: res.data.count
          };
        }
        return r;
      }));
    } catch (err) {
      setReels(prev => prev.map(r => {
        if (r.postId === postId) {
          return {
            ...r,
            hasLiked: !r.hasLiked,
            likesCount: r.hasLiked ? r.likesCount - 1 : r.likesCount + 1
          };
        }
        return r;
      }));
    }
  };

  const handleSaveToggle = async (postId: string) => {
    try {
      const res = await api.post(`/posts/${postId}/save`);
      setReels(prev => prev.map(r => {
        if (r.postId === postId) {
          return { ...r, isSaved: res.data.saved };
        }
        return r;
      }));
    } catch (err) {
      setReels(prev => prev.map(r => {
        if (r.postId === postId) {
          return { ...r, isSaved: !r.isSaved };
        }
        return r;
      }));
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <ActivityIndicator size="large" color="#6366f1" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center relative">
      {/* Top Header floating */}
      <div className="absolute top-4 left-4 z-40 flex items-center gap-3">
        <Link href="/" className="p-2.5 rounded-full bg-zinc-900/60 border border-zinc-800 text-white backdrop-blur-md hover:bg-zinc-800 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="text-xs font-bold bg-zinc-900/60 border border-zinc-800 px-3.5 py-2 rounded-full backdrop-blur-md">
          Reels
        </span>
      </div>

      <div className="absolute top-4 right-4 z-40">
        <button 
          onClick={() => setMuted(!muted)}
          className="p-2.5 rounded-full bg-zinc-900/60 border border-zinc-800 text-white backdrop-blur-md hover:bg-zinc-800 transition-colors"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Vertical Reels Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full max-w-sm h-screen md:h-[85vh] overflow-y-scroll snap-y snap-mandatory scrollbar-none flex flex-col md:rounded-2xl border-0 md:border border-zinc-900/60 shadow-2xl relative"
      >
        {reels.map((reel, idx) => (
          <div 
            key={reel.postId}
            className="w-full h-full min-h-full flex-shrink-0 snap-start relative flex items-center justify-center bg-zinc-950"
          >
            {/* Video Player */}
            {reel.mediaUrls && reel.mediaUrls.length > 0 ? (
              <video 
                ref={el => { videoRefs.current[reel.postId] = el; }}
                src={reel.mediaUrls[0]}
                loop
                muted={muted}
                playsInline
                className="w-full h-full object-cover pointer-events-none"
                onClick={() => {
                  const vid = videoRefs.current[reel.postId];
                  if (vid) {
                    if (vid.paused) vid.play().catch(() => {});
                    else vid.pause();
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-zinc-700 bg-zinc-950">
                <Compass className="h-8 w-8 text-zinc-800 animate-spin" />
                <span className="text-xs font-semibold">Video no cargado</span>
              </div>
            )}

            {/* Dark gradient overlay bottom */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

            {/* Side Social Actions panel */}
            <div className="absolute right-3.5 bottom-24 flex flex-col items-center gap-5 z-20">
              <button 
                onClick={() => handleLikeToggle(reel.postId)}
                className={`flex flex-col items-center gap-1.5 transition-transform active:scale-90 ${
                  reel.hasLiked ? 'text-rose-500' : 'text-white'
                }`}
              >
                <Heart className={`h-6 w-6 ${reel.hasLiked ? 'fill-current' : ''}`} />
                <span className="text-[10px] font-bold">{reel.likesCount}</span>
              </button>

              <button className="flex flex-col items-center gap-1.5 text-white transition-transform active:scale-90">
                <MessageCircle className="h-6 w-6" />
                <span className="text-[10px] font-bold">{reel.commentsCount}</span>
              </button>

              <button 
                onClick={() => handleSaveToggle(reel.postId)}
                className={`flex flex-col items-center gap-1.5 transition-transform active:scale-90 ${
                  reel.isSaved ? 'text-indigo-400' : 'text-white'
                }`}
              >
                <Bookmark className={`h-6 w-6 ${reel.isSaved ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Bottom Details panel */}
            <div className="absolute left-4 bottom-6 right-16 z-20 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-[10px] text-white border border-white/20">
                  {reel.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-bold text-white">@{reel.username}</span>
                <button className="px-2.5 py-0.5 border border-white/40 hover:border-white text-[9px] font-bold text-white rounded-full transition-colors">
                  Seguir
                </button>
              </div>

              <p className="text-[11px] text-zinc-300 leading-relaxed font-sans line-clamp-2">
                {reel.caption}
              </p>

              {reel.musicTitle && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Music className="h-3 w-3 text-indigo-400 animate-spin" />
                  <span className="text-[9px] text-zinc-400 font-semibold">{reel.musicTitle}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function ActivityIndicator({ size, color }: { size: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-10 w-10 bg-indigo-500 rounded-xl animate-pulse" />
      <span className="text-zinc-500 text-sm font-semibold">Cargando Reels...</span>
    </div>
  );
}

// Resilient fallback short videos
function getMockReels(): ReelDto[] {
  return [
    {
      postId: 'r1',
      userId: 'mock-1',
      username: 'neon_rider',
      displayName: 'Neon Rider',
      avatarUrl: '',
      caption: 'Prueba de reproducción vertical premium de Reels en SocialTush. 🚀 #reels #design',
      location: 'Tokyo, Japan',
      musicTitle: 'Kavinsky - Nightcall',
      mediaUrls: ['https://assets.mixkit.co/videos/preview/mixkit-urban-street-lights-at-night-vertical-shot-41909-large.mp4'],
      likesCount: 520,
      commentsCount: 14,
      hasLiked: false,
      isSaved: false,
      createdAt: new Date().toISOString()
    },
    {
      postId: 'r2',
      userId: 'mock-2',
      username: 'art_creative',
      displayName: 'Sophia',
      avatarUrl: '',
      caption: 'Explorando olas y naturaleza salvaje. 🌊 #nature #adventure',
      location: 'Bali, Indonesia',
      musicTitle: 'Ocean Breeze - Relaxing Sound',
      mediaUrls: ['https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-waves-crashing-on-a-beach-vertical-41604-large.mp4'],
      likesCount: 910,
      commentsCount: 22,
      hasLiked: true,
      isSaved: true,
      createdAt: new Date().toISOString()
    }
  ];
}
