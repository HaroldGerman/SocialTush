'use client';

import React, { useEffect, useState } from 'react';
import MobileFeedPage from '@/components/mobile/MobileFeedPage';

export default function FeedLayout({ children }: { children: React.ReactNode }) {
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

  if (!mounted) return <div className="min-h-[100dvh] bg-[#f4f7f7] dark:bg-[#07151d]" />;
  return mobile ? <MobileFeedPage /> : <>{children}</>;
}
