import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

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
      // Action error handled gracefully
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
      // Privacy update error handled gracefully
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Error al cargar perfil'}</Text>
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
        {onBack ? (
          <TouchableOpacity style={styles.iconButton} onPress={onBack}>
            <Ionicons name="arrow-back" size={20} color="#94a3b8" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <Text style={styles.headerTitle}>@{profile.username}</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Main Profile Info */}
      <View style={styles.profileInfo}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarLetter}>
            {(profile.displayName || profile.username).charAt(0).toUpperCase()}
          </Text>
        </View>

        <Text style={styles.displayName}>{profile.displayName || profile.username}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        
        {profile.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : null}

        {/* Action Button */}
        <View style={styles.actionsRow}>
          {profile.isSelf ? (
            <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
              <Ionicons name="log-out-outline" size={16} color="#f87171" />
              <Text style={styles.logoutButtonText}>Cerrar sesión</Text>
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
          <View style={{ flex: 1 }}>
            <Text style={styles.privacyTitle}>Cuenta Privada</Text>
            <Text style={styles.privacySub}>Oculta tus publicaciones a no seguidores</Text>
          </View>
          <Switch
            value={profile.isPrivate}
            onValueChange={handlePrivacyToggle}
            trackColor={{ false: '#1e293b', true: '#0f766e' }}
            thumbColor={profile.isPrivate ? '#14b8a6' : '#94a3b8'}
          />
        </View>
      )}

      {/* Content boundary */}
      {showPrivateBoundary ? (
        <View style={styles.privateContainer}>
          <Ionicons name="lock-closed-outline" size={32} color="#64748b" />
          <Text style={styles.privateTitle}>Esta cuenta es privada</Text>
          <Text style={styles.privateText}>Sigue a este usuario para ver su actividad.</Text>
        </View>
      ) : (
        <View style={styles.feedPlaceholder}>
          <Ionicons name="images-outline" size={32} color="#334155" />
          <Text style={styles.feedText}>Aún no hay publicaciones</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  content: {
    padding: 20,
    paddingTop: 16,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#090d16',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  iconButton: {
    padding: 4,
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#14b8a650',
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
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
  },
  bio: {
    color: '#cbd5e1',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 18,
    maxWidth: '85%',
  },
  actionsRow: {
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  followButton: {
    backgroundColor: '#0f766e',
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 12,
  },
  followButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  unfollowButton: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  unfollowButtonText: {
    color: '#94a3b8',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ef444415',
    borderWidth: 1,
    borderColor: '#ef444430',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 12,
  },
  logoutButtonText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
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
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  privacySetting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 20,
  },
  privacyTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  privacySub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  privateContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  privateTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 4,
  },
  privateText: {
    color: '#64748b',
    fontSize: 12,
  },
  feedPlaceholder: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  feedText: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 8,
    fontWeight: '500',
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
  },
  backButtonText: {
    color: '#ffffff',
    fontSize: 13,
  },
});
