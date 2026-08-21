'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Crop, RotateCcw, X } from 'lucide-react';

type AspectKey = 'original' | 'square' | 'portrait' | 'wide';

interface PendingCrop {
  input: HTMLInputElement;
  file: File;
  url: string;
}

const aspectValues: Record<AspectKey, number | null> = {
  original: null,
  square: 1,
  portrait: 4 / 5,
  wide: 16 / 9,
};

function replaceInputFile(input: HTMLInputElement, file: File) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dataset.cropBypass = '1';
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function extensionFor(type: string) {
  if (type === 'image/png') return 'png';
  if (type === 'image/webp') return 'webp';
  return 'jpg';
}

export default function GlobalImageCropInterceptor() {
  const [pending, setPending] = useState<PendingCrop | null>(null);
  const [aspect, setAspect] = useState<AspectKey>('original');
  const [zoom, setZoom] = useState(1);
  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(50);
  const [processing, setProcessing] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const onChange = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
      if (input.dataset.cropBypass === '1') {
        delete input.dataset.cropBypass;
        return;
      }
      if (input.dataset.noCrop === 'true') return;
      const file = input.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      const url = URL.createObjectURL(file);
      setAspect('original');
      setZoom(1);
      setPositionX(50);
      setPositionY(50);
      setPending({ input, file, url });
    };

    document.addEventListener('change', onChange, true);
    return () => document.removeEventListener('change', onChange, true);
  }, []);

  useEffect(() => () => {
    if (pending?.url) URL.revokeObjectURL(pending.url);
  }, [pending?.url]);

  const previewRatio = useMemo(() => {
    const selected = aspectValues[aspect];
    return selected || naturalSize.width / naturalSize.height || 1;
  }, [aspect, naturalSize]);

  const closeAndClear = () => {
    if (!pending) return;
    pending.input.value = '';
    URL.revokeObjectURL(pending.url);
    setPending(null);
  };

  const useOriginal = () => {
    if (!pending) return;
    replaceInputFile(pending.input, pending.file);
    URL.revokeObjectURL(pending.url);
    setPending(null);
  };

  const cropAndUse = async () => {
    if (!pending || processing) return;
    setProcessing(true);
    try {
      const image = new Image();
      image.src = pending.url;
      await image.decode();

      const naturalW = image.naturalWidth;
      const naturalH = image.naturalHeight;
      const targetRatio = aspectValues[aspect] || naturalW / naturalH;

      let baseW = naturalW;
      let baseH = naturalH;
      if (naturalW / naturalH > targetRatio) baseW = naturalH * targetRatio;
      else baseH = naturalW / targetRatio;

      const cropW = Math.max(1, baseW / zoom);
      const cropH = Math.max(1, baseH / zoom);
      const sourceX = Math.max(0, (naturalW - cropW) * (positionX / 100));
      const sourceY = Math.max(0, (naturalH - cropH) * (positionY / 100));

      const maxOutput = 1800;
      const outputW = Math.max(1, Math.round(Math.min(maxOutput, cropW)));
      const outputH = Math.max(1, Math.round(outputW / targetRatio));
      const canvas = document.createElement('canvas');
      canvas.width = outputW;
      canvas.height = outputH;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(image, sourceX, sourceY, cropW, cropH, 0, 0, outputW, outputH);

      const mime = ['image/jpeg', 'image/png', 'image/webp'].includes(pending.file.type)
        ? pending.file.type
        : 'image/jpeg';
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(value => value ? resolve(value) : reject(new Error('Crop failed')), mime, 0.92);
      });
      const baseName = pending.file.name.replace(/\.[^.]+$/, '') || 'lifonk-image';
      const cropped = new File([blob], `${baseName}-recortada.${extensionFor(mime)}`, {
        type: mime,
        lastModified: Date.now(),
      });
      replaceInputFile(pending.input, cropped);
      URL.revokeObjectURL(pending.url);
      setPending(null);
    } catch (error) {
      console.error('No se pudo recortar la imagen:', error);
      useOriginal();
    } finally {
      setProcessing(false);
    }
  };

  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-end justify-center bg-black/80 md:items-center md:p-4">
      <div className="flex max-h-[94dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-slate-700 bg-[#07151d] text-white shadow-2xl md:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2"><Crop className="h-5 w-5 text-teal-400"/><div><h2 className="text-sm font-black">Ajustar imagen</h2><p className="text-[10px] text-slate-400">Recorta antes de publicar o enviar</p></div></div>
          <button onClick={closeAndClear} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900"><X className="h-5 w-5"/></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto flex max-h-[48dvh] w-full items-center justify-center overflow-hidden rounded-2xl bg-black" style={{ aspectRatio: String(previewRatio) }}>
            <img
              src={pending.url}
              alt="Vista previa para recortar"
              onLoad={event => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
              className="h-full w-full object-cover"
              style={{ objectPosition: `${positionX}% ${positionY}%`, transform: `scale(${zoom})` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {([
              ['original', 'Original'],
              ['square', '1:1'],
              ['portrait', '4:5'],
              ['wide', '16:9'],
            ] as Array<[AspectKey, string]>).map(([key, label]) => (
              <button key={key} type="button" onClick={() => { setAspect(key); setZoom(1); setPositionX(50); setPositionY(50); }} className={`rounded-xl border px-2 py-2 text-xs font-bold ${aspect === key ? 'border-teal-500 bg-teal-500/15 text-teal-300' : 'border-slate-700 text-slate-300'}`}>{label}</button>
            ))}
          </div>

          <label className="mt-4 block text-xs font-bold text-slate-300">Zoom · {zoom.toFixed(1)}x<input type="range" min="1" max="3" step="0.05" value={zoom} onChange={event => setZoom(Number(event.target.value))} className="mt-2 w-full accent-teal-500"/></label>
          <label className="mt-3 block text-xs font-bold text-slate-300">Mover horizontal<input type="range" min="0" max="100" value={positionX} onChange={event => setPositionX(Number(event.target.value))} className="mt-2 w-full accent-teal-500"/></label>
          <label className="mt-3 block text-xs font-bold text-slate-300">Mover vertical<input type="range" min="0" max="100" value={positionY} onChange={event => setPositionY(Number(event.target.value))} className="mt-2 w-full accent-teal-500"/></label>
          <button type="button" onClick={() => { setAspect('original'); setZoom(1); setPositionX(50); setPositionY(50); }} className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-400"><RotateCcw className="h-4 w-4"/>Restablecer</button>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-slate-800 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button type="button" onClick={useOriginal} disabled={processing} className="rounded-2xl border border-slate-700 py-3 text-sm font-bold text-slate-200">Usar original</button>
          <button type="button" onClick={() => void cropAndUse()} disabled={processing} className="rounded-2xl bg-teal-600 py-3 text-sm font-black text-white disabled:opacity-50">{processing ? 'Procesando…' : 'Recortar y usar'}</button>
        </div>
      </div>
    </div>
  );
}
