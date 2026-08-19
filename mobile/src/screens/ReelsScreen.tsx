import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

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
  const { api } = useAuth();
  
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReels = async () => {
    try {
      const res = await api.get('/posts/reels?page=0&size=10');
      setReels(res.data?.posts || []);
    } catch (err) {
      setReels([]);
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
      {item.mediaUrls && item.mediaUrls.length > 0 ? (
        <Image 
          source={{ uri: item.mediaUrls[0] }} 
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.mediaPlaceholder}>
          <Ionicons name="film-outline" size={48} color="#334155" />
        </View>
      )}
      
      {/* Overlay Darkner */}
      <View style={styles.darkOverlay} />

      {/* Right Side Social Actions Panel */}
      <View style={styles.actionsPanel}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleLikeToggle(item.postId)}>
          <Ionicons name={item.hasLiked ? "heart" : "heart-outline"} size={28} color={item.hasLiked ? "#ef4444" : "#ffffff"} />
          <Text style={styles.actionCount}>{item.likesCount}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={26} color="#ffffff" />
          <Text style={styles.actionCount}>{item.commentsCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name={item.isSaved ? "bookmark" : "bookmark-outline"} size={26} color={item.isSaved ? "#14b8a6" : "#ffffff"} />
        </TouchableOpacity>
      </View>

      {/* Bottom Info Details */}
      <View style={styles.bottomDetails}>
        <View style={styles.authorRow}>
          <View style={styles.authorAvatar}>
            <Text style={styles.avatarText}>
              {(item.displayName || item.username || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.username}>@{item.username}</Text>
        </View>

        {item.caption ? (
          <Text style={styles.caption} numberOfLines={2}>{item.caption}</Text>
        ) : null}

        {item.musicTitle ? (
          <View style={styles.musicRow}>
            <Ionicons name="musical-notes-outline" size={12} color="#14b8a6" />
            <Text style={styles.musicText}>{item.musicTitle}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  if (reels.length === 0) {
    return (
      <View style={styles.center}>
        <View style={styles.emptyIconBox}>
          <Ionicons name="film-outline" size={36} color="#64748b" />
        </View>
        <Text style={styles.emptyTitle}>No hay Reels disponibles</Text>
        <Text style={styles.emptySub}>Vuelve más tarde para descubrir videos verticales.</Text>
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
        snapToInterval={WINDOW_HEIGHT - 64}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
  },
  center: {
    flex: 1,
    backgroundColor: '#090d16',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  reelContainer: {
    width: '100%',
    height: WINDOW_HEIGHT - 64,
    position: 'relative',
    backgroundColor: '#090d16',
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  mediaPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 13, 22, 0.45)',
  },
  actionsPanel: {
    position: 'absolute',
    right: 16,
    bottom: 110,
    alignItems: 'center',
    gap: 20,
    zIndex: 10,
  },
  actionBtn: {
    alignItems: 'center',
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  username: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  caption: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 18,
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  musicText: {
    color: '#14b8a6',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#1e293b50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  emptySub: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
  },
});
