'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type LifonkLanguage = 'es' | 'en';

const STORAGE_KEY = 'lifonk-language';

const dictionary = {
  es: {
    registerTitle: 'Crea tu cuenta',
    registerSubtitle: 'Usaremos tu correo para proteger y recuperar tu cuenta.',
    publicName: 'Nombre público',
    username: 'Nombre de usuario',
    email: 'Correo electrónico',
    password: 'Contraseña',
    passwordHint: 'Mínimo 8 caracteres',
    language: 'Idioma',
    spanish: 'Español',
    english: 'English',
    createAccount: 'Crear cuenta',
    creatingAccount: 'Creando cuenta...',
    alreadyAccount: '¿Ya tienes una cuenta?',
    signIn: 'Inicia sesión',
    back: 'Volver al Ritmo',
    passwordMin: 'La contraseña debe tener al menos 8 caracteres.',
    registerError: 'Error al registrarse. Intenta con otro nombre de usuario o correo.',
    languageSettings: 'Idioma de Lifonk',
    languageSettingsHint: 'Elige cómo quieres ver Lifonk.',
    save: 'Guardar',
    saved: 'Idioma guardado',
  },
  en: {
    registerTitle: 'Create your account',
    registerSubtitle: 'We will use your email to protect and recover your account.',
    publicName: 'Display name',
    username: 'Username',
    email: 'Email address',
    password: 'Password',
    passwordHint: 'At least 8 characters',
    language: 'Language',
    spanish: 'Español',
    english: 'English',
    createAccount: 'Create account',
    creatingAccount: 'Creating account...',
    alreadyAccount: 'Already have an account?',
    signIn: 'Sign in',
    back: 'Back to Ritmo',
    passwordMin: 'Password must be at least 8 characters long.',
    registerError: 'Could not create your account. Try another username or email.',
    languageSettings: 'Lifonk language',
    languageSettingsHint: 'Choose how you want to view Lifonk.',
    save: 'Save',
    saved: 'Language saved',
  },
} as const;

type TranslationKey = keyof typeof dictionary.es;

interface LanguageContextValue {
  language: LifonkLanguage;
  setLanguage: (language: LifonkLanguage) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function detectLanguage(): LifonkLanguage {
  if (typeof window === 'undefined') return 'es';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'es' || stored === 'en') return stored;
  return window.navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LifonkLanguage>('es');

  useEffect(() => {
    setLanguageState(detectLanguage());
  }, []);

  useEffect(() => {
    const onExternalChange = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      if (value === 'es' || value === 'en') setLanguageState(value);
    };
    window.addEventListener('lifonk:language-changed', onExternalChange);
    return () => window.removeEventListener('lifonk:language-changed', onExternalChange);
  }, []);

  const setLanguage = (next: LifonkLanguage) => {
    setLanguageState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
      window.dispatchEvent(new CustomEvent('lifonk:language-changed', { detail: next }));
    }
  };

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key) => dictionary[language][key],
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage debe usarse dentro de LanguageProvider');
  return context;
}
