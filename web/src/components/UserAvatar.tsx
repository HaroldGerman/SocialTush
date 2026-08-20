'use client';

import React, { useState } from 'react';

interface UserAvatarProps {
  avatarUrl?: string | null;
  name?: string | null;
  className?: string;
  imageClassName?: string;
}

export default function UserAvatar({ avatarUrl, name, className = '', imageClassName = '' }: UserAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const canRenderImage = Boolean(avatarUrl && failedUrl !== avatarUrl);
  const initial = (name?.trim().charAt(0) || 'U').toUpperCase();

  return (
    <div className={`overflow-hidden flex items-center justify-center bg-teal-700 text-white font-bold ${className}`}>
      {canRenderImage ? (
        <img
          src={avatarUrl!}
          alt={name ? `Avatar de ${name}` : 'Avatar'}
          className={`w-full h-full object-cover ${imageClassName}`}
          onError={() => setFailedUrl(avatarUrl!)}
        />
      ) : initial}
    </div>
  );
}
