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

  const base = 'flex h-full min-w-0 flex-col items-center justify-center gap-1 text-center';
  const active = 'text-teal-700 dark:text-teal-400 font-bold';
  const inactive = 'text-slate-500 dark:text-slate-400';
  const ownProfilePath = user?.username ? `/profile/${user.username}` : '';
  const isOwnProfile = Boolean(ownProfilePath && pathname === ownProfilePath);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 grid h-[68px] grid-cols-6 items-stretch border-t border-slate-200 bg-white px-1 shadow-[0_-6px_20px_rgba(15,23,42,.07)] dark:border-slate-800 dark:bg-[#0f172a] md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <Link href="/feed" className={`${base} ${pathname === '/feed' || pathname === '/' ? active : inactive}`}>
        <Home className="h-5 w-5 shrink-0" />
        <span className="w-full truncate text-[9px] leading-none">Ritmo</span>
      </Link>

      <Link href="/pulse" className={`${base} ${pathname.startsWith('/pulse') ? active : inactive}`}>
        <PlaySquare className="h-5 w-5 shrink-0" />
        <span className="w-full truncate text-[9px] leading-none">Pulso</span>
      </Link>

      <Link href="/circles" className={`${base} ${pathname.startsWith('/circles') ? active : inactive}`}>
        <Compass className="h-5 w-5 shrink-0" />
        <span className="w-full truncate text-[9px] leading-none">Círculos</span>
      </Link>

      <button onClick={handleCreateClick} className={`${base} text-teal-700 dark:text-teal-400`} aria-label="Crear">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm shadow-teal-900/20">
          <Plus className="h-5 w-5 stroke-[2.7]" />
        </span>
        <span className="w-full truncate text-[9px] font-bold leading-none">Crear</span>
      </button>

      <Link href="/chat" className={`${base} ${pathname.startsWith('/chat') ? active : inactive}`}>
        <span className="relative shrink-0">
          <MessageSquare className="h-5 w-5" />
          {totalUnreadMessages > 0 && <span className="absolute -right-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-black leading-none text-white">{totalUnreadMessages > 99 ? '99+' : totalUnreadMessages}</span>}
        </span>
        <span className="w-full truncate text-[9px] leading-none">Chat</span>
      </Link>

      <Link href={user ? ownProfilePath : '/login'} className={`${base} ${isOwnProfile ? active : inactive}`}>
        {user ? <UserAvatar avatarUrl={user.avatarUrl} name={user.displayName || user.username} className={`h-5 w-5 shrink-0 rounded-full border ${isOwnProfile ? 'border-teal-600' : 'border-slate-300 dark:border-slate-700'} text-[8px]`} /> : <User className="h-5 w-5 shrink-0" />}
        <span className="w-full truncate text-[9px] leading-none">Espacio</span>
      </Link>
    </div>
  );
}
