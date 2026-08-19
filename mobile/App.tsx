import React, { useState } from 'react';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import FeedScreen from './src/screens/FeedScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import ChatRoomScreen from './src/screens/ChatRoomScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import CirclesScreen from './src/screens/CirclesScreen';
import CreatePostModal from './src/components/CreatePostModal';
import { StyleSheet, Text, View, StatusBar, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from './src/theme';

interface Conversation {
  conversationId: string;
  name: string;
  avatarUrl: string;
  isGroup: boolean;
  latestMessage: string;
  updatedAt: string;
}

type TabType = 'INICIO' | 'CIRCULOS' | 'CREAR' | 'MENSAJES' | 'PERFIL' | 'NOTIFS';

function MainApp() {
  const { user, logout } = useAuth();
  const { theme, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [screen, setScreen] = useState<'WELCOME' | 'LOGIN' | 'REGISTER'>('WELCOME');
  const [authTab, setAuthTab] = useState<TabType>('INICIO');
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [targetProfileUsername, setTargetProfileUsername] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [feedRefreshKey, setFeedRefreshKey] = useState<number>(0);

  if (user) {
    return (
      <View style={[styles.mainWrapper, { backgroundColor: theme.background, paddingTop: insets.top }]}>
        <StatusBar 
          barStyle={isDark ? "light-content" : "dark-content"} 
          backgroundColor={theme.background} 
          translucent={true}
        />
        
        {/* Main Content Screen */}
        <View style={{ flex: 1 }}>
          {authTab === 'INICIO' && (
            <FeedScreen 
              key={feedRefreshKey}
              onOpenNotifications={() => setAuthTab('NOTIFS')}
              onOpenProfile={() => {
                setTargetProfileUsername(user.username);
                setAuthTab('PERFIL');
              }}
              onOpenUser={(username) => {
                setTargetProfileUsername(username);
                setAuthTab('PERFIL');
              }}
            />
          )}
          
          {authTab === 'CIRCULOS' && <CirclesScreen />}

          {authTab === 'NOTIFS' && <NotificationsScreen />}

          {authTab === 'MENSAJES' && (
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
          
          {authTab === 'PERFIL' && (
            <ProfileScreen 
              username={targetProfileUsername || user.username}
              onLogout={logout}
              onBack={targetProfileUsername && targetProfileUsername !== user.username ? () => setAuthTab('INICIO') : undefined}
            />
          )}
        </View>

        {/* Real Create Post Modal */}
        <CreatePostModal
          visible={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onPostCreated={() => {
            setAuthTab('INICIO');
            setFeedRefreshKey(prev => prev + 1);
          }}
        />

        {/* Dynamic Theme 5-Tab Navigation Bar */}
        <View style={[styles.tabBar, { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: Math.max(insets.bottom, 4) }]}>
          {/* 1. Inicio */}
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => {
              setAuthTab('INICIO');
              setTargetProfileUsername(null);
              setActiveConversation(null);
            }}
          >
            <Ionicons 
              name={authTab === 'INICIO' ? 'home' : 'home-outline'} 
              size={22} 
              color={authTab === 'INICIO' ? theme.accent : theme.textMuted} 
            />
            <Text style={[styles.tabText, { color: theme.textMuted }, authTab === 'INICIO' && { color: theme.accent, fontWeight: 'bold' }]}>
              Inicio
            </Text>
          </TouchableOpacity>

          {/* 2. Círculos */}
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => {
              setAuthTab('CIRCULOS');
              setTargetProfileUsername(null);
              setActiveConversation(null);
            }}
          >
            <Ionicons 
              name={authTab === 'CIRCULOS' ? 'people' : 'people-outline'} 
              size={22} 
              color={authTab === 'CIRCULOS' ? theme.accent : theme.textMuted} 
            />
            <Text style={[styles.tabText, { color: theme.textMuted }, authTab === 'CIRCULOS' && { color: theme.accent, fontWeight: 'bold' }]}>
              Círculos
            </Text>
          </TouchableOpacity>

          {/* 3. Crear (Featured Middle Button) */}
          <TouchableOpacity 
            style={styles.tabItemCreate} 
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.85}
          >
            <View style={[styles.createBtnCircle, { backgroundColor: theme.primary }]}>
              <Ionicons name="add" size={28} color="#ffffff" />
            </View>
            <Text style={[styles.tabTextCreate, { color: theme.accent }]}>Crear</Text>
          </TouchableOpacity>

          {/* 4. Mensajes */}
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => {
              setAuthTab('MENSAJES');
              setTargetProfileUsername(null);
            }}
          >
            <Ionicons 
              name={authTab === 'MENSAJES' ? 'chatbubbles' : 'chatbubbles-outline'} 
              size={22} 
              color={authTab === 'MENSAJES' ? theme.accent : theme.textMuted} 
            />
            <Text style={[styles.tabText, { color: theme.textMuted }, authTab === 'MENSAJES' && { color: theme.accent, fontWeight: 'bold' }]}>
              Mensajes
            </Text>
          </TouchableOpacity>

          {/* 5. Perfil */}
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => {
              setTargetProfileUsername(user.username);
              setAuthTab('PERFIL');
              setActiveConversation(null);
            }}
          >
            <Ionicons 
              name={authTab === 'PERFIL' ? 'person' : 'person-outline'} 
              size={22} 
              color={authTab === 'PERFIL' ? theme.accent : theme.textMuted} 
            />
            <Text style={[styles.tabText, { color: theme.textMuted }, authTab === 'PERFIL' && { color: theme.accent, fontWeight: 'bold' }]}>
              Perfil
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (screen === 'LOGIN') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top }}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />
        <LoginScreen 
          onNavigateToRegister={() => setScreen('REGISTER')}
          onLoginSuccess={() => {}}
        />
      </View>
    );
  }

  if (screen === 'REGISTER') {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top }}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />
        <RegisterScreen 
          onNavigateToLogin={() => setScreen('LOGIN')}
          onRegisterSuccess={() => {}}
        />
      </View>
    );
  }

  // Unauthenticated Public Welcome Screen
  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={theme.background} />
      
      {/* Ambient Glow */}
      <View style={[styles.ambientGlow, { backgroundColor: isDark ? '#0f766e15' : '#0f766e10' }]} />

      {/* Main Branding Card */}
      <View style={[styles.welcomeCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={[styles.logoBadge, { backgroundColor: theme.primary }]}>
          <Text style={styles.logoText}>S</Text>
        </View>

        <Text style={[styles.appName, { color: theme.textPrimary }]}>SocialTush</Text>
        <Text style={[styles.appTagline, { color: theme.accent }]}>Conecta. Comparte. Descubre.</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: theme.primary }]} 
            activeOpacity={0.85}
            onPress={() => setScreen('LOGIN')}
          >
            <Text style={styles.primaryButtonText}>Iniciar sesión</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.secondaryButton, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]} 
            activeOpacity={0.85}
            onPress={() => setScreen('REGISTER')}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.textPrimary }]}>Crear una cuenta</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  mainWrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  ambientGlow: {
    position: 'absolute',
    top: '20%',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  welcomeCard: {
    width: '100%',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#14b8a650',
    marginBottom: 20,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 42,
    fontWeight: '900',
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  appTagline: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 36,
  },
  buttonContainer: {
    width: '100%',
    gap: 14,
  },
  primaryButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  tabBar: {
    minHeight: 60,
    flexDirection: 'row',
    borderTopWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemCreate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#14b8a660',
    marginTop: -14,
  },
  tabText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  tabTextCreate: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
});
