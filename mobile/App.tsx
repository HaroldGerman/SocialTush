import React, { useState } from 'react';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import FeedScreen from './src/screens/FeedScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import ChatRoomScreen from './src/screens/ChatRoomScreen';
import ReelsScreen from './src/screens/ReelsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import { StyleSheet, Text, View, StatusBar, TouchableOpacity } from 'react-native';

interface Conversation {
  conversationId: string;
  name: string;
  avatarUrl: string;
  isGroup: boolean;
  latestMessage: string;
  updatedAt: string;
}

function MainApp() {
  const { user, logout } = useAuth();
  const [screen, setScreen] = useState<'WELCOME' | 'LOGIN' | 'REGISTER'>('WELCOME');
  const [authTab, setAuthTab] = useState<'FEED' | 'REELS' | 'CHATS' | 'NOTIFS' | 'PROFILE'>('FEED');
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  if (user) {
    return (
      <View style={{ flex: 1, backgroundColor: '#09090b' }}>
        <StatusBar barStyle="light-content" backgroundColor="#09090b" />
        
        {/* Main Content Screen */}
        <View style={{ flex: 1 }}>
          {authTab === 'FEED' && <FeedScreen />}
          
          {authTab === 'REELS' && <ReelsScreen />}

          {authTab === 'CHATS' && (
            activeConversation ? (
              <ChatRoomScreen 
                conversation={activeConversation}
                onBack={() => setActiveConversation(null)}
              />
            ) : (
              <ChatListScreen 
                onSelectConversation={(conv) => setActiveConversation(conv)}
              />
            )
          )}
          
          {authTab === 'NOTIFS' && <NotificationsScreen />}

          {authTab === 'PROFILE' && (
            <ProfileScreen 
              username={user.username}
              onLogout={logout}
            />
          )}
        </View>

        {/* Custom Tab Navigation Bar (5 Tabs) */}
        <View style={styles.tabBar}>
          <TouchableOpacity 
            style={[styles.tabItem, authTab === 'FEED' && styles.tabActive]} 
            onPress={() => {
              setAuthTab('FEED');
              setActiveConversation(null);
            }}
          >
            <Text style={[styles.tabText, authTab === 'FEED' && styles.tabTextActive]}>Feed</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabItem, authTab === 'REELS' && styles.tabActive]} 
            onPress={() => {
              setAuthTab('REELS');
              setActiveConversation(null);
            }}
          >
            <Text style={[styles.tabText, authTab === 'REELS' && styles.tabTextActive]}>Reels</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabItem, authTab === 'CHATS' && styles.tabActive]} 
            onPress={() => setAuthTab('CHATS')}
          >
            <Text style={[styles.tabText, authTab === 'CHATS' && styles.tabTextActive]}>Chats</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabItem, authTab === 'NOTIFS' && styles.tabActive]} 
            onPress={() => {
              setAuthTab('NOTIFS');
              setActiveConversation(null);
            }}
          >
            <Text style={[styles.tabText, authTab === 'NOTIFS' && styles.tabTextActive]}>Alertas</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.tabItem, authTab === 'PROFILE' && styles.tabActive]} 
            onPress={() => {
              setAuthTab('PROFILE');
              setActiveConversation(null);
            }}
          >
            <Text style={[styles.tabText, authTab === 'PROFILE' && styles.tabTextActive]}>Perfil</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screen === 'LOGIN') {
    return (
      <LoginScreen 
        onNavigateToRegister={() => setScreen('REGISTER')}
        onLoginSuccess={() => {}}
      />
    );
  }

  if (screen === 'REGISTER') {
    return (
      <RegisterScreen 
        onNavigateToLogin={() => setScreen('LOGIN')}
        onRegisterSuccess={() => {}}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />
      
      {/* Logo Banner */}
      <View style={styles.logoContainer}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>S</Text>
        </View>
        <Text style={styles.appName}>SocialTush</Text>
        <Text style={styles.appSub}>Plataforma Social Premium</Text>
      </View>

      {/* Development Status */}
      <View style={styles.statusBox}>
        <Text style={styles.statusTitle}>Fases 1 a 9 - Completo</Text>
        <Text style={styles.statusDescription}>
          Infraestructura, Autenticación JWT, Perfiles, Feed de Posts, Historias, Chats, Notificaciones y Videos Cortos (Reels).
        </Text>
        
        <View style={styles.indicatorRow}>
          <View style={styles.greenDot} />
          <Text style={styles.indicatorText}>Sincronizado con API Multi-Módulo</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.primaryButton} 
          activeOpacity={0.8}
          onPress={() => setScreen('LOGIN')}
        >
          <Text style={styles.primaryButtonText}>Iniciar Sesión</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.secondaryButton} 
          activeOpacity={0.8}
          onPress={() => setScreen('REGISTER')}
        >
          <Text style={styles.secondaryButtonText}>Registrar Cuenta</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>SocialTush Mobile v1.4.0 &bull; Expo</Text>
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b', // zinc-950
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#6366f1', // Indigo
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
  },
  appName: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
    letterSpacing: 0.5,
  },
  appSub: {
    color: '#a1a1aa', // zinc-400
    fontSize: 14,
    marginTop: 6,
  },
  statusBox: {
    width: '100%',
    backgroundColor: '#18181b', // zinc-900
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a', // zinc-800
  },
  statusTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusDescription: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  indicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981', // emerald-500
    marginRight: 8,
  },
  indicatorText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#a1a1aa',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    color: '#3f3f46', // zinc-700
    fontSize: 12,
  },
  tabBar: {
    height: 60,
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderTopWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabActive: {
    backgroundColor: '#09090b',
  },
  tabText: {
    color: '#a1a1aa',
    fontSize: 11,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#6366f1',
    fontWeight: 'bold',
  },
});
