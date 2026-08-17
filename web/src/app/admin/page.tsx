'use client';

import React, { useState, useEffect } from 'react';
import { useAuth, api } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Users, Image, Film, ShieldAlert, ArrowLeft, RefreshCw, CheckCircle, Ban 
} from 'lucide-react';

interface Stats {
  totalUsers: number;
  totalPosts: number;
  totalStories: number;
  serverTime: string;
  status: string;
}

interface AdminUser {
  userId: string;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
}

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Redirect non-admins or unauthenticated users
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (user.role !== 'ADMIN') {
        alert('Acceso restringido. Se requiere rol de Administrador.');
        router.push('/');
      }
    }
  }, [user, isLoading, router]);

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const statsRes = await api.get('/admin/stats');
      setStats(statsRes.data);

      const usersRes = await api.get('/admin/users?page=0&size=50');
      setUsers(usersRes.data.users);
    } catch (err) {
      // Mock admin fallback for offline testing
      setStats({
        totalUsers: 12,
        totalPosts: 45,
        totalStories: 6,
        serverTime: new Date().toISOString(),
        status: 'OFFLINE_SANDBOX'
      });
      setUsers(getMockAdminUsers());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      loadAdminData();
    }
  }, [user]);

  const handleToggleBlock = async (userId: string) => {
    try {
      const res = await api.post(`/admin/users/${userId}/toggle-block`);
      setUsers(prev => prev.map(u => {
        if (u.userId === userId) {
          return { ...u, isActive: res.data.isActive };
        }
        return u;
      }));
    } catch (err) {
      // Mock toggle
      setUsers(prev => prev.map(u => {
        if (u.userId === userId) {
          return { ...u, isActive: !u.isActive };
        }
        return u;
      }));
    }
  };

  if (isLoading || !user || user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <RefreshCw className="h-6 w-6 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h2 className="text-base font-bold text-white block">Panel de Administración</h2>
            <span className="text-[10px] text-zinc-500 block">Moderación General de SocialTush</span>
          </div>
        </div>

        <button 
          onClick={loadAdminData}
          className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 text-xs font-semibold"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </button>
      </div>

      {/* Grid Stats */}
      {stats && (
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div className="bg-zinc-900/40 border border-zinc-900 p-5 rounded-2xl flex items-center gap-4">
            <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">Usuarios Totales</span>
              <span className="text-xl font-extrabold text-white block">{stats.totalUsers}</span>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-900 p-5 rounded-2xl flex items-center gap-4">
            <div className="h-10 w-10 bg-purple-500/10 text-purple-400 rounded-xl flex items-center justify-center">
              <Image className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">Publicaciones (Posts)</span>
              <span className="text-xl font-extrabold text-white block">{stats.totalPosts}</span>
            </div>
          </div>

          <div className="bg-zinc-900/40 border border-zinc-900 p-5 rounded-2xl flex items-center gap-4">
            <div className="h-10 w-10 bg-pink-500/10 text-pink-400 rounded-xl flex items-center justify-center">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-semibold">Historias Activas</span>
              <span className="text-xl font-extrabold text-white block">{stats.totalStories}</span>
            </div>
          </div>
        </div>
      )}

      {/* Users moderation Table card */}
      <div className="w-full max-w-5xl mx-auto bg-zinc-900/30 border border-zinc-900 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/40">
          <span className="text-xs font-bold text-white flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4 text-indigo-400" />
            Cuentas Registradas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-950/40 border-b border-zinc-900 text-zinc-500 font-semibold">
                <th className="p-4">Usuario</th>
                <th className="p-4">Email</th>
                <th className="p-4">Rol</th>
                <th className="p-4">Estado</th>
                <th className="p-4 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/60">
              {users.map((u) => (
                <tr key={u.userId} className="hover:bg-zinc-900/10 transition-colors">
                  <td className="p-4 font-bold text-white">@{u.username}</td>
                  <td className="p-4 text-zinc-400">{u.email}</td>
                  <td className="p-4 text-zinc-400">
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      u.role === 'ADMIN' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="p-4 text-zinc-400">
                    {u.isActive ? (
                      <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Activa
                      </span>
                    ) : (
                      <span className="text-[10px] text-rose-500 font-bold flex items-center gap-1">
                        <Ban className="h-3 w-3" />
                        Bloqueada
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button 
                      onClick={() => handleToggleBlock(u.userId)}
                      disabled={u.userId === user.userId} // Cannot block yourself
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all disabled:opacity-30 ${
                        u.isActive 
                          ? 'bg-rose-600/10 border border-rose-500/20 hover:bg-rose-600 text-rose-500 hover:text-white' 
                          : 'bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-650 text-emerald-500 hover:text-white'
                      }`}
                    >
                      {u.isActive ? 'Bloquear' : 'Desbloquear'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function getMockAdminUsers(): AdminUser[] {
  return [
    {
      userId: 'admin-1',
      username: 'alex_futurist',
      email: 'alex@socialtush.com',
      role: 'ADMIN',
      isActive: true,
      isVerified: true,
      createdAt: new Date().toISOString()
    },
    {
      userId: 'user-2',
      username: 'sophia',
      email: 'sophia@loren.com',
      role: 'USER',
      isActive: true,
      isVerified: true,
      createdAt: new Date().toISOString()
    },
    {
      userId: 'user-3',
      username: 'bot_spammer',
      email: 'bot@spam.com',
      role: 'USER',
      isActive: false,
      isVerified: false,
      createdAt: new Date().toISOString()
    }
  ];
}
