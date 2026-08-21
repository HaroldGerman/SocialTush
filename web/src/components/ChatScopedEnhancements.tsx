'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@/context/AuthContext';

type ActiveStory = {
  storyId: string;
  mediaType?: string;
  mediaUrl?: string;
  textContent?: string;
};

type ActiveStoryGroup = { stories?: ActiveStory[] };

type AudioTarget = {
  key: string;
  audio: HTMLAudioElement;
  mount: HTMLElement;
  own: boolean;
};

const STORY_LABELS = new Set([
  'tu interacción con un momento',
  'tu interaccion con un momento',
  'interacción con tu momento',
  'interaccion con tu momento',
]);

const WAVE_HEIGHTS = [8, 15, 11, 21, 13, 26, 18, 11, 23, 15, 28, 19, 12, 25, 17, 10, 22, 14, 27, 16, 9, 20, 13, 24];

function formatAudioTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function findStoryCard(target: HTMLElement | null) {
  let current = target;
  for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
    if (current.tagName !== 'DIV') continue;
    const directLabel = Array.from(current.children).find((child) => child.tagName === 'P');
    const label = directLabel?.textContent?.trim().toLowerCase() || '';
    if (!STORY_LABELS.has(label)) continue;
    if (current.querySelector('img[alt="Momento"], video, div[style]')) return current;
  }
  return null;
}

function normalizedMediaKey(value?: string | null) {
  if (!value) return '';
  try {
    const parsed = new URL(value, window.location.origin);
    return decodeURIComponent(parsed.pathname).replace(/\/+$/, '').toLowerCase();
  } catch {
    return value.split(/[?#]/)[0].replace(/\/+$/, '').toLowerCase();
  }
}

function mediaMatches(first?: string | null, second?: string | null) {
  const a = normalizedMediaKey(first);
  const b = normalizedMediaKey(second);
  if (!a || !b) return false;
  if (a === b) return true;
  const aName = a.split('/').filter(Boolean).pop();
  const bName = b.split('/').filter(Boolean).pop();
  return Boolean(aName && bName && aName === bName);
}

function isOwnAudio(audio: HTMLAudioElement) {
  let current: HTMLElement | null = audio.parentElement;
  for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
    const classes = typeof current.className === 'string' ? current.className : '';
    if (classes.includes('linear-gradient(135deg,#1a8a80,#126f68)')) return true;
  }
  return false;
}

function AudioBubblePlayer({ audio, own }: { audio: HTMLAudioElement; own: boolean }) {
  const [playing, setPlaying] = useState(!audio.paused);
  const [current, setCurrent] = useState(audio.currentTime || 0);
  const [duration, setDuration] = useState(Number.isFinite(audio.duration) ? audio.duration : 0);
  const [rate, setRate] = useState(audio.playbackRate || 1);

  useEffect(() => {
    const update = () => setCurrent(audio.currentTime || 0);
    const metadata = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const play = () => setPlaying(true);
    const pause = () => setPlaying(false);
    const ended = () => { setPlaying(false); setCurrent(audio.duration || 0); };

    audio.addEventListener('timeupdate', update);
    audio.addEventListener('loadedmetadata', metadata);
    audio.addEventListener('durationchange', metadata);
    audio.addEventListener('play', play);
    audio.addEventListener('pause', pause);
    audio.addEventListener('ended', ended);
    metadata();

    return () => {
      audio.removeEventListener('timeupdate', update);
      audio.removeEventListener('loadedmetadata', metadata);
      audio.removeEventListener('durationchange', metadata);
      audio.removeEventListener('play', play);
      audio.removeEventListener('pause', pause);
      audio.removeEventListener('ended', ended);
    };
  }, [audio]);

  const togglePlay = async () => {
    if (audio.paused) {
      try { await audio.play(); } catch { /* Browser can reject playback until the next tap. */ }
    } else {
      audio.pause();
    }
  };

  const seek = (value: number) => {
    if (!Number.isFinite(duration) || duration <= 0) return;
    audio.currentTime = Math.max(0, Math.min(duration, value));
    setCurrent(audio.currentTime);
  };

  const cycleRate = () => {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    audio.playbackRate = next;
    setRate(next);
  };

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;
  const activeBars = Math.round(progress * WAVE_HEIGHTS.length);

  return (
    <div className={`min-w-[230px] max-w-[310px] rounded-2xl border px-3 py-3 shadow-sm ${own ? 'border-white/20 bg-white/10 text-white' : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100'}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void togglePlay()}
          aria-label={playing ? 'Pausar audio' : 'Reproducir audio'}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-md transition active:scale-95 ${own ? 'bg-white text-[#177f76]' : 'bg-[#177f76] text-white'}`}
        >
          <span className={`text-lg leading-none ${playing ? '' : 'translate-x-[1px]'}`}>{playing ? 'Ⅱ' : '▶'}</span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="relative flex h-9 items-center gap-[3px] overflow-hidden rounded-lg px-1">
            {WAVE_HEIGHTS.map((height, index) => (
              <span
                key={index}
                className={`w-[3px] shrink-0 rounded-full transition-colors ${index < activeBars ? (own ? 'bg-white' : 'bg-[#177f76]') : (own ? 'bg-white/30' : 'bg-slate-300 dark:bg-slate-600')}`}
                style={{ height }}
              />
            ))}
            <input
              aria-label="Progreso del audio"
              type="range"
              min={0}
              max={duration || 1}
              step={0.05}
              value={Math.min(current, duration || 1)}
              onChange={(event) => seek(Number(event.target.value))}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </div>
          <div className={`mt-1 flex items-center justify-between text-[10px] font-semibold ${own ? 'text-white/75' : 'text-slate-500 dark:text-slate-400'}`}>
            <span>{formatAudioTime(current)} / {formatAudioTime(duration)}</span>
            <button type="button" onClick={cycleRate} className={`rounded-full px-2 py-0.5 font-black ${own ? 'bg-white/15 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}>
              {rate}×
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatScopedEnhancements() {
  const [notice, setNotice] = useState('');
  const [audioTargets, setAudioTargets] = useState<AudioTarget[]>([]);
  const audioCounter = useRef(0);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!window.location.pathname.startsWith('/chat')) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('input, textarea, [contenteditable="true"]')) return;

      const card = findStoryCard(target);
      if (!card) return;

      event.preventDefault();
      event.stopPropagation();

      const preview = card.querySelector('img[alt="Momento"], video') as HTMLImageElement | HTMLVideoElement | null;
      const previewUrl = preview?.src || '';
      const textPreview = card.textContent || '';

      void api.get('/stories/active').then((response) => {
        const groups: ActiveStoryGroup[] = Array.isArray(response.data) ? response.data : [];
        const stories = groups.flatMap((group) => group.stories || []);
        const match = stories.find((story) => {
          if (previewUrl && story.mediaUrl && mediaMatches(previewUrl, story.mediaUrl)) return true;
          if (story.mediaType === 'TEXT' && story.textContent) return textPreview.includes(story.textContent);
          return false;
        });

        if (!match) {
          setNotice('Este momento ya no está disponible.');
          return;
        }
        window.location.assign(`/feed?moment=${encodeURIComponent(match.storyId)}`);
      }).catch(() => setNotice('No se pudo abrir el momento.'));
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    const scanAudios = () => {
      if (!window.location.pathname.startsWith('/chat')) {
        setAudioTargets([]);
        return;
      }

      const next: AudioTarget[] = [];
      const audios = Array.from(document.querySelectorAll<HTMLAudioElement>('audio'));

      for (const audio of audios) {
        if (!audio.src) continue;
        let key = audio.dataset.lifonkAudioKey;
        if (!key) {
          audioCounter.current += 1;
          key = `lifonk-audio-${audioCounter.current}`;
          audio.dataset.lifonkAudioKey = key;
        }

        let mount = document.querySelector<HTMLElement>(`[data-lifonk-audio-mount="${key}"]`);
        if (!mount) {
          mount = document.createElement('div');
          mount.dataset.lifonkAudioMount = key;
          audio.insertAdjacentElement('afterend', mount);
        }

        audio.style.display = 'none';
        next.push({ key, audio, mount, own: isOwnAudio(audio) });
      }

      setAudioTargets((previous) => {
        if (previous.length === next.length && previous.every((item, index) => item.key === next[index]?.key && item.mount === next[index]?.mount)) return previous;
        return next;
      });
    };

    scanAudios();
    const observer = new MutationObserver(scanAudios);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', scanAudios);

    return () => {
      observer.disconnect();
      window.removeEventListener('popstate', scanAudios);
      document.querySelectorAll<HTMLAudioElement>('audio[data-lifonk-audio-key]').forEach((audio) => {
        audio.style.display = '';
        delete audio.dataset.lifonkAudioKey;
      });
      document.querySelectorAll<HTMLElement>('[data-lifonk-audio-mount]').forEach((mount) => mount.remove());
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <>
      <style jsx global>{`
        [class~="bg-black/92"] {
          background-color: rgba(0, 0, 0, 0.96) !important;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        [class~="bg-black/92"] img[alt="Imagen ampliada"] {
          width: auto !important;
          height: auto !important;
          max-width: calc(100vw - 24px) !important;
          max-height: calc(100dvh - 32px) !important;
          object-fit: contain !important;
          border-radius: 14px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, .55);
        }
      `}</style>

      {audioTargets.map(({ key, audio, mount, own }) => createPortal(
        <AudioBubblePlayer key={key} audio={audio} own={own} />,
        mount,
        key,
      ))}

      {notice && typeof window !== 'undefined' && window.location.pathname.startsWith('/chat') && (
        <div className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+1rem)] z-[120] -translate-x-1/2 rounded-full bg-slate-950/90 px-4 py-2 text-xs font-bold text-white shadow-xl backdrop-blur">
          {notice}
        </div>
      )}
    </>
  );
}
