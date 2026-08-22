import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { CreateHubProvider } from "@/context/CreateHubContext";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import AccountSecurityShortcut from "@/components/AccountSecurityShortcut";
import AccountSettingsShortcut from "@/components/AccountSettingsShortcut";
import GlobalImageCropInterceptor from "@/components/GlobalImageCropInterceptor";
import DeepLinkedMomentOverlay from "@/components/DeepLinkedMomentOverlay";
import ChatScopedEnhancements from "@/components/ChatScopedEnhancements";
import ChatReliableInteractions from "@/components/ChatReliableInteractions";
import ChatReplyEnhancer from "@/components/ChatReplyEnhancer";
import ChatHistoryTools from "@/components/ChatHistoryTools";
import IncomingCallBridge from "@/components/IncomingCallBridge";
import BuzzPersistenceBridge from "@/components/BuzzPersistenceBridge";
import WebPushAutoSync from "@/components/WebPushAutoSync";
import MobileEcoEnhancer from "@/components/MobileEcoEnhancer";
import PulseInteractiveEcos from "@/components/PulseInteractiveEcos";
import { RealtimeActivityProvider } from "@/context/RealtimeActivityContext";

export const metadata: Metadata = {
  title: "Lifonk - Red social",
  description: "Connect, chat, share posts and stories in a premium, ultra-fast platform.",
  manifest: "/manifest.webmanifest",
  applicationName: "Lifonk",
  themeColor: "#6d28d9",
  icons: { icon: "/icons/lifonk.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{__html:`(function(){var theme=localStorage.getItem('socialtush-theme')||'light';if(theme==='dark')document.documentElement.classList.add('dark');else document.documentElement.classList.remove('dark');var storedLanguage=localStorage.getItem('lifonk-language');var language=storedLanguage==='en'||storedLanguage==='es'?storedLanguage:((navigator.language||'es').toLowerCase().indexOf('en')===0?'en':'es');document.documentElement.lang=language;})();`}} />
      </head>
      <body className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-200">
        <ServiceWorkerRegistrar />
        <GlobalImageCropInterceptor />
        <ThemeProvider><LanguageProvider><AuthProvider>
          <WebPushAutoSync />
          <BuzzPersistenceBridge />
          <ChatReliableInteractions />
          <ChatScopedEnhancements />
          <ChatReplyEnhancer />
          <ChatHistoryTools />
          <IncomingCallBridge />
          <PulseInteractiveEcos />
          <MobileEcoEnhancer />
          <DeepLinkedMomentOverlay />
          <RealtimeActivityProvider><CreateHubProvider>{children}<AccountSettingsShortcut /><AccountSecurityShortcut /></CreateHubProvider></RealtimeActivityProvider>
        </AuthProvider></LanguageProvider></ThemeProvider>
      </body>
    </html>
  );
}
