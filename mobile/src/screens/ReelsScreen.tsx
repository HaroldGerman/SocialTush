import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useAuth } from '../context/AuthContext';

interface Reel {
  postId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  caption: string;
  location: string;
  musicTitle: string;
  mediaUrls: string[];
  likesCount: number;
  commentsCount: number;
  hasLiked: boolean;
  isSaved: boolean;
}

const { height: WINDOW_HEIGHT } = Dimensions.get('window');

export default function ReelsScreen() {
  const { api, user } = useAuth();
  
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReels = async () => {
    try {
      const res = await api.get('/posts/reels?page=0&size=10');
      setReels(res.data.posts);
    } catch (err) {
      setReels(getMockReels());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReels();
  }, []);

  const handleLikeToggle = async (postId: string) => {
    try {
      const res = await api.post(`/likes/${postId}`);
      setReels(prev => prev.map(r => r.postId === postId ? { ...r, hasLiked: res.data.liked, likesCount: res.data.count } : r));
    } catch (err) {
      setReels(prev => prev.map(r => r.postId === postId ? { ...r, hasLiked: !r.hasLiked, likesCount: r.hasLiked ? r.likesCount - 1 : r.likesCount + 1 } : r));
    }
  };

  const renderReelItem = ({ item }: { item: Reel }) => (
    <View style={styles.reelContainer}>
      {/* Background Media Image Fallback for Compilability */}
      <Image 
        source={{ uri: item.mediaUrls[0] || 'https://picsum.photos/seed/reel/800/1200' }} 
        style={styles.backgroundImage}
        resizeMode="cover"
      />
      
      {/* Overlay Darkner */}
      <View style={styles.darkOverlay} />

      {/* Center Play Button Icon indicator */}
      <View style={styles.centerPlay}>
        <Text style={styles.playText}>▶</Text>
      </View>

      {/* Right Side Social Actions Panel */}
      <View style={styles.actionsPanel}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleLikeToggle(item.postId)}>
          <Text style={styles.actionIcon}>{item.hasLiked ? '❤️' : '🤍'}</Text>
          <Text style={styles.actionCount}>{item.likesCount}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionCount}>{item.commentsCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn}>
          <Text style={styles.actionIcon}>⭐️</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Info Details */}
      <View style={styles.bottomDetails}>
        <View style={styles.authorRow}>
          <View style={styles.authorAvatar}>
            <Text style={styles.avatarText}>{item.displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.username}>@{item.username}</Text>
          <TouchableOpacity style={styles.followBtn}>
            <Text style={styles.followText}>Seguir</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.caption} numberOfLines={2}>{item.caption}</Text>

        {item.musicTitle ? (
          <View style={styles.musicRow}>
            <Text style={styles.musicText}>🎵 {item.musicTitle}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={reels}
        keyExtractor={(item) => item.postId}
        renderItem={renderReelItem}
        pagingEnabled={true}
        decelerationRate="fast"
        snapToInterval={WINDOW_HEIGHT - 60} // Snaps vertically, adjusting for the bottom tab-bar
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function getMockReels(): Reel[] {
  return [
    {
      postId: 'r1',
      userId: 'mock-1',
      username: 'neon_rider',
      displayName: 'Neon Rider',
      avatarUrl: '',
      caption: 'Explorando las calles de Neo Tokyo de noche. Estética cyberpunk. 🌃 #reels #tokyo',
      location: 'Tokyo, Japan',
      musicTitle: 'Kavinsky - Nightcall',
      mediaUrls: ['https://images.unsplash.com/photo-1540959733332-eab4deceeaf7?w=800&auto=format&fit=crop'],
      likesCount: 520,
      commentsCount: 14,
      hasLiked: false,
      isSaved: false
    },
    {
      postId: 'r2',
      userId: 'mock-2',
      username: 'art_creative',
      displayName: 'Sophia',
      avatarUrl: '',
      caption: 'La inmensidad del océano. Conectando con la naturaleza. 🌊 #nature #bali',
      location: 'Bali, Indonesia',
      musicTitle: 'Sunset Ride',
      mediaUrls: ['https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&auto=format&fit=crop'],
      likesCount: 910,
      commentsCount: 22,
      hasLiked: true,
      isSaved: true
    }
  ];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  center: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelContainer: {
    width: '100%',
    height: WINDOW_HEIGHT - 60, // Account for custom tab bar
    position: 'relative',
    backgroundColor: '#000000',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  centerPlay: {
    position: 'absolute',
    alignSelf: 'center',
    top: (WINDOW_HEIGHT - 120) / 2,
    opacity: 0.3,
  },
  playText: {
    fontSize: 64,
    color: '#ffffff',
  },
  actionsPanel: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    alignItems: 'center',
    gap: 20,
    zIndex: 10,
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 28,
    color: '#ffffff',
  },
  actionCount: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
    marginTop: 4,
  },
  bottomDetails: {
    position: 'absolute',
    left: 16,
    right: 72,
    bottom: 24,
    zIndex: 10,
    gap: 8,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  authorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  username: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  followBtn: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 12,
  },
  followText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  caption: {
    color: '#e4e4e7',
    fontSize: 12,
    lineHeight: 18,
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  musicText: {
    color: '#a1a1aa',
    fontSize: 10,
    fontWeight: '600',
  },
});
