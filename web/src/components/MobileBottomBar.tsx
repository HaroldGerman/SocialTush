'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Plus, MessageSquare, User, PlaySquare } from 'lucide-react';
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
    if (onOpenCreate) onOpenCreate();
    else openCreateHub();
  };

  const base = 'flex min-w-0 flex-1 flex-col items-center gap-0.5';
  const active = 'text-teal-700 dark:text-teal-400 font-bold';
  const inactive = 'text-slate-500 dark:text-slate-400';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-slate-200 bg-white px-1 shadow-lg dark:border-slate-800 dark:bg-[#0f172a] md:hidden">
      <Link href="/feed" className={`${base} ${pathname === '/feed' || pathname === '/' ? active : inactive}`}>
        <Home className="h-5 w-5" />
        <span className="text-[9px]">Ritmo</span>
      </Link>

      <Link href="/pulse" className={`${base} ${pathname.startsWith('/pulse') ? active : inactive}`}>
        <PlaySquare className="h-5 w-5" />
        <span className="text-[9px]">Pulso</span>
      </Link>

      <Link href="/circles" className={`${base} ${pathname.startsWith('/circles') ? active : inactive}`}>
        <Compass className="h-5 w-5" />
        <span className="text-[9px]">Círculos</span>
      </Link>

      <button onClick={handleCreateClick} className="flex min-w-0 flex-1 flex-col items-center">
        <div className="-mt-5 flex h-10 w-10 items-center justify-center rounded-full border border-teal-500/50 bg-teal-700 text-white shadow-md">
          <Plus className="h-6 w-6 stroke-[3]" />
        </div>
        <span className="mt-0.5 text-[9px] font-bold text-teal-700 dark:text-teal-400">Crear</span>
      </button>

      <Link href="/chat" className={`${base} ${pathname.startsWith('/chat') ? active : inactive}`}>
        <span className="relative">
          <MessageSquare className="h-5 w-5" />
          {totalUnreadMessages > 0 && <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black leading-none text-white">{totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}</span>}
        </span>
        <span className="text-[9px]">Chat</span>
      </Link>

      <Link href={user ? `/profile/${user.username}` : '/login'} className={`${base} ${pathname.startsWith('/profile') ? active : inactive}`}>
        {user ? <UserAvatar avatarUrl={user.avatarUrl} name={user.displayName || user.username} className={`h-6 w-6 rounded-full border ${pathname.startsWith('/profile') ? 'border-teal-600' : 'border-slate-300 dark:border-slate-700'} text-[9px]`} /> : <User className="h-5 w-5" />}
        <span className="text-[9px]">Espacio</span>
      </Link>
    </div>
  );
}
