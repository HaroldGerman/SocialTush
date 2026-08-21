'use client';

import React, { useEffect, useState } from 'react';
import MobileChatPage from '@/components/mobile/MobileChatPage';

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const update = () => setMobile(query.matches);
    update();
    setMounted(true);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  if (!mounted) return <div className="h-[100dvh] bg-slate-50 dark:bg-[#07151d]" />;
  return mobile ? <MobileChatPage /> : <>{children}</>;
}
