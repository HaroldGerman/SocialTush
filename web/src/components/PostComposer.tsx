'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/context/AuthContext';
import { Image as ImageIcon, Video as VideoIcon, X } from 'lucide-react';

interface PostComposerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PostComposer({ isOpen, onClose }: PostComposerProps) {
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const isVideo = Boolean(selectedFile?.type?.toLowerCase().startsWith('video/'));

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  if (!isOpen) return null;

  const clearFile = () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setSelectedFile(null);
    setFilePreview(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (filePreview) URL.revokeObjectURL(filePreview);
    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caption.trim() && !selectedFile) return;

    setIsPublishing(true);
    try {
      const formData = new FormData();
      formData.append('caption', caption);
      if (selectedFile) formData.append('files', selectedFile);

      await api.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setCaption('');
      clearFile();
      onClose();
      window.dispatchEvent(new CustomEvent('socialtush:post-published'));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al contribuir');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCancel = () => {
    setCaption('');
    clearFile();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm md:items-center md:p-4">
      <div className="absolute inset-0" onClick={handleCancel} />

      <div className="relative z-10 flex max-h-[90vh] w-full flex-col overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-6 pb-safe text-slate-800 shadow-2xl animate-in slide-in-from-bottom duration-200 dark:border-slate-800 dark:bg-[#0f172a] dark:text-slate-100 md:max-w-lg md:rounded-3xl md:max-h-none">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <h3 className="text-base font-extrabold">Nueva contribución</h3>
          <button
            onClick={handleCancel}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handlePublish} className="flex-1 space-y-4">
          <textarea
            rows={4}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="¿Qué quieres compartir hoy?..."
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-teal-600 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
            required={!selectedFile}
          />

          {filePreview && selectedFile && (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 dark:border-slate-800">
              {isVideo ? (
                <video
                  src={filePreview}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-[46vh] min-h-48 w-full bg-black object-contain"
                />
              ) : (
                <img
                  src={filePreview}
                  alt="Vista previa"
                  className="max-h-[46vh] w-full object-contain"
                />
              )}

              <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/65 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur">
                {isVideo ? <VideoIcon className="h-3.5 w-3.5" /> : <ImageIcon className="h-3.5 w-3.5" />}
                {isVideo ? 'Video' : 'Imagen'}
              </div>

              <button
                type="button"
                onClick={clearFile}
                className="absolute right-2 top-2 rounded-full bg-black/65 p-1.5 text-white transition-colors hover:bg-black/85"
                aria-label="Quitar archivo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:bg-slate-200 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
              <ImageIcon className="h-4 w-4 text-emerald-500" />
              <span>Foto / Video</span>
              <input
                type="file"
                onChange={handleFileChange}
                accept="image/*,video/*"
                className="hidden"
              />
            </label>

            <button
              type="submit"
              disabled={isPublishing || (!caption.trim() && !selectedFile)}
              className="rounded-xl bg-teal-700 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-teal-900/30 transition-all hover:bg-teal-600 disabled:opacity-50"
            >
              {isPublishing ? 'Contribuyendo...' : 'Contribuir'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
