'use client';

import React, { useState, useRef, useEffect } from 'react';
import { api } from '@/context/AuthContext';
import { 
  X, Camera, Image as ImageIcon, Type, Sparkles, Smile, Music, Film, Check, RefreshCw
} from 'lucide-react';

interface StoryComposerProps {
  isOpen: boolean;
  onClose: () => void;
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

const SAMPLE_SONGS = [
  { title: "Despacito", artist: "Luis Fonsi" },
  { title: "Blinding Lights", artist: "The Weeknd" },
  { title: "La Bachata", artist: "Manuel Turizo" },
  { title: "Stay", artist: "Kid LAROI & Justin Bieber" },
  { title: "Dakiti", artist: "Bad Bunny" }
];

const PRESET_BACKGROUNDS = [
  'linear-gradient(135deg, #0f766e 0%, #042f2e 100%)', // Teal Dark
  'linear-gradient(135deg, #312e81 0%, #1e1b4b 100%)', // Indigo Dark
  'linear-gradient(135deg, #881337 0%, #4c0519 100%)', // Rose Dark
  'linear-gradient(135deg, #7c2d12 0%, #431407 100%)', // Orange Dark
  '#090d16', // Slate Black
  '#1e293b'  // Slate Gray
];

export default function StoryComposer({ isOpen, onClose }: StoryComposerProps) {
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
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  
  // Tools panels
  const [activePanel, setActivePanel] = useState<'NONE' | 'TEXT' | 'EMOJI' | 'MUSIC'>('NONE');
  
  // New Text Inputs
  const [newText, setNewText] = useState('');
  const [newTextColor, setNewTextColor] = useState('#ffffff');
  const [newTextBg, setNewTextBg] = useState(false);

  // Camera settings
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // Publish Status
  const [isPublishing, setIsPublishing] = useState(false);
  const [isBestFriends, setIsBestFriends] = useState(false);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stream]);

  if (!isOpen) return null;

  // Camera handlers
  const startCamera = async (facing: 'user' | 'environment' = 'user') => {
    stopCamera();
    try {
      const constraints = {
        video: { facingMode: facing },
        audio: false
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setComposerMode('CAMERA');
    } catch (err) {
      alert('No pudimos acceder a la cámara. Puedes seleccionar una imagen de tu galería.');
      setComposerMode('SELECT');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'user' ? 'environment' : 'user';
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Mirror if user camera
      if (cameraFacing === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
          setSelectedFile(file);
          const url = URL.createObjectURL(file);
          setMediaUrl(url);
          setMediaType('IMAGE');
          setComposerMode('EDITOR');
          stopCamera();
        }
        setIsCapturing(false);
      }, 'image/jpeg', 0.95);
    } else {
      setIsCapturing(false);
    }
  };

  // Gallery select
  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

      if (selectedSong) {
        formData.append('musicTitle', selectedSong);
      }

      // Persist overlay items as metadata
      if (overlays.length > 0) {
        formData.append('overlayData', JSON.stringify(overlays));
      }

      await api.post('/stories', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      onCloseClean();
      window.location.reload();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al publicar historia');
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
    setSelectedSong(null);
    setComposerMode('SELECT');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] bg-black flex flex-col md:p-4 justify-center items-center">
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
                className="flex items-center gap-3 p-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-left transition-all group"
              >
                <div className="p-3 rounded-xl bg-teal-950/80 text-teal-400 group-hover:scale-105 transition-transform">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Usar Cámara</h4>
                  <p className="text-[11px] text-slate-500">Toma una foto en vivo desde tu dispositivo</p>
                </div>
              </button>

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
              className={`w-full h-full object-cover ${cameraFacing === 'user' ? 'scale-x-[-1]' : ''}`}
            />
            
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
                disabled={isCapturing}
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

              {/* Music badge */}
              {selectedSong && (
                <div className="absolute bottom-20 left-4 bg-teal-900/90 border border-teal-600/50 px-4 py-2.5 rounded-2xl flex items-center gap-2 text-white shadow-lg z-20 animate-bounce">
                  <Music className="w-4 h-4 text-teal-400" />
                  <div className="text-left">
                    <span className="block text-[11px] font-black leading-none">{selectedSong}</span>
                    <span className="text-[9px] text-teal-300 font-semibold">SocialTush Audio</span>
                  </div>
                </div>
              )}
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
                <h4 className="text-xs font-black text-white">Seleccionar Música</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {SAMPLE_SONGS.map((song, i) => (
                    <button
                      key={i}
                      onClick={() => { setSelectedSong(`${song.title} - ${song.artist}`); setActivePanel('NONE'); }}
                      className="w-full flex items-center justify-between p-2 hover:bg-slate-800 rounded-xl text-left text-xs transition-colors"
                    >
                      <div>
                        <span className="font-bold block text-white">{song.title}</span>
                        <span className="text-[10px] text-slate-400">{song.artist}</span>
                      </div>
                      <Music className="w-4 h-4 text-teal-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions footer */}
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
