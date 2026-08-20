'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Plus, MessageSquare, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCreateHub } from '@/context/CreateHubContext';
import { useRealtimeActivity } from '@/context/RealtimeActivityContext';
import UserAvatar from '@/components/UserAvatar';

interface MobileBottomBarProps {
  onOpenCreate?: () => void;
}

export default function MobileBottomBar({ onOpenCreate }: MobileBottomBarProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { openCreateHub } = useCreateHub();
  const { totalUnreadMessages } = useRealtimeActivity();

  const handleCreateClick = () => {
    if (onOpenCreate) {
      onOpenCreate();
    } else {
      openCreateHub();
    }
  };

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-[#0f172a] border-t border-slate-200 dark:border-slate-800 z-50 flex items-center justify-around px-2 shadow-lg">
      {/* 1. Ritmo */}
      <Link 
        href="/feed" 
        className={`flex flex-col items-center gap-0.5 ${pathname === '/feed' || pathname === '/' ? 'text-teal-700 dark:text-teal-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px]">Ritmo</span>
      </Link>

      {/* 2. Círculos */}
      <Link 
        href="/circles" 
        className={`flex flex-col items-center gap-0.5 ${pathname.startsWith('/circles') ? 'text-teal-700 dark:text-teal-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}
      >
        <Compass className="w-5 h-5" />
        <span className="text-[10px]">Círculos</span>
      </Link>

      {/* 3. Crear (Featured Middle Button) */}
      <button 
        onClick={handleCreateClick}
        className="flex flex-col items-center"
      >
        <div className="w-10 h-10 rounded-full bg-teal-700 text-white flex items-center justify-center -mt-5 shadow-md border border-teal-500/50">
          <Plus className="w-6 h-6 stroke-[3]" />
        </div>
        <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 mt-0.5">Crear</span>
      </button>

      {/* 4. Conversaciones */}
      <Link 
        href="/chat" 
        className={`flex flex-col items-center gap-0.5 ${pathname.startsWith('/chat') ? 'text-teal-700 dark:text-teal-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}
      >
        <span className="relative">
          <MessageSquare className="w-5 h-5" />
          {totalUnreadMessages > 0 && <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black leading-none text-white">{totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}</span>}
        </span>
        <span className="text-[10px]">Conversaciones</span>
      </Link>

      {/* 5. Espacio */}
      <Link 
        href={user ? `/profile/${user.username}` : '/login'}
        className={`flex flex-col items-center gap-0.5 ${pathname.startsWith('/profile') ? 'text-teal-700 dark:text-teal-400 font-bold' : 'text-slate-500 dark:text-slate-400'}`}
      >
        {user ? <UserAvatar avatarUrl={user.avatarUrl} name={user.displayName || user.username} className={`h-6 w-6 rounded-full border ${pathname.startsWith('/profile') ? 'border-teal-600' : 'border-slate-300 dark:border-slate-700'} text-[9px]`} /> : <User className="w-5 h-5" />}
        <span className="text-[10px]">Espacio</span>
      </Link>
    </div>
  );
}
