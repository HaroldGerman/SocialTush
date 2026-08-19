import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

interface Post {
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

interface GroupedStory {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  stories: any[];
}

export default function FeedScreen() {
  const { api, user } = useAuth();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<GroupedStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFeed = useCallback(async (clear = false) => {
    try {
      const res = await api.get('/posts/feed?page=0&size=10');
      const fetchedPosts = res.data?.posts || [];
      setPosts(clear ? fetchedPosts : [...posts, ...fetchedPosts]);
    } catch (err) {
      if (clear) setPosts([]);
    }
  }, [api, posts]);

  const fetchStories = useCallback(async () => {
    try {
      const res = await api.get('/stories/active');
      setStories(res.data || []);
    } catch (err) {
      setStories([]);
    }
  }, [api]);

  const initData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchFeed(true), fetchStories()]);
    setLoading(false);
  }, [fetchFeed, fetchStories]);

  useEffect(() => {
    initData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchFeed(true), fetchStories()]);
    setRefreshing(false);
  };

  const handleLikeToggle = async (postId: string) => {
    try {
      const res = await api.post(`/likes/${postId}`);
      setPosts(prev => prev.map(p => {
        if (p.postId === postId) {
          return { ...p, hasLiked: res.data.liked, likesCount: res.data.count };
        }
        return p;
      }));
    } catch (err) {
      setPosts(prev => prev.map(p => {
        if (p.postId === postId) {
          return { ...p, hasLiked: !p.hasLiked, likesCount: p.hasLiked ? p.likesCount - 1 : p.likesCount + 1 };
        }
        return p;
      }));
    }
  };

  const renderPostItem = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      {/* Header */}
      <View style={styles.postHeader}>
        <View style={styles.postAuthor}>
          <View style={styles.smallAvatar}>
            <Text style={styles.avatarText}>
              {(item.displayName || item.username || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.displayName}>{item.displayName || item.username}</Text>
            {item.location ? (
              <Text style={styles.locationText}>{item.location}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Image / Media */}
      {item.mediaUrls && item.mediaUrls.length > 0 ? (
        <Image 
          source={{ uri: item.mediaUrls[0] }} 
          style={styles.postImage} 
          resizeMode="cover"
        />
      ) : (
        <View style={styles.mediaPlaceholder}>
          <Ionicons name="image-outline" size={32} color="#334155" />
          <Text style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>Sin Multimedia</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsBar}>
        <View style={styles.actionsLeft}>
          <TouchableOpacity onPress={() => handleLikeToggle(item.postId)} style={styles.actionBtn}>
            <Ionicons 
              name={item.hasLiked ? "heart" : "heart-outline"} 
              size={20} 
              color={item.hasLiked ? "#ef4444" : "#94a3b8"} 
            />
            <Text style={[styles.actionLabel, item.hasLiked && styles.likedLabel]}>
              {item.likesCount}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={19} color="#94a3b8" />
            <Text style={styles.actionLabel}>{item.commentsCount}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity>
          <Ionicons 
            name={item.isSaved ? "bookmark" : "bookmark-outline"} 
            size={19} 
            color={item.isSaved ? "#14b8a6" : "#94a3b8"} 
          />
        </TouchableOpacity>
      </View>

      {/* Caption */}
      {item.caption ? (
        <View style={styles.captionContainer}>
          <Text style={styles.captionText}>
            <Text style={styles.captionUsername}>@{item.username} </Text>
            {item.caption}
          </Text>
        </View>
      ) : null}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#14b8a6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header Title */}
      <View style={styles.topNav}>
        <Text style={styles.topNavTitle}>SocialTush</Text>
      </View>

      {/* Stories Bar */}
      <View style={styles.storiesBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={stories}
          keyExtractor={(item) => item.userId}
          ListHeaderComponent={
            <TouchableOpacity style={styles.createStoryBtn}>
              <View style={styles.createStoryCircle}>
                <Ionicons name="add" size={20} color="#14b8a6" />
              </View>
              <Text style={styles.storyName}>Tu Historia</Text>
            </TouchableOpacity>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.storyBtn}>
              <View style={styles.storyOuterCircle}>
                <View style={styles.storyInnerCircle}>
                  <Text style={styles.storyAvatarText}>
                    {(item.displayName || item.username || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.storyName}>{item.displayName || item.username}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Feed List */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.postId}
        renderItem={renderPostItem}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh} 
            tintColor="#14b8a6"
          />
        }
        contentContainerStyle={posts.length === 0 ? styles.emptyContainer : { paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="newspaper-outline" size={36} color="#64748b" />
            </View>
            <Text style={styles.emptyTitle}>Tu Feed está tranquilo</Text>
            <Text style={styles.emptySub}>Conecta con más personas o crea tu primera publicación.</Text>
          </View>
        }
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
  },
  topNav: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
  },
  topNavTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  storiesBar: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 16,
  },
  createStoryBtn: {
    alignItems: 'center',
    marginRight: 16,
  },
  createStoryCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: '#14b8a6',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  storyBtn: {
    alignItems: 'center',
    marginRight: 16,
  },
  storyOuterCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0f766e',
    padding: 2,
  },
  storyInnerCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: '#090d16',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  storyName: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 4,
  },
  postCard: {
    backgroundColor: '#0f172a60',
    borderBottomWidth: 1,
    borderColor: '#1e293b',
    paddingVertical: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  postAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  smallAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  displayName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  locationText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1,
  },
  postImage: {
    width: '100%',
    height: 380,
  },
  mediaPlaceholder: {
    width: '100%',
    height: 260,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  actionLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  likedLabel: {
    color: '#ef4444',
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingTop: 2,
  },
  captionText: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 19,
  },
  captionUsername: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
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
