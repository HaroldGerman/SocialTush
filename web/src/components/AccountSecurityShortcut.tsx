'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function AccountSecurityShortcut() {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user || pathname !== `/profile/${user.username}`) return null;

  return (
    <Link
      href="/settings/security"
      className="fixed bottom-20 right-4 z-40 flex h-11 items-center gap-2 rounded-full border border-teal-700/30 bg-white px-3 text-xs font-bold text-teal-800 shadow-lg transition hover:bg-teal-50 dark:border-teal-700/50 dark:bg-[#0f172a] dark:text-teal-300 dark:hover:bg-slate-800 md:bottom-6 md:right-6"
      aria-label="Seguridad de la cuenta"
      title="Seguridad de la cuenta"
    >
      <ShieldCheck className="h-5 w-5" />
      <span className="hidden sm:inline">Seguridad</span>
    </Link>
  );
}
