'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/context/AuthContext';
import { 
  X, Camera, Image as ImageIcon, Type, Sparkles, Smile, Music, Film, Check, RefreshCw
} from 'lucide-react';

interface StoryComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onPublished?: (story: unknown) => void;
}

interface OverlayItem {
  id: string;
  type: 'TEXT' | 'EMOJI' | 'GIF';
  value: string;
  x: number; // 0 to 1 relative
  y: number; // 0 to 1 relative
  scale: number;
  color?: string;
  bg?: boolean;
}

const PRESET_BACKGROUNDS = [
  'linear-gradient(135deg, #0f766e 0%, #042f2e 100%)', // Teal Dark
  'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)', // Indigo Dark
  'linear-gradient(135deg, #881337 0%, #4c0519 100%)', // Rose Dark
  'linear-gradient(135deg, #7c2d12 0%, #431407 100%)', // Orange Dark
  '#090d16', // Slate Black
  '#1e293b'  // Slate Gray
];

export default function StoryComposer({ isOpen, onClose, onPublished }: StoryComposerProps) {
  // Mode selection: 'SELECT', 'CAMERA', 'GALLERY', 'TEXT', 'EDITOR'
  const [composerMode, setComposerMode] = useState<'SELECT' | 'CAMERA' | 'TEXT' | 'EDITOR'>('SELECT');
  
  // Media source
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'IMAGE' | 'VIDEO' | 'TEXT'>('TEXT');
  
  // Text Mode & Presets
  const [textContent, setTextContent] = useState('');
  const [bgColor, setBgColor] = useState(PRESET_BACKGROUNDS[0]);

  // Overlays
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  
  // Tools panels
  const [activePanel, setActivePanel] = useState<'NONE' | 'TEXT' | 'EMOJI' | 'MUSIC'>('NONE');
  
  // New Text Inputs
  const [newText, setNewText] = useState('');
  const [newTextColor, setNewTextColor] = useState('#ffffff');
  const [newTextBg, setNewTextBg] = useState(false);

  // Camera settings
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestRef = useRef(0);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Publish Status
  const [isPublishing, setIsPublishing] = useState(false);
  const [isBestFriends, setIsBestFriends] = useState(false);

  const stopCamera = useCallback(() => {
    cameraRequestRef.current += 1;
    const current = streamRef.current;
    if (current) {
      current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraReady(false);
    setIsStartingCamera(false);
  }, []);

  const cameraErrorMessage = (error: unknown) => {
    const name = error instanceof DOMException ? error.name : '';
    const messages: Record<string, string> = {
      NotAllowedError: 'El permiso de cámara fue denegado.',
      NotFoundError: 'No encontramos una cámara disponible.',
      NotReadableError: 'La cámara está siendo usada por otra aplicación.',
      OverconstrainedError: 'La cámara no admite la configuración solicitada.',
      SecurityError: 'El navegador bloqueó el acceso seguro a la cámara.'
    };
    return messages[name] || 'No pudimos acceder a la cámara.';
  };

  const requestCamera = async (facing: 'user' | 'environment') => {
    if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('getUserMedia no disponible', 'NotSupportedError');
    try {
      return await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facing } }, audio: false });
    } catch (error) {
      if (error instanceof DOMException && (error.name === 'OverconstrainedError' || error.name === 'NotFoundError')) {
        return navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false });
      }
      throw error;
    }
  };

  const startCamera = useCallback(async (facing: 'user' | 'environment' = 'user') => {
    stopCamera();
    const requestId = cameraRequestRef.current;
    setCameraError(null);
    setIsStartingCamera(true);
    try {
      const mediaStream = await requestCamera(facing);
      if (requestId !== cameraRequestRef.current) {
        mediaStream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = mediaStream;
      setCameraFacing(facing);
      setComposerMode('CAMERA');
    } catch (err) {
      if (requestId !== cameraRequestRef.current) return;
      console.error('No se pudo iniciar la cámara:', err);
      setCameraError(cameraErrorMessage(err));
      setComposerMode('SELECT');
    } finally {
      if (requestId === cameraRequestRef.current) setIsStartingCamera(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (composerMode !== 'CAMERA' || !videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.play().catch(error => {
      console.error('No se pudo reproducir el preview de cámara:', error);
      setCameraError('No pudimos mostrar la vista previa de la cámara.');
      stopCamera();
      setComposerMode('SELECT');
    });
  }, [composerMode, cameraFacing, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);
  useEffect(() => {
    if (!isOpen) stopCamera();
  }, [isOpen, stopCamera]);

  if (!isOpen) return null;

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    startCamera(nextFacing);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !isCameraReady || videoRef.current.videoWidth <= 0 || videoRef.current.videoHeight <= 0) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      try {
        if (cameraFacing === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
            setSelectedFile(file);
            setMediaUrl(URL.createObjectURL(file));
            setMediaType('IMAGE');
            setComposerMode('EDITOR');
            stopCamera();
          } else setCameraError('No pudimos procesar la foto capturada.');
          setIsCapturing(false);
        }, 'image/jpeg', 0.95);
      } catch (error) {
        console.error('Error al capturar la foto:', error);
        setCameraError('No pudimos capturar la foto. Inténtalo de nuevo.');
        setIsCapturing(false);
        stopCamera();
      }
    } else {
      console.error('Canvas 2D no está disponible para capturar la cámara.');
      setCameraError('Este navegador no permite procesar la captura.');
      setIsCapturing(false);
      stopCamera();
    }
  };

  // Gallery select
  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    stopCamera();
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setMediaUrl(url);
      setMediaType(file.type.startsWith('video') ? 'VIDEO' : 'IMAGE');
      setComposerMode('EDITOR');
    }
  };

  // Drag overlays
  const handleOverlayDrag = (id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const container = canvasContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    
    const updatePosition = (clientX: number, clientY: number) => {
      const x = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      const y = Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1);
      setOverlays(prev => prev.map(o => o.id === id ? { ...o, x, y } : o));
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updatePosition(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    const handleTouchMove = (touchEvent: TouchEvent) => {
      if (touchEvent.touches.length > 0) {
        updatePosition(touchEvent.touches[0].clientX, touchEvent.touches[0].clientY);
      }
    };

    const handleTouchEnd = () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    if ('touches' in e) {
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleTouchEnd);
    } else {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
  };

  // Add items
  const addTextOverlay = () => {
    if (!newText.trim()) return;
    const textItem: OverlayItem = {
      id: 'text_' + Date.now(),
      type: 'TEXT',
      value: newText.trim(),
      x: 0.5,
      y: 0.4,
      scale: 1.2,
      color: newTextColor,
      bg: newTextBg
    };
    setOverlays(prev => [...prev, textItem]);
    setNewText('');
    setActivePanel('NONE');
  };

  const addEmojiOverlay = (emoji: string) => {
    const emojiItem: OverlayItem = {
      id: 'emoji_' + Date.now(),
      type: 'EMOJI',
      value: emoji,
      x: 0.5,
      y: 0.5,
      scale: 1.8
    };
    setOverlays(prev => [...prev, emojiItem]);
    setActivePanel('NONE');
  };

  const removeOverlay = (id: string) => {
    setOverlays(prev => prev.filter(o => o.id !== id));
  };

  // Publish
  const handlePublishStory = async () => {
    setIsPublishing(true);
    try {
      const formData = new FormData();
      formData.append('mediaType', mediaType);
      formData.append('isBestFriends', String(isBestFriends));

      if (mediaType === 'TEXT') {
        formData.append('textContent', textContent);
        formData.append('backgroundColor', bgColor);
      } else if (selectedFile) {
        formData.append('file', selectedFile);
      }

      // Persist overlay items as metadata
      if (overlays.length > 0) {
        formData.append('overlayData', JSON.stringify(overlays));
      }

      const response = await api.post('/stories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      onCloseClean();
      onPublished?.(response.data);
    } catch (err: any) {
      console.error('Error al publicar historia:', err);
      setCameraError(err.response?.data?.message || 'Error al publicar historia');
    } finally {
      setIsPublishing(false);
    }
  };

  const onCloseClean = () => {
    stopCamera();
    setSelectedFile(null);
    if (mediaUrl) {
      URL.revokeObjectURL(mediaUrl);
      setMediaUrl(null);
    }
    setOverlays([]);
    setTextContent('');
    setCameraError(null);
    setComposerMode('SELECT');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black flex flex-col md:p-4 justify-center items-center h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Container wrapper */}
      <div className="w-full h-full md:max-w-md bg-[#090d16] md:rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
        
        {/* SELECT MODE */}
        {composerMode === 'SELECT' && (
          <div className="flex-1 flex flex-col justify-center p-6 space-y-6 text-center">
            <div className="flex justify-between items-center absolute top-4 left-4 right-4 z-10">
              <span className="text-sm font-extrabold text-teal-400">Crear Historia</span>
              <button onClick={onCloseClean} className="p-2 rounded-full bg-slate-800 text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-2">
              <Sparkles className="w-12 h-12 text-teal-500 mx-auto animate-pulse" />
              <h2 className="text-lg font-black text-white">¿Cómo quieres contar tu historia?</h2>
              <p className="text-xs text-slate-400">Captura un momento, sube de tu galería o comparte tus pensamientos en texto.</p>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-4">
              <button
                onClick={() => startCamera('user')}
                disabled={isStartingCamera}
                className="flex items-center gap-3 p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left transition-all group"
              >
                <div className="p-3 rounded-xl bg-teal-950/80 text-teal-400 group-hover:scale-105 transition-transform">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">{isStartingCamera ? 'Abriendo cámara...' : 'Usar Cámara'}</h4>
                  <p className="text-[11px] text-slate-500">Toma una foto en vivo desde tu dispositivo</p>
                </div>
              </button>

              {cameraError && (
                <div role="alert" className="rounded-2xl border border-amber-700/60 bg-amber-950/30 p-4 text-left space-y-3">
                  <p className="text-sm font-bold text-white">No pudimos acceder a la cámara.</p>
                  <p className="text-xs text-amber-200">{cameraError}</p>
                  <div className="grid gap-2">
                    <button type="button" onClick={() => startCamera(cameraFacing)} className="rounded-xl bg-teal-700 px-3 py-2 text-xs font-bold text-white">Reintentar</button>
                    <button type="button" onClick={() => nativeCameraInputRef.current?.click()} className="rounded-xl border border-slate-600 px-3 py-2 text-xs font-bold text-white">Usar cámara del dispositivo</button>
                    <label className="rounded-xl border border-slate-600 px-3 py-2 text-center text-xs font-bold text-white cursor-pointer">Elegir de galería<input type="file" accept="image/*,video/*" onChange={handleGallerySelect} className="hidden" /></label>
                  </div>
                </div>
              )}
              <input ref={nativeCameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleGallerySelect} className="hidden" />

              <label className="flex items-center gap-3 p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left cursor-pointer transition-all group">
                <div className="p-3 rounded-xl bg-emerald-950/80 text-emerald-400 group-hover:scale-105 transition-transform">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-white">Galería / Archivos</h4>
                  <p className="text-[11px] text-slate-500">Sube una foto o video existente</p>
                </div>
                <input
                  type="file"
                  onChange={handleGallerySelect}
                  accept="image/*,video/*"
                  className="hidden"
                />
              </label>

              <button
                onClick={() => { setMediaType('TEXT'); setComposerMode('TEXT'); }}
                className="flex items-center gap-3 p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left transition-all group"
              >
                <div className="p-3 rounded-xl bg-amber-950/80 text-amber-400 group-hover:scale-105 transition-transform">
                  <Type className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Historia de Texto</h4>
                  <p className="text-[11px] text-slate-500">Escribe sobre un fondo de color personalizado</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* CAMERA MODE */}
        {composerMode === 'CAMERA' && (
          <div className="flex-1 flex flex-col justify-between relative bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={(event) => setIsCameraReady(event.currentTarget.videoWidth > 0 && event.currentTarget.videoHeight > 0)}
              className={`w-full h-full object-cover ${cameraFacing === 'user' ? 'scale-x-[-1]' : ''}`}
            />
            {!isCameraReady && <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-bold text-white">Preparando cámara...</div>}
            
            {/* Header toolbar */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
              <button 
                onClick={() => { stopCamera(); setComposerMode('SELECT'); }}
                className="p-2.5 rounded-full bg-black/60 text-white backdrop-blur-md"
              >
                <X className="w-5 h-5" />
              </button>
              <button
                onClick={toggleCameraFacing}
                className="p-2.5 rounded-full bg-black/60 text-white backdrop-blur-md"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {/* Shutter btn */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center z-10">
              <button
                onClick={capturePhoto}
                disabled={isCapturing || !isCameraReady}
                className="w-20 h-20 rounded-full border-4 border-white bg-transparent flex items-center justify-center p-1 cursor-pointer disabled:opacity-50"
              >
                <div className="w-full h-full rounded-full bg-white active:scale-95 transition-transform" />
              </button>
            </div>
          </div>
        )}

        {/* TEXT EDITOR MODE */}
        {composerMode === 'TEXT' && (
          <div className="flex-1 flex flex-col justify-between p-6" style={{ background: bgColor }}>
            {/* Header */}
            <div className="flex justify-between items-center">
              <button onClick={() => setComposerMode('SELECT')} className="p-2 rounded-full bg-black/40 text-white">
                <X className="w-5 h-5" />
              </button>
              <button
                onClick={() => setComposerMode('EDITOR')}
                disabled={!textContent.trim()}
                className="px-4 py-2 bg-white text-slate-900 rounded-xl text-xs font-black disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>

            {/* Input area */}
            <div className="flex-1 flex items-center justify-center">
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Escribe algo increíble..."
                maxLength={250}
                className="w-full bg-transparent text-center text-white font-extrabold text-2xl border-none focus:ring-0 focus:outline-none resize-none placeholder-white/50"
                style={{ caretColor: '#14b8a6' }}
              />
            </div>

            {/* Color selector footer */}
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider block text-center">Fondo de historia</span>
              <div className="flex items-center justify-center gap-3">
                {PRESET_BACKGROUNDS.map((bg, idx) => (
                  <button
                    key={idx}
                    onClick={() => setBgColor(bg)}
                    className="w-8 h-8 rounded-full border-2 border-white/60 active:scale-90 transition-transform"
                    style={{ background: bg }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* MAIN EDITOR & OVERLAY CUSTOMIZER */}
        {composerMode === 'EDITOR' && (
          <div className="flex-1 flex flex-col justify-between relative bg-slate-950">
            {/* Toolbar Top */}
            <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-30">
              <button onClick={onCloseClean} className="p-2.5 rounded-full bg-black/60 text-white backdrop-blur-md shadow-lg">
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActivePanel(activePanel === 'TEXT' ? 'NONE' : 'TEXT')}
                  className={`p-2.5 rounded-full backdrop-blur-md shadow-lg ${activePanel === 'TEXT' ? 'bg-teal-700 text-white' : 'bg-black/60 text-white'}`}
                >
                  <Type className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setActivePanel(activePanel === 'EMOJI' ? 'NONE' : 'EMOJI')}
                  className={`p-2.5 rounded-full backdrop-blur-md shadow-lg ${activePanel === 'EMOJI' ? 'bg-teal-700 text-white' : 'bg-black/60 text-white'}`}
                >
                  <Smile className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setActivePanel(activePanel === 'MUSIC' ? 'NONE' : 'MUSIC')}
                  className={`p-2.5 rounded-full backdrop-blur-md shadow-lg ${activePanel === 'MUSIC' ? 'bg-teal-700 text-white' : 'bg-black/60 text-white'}`}
                >
                  <Music className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Canvas / Preview Container */}
            <div 
              ref={canvasContainerRef}
              className="flex-1 relative overflow-hidden flex items-center justify-center select-none"
              style={{ background: mediaType === 'TEXT' ? bgColor : '#000000' }}
            >
              {/* Media rendering */}
              {mediaType === 'IMAGE' && mediaUrl && (
                <img src={mediaUrl} alt="Story Image" className="w-full h-full object-cover pointer-events-none" />
              )}
              {mediaType === 'VIDEO' && mediaUrl && (
                <video src={mediaUrl} autoPlay loop muted playsInline className="w-full h-full object-cover pointer-events-none" />
              )}
              {mediaType === 'TEXT' && (
                <p className="text-white font-extrabold text-2xl text-center px-6 whitespace-pre-wrap max-w-xs leading-snug">
                  {textContent}
                </p>
              )}

              {/* Overlays Rendering */}
              {overlays.map((o) => (
                <div
                  key={o.id}
                  onMouseDown={(e) => handleOverlayDrag(o.id, e)}
                  onTouchStart={(e) => handleOverlayDrag(o.id, e)}
                  className="absolute cursor-move select-none active:scale-95 transition-transform origin-center z-20 group"
                  style={{
                    left: `${o.x * 100}%`,
                    top: `${o.y * 100}%`,
                    transform: `translate(-50%, -50%) scale(${o.scale})`,
                    color: o.color || '#ffffff'
                  }}
                >
                  <div className={`relative px-3 py-1.5 rounded-xl font-bold text-center ${o.bg ? 'bg-black/75 text-white' : ''}`}>
                    {o.value}
                    {/* Delete option on hover or touch */}
                    <button
                      onClick={() => removeOverlay(o.id)}
                      className="absolute -top-3 -right-3 p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full scale-0 group-hover:scale-100 transition-transform shadow-md z-30"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </div>
                </div>
              ))}

            </div>

            {/* Panel details */}
            {activePanel === 'TEXT' && (
              <div className="absolute bottom-16 left-4 right-4 bg-slate-900/95 border border-slate-800 rounded-3xl p-4 space-y-3 z-40 text-slate-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Escribe texto..."
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    autoFocus
                    className="flex-1 px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-teal-500"
                  />
                  <button onClick={addTextOverlay} className="px-4 bg-teal-700 text-white text-xs font-bold rounded-xl hover:bg-teal-600">
                    Añadir
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs pt-1">
                  <div className="flex gap-2">
                    {['#ffffff', '#facc15', '#ef4444', '#10b981', '#3b82f6'].map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewTextColor(c)}
                        className="w-5 h-5 rounded-full border border-slate-600"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={newTextBg} onChange={(e) => setNewTextBg(e.target.checked)} className="rounded text-teal-600 focus:ring-0" />
                    <span>Fondo</span>
                  </label>
                </div>
              </div>
            )}

            {activePanel === 'EMOJI' && (
              <div className="absolute bottom-16 left-4 right-4 bg-slate-900/95 border border-slate-800 rounded-3xl p-4 z-40 text-slate-200">
                <div className="grid grid-cols-6 gap-2 text-center text-xl max-h-48 overflow-y-auto">
                  {['🔥','🚀','😂','❤️','😍','😎','👍','✨','🎉','🤔','😅','😭','🙏','👀','🌟','💥','👑','💯','🎶','💡'].map(em => (
                    <button
                      key={em}
                      onClick={() => addEmojiOverlay(em)}
                      className="p-2 hover:bg-slate-800 rounded-xl transition-colors active:scale-90"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activePanel === 'MUSIC' && (
              <div className="absolute bottom-16 left-4 right-4 bg-slate-900/95 border border-slate-800 rounded-3xl p-4 z-40 text-slate-200 space-y-3">
                <h4 className="text-xs font-black text-white">Música</h4>
                <p className="text-xs text-slate-400">Próximamente. Todavía no hay un proveedor de música conectado.</p>
              </div>
            )}

            {/* Bottom Actions footer */}
            {cameraError && <div role="alert" className="absolute bottom-16 left-4 right-4 z-50 rounded-xl bg-rose-950/95 border border-rose-700 p-3 text-xs text-rose-100">{cameraError}</div>}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between z-30">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 font-semibold text-xs">
                <input
                  type="checkbox"
                  checked={isBestFriends}
                  onChange={(e) => setIsBestFriends(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-0"
                />
                <span>Mejores amigos</span>
              </label>

              <button
                onClick={handlePublishStory}
                disabled={isPublishing}
                className="px-6 py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs rounded-xl shadow-md transition-all"
              >
                {isPublishing ? 'Publicando...' : 'Publicar historia'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
