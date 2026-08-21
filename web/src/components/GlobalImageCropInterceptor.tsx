'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Crop, Move, RotateCcw, X, ZoomIn } from 'lucide-react';

type AspectKey = 'original' | 'square' | 'portrait' | 'wide';
type Corner = 'nw' | 'ne' | 'sw' | 'se';

interface PendingCrop {
  input: HTMLInputElement;
  file: File;
  url: string;
}

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const aspectValues: Record<AspectKey, number | null> = {
  original: null,
  square: 1,
  portrait: 4 / 5,
  wide: 16 / 9,
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const DEFAULT_RECT: CropRect = { x: 4, y: 4, w: 92, h: 92 };
const MIN_CROP_PERCENT = 15;

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

function centeredRectForAspect(viewRatio: number, targetRatio: number | null): CropRect {
  if (!targetRatio) return DEFAULT_RECT;

  const innerW = 92;
  const innerH = 92;
  const availableRatio = viewRatio * (innerW / innerH);

  if (availableRatio > targetRatio) {
    const width = innerH * targetRatio / viewRatio;
    return { x: (100 - width) / 2, y: 4, w: width, h: innerH };
  }

  const height = innerW * viewRatio / targetRatio;
  return { x: 4, y: (100 - height) / 2, w: innerW, h: height };
}

export default function GlobalImageCropInterceptor() {
  const [pending, setPending] = useState<PendingCrop | null>(null);
  const [aspect, setAspect] = useState<AspectKey>('original');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [cropRect, setCropRect] = useState<CropRect>(DEFAULT_RECT);
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
    startPanX: 0,
    startPanY: 0,
  });
  const resizeRef = useRef<{
    corner: Corner;
    startX: number;
    startY: number;
    rect: CropRect;
  } | null>(null);

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
      setPan({ x: 0, y: 0 });
      setCropRect(DEFAULT_RECT);
      setNaturalSize({ width: 1, height: 1 });
      setPending({ input, file, url });
    };

    document.addEventListener('change', onChange, true);
    return () => document.removeEventListener('change', onChange, true);
  }, []);

  useEffect(() => () => {
    if (pending?.url) URL.revokeObjectURL(pending.url);
  }, [pending?.url]);

  const previewRatio = useMemo(() => {
    const ratio = naturalSize.width / naturalSize.height;
    return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  }, [naturalSize]);

  const resetAll = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCropRect(centeredRectForAspect(previewRatio, aspectValues[aspect]));
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
    if (!pending || processing || !previewRef.current) return;
    setProcessing(true);
    try {
      const image = new Image();
      image.src = pending.url;
      await image.decode();

      const rect = previewRef.current.getBoundingClientRect();
      const viewportW = rect.width;
      const viewportH = rect.height;
      const naturalW = image.naturalWidth;
      const naturalH = image.naturalHeight;

      const cropLeftPx = viewportW * cropRect.x / 100;
      const cropTopPx = viewportH * cropRect.y / 100;
      const cropWidthPx = viewportW * cropRect.w / 100;
      const cropHeightPx = viewportH * cropRect.h / 100;

      const centerX = viewportW / 2;
      const centerY = viewportH / 2;

      let sourceX = (((cropLeftPx - centerX - pan.x) / zoom) + centerX) / viewportW * naturalW;
      let sourceY = (((cropTopPx - centerY - pan.y) / zoom) + centerY) / viewportH * naturalH;
      let sourceW = cropWidthPx / zoom / viewportW * naturalW;
      let sourceH = cropHeightPx / zoom / viewportH * naturalH;

      sourceW = clamp(sourceW, 1, naturalW);
      sourceH = clamp(sourceH, 1, naturalH);
      sourceX = clamp(sourceX, 0, naturalW - sourceW);
      sourceY = clamp(sourceY, 0, naturalH - sourceH);

      const maxOutput = 1800;
      const scale = Math.min(1, maxOutput / Math.max(sourceW, sourceH));
      const outputW = Math.max(1, Math.round(sourceW * scale));
      const outputH = Math.max(1, Math.round(sourceH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = outputW;
      canvas.height = outputH;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas unavailable');
      context.drawImage(image, sourceX, sourceY, sourceW, sourceH, 0, 0, outputW, outputH);

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
      startPanX: pan.x,
      startPanY: pan.y,
    };
  };

  const clampPan = (x: number, y: number, nextZoom: number) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return { x, y };
    const maxX = ((nextZoom - 1) * rect.width) / 2;
    const maxY = ((nextZoom - 1) * rect.height) / 2;
    return {
      x: clamp(x, -maxX, maxX),
      y: clamp(y, -maxY, maxY),
    };
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!previewRef.current || resizeRef.current) return;
    previewRef.current.setPointerCapture?.(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    beginGesture();
    setIsInteracting(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId) || !previewRef.current || resizeRef.current) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const center = pointerCenter();
    const gesture = gestureRef.current;

    let nextZoom = gesture.startZoom;
    if (pointersRef.current.size >= 2) {
      const distance = pointerDistance();
      if (gesture.startDistance > 0) nextZoom = clamp(gesture.startZoom * (distance / gesture.startDistance), 1, 4);
      setZoom(nextZoom);
    }

    const nextPan = clampPan(
      gesture.startPanX + (center.x - gesture.startCenterX),
      gesture.startPanY + (center.y - gesture.startCenterY),
      nextZoom,
    );
    setPan(nextPan);
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size) beginGesture();
    else setIsInteracting(false);
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const next = clamp(zoom + (event.deltaY > 0 ? -0.1 : 0.1), 1, 4);
    setZoom(next);
    setPan(current => clampPan(current.x, current.y, next));
  };

  const beginResize = (corner: Corner, event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resizeRef.current = {
      corner,
      startX: event.clientX,
      startY: event.clientY,
      rect: cropRect,
    };
    setIsInteracting(true);
  };

  const resizeCrop = (event: React.PointerEvent<HTMLButtonElement>) => {
    const active = resizeRef.current;
    const preview = previewRef.current;
    if (!active || !preview) return;
    event.preventDefault();
    event.stopPropagation();

    const bounds = preview.getBoundingClientRect();
    const dx = (event.clientX - active.startX) / bounds.width * 100;
    const dy = (event.clientY - active.startY) / bounds.height * 100;
    const start = active.rect;
    const lockedRatio = aspectValues[aspect];

    let left = start.x;
    let top = start.y;
    let right = start.x + start.w;
    let bottom = start.y + start.h;

    if (active.corner.includes('w')) left = clamp(start.x + dx, 0, right - MIN_CROP_PERCENT);
    if (active.corner.includes('e')) right = clamp(start.x + start.w + dx, left + MIN_CROP_PERCENT, 100);
    if (active.corner.includes('n')) top = clamp(start.y + dy, 0, bottom - MIN_CROP_PERCENT);
    if (active.corner.includes('s')) bottom = clamp(start.y + start.h + dy, top + MIN_CROP_PERCENT, 100);

    if (lockedRatio) {
      const desiredVisualRatio = lockedRatio / previewRatio;
      let width = right - left;
      let height = bottom - top;
      const currentRatio = width / height;

      if (currentRatio > desiredVisualRatio) width = height * desiredVisualRatio;
      else height = width / desiredVisualRatio;

      if (active.corner === 'nw') {
        left = right - width;
        top = bottom - height;
      } else if (active.corner === 'ne') {
        right = left + width;
        top = bottom - height;
      } else if (active.corner === 'sw') {
        left = right - width;
        bottom = top + height;
      } else {
        right = left + width;
        bottom = top + height;
      }

      if (left < 0) { right -= left; left = 0; }
      if (top < 0) { bottom -= top; top = 0; }
      if (right > 100) { left -= right - 100; right = 100; }
      if (bottom > 100) { top -= bottom - 100; bottom = 100; }
    }

    setCropRect({
      x: clamp(left, 0, 100),
      y: clamp(top, 0, 100),
      w: clamp(right - left, MIN_CROP_PERCENT, 100),
      h: clamp(bottom - top, MIN_CROP_PERCENT, 100),
    });
  };

  const endResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = null;
    setIsInteracting(false);
  };

  const selectAspect = (key: AspectKey) => {
    setAspect(key);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setCropRect(centeredRectForAspect(previewRatio, aspectValues[key]));
  };

  if (!pending) return null;

  const viewportWidth = `min(100%, calc(52dvh * ${previewRatio}))`;
  const cropStyle: React.CSSProperties = {
    left: `${cropRect.x}%`,
    top: `${cropRect.y}%`,
    width: `${cropRect.w}%`,
    height: `${cropRect.h}%`,
  };

  return (
    <div className="fixed inset-0 z-[500] flex items-end justify-center bg-black/90 md:items-center md:p-4">
      <div className="flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-[#05090d] text-white shadow-2xl md:h-auto md:max-h-[94dvh] md:rounded-3xl md:border md:border-slate-700">
        <div className="flex items-center justify-between border-b border-white/10 px-4 pb-3 pt-[calc(.75rem+env(safe-area-inset-top))]">
          <div className="flex items-center gap-2">
            <Crop className="h-5 w-5 text-teal-400"/>
            <div>
              <h2 className="text-sm font-black">Ajustar imagen</h2>
              <p className="text-[10px] text-slate-400">Arrastra las esquinas para recortar · pellizca para ampliar</p>
            </div>
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
                onLoad={event => {
                  const next = { width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight };
                  setNaturalSize(next);
                  const ratio = next.width / next.height || 1;
                  setCropRect(centeredRectForAspect(ratio, aspectValues[aspect]));
                }}
                className="pointer-events-none h-full w-full select-none object-fill"
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: isInteracting ? 'none' : 'transform 120ms ease-out',
                }}
              />

              <div className="pointer-events-none absolute inset-0 bg-black/45" />

              <div className="absolute z-10" style={cropStyle}>
                <div className="pointer-events-none absolute inset-0 overflow-hidden border-2 border-white/95 shadow-[0_0_0_9999px_rgba(0,0,0,.42)]">
                  <div className="absolute left-1/3 top-0 h-full w-px bg-white/30"/>
                  <div className="absolute left-2/3 top-0 h-full w-px bg-white/30"/>
                  <div className="absolute left-0 top-1/3 h-px w-full bg-white/30"/>
                  <div className="absolute left-0 top-2/3 h-px w-full bg-white/30"/>
                </div>

                {(['nw', 'ne', 'sw', 'se'] as Corner[]).map(corner => {
                  const position = corner === 'nw' ? '-left-3 -top-3' : corner === 'ne' ? '-right-3 -top-3' : corner === 'sw' ? '-bottom-3 -left-3' : '-bottom-3 -right-3';
                  const borders = corner === 'nw' ? 'border-l-[5px] border-t-[5px]' : corner === 'ne' ? 'border-r-[5px] border-t-[5px]' : corner === 'sw' ? 'border-b-[5px] border-l-[5px]' : 'border-b-[5px] border-r-[5px]';
                  return (
                    <button
                      key={corner}
                      type="button"
                      aria-label={`Ajustar esquina ${corner}`}
                      onPointerDown={event => beginResize(corner, event)}
                      onPointerMove={resizeCrop}
                      onPointerUp={endResize}
                      onPointerCancel={endResize}
                      className={`absolute ${position} h-10 w-10 touch-none ${borders} border-white bg-transparent`}
                    />
                  );
                })}
              </div>

              {zoom === 1 && pan.x === 0 && pan.y === 0 && (
                <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-[10px] font-bold text-white/90 backdrop-blur">
                  <Move className="h-3.5 w-3.5"/> Mueve foto · <ZoomIn className="h-3.5 w-3.5"/> Pellizca
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
                onClick={() => selectAspect(key)}
                className={`rounded-xl border px-2 py-2.5 text-xs font-bold ${aspect === key ? 'border-teal-400 bg-teal-500/15 text-teal-300' : 'border-white/15 text-slate-300'}`}
              >{label}</button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300"><ZoomIn className="h-4 w-4 text-teal-400"/>Zoom {zoom.toFixed(1)}x</div>
            <button type="button" onClick={resetAll} className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-[11px] font-bold text-slate-300"><RotateCcw className="h-3.5 w-3.5"/>Revertir</button>
          </div>
          <input
            aria-label="Zoom"
            type="range"
            min="1"
            max="4"
            step="0.05"
            value={zoom}
            onChange={event => {
              const next = Number(event.target.value);
              setZoom(next);
              setPan(current => clampPan(current.x, current.y, next));
            }}
            className="mt-2 w-full accent-teal-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-white/10 bg-[#071016] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <button type="button" onClick={useOriginal} disabled={processing} className="rounded-2xl border border-slate-700 py-3.5 text-sm font-bold text-slate-200">Usar original</button>
          <button type="button" onClick={() => void cropAndUse()} disabled={processing} className="rounded-2xl bg-teal-600 py-3.5 text-sm font-black text-white disabled:opacity-50">{processing ? 'Procesando…' : 'Recortar y usar'}</button>
        </div>
      </div>
    </div>
  );
}
