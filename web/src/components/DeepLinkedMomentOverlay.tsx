'use client';

import { useEffect, useMemo, useState } from 'react';
import StoryViewer from '@/components/StoryViewer';
import { api } from '@/context/AuthContext';

type Story = {
  storyId: string;
  mediaType: string;
  mediaUrl: string;
  textContent: string;
  backgroundColor: string;
  musicTitle: string;
  createdAt: string;
  overlayData?: string;
  viewedByMe?: boolean;
};

type GroupedStory = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  hasUnseenStories?: boolean;
  stories: Story[];
};

export default function DeepLinkedMomentOverlay() {
  const [groups, setGroups] = useState<GroupedStory[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (window.location.pathname !== '/feed') return;
    const id = new URLSearchParams(window.location.search).get('moment');
    if (!id) return;
    setTargetId(id);
    setUnavailable(false);

    // Use the exact same source of truth as the Momento row in Ritmo.
    // If a Momento is visible there, a deep link from Chat must open it too.
    void api.get('/stories/active').then((response) => {
      const activeGroups: GroupedStory[] = Array.isArray(response.data) ? response.data : [];
      const ownerGroup = activeGroups.find((group) => group.stories?.some((story) => String(story.storyId) === String(id)));
      if (!ownerGroup) {
        setUnavailable(true);
        return;
      }

      const target = ownerGroup.stories.find((story) => String(story.storyId) === String(id));
      if (!target) {
        setUnavailable(true);
        return;
      }

      setGroups([{
        ...ownerGroup,
        stories: [target, ...ownerGroup.stories.filter((story) => String(story.storyId) !== String(id))],
      }]);
    }).catch(() => setUnavailable(true));
  }, []);

  const targetUserIndex = useMemo(() => {
    if (!targetId) return -1;
    return groups.findIndex((group) => group.stories?.[0] && String(group.stories[0].storyId) === String(targetId));
  }, [groups, targetId]);

  const close = () => {
    setTargetId(null);
    setUnavailable(false);
    const url = new URL(window.location.href);
    url.searchParams.delete('moment');
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  };

  if (unavailable && targetId) {
    return (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 p-4" onClick={close}>
        <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl dark:bg-[#0f172a]" onClick={(event) => event.stopPropagation()}>
          <p className="text-sm font-extrabold text-slate-900 dark:text-white">Este Momento no está entre tus Momentos activos</p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Si todavía aparece en Ritmo, actualiza una vez la página y vuelve a tocarlo desde el chat.</p>
          <button type="button" onClick={close} className="mt-4 rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-bold text-white">Volver a Ritmo</button>
        </div>
      </div>
    );
  }

  if (!targetId || targetUserIndex < 0) return null;

  return <StoryViewer groupedStories={groups} initialUserIndex={targetUserIndex} onClose={close} onStoriesChange={setGroups} />;
}
