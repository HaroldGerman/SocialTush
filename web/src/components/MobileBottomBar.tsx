'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Compass, Plus, MessageSquare, User } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface MobileBottomBarProps {
  onOpenCreate?: () => void;
}

export default function MobileBottomBar({ onOpenCreate }: MobileBottomBarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0f172a] border-t border-slate-800 z-50 flex items-center justify-around px-2 shadow-lg">
      {/* 1. Inicio */}
      <Link 
        href="/feed" 
        className={`flex flex-col items-center gap-0.5 ${pathname === '/feed' || pathname === '/' ? 'text-teal-400 font-bold' : 'text-slate-400'}`}
      >
        <Home className="w-5 h-5" />
        <span className="text-[10px]">Inicio</span>
      </Link>

      {/* 2. Círculos */}
      <Link 
        href="/circles" 
        className={`flex flex-col items-center gap-0.5 ${pathname.startsWith('/circles') ? 'text-teal-400 font-bold' : 'text-slate-400'}`}
      >
        <Compass className="w-5 h-5" />
        <span className="text-[10px]">Círculos</span>
      </Link>

      {/* 3. Crear (Featured Middle Button) */}
      <button 
        onClick={() => {
          if (onOpenCreate) {
            onOpenCreate();
          } else {
            window.location.href = '/feed';
          }
        }}
        className="flex flex-col items-center"
      >
        <div className="w-10 h-10 rounded-full bg-teal-700 text-white flex items-center justify-center -mt-5 shadow-md border border-teal-500/50">
          <Plus className="w-6 h-6 stroke-[3]" />
        </div>
        <span className="text-[10px] font-bold text-teal-400 mt-0.5">Crear</span>
      </button>

      {/* 4. Mensajes */}
      <Link 
        href="/chat" 
        className={`flex flex-col items-center gap-0.5 ${pathname.startsWith('/chat') ? 'text-teal-400 font-bold' : 'text-slate-400'}`}
      >
        <MessageSquare className="w-5 h-5" />
        <span className="text-[10px]">Mensajes</span>
      </Link>

      {/* 5. Perfil */}
      <Link 
        href={`/profile/${user?.username || 'usuario_A'}`} 
        className={`flex flex-col items-center gap-0.5 ${pathname.startsWith('/profile') ? 'text-teal-400 font-bold' : 'text-slate-400'}`}
      >
        <User className="w-5 h-5" />
        <span className="text-[10px]">Perfil</span>
      </Link>
    </div>
  );
}
