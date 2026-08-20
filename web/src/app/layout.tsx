import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { CreateHubProvider } from "@/context/CreateHubContext";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import { RealtimeActivityProvider } from "@/context/RealtimeActivityContext";

export const metadata: Metadata = {
  title: "Lifonk - Red social",
  description: "Connect, chat, share posts and stories in a premium, ultra-fast platform.",
  manifest: "/manifest.webmanifest",
  applicationName: "Lifonk",
  themeColor: "#0f766e",
  icons: {
    icon: "/icons/lifonk.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var theme = localStorage.getItem('socialtush-theme') || 'light';
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-200">
        <ServiceWorkerRegistrar />
        <ThemeProvider>
          <AuthProvider>
            <RealtimeActivityProvider>
              <CreateHubProvider>
                {children}
              </CreateHubProvider>
            </RealtimeActivityProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
