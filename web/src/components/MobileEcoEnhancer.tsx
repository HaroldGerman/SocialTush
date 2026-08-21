'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import EcoThread from '@/components/EcoThread';

type PortalTarget = {
  postId: string;
  mount: HTMLElement;
};

export default function MobileEcoEnhancer() {
  const [targets, setTargets] = useState<PortalTarget[]>([]);

  useEffect(() => {
    if (!window.location.pathname.startsWith('/feed')) return;
    if (!window.matchMedia('(max-width: 767px)').matches) return;

    const scan = () => {
      const next: PortalTarget[] = [];
      const articles = Array.from(document.querySelectorAll<HTMLElement>('article[id]'));

      for (const article of articles) {
        const input = article.querySelector<HTMLInputElement>('input[placeholder^="Escribe un eco"]');
        const existingMount = article.querySelector<HTMLElement>('[data-lifonk-eco-thread="true"]');

        if (!input) {
          existingMount?.remove();
          continue;
        }

        const legacy = input.closest<HTMLElement>('div.border-t');
        if (!legacy) continue;
        legacy.style.display = 'none';
        legacy.dataset.lifonkLegacyEco = 'true';

        let mount = existingMount;
        if (!mount) {
          mount = document.createElement('div');
          mount.dataset.lifonkEcoThread = 'true';
          mount.className = 'border-t border-slate-100 px-4 py-3 dark:border-slate-800';
          legacy.insertAdjacentElement('afterend', mount);
        }

        next.push({ postId: article.id, mount });
      }

      setTargets((previous) => {
        if (previous.length === next.length && previous.every((item, index) => item.postId === next[index]?.postId && item.mount === next[index]?.mount)) {
          return previous;
        }
        return next;
      });
    };

    scan();
    const observer = new MutationObserver(() => scan());
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', scan);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scan);
      document.querySelectorAll<HTMLElement>('[data-lifonk-legacy-eco="true"]').forEach((element) => {
        element.style.display = '';
        delete element.dataset.lifonkLegacyEco;
      });
      document.querySelectorAll<HTMLElement>('[data-lifonk-eco-thread="true"]').forEach((element) => element.remove());
    };
  }, []);

  const portals = useMemo(() => targets.map(({ postId, mount }) => createPortal(
    <EcoThread postId={postId} />,
    mount,
    `eco-${postId}`,
  )), [targets]);

  return <>{portals}</>;
}
