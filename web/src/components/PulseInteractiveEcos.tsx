'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import EcoThread from '@/components/EcoThread';

export default function PulseInteractiveEcos() {
  const [postId, setPostId] = useState<string | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!window.location.pathname.startsWith('/pulse')) return;
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>('button');
      if (!button || !button.querySelector('svg.lucide-message-circle')) return;
      const article = button.closest<HTMLElement>('article[data-post-id]');
      const selectedPostId = article?.dataset.postId;
      if (!selectedPostId) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      setPostId(selectedPostId);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    if (!postId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPostId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [postId]);

  if (!postId || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[2147482500] flex items-end bg-black/60" onClick={() => setPostId(null)}>
      <section className="max-h-[78dvh] w-full overflow-hidden rounded-t-[30px] bg-white text-slate-900 shadow-2xl dark:bg-[#0d1524] dark:text-white" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-black">Ecos</h2>
            <p className="text-[10px] font-semibold text-slate-400">Resona y responde a la conversación</p>
          </div>
          <button type="button" onClick={() => setPostId(null)} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300" aria-label="Cerrar Ecos">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(78dvh-72px)] overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <EcoThread postId={postId} />
        </div>
      </section>
    </div>,
    document.body,
  );
}
