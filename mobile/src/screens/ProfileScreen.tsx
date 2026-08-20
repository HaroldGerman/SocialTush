import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';

interface ProfileData {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  isPrivate: boolean;
  onboardingCompleted: boolean;
}

interface ProfileScreenProps {
  username?: string;
  onLogout?: () => void;
  onBack?: () => void;
}

export default function ProfileScreen({ username, onLogout, onBack }: ProfileScreenProps) {
  const { api, user: currentUser } = useAuth();
  const { theme } = useAppTheme();
  
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPrivate, setIsPrivate] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');

  const targetUsername = username || currentUser?.username;
  const isSelf = !username || username === currentUser?.username;

  const fetchProfile = async () => {
    try {
      const res = await api.get(`/profiles/${targetUsername}`);
      setProfile(res.data);
      setIsPrivate(res.data.isPrivate);
    } catch (err) {
      // Fallback to basic session info
      setProfile({
        userId: currentUser?.userId || '1',
        username: targetUsername || 'usuario',
        displayName: currentUser?.displayName || targetUsername || 'Usuario',
        bio: 'Miembro activo de Lifonk.',
        avatarUrl: '',
        isPrivate: false,
        onboardingCompleted: true,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [targetUsername]);

  const handleTogglePrivacy = async (value: boolean) => {
    setUpdating(true);
    setUpdateError('');
    try {
      const res = await api.put('/profiles/me', { isPrivate: value });
      setIsPrivate(res.data.isPrivate);
      setProfile(previous => previous ? { ...previous, isPrivate: res.data.isPrivate } : previous);
    } catch (err) {
      console.error(err);
      setUpdateError('No se pudo actualizar la privacidad.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
          </TouchableOpacity>
        ) : null}
        <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>@{profile?.username}</Text>
        {isSelf && onLogout ? (
          <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color={theme.danger} />
          </TouchableOpacity>
        ) : <View style={{ width: 32 }} />}
      </View>

      {/* Main Profile Info */}
      <View style={styles.content}>
        <View style={styles.avatarSection}>
          <View style={[styles.avatarLarge, { backgroundColor: theme.primary }]}>
            <Text style={styles.avatarTextLarge}>
              {(profile?.displayName || profile?.username || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>

          <Text style={[styles.displayName, { color: theme.textPrimary }]}>
            {profile?.displayName || profile?.username}
          </Text>
          <Text style={[styles.usernameHandle, { color: theme.accent }]}>@{profile?.username}</Text>

          {profile?.bio ? (
            <Text style={[styles.bioText, { color: theme.textSecondary }]}>{profile.bio}</Text>
          ) : null}
        </View>

        {/* Self Settings */}
        {isSelf ? (
          <View style={styles.settingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Configuración de Privacidad</Text>
            {updateError ? <Text style={{ color: theme.danger, fontSize: 12 }}>{updateError}</Text> : null}

            <View style={[styles.settingRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.settingInfo}>
                <Ionicons name="lock-closed-outline" size={20} color={theme.accent} />
                <View>
                  <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>Cuenta Privada</Text>
                  <Text style={[styles.settingSub, { color: theme.textMuted }]}>Solo seguidores aprobados ven tu contenido</Text>
                </View>
              </View>
              <Switch
                value={isPrivate}
                onValueChange={handleTogglePrivacy}
                disabled={updating}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#ffffff"
              />
            </View>

            {onLogout ? (
              <TouchableOpacity 
                style={[styles.logoutCardBtn, { backgroundColor: '#ef444415', borderColor: '#ef444440' }]} 
                onPress={onLogout}
              >
                <Ionicons name="log-out-outline" size={20} color={theme.danger} />
                <Text style={[styles.logoutCardText, { color: theme.danger }]}>Cerrar Sesión</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  logoutBtn: {
    padding: 4,
  },
  content: {
    padding: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarLarge: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarTextLarge: {
    color: '#ffffff',
    fontSize: 38,
    fontWeight: 'bold',
  },
  displayName: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  usernameHandle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  bioText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  settingsSection: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  settingSub: {
    fontSize: 11,
    marginTop: 2,
  },
  logoutCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 12,
  },
  logoutCardText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});
