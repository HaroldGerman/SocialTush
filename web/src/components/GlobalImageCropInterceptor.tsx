'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crop, RotateCcw, X, ZoomIn, Move } from 'lucide-react';

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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function GlobalImageCropInterceptor() {
  const [pending, setPending] = useState<PendingCrop | null>(null);
  const [aspect, setAspect] = useState<AspectKey>('original');
  const [zoom, setZoom] = useState(1);
  const [positionX, setPositionX] = useState(50);
  const [positionY, setPositionY] = useState(50);
  const [processing, setProcessing] = useState(false);
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  const [isInteracting, setIsInteracting] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef({
    startCenterX: 0,
    startCenterY: 0,
    startDistance: 0,
    startZoom: 1,
    startPositionX: 50,
    startPositionY: 50,
  });

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

  const resetTransform = () => {
    setZoom(1);
    setPositionX(50);
    setPositionY(50);
  };

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
      const sourceX = clamp((naturalW - cropW) * (positionX / 100), 0, naturalW - cropW);
      const sourceY = clamp((naturalH - cropH) * (positionY / 100), 0, naturalH - cropH);

      const maxOutput = 1800;
      let outputW = Math.max(1, Math.round(Math.min(maxOutput, cropW)));
      let outputH = Math.max(1, Math.round(outputW / targetRatio));
      if (outputH > maxOutput) {
        outputH = maxOutput;
        outputW = Math.max(1, Math.round(outputH * targetRatio));
      }

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

  const pointerCenter = () => {
    const points = Array.from(pointersRef.current.values());
    if (!points.length) return { x: 0, y: 0 };
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
  };

  const pointerDistance = () => {
    const points = Array.from(pointersRef.current.values());
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  };

  const beginGesture = () => {
    const center = pointerCenter();
    gestureRef.current = {
      startCenterX: center.x,
      startCenterY: center.y,
      startDistance: pointerDistance(),
      startZoom: zoom,
      startPositionX: positionX,
      startPositionY: positionY,
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!previewRef.current) return;
    previewRef.current.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    beginGesture();
    setIsInteracting(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId) || !previewRef.current) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const rect = previewRef.current.getBoundingClientRect();
    const center = pointerCenter();
    const gesture = gestureRef.current;

    if (pointersRef.current.size >= 2) {
      const distance = pointerDistance();
      if (gesture.startDistance > 0) {
        const nextZoom = clamp(gesture.startZoom * (distance / gesture.startDistance), 1, 4);
        setZoom(nextZoom);
      }
    }

    const sensitivityX = 100 / Math.max(1, rect.width * Math.max(1, zoom));
    const sensitivityY = 100 / Math.max(1, rect.height * Math.max(1, zoom));
    setPositionX(clamp(gesture.startPositionX - (center.x - gesture.startCenterX) * sensitivityX, 0, 100));
    setPositionY(clamp(gesture.startPositionY - (center.y - gesture.startCenterY) * sensitivityY, 0, 100));
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size) beginGesture();
    else setIsInteracting(false);
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setZoom(current => clamp(current + (event.deltaY > 0 ? -0.1 : 0.1), 1, 4));
  };

  if (!pending) return null;

  const viewportWidth = `min(100%, calc(52dvh * ${previewRatio}))`;

  return (
    <div className="fixed inset-0 z-[500] flex items-end justify-center bg-black/90 md:items-center md:p-4">
      <div className="flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-[#05090d] text-white shadow-2xl md:h-auto md:max-h-[94dvh] md:rounded-3xl md:border md:border-slate-700">
        <div className="flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-[calc(.75rem+env(safe-area-inset-top))]">
          <div className="flex items-center gap-2">
            <Crop className="h-5 w-5 text-teal-400"/>
            <div><h2 className="text-sm font-black">Ajustar imagen</h2><p className="text-[10px] text-slate-400">Pellizca para ampliar · arrastra para mover</p></div>
          </div>
          <button onClick={closeAndClear} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><X className="h-5 w-5"/></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <div className="flex min-h-[56dvh] items-center justify-center md:min-h-0">
            <div
              ref={previewRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
              onWheel={onWheel}
              className={`relative select-none overflow-hidden bg-black touch-none ${isInteracting ? 'cursor-grabbing' : 'cursor-grab'}`}
              style={{ aspectRatio: String(previewRatio), width: viewportWidth, maxWidth: '100%', maxHeight: '52dvh' }}
            >
              <img
                src={pending.url}
                alt="Vista previa para recortar"
                draggable={false}
                onLoad={event => setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
                className="pointer-events-none h-full w-full select-none object-cover"
                style={{
                  objectPosition: `${positionX}% ${positionY}%`,
                  transform: `scale(${zoom})`,
                  transformOrigin: `${positionX}% ${positionY}%`,
                  transition: isInteracting ? 'none' : 'transform 120ms ease-out',
                }}
              />

              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/3 top-0 h-full w-px bg-white/25"/>
                <div className="absolute left-2/3 top-0 h-full w-px bg-white/25"/>
                <div className="absolute left-0 top-1/3 h-px w-full bg-white/25"/>
                <div className="absolute left-0 top-2/3 h-px w-full bg-white/25"/>
                <div className="absolute inset-0 border-2 border-white/90"/>
                <span className="absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-white"/>
                <span className="absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-white"/>
                <span className="absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-white"/>
                <span className="absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-white"/>
              </div>

              {zoom === 1 && positionX === 50 && positionY === 50 && (
                <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-[10px] font-bold text-white/90 backdrop-blur">
                  <Move className="h-3.5 w-3.5"/> Arrastra · <ZoomIn className="h-3.5 w-3.5"/> Pellizca
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {([
              ['original', 'Original'],
              ['square', '1:1'],
              ['portrait', '4:5'],
              ['wide', '16:9'],
            ] as Array<[AspectKey, string]>).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => { setAspect(key); resetTransform(); }}
                className={`rounded-xl border px-2 py-2.5 text-xs font-bold ${aspect === key ? 'border-teal-400 bg-teal-500/15 text-teal-300' : 'border-white/15 text-slate-300'}`}
              >{label}</button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300"><ZoomIn className="h-4 w-4 text-teal-400"/>Zoom {zoom.toFixed(1)}x</div>
            <button type="button" onClick={resetTransform} className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[11px] font-bold text-slate-300"><RotateCcw className="h-3.5 w-3.5"/>Revertir</button>
          </div>
          <input aria-label="Zoom" type="range" min="1" max="4" step="0.05" value={zoom} onChange={event => setZoom(Number(event.target.value))} className="mt-2 w-full accent-teal-500"/>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-white/10 bg-[#071016] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button type="button" onClick={useOriginal} disabled={processing} className="rounded-2xl border border-slate-700 py-3.5 text-sm font-bold text-slate-200">Usar original</button>
          <button type="button" onClick={() => void cropAndUse()} disabled={processing} className="rounded-2xl bg-teal-600 py-3.5 text-sm font-black text-white disabled:opacity-50">{processing ? 'Procesando…' : 'Recortar y usar'}</button>
        </div>
      </div>
    </div>
  );
}
