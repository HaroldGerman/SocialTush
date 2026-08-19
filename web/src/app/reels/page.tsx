'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import MobileBottomBar from '@/components/MobileBottomBar';
import { 
  Heart, MessageCircle, Bookmark, Music, Play, Pause, Volume2, VolumeX, ArrowLeft, MoreVertical, Compass, Sparkles
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

  // Load reels from backend
  useEffect(() => {
    const fetchReels = async () => {
      try {
        const res = await api.get('/posts/reels?page=0&size=10');
        setReels(res.data?.posts || []);
      } catch (err) {
        setReels([]);
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
        }
      }
    });
  }, [activeIndex, reels]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollPosition = containerRef.current.scrollTop;
    const itemHeight = containerRef.current.clientHeight;
    const index = Math.round(scrollPosition / itemHeight);
    if (index !== activeIndex && index >= 0 && index < reels.length) {
      setActiveIndex(index);
    }
  };

  const handleLikeToggle = async (postId: string) => {
    try {
      const res = await api.post(`/likes/${postId}`);
      setReels(prev => prev.map(r => r.postId === postId ? { ...r, hasLiked: res.data.liked, likesCount: res.data.count } : r));
    } catch (err) {
      setReels(prev => prev.map(r => r.postId === postId ? { ...r, hasLiked: !r.hasLiked, likesCount: r.hasLiked ? r.likesCount - 1 : r.likesCount + 1 } : r));
    }
  };

  const handleSaveToggle = async (postId: string) => {
    try {
      const res = await api.post(`/posts/${postId}/save`);
      setReels(prev => prev.map(r => r.postId === postId ? { ...r, isSaved: res.data.saved } : r));
    } catch (err) {
      setReels(prev => prev.map(r => r.postId === postId ? { ...r, isSaved: !r.isSaved } : r));
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="h-10 w-10 bg-teal-700 rounded-xl" />
          <span className="text-teal-400 text-sm font-semibold">Cargando Reels...</span>
        </div>
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="min-h-screen bg-[#090d16] text-white flex flex-col items-center justify-center p-6 pb-20">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
          <Sparkles className="w-8 h-8 text-teal-400" />
        </div>
        <h3 className="text-lg font-extrabold mb-1">No hay Reels disponibles</h3>
        <p className="text-xs text-slate-400 text-center max-w-sm mb-6">
          Sé el primero en compartir un video o explorar más tarde.
        </p>
        <Link href="/feed" className="px-5 py-2.5 bg-teal-700 hover:bg-teal-600 rounded-xl text-xs font-bold text-white shadow-md">
          Volver al Feed
        </Link>
        <MobileBottomBar />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-white flex flex-col items-center justify-center relative overflow-hidden font-sans pb-16 md:pb-0">
      {/* Top Controls Overlay */}
      <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between max-w-md mx-auto">
        <button 
          onClick={() => router.back()}
          className="p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-all border border-white/10"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <span className="font-extrabold text-sm tracking-wider uppercase text-teal-400 drop-shadow-md">
          Reels
        </span>

        <button 
          onClick={() => setMuted(!muted)}
          className="p-2.5 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-all border border-white/10"
        >
          {muted ? <VolumeX className="w-5 h-5 text-rose-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
        </button>
      </div>

      {/* Main Snap Reel Feed */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full max-w-md h-screen overflow-y-scroll snap-y snap-mandatory scrollbar-none relative"
      >
        {reels.map((reel, index) => (
          <div 
            key={reel.postId}
            className="w-full h-full snap-start relative bg-slate-900 flex items-center justify-center overflow-hidden"
          >
            {/* Background Video / Image Player */}
            {reel.mediaUrls && reel.mediaUrls.length > 0 && (
              reel.mediaUrls[0].endsWith('.mp4') || reel.mediaUrls[0].includes('video') ? (
                <video 
                  ref={(el) => { videoRefs.current[reel.postId] = el; }}
                  src={reel.mediaUrls[0]}
                  loop
                  muted={muted}
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <img 
                  src={reel.mediaUrls[0]}
                  alt="Reel"
                  className="w-full h-full object-cover"
                />
              )
            )}

            {/* Dark Gradient Overlay for Readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 z-10 pointer-events-none" />

            {/* Right Side Social Actions Panel */}
            <div className="absolute right-4 bottom-24 z-30 flex flex-col items-center gap-6">
              {/* Like */}
              <button 
                onClick={() => handleLikeToggle(reel.postId)}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 group-hover:scale-110 transition-transform">
                  <Heart className={`w-6 h-6 ${reel.hasLiked ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
                </div>
                <span className="text-[11px] font-bold drop-shadow">{reel.likesCount}</span>
              </button>

              {/* Comment */}
              <button className="flex flex-col items-center gap-1 group">
                <div className="p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 group-hover:scale-110 transition-transform">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <span className="text-[11px] font-bold drop-shadow">{reel.commentsCount}</span>
              </button>

              {/* Bookmark Save */}
              <button 
                onClick={() => handleSaveToggle(reel.postId)}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 group-hover:scale-110 transition-transform">
                  <Bookmark className={`w-6 h-6 ${reel.isSaved ? 'fill-teal-400 text-teal-400' : 'text-white'}`} />
                </div>
              </button>
            </div>

            {/* Bottom Info Details overlay */}
            <div className="absolute left-4 right-16 bottom-20 z-30 space-y-3">
              {/* Author Row */}
              <div className="flex items-center gap-3">
                <Link href={`/profile/${reel.username}`} className="w-10 h-10 rounded-full bg-teal-800 text-white font-bold flex items-center justify-center text-xs border border-white/20 shadow-md">
                  {(reel.displayName || reel.username || 'U').charAt(0).toUpperCase()}
                </Link>
                <Link href={`/profile/${reel.username}`} className="font-extrabold text-sm text-white drop-shadow hover:underline">
                  @{reel.username}
                </Link>
              </div>

              {/* Caption */}
              {reel.caption ? (
                <p className="text-xs text-slate-100 font-medium line-clamp-2 drop-shadow-md">
                  {reel.caption}
                </p>
              ) : null}

              {/* Music Title Track */}
              {reel.musicTitle ? (
                <div className="flex items-center gap-2 text-teal-300 text-xs font-semibold drop-shadow">
                  <Music className="w-3.5 h-3.5 animate-spin" />
                  <span className="truncate max-w-[200px]">{reel.musicTitle}</span>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomBar />
    </div>
  );
}
