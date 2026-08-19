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
import CirclesScreen from './src/screens/CirclesScreen';
import { StyleSheet, Text, View, StatusBar, TouchableOpacity, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Conversation {
  conversationId: string;
  name: string;
  avatarUrl: string;
  isGroup: boolean;
  latestMessage: string;
  updatedAt: string;
}

type TabType = 'INICIO' | 'CIRCULOS' | 'CREAR' | 'MENSAJES' | 'PERFIL';

function MainApp() {
  const { user, logout } = useAuth();
  const [screen, setScreen] = useState<'WELCOME' | 'LOGIN' | 'REGISTER'>('WELCOME');
  const [authTab, setAuthTab] = useState<TabType>('INICIO');
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);

  if (user) {
    return (
      <View style={{ flex: 1, backgroundColor: '#090d16' }}>
        <StatusBar barStyle="light-content" backgroundColor="#090d16" />
        
        {/* Main Content Screen */}
        <View style={{ flex: 1 }}>
          {authTab === 'INICIO' && <FeedScreen />}
          
          {authTab === 'CIRCULOS' && <CirclesScreen />}

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
              username={user.username}
              onLogout={logout}
            />
          )}
        </View>

        {/* Create Action Modal */}
        <Modal
          visible={showCreateModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCreateModal(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowCreateModal(false)}
          >
            <View style={styles.createModalContent}>
              <Text style={styles.createModalTitle}>Crear en SocialTush</Text>
              
              <TouchableOpacity 
                style={styles.createOption}
                onPress={() => {
                  setShowCreateModal(false);
                  Alert.alert('Nueva Publicación', 'Función de creación de post en desarrollo.');
                }}
              >
                <View style={[styles.createIconBox, { backgroundColor: '#0f766e20' }]}>
                  <Ionicons name="image-outline" size={24} color="#14b8a6" />
                </View>
                <View>
                  <Text style={styles.createOptionTitle}>Nueva Publicación</Text>
                  <Text style={styles.createOptionSub}>Comparte fotos o momentos</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.createOption}
                onPress={() => {
                  setShowCreateModal(false);
                  Alert.alert('Nueva Historia', 'Función de historias efímeras en desarrollo.');
                }}
              >
                <View style={[styles.createIconBox, { backgroundColor: '#10b98120' }]}>
                  <Ionicons name="camera-outline" size={24} color="#10b981" />
                </View>
                <View>
                  <Text style={styles.createOptionTitle}>Nueva Historia</Text>
                  <Text style={styles.createOptionSub}>Momento efímero de 24h</Text>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Modern 5-Tab Navigation Bar */}
        <View style={styles.tabBar}>
          {/* 1. Inicio */}
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => {
              setAuthTab('INICIO');
              setActiveConversation(null);
            }}
          >
            <Ionicons 
              name={authTab === 'INICIO' ? 'home' : 'home-outline'} 
              size={22} 
              color={authTab === 'INICIO' ? '#14b8a6' : '#64748b'} 
            />
            <Text style={[styles.tabText, authTab === 'INICIO' && styles.tabTextActive]}>Inicio</Text>
          </TouchableOpacity>

          {/* 2. Círculos */}
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => {
              setAuthTab('CIRCULOS');
              setActiveConversation(null);
            }}
          >
            <Ionicons 
              name={authTab === 'CIRCULOS' ? 'people' : 'people-outline'} 
              size={22} 
              color={authTab === 'CIRCULOS' ? '#14b8a6' : '#64748b'} 
            />
            <Text style={[styles.tabText, authTab === 'CIRCULOS' && styles.tabTextActive]}>Círculos</Text>
          </TouchableOpacity>

          {/* 3. Crear (Featured Middle Button) */}
          <TouchableOpacity 
            style={styles.tabItemCreate} 
            onPress={() => setShowCreateModal(true)}
            activeOpacity={0.85}
          >
            <View style={styles.createBtnCircle}>
              <Ionicons name="add" size={28} color="#ffffff" />
            </View>
            <Text style={styles.tabTextCreate}>Crear</Text>
          </TouchableOpacity>

          {/* 4. Mensajes */}
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => setAuthTab('MENSAJES')}
          >
            <Ionicons 
              name={authTab === 'MENSAJES' ? 'chatbubbles' : 'chatbubbles-outline'} 
              size={22} 
              color={authTab === 'MENSAJES' ? '#14b8a6' : '#64748b'} 
            />
            <Text style={[styles.tabText, authTab === 'MENSAJES' && styles.tabTextActive]}>Mensajes</Text>
          </TouchableOpacity>

          {/* 5. Perfil */}
          <TouchableOpacity 
            style={styles.tabItem} 
            onPress={() => {
              setAuthTab('PERFIL');
              setActiveConversation(null);
            }}
          >
            <Ionicons 
              name={authTab === 'PERFIL' ? 'person' : 'person-outline'} 
              size={22} 
              color={authTab === 'PERFIL' ? '#14b8a6' : '#64748b'} 
            />
            <Text style={[styles.tabText, authTab === 'PERFIL' && styles.tabTextActive]}>Perfil</Text>
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

  // Unauthenticated Public Welcome Screen
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#090d16" />
      
      {/* Decorative Glow */}
      <View style={styles.ambientGlow} />

      {/* Main Branding Card */}
      <View style={styles.welcomeCard}>
        {/* Large Logo Badge */}
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>S</Text>
        </View>

        <Text style={styles.appName}>SocialTush</Text>
        <Text style={styles.appTagline}>Conecta. Comparte. Descubre.</Text>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.primaryButton} 
            activeOpacity={0.85}
            onPress={() => setScreen('LOGIN')}
          >
            <Text style={styles.primaryButtonText}>Iniciar sesión</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.secondaryButton} 
            activeOpacity={0.85}
            onPress={() => setScreen('REGISTER')}
          >
            <Text style={styles.secondaryButtonText}>Crear una cuenta</Text>
          </TouchableOpacity>
        </View>
      </View>
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
    backgroundColor: '#090d16',
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
    backgroundColor: '#0f766e15',
  },
  welcomeCard: {
    width: '100%',
    backgroundColor: '#0f172a80',
    borderRadius: 28,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#0f766e',
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
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  appTagline: {
    color: '#14b8a6',
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
    backgroundColor: '#0f766e',
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
    backgroundColor: '#090d16',
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  tabBar: {
    height: 64,
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  tabItemCreate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  createBtnCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#14b8a660',
    marginTop: -10,
  },
  tabText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  tabTextActive: {
    color: '#14b8a6',
    fontWeight: 'bold',
  },
  tabTextCreate: {
    color: '#14b8a6',
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'flex-end',
  },
  createModalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  createModalTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  createOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
  },
  createIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createOptionTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  createOptionSub: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
});
