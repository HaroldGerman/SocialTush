'use client';

import React, { createContext, useContext, useState } from 'react';
import CreateHub from '@/components/CreateHub';
import PostComposer from '@/components/PostComposer';
import StoryComposer from '@/components/StoryComposer';
import { useRouter } from 'next/navigation';

interface CreateHubContextType {
  openCreateHub: () => void;
  closeCreateHub: () => void;
  openPostComposer: () => void;
  openStoryComposer: () => void;
  isCreateHubOpen: boolean;
  isPostComposerOpen: boolean;
  isStoryComposerOpen: boolean;
}

const CreateHubContext = createContext<CreateHubContextType | undefined>(undefined);

export function CreateHubProvider({ children }: { children: React.ReactNode }) {
  const [isHubOpen, setIsHubOpen] = useState(false);
  const [isPostOpen, setIsPostOpen] = useState(false);
  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const router = useRouter();

  const openCreateHub = () => setIsHubOpen(true);
  const closeCreateHub = () => setIsHubOpen(false);

  const openPostComposer = () => {
    setIsHubOpen(false);
    setIsPostOpen(true);
  };
  const openStoryComposer = () => {
    setIsHubOpen(false);
    setIsStoryOpen(true);
  };

  const handleSelectCirculo = () => {
    setIsHubOpen(false);
    router.push('/circles');
  };

  return (
    <CreateHubContext.Provider value={{
      openCreateHub,
      closeCreateHub,
      openPostComposer,
      openStoryComposer,
      isCreateHubOpen: isHubOpen,
      isPostComposerOpen: isPostOpen,
      isStoryComposerOpen: isStoryOpen
    }}>
      {children}
      
      <CreateHub
        isOpen={isHubOpen}
        onClose={() => setIsHubOpen(false)}
        onSelectMomento={openPostComposer}
        onSelectHistoria={openStoryComposer}
        onSelectCirculo={handleSelectCirculo}
      />

      <PostComposer
        isOpen={isPostOpen}
        onClose={() => setIsPostOpen(false)}
      />

      <StoryComposer
        isOpen={isStoryOpen}
        onClose={() => setIsStoryOpen(false)}
        onPublished={() => window.dispatchEvent(new CustomEvent('socialtush:story-published'))}
      />
    </CreateHubContext.Provider>
  );
}

export function useCreateHub() {
  const context = useContext(CreateHubContext);
  if (!context) {
    throw new Error('useCreateHub debe usarse dentro de un CreateHubProvider');
  }
  return context;
}
