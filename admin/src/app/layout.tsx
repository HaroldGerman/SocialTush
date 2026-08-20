import type { Metadata } from 'next';
import './globals.css';
import { AdminAuthProvider } from '@/context/AdminAuthContext';

export const metadata: Metadata = { title: 'Lifonk Admin', description: 'Administración interna de Lifonk' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body><AdminAuthProvider>{children}</AdminAuthProvider></body></html>;
}
