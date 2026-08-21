'use client';

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function AccountSettingsShortcut() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user || pathname !== `/profile/${user.username}`) return null;

  return (
    <Link
      href="/settings"
      className="fixed bottom-20 right-[4.25rem] z-40 flex h-11 items-center gap-2 rounded-full border border-slate-300/70 bg-white px-3 text-xs font-bold text-slate-700 shadow-lg transition hover:border-teal-500 hover:bg-teal-50 hover:text-teal-800 dark:border-slate-700 dark:bg-[#0f172a] dark:text-slate-200 dark:hover:border-teal-700 dark:hover:bg-slate-800 dark:hover:text-teal-300 md:bottom-6 md:right-[5.25rem]"
      aria-label="Ajustes"
      title="Ajustes"
    >
      <Settings className="h-5 w-5" />
      <span className="hidden sm:inline">Ajustes</span>
    </Link>
  );
}
