'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function MyProfileRedirect() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace(`/profile/${user.username}`);
      } else {
        router.replace('/login');
      }
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen bg-[#f4f6f9] flex items-center justify-center">
      <div className="animate-pulse flex flex-col items-center gap-3">
        <div className="h-10 w-10 bg-teal-800 rounded-2xl" />
        <span className="text-slate-500 text-xs font-semibold">Redirigiendo a tu perfil...</span>
      </div>
    </div>
  );
}
