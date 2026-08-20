'use client';

import React, { useState } from 'react';
import { api } from '@/context/AuthContext';
import { X, Image as ImageIcon, Camera } from 'lucide-react';

interface PostComposerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PostComposer({ isOpen, onClose }: PostComposerProps) {
  const [caption, setCaption] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caption.trim() && !selectedFile) return;

    setIsPublishing(true);
    try {
      const formData = new FormData();
      formData.append('caption', caption);
      if (selectedFile) {
        formData.append('files', selectedFile);
      }

      await api.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setCaption('');
      setSelectedFile(null);
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
        setFilePreview(null);
      }
      onClose();
      // Reload page to display new post
      window.location.reload();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al publicar momento');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCancel = () => {
    setCaption('');
    setSelectedFile(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
      {/* Mobile Back button or close modal overlay */}
      <div className="absolute inset-0" onClick={handleCancel} />

      <div className="relative w-full md:max-w-lg bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-t-3xl md:rounded-3xl p-6 shadow-2xl z-10 flex flex-col max-h-[90vh] md:max-h-none overflow-y-auto pb-safe animate-in slide-in-from-bottom duration-200 text-slate-800 dark:text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-base font-extrabold">Nuevo Momento</h3>
          <button onClick={handleCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handlePublish} className="space-y-4 flex-1">
          <div>
            <textarea
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="¿Qué quieres compartir hoy con la comunidad?..."
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm focus:outline-none focus:border-teal-600 resize-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
              required={!selectedFile}
            />
          </div>

          {/* Image/Video Preview */}
          {filePreview && (
            <div className="relative rounded-2xl overflow-hidden max-h-60 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
              <img src={filePreview} alt="Preview" className="w-full h-full object-contain max-h-60" />
              <button
                type="button"
                onClick={() => { setSelectedFile(null); setFilePreview(null); }}
                className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition-all border border-slate-200 dark:border-slate-800">
              <ImageIcon className="w-4 h-4 text-emerald-500" />
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
              className="px-6 py-2.5 bg-teal-700 hover:bg-teal-600 text-white font-bold text-xs rounded-xl shadow-md shadow-teal-900/30 disabled:opacity-50 transition-all"
            >
              {isPublishing ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
