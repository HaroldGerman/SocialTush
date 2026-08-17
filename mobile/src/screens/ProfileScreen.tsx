import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useAuth } from '../context/AuthContext';

interface ProfileScreenProps {
  username: string;
  onLogout: () => void;
  onBack?: () => void;
}

interface ProfileData {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  isPrivate: boolean;
  isSelf: boolean;
  isFollowing: boolean;
  followersCount: number;
  followingCount: number;
}

export default function ProfileScreen({ username, onLogout, onBack }: ProfileScreenProps) {
  const { user: currentUser, api } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/profiles/${username}`);
      setProfile(res.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al cargar perfil');
    } finally {
      setLoading(false);
    }
  }, [username, api]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleFollowToggle = async () => {
    if (!profile) return;
    try {
      if (profile.isFollowing) {
        await api.post(`/social/unfollow/${profile.username}`);
        setProfile(prev => prev ? {
          ...prev,
          isFollowing: false,
          followersCount: Math.max(0, prev.followersCount - 1)
        } : null);
      } else {
        const res = await api.post(`/social/follow/${profile.username}`);
        const isRequestPending = res.data.status === 'PENDING';
        setProfile(prev => prev ? {
          ...prev,
          isFollowing: !isRequestPending,
          followersCount: !isRequestPending ? prev.followersCount + 1 : prev.followersCount
        } : null);
      }
    } catch (err) {
      alert('Error en acción de seguimiento');
    }
  };

  const handlePrivacyToggle = async (value: boolean) => {
    if (!profile) return;
    try {
      await api.put('/profiles/me', {
        displayName: profile.displayName,
        bio: profile.bio,
        isPrivate: value
      });
      setProfile(prev => prev ? { ...prev, isPrivate: value } : null);
    } catch (err) {
      alert('Error al actualizar privacidad');
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Error al cargar'}</Text>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const showPrivateBoundary = profile.isPrivate && !profile.isSelf && !profile.isFollowing;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        {onBack && (
          <TouchableOpacity style={styles.iconButton} onPress={onBack}>
            <Text style={{ color: '#a1a1aa' }}>Atrás</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>@{profile.username}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Main Profile Info */}
      <View style={styles.profileInfo}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarLetter}>
            {profile.displayName.charAt(0).toUpperCase()}
          </Text>
        </View>

        <Text style={styles.displayName}>{profile.displayName}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        
        {profile.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : null}

        {/* Action Button */}
        <View style={styles.actionsRow}>
          {profile.isSelf ? (
            <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
              <Text style={styles.logoutButtonText}>Cerrar Sesión</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.followButton, profile.isFollowing && styles.unfollowButton]} 
              onPress={handleFollowToggle}
            >
              <Text style={[styles.followButtonText, profile.isFollowing && styles.unfollowButtonText]}>
                {profile.isFollowing ? 'Siguiendo' : 'Seguir'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>0</Text>
          <Text style={styles.statLabel}>Posts</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{profile.followersCount}</Text>
          <Text style={styles.statLabel}>Seguidores</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{profile.followingCount}</Text>
          <Text style={styles.statLabel}>Seguidos</Text>
        </View>
      </View>

      {/* Privacy Settings toggler if Self */}
      {profile.isSelf && (
        <View style={styles.privacySetting}>
          <View>
            <Text style={styles.privacyTitle}>Cuenta Privada</Text>
            <Text style={styles.privacySub}>Oculta tus publicaciones a no seguidores</Text>
          </View>
          <Switch
            value={profile.isPrivate}
            onValueChange={handlePrivacyToggle}
            trackColor={{ false: '#27272a', true: '#4f46e5' }}
            thumbColor={profile.isPrivate ? '#6366f1' : '#a1a1aa'}
          />
        </View>
      )}

      {/* Content boundary */}
      {showPrivateBoundary ? (
        <View style={styles.privateContainer}>
          <Text style={styles.privateTitle}>Esta cuenta es privada</Text>
          <Text style={styles.privateText}>Sigue a este usuario para ver su actividad.</Text>
        </View>
      ) : (
        <View style={styles.feedPlaceholder}>
          <Text style={styles.feedText}>No hay publicaciones disponibles</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  content: {
    padding: 24,
    paddingTop: 48,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#09090b',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  iconButton: {
    padding: 8,
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarLetter: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  displayName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  username: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 4,
  },
  bio: {
    color: '#a1a1aa',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 18,
    maxWidth: '80%',
  },
  actionsRow: {
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  followButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 10,
  },
  followButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  unfollowButton: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  unfollowButtonText: {
    color: '#a1a1aa',
  },
  logoutButton: {
    backgroundColor: '#ef444415',
    borderWidth: 1,
    borderColor: '#ef444430',
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 10,
  },
  logoutButtonText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#18181b',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 24,
  },
  statBox: {
    alignItems: 'center',
  },
  statVal: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#71717a',
    fontSize: 10,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  privacySetting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#18181b',
    marginBottom: 24,
  },
  privacyTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  privacySub: {
    color: '#71717a',
    fontSize: 11,
    marginTop: 2,
  },
  privateContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  privateTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  privateText: {
    color: '#71717a',
    fontSize: 12,
  },
  feedPlaceholder: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  feedText: {
    color: '#3f3f46',
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#18181b',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 12,
  },
});
