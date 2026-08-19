import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Image, Share, Modal } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';
import SearchScreen from './SearchScreen';

interface Post {
  postId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  caption: string;
  location?: string;
  musicTitle?: string;
  mediaUrls: string[];
  likesCount: number;
  commentsCount: number;
  hasLiked: boolean;
  isSaved?: boolean;
  createdAt: string;
}

interface GroupedStory {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  stories: any[];
}

interface FeedScreenProps {
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
  onOpenUser?: (username: string) => void;
  onOpenCircle?: (slug: string) => void;
}

export default function FeedScreen({ onOpenNotifications, onOpenProfile, onOpenUser, onOpenCircle }: FeedScreenProps) {
  const { api, user } = useAuth();
  const { theme } = useAppTheme();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<GroupedStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, boolean>>({});

  const fetchFeed = useCallback(async (clear = false) => {
    try {
      const res = await api.get('/posts/feed?page=0&size=10');
      const fetchedPosts = res.data?.posts || res.data?.content || (Array.isArray(res.data) ? res.data : []);
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

  const handleSaveToggle = async (postId: string) => {
    try {
      const res = await api.post(`/posts/${postId}/save`);
      setPosts(prev => prev.map(p => {
        if (p.postId === postId) {
          return { ...p, isSaved: res.data.saved };
        }
        return p;
      }));
    } catch (err) {
      setPosts(prev => prev.map(p => {
        if (p.postId === postId) {
          return { ...p, isSaved: !p.isSaved };
        }
        return p;
      }));
    }
  };

  const handleShare = async (post: Post) => {
    try {
      await Share.share({
        message: `${post.caption || 'Mira esta publicación en SocialTush'} - por @${post.username}`,
      });
    } catch (error) {
      // Share cancelled
    }
  };

  const renderPostItem = ({ item }: { item: Post }) => {
    const hasMedia = item.mediaUrls && item.mediaUrls.length > 0;
    const mediaUrl = hasMedia ? item.mediaUrls[0] : null;
    const isMediaFailed = mediaUrl ? failedImageUrls[mediaUrl] : false;

    return (
      <View style={[styles.postCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {/* Header Post */}
        <View style={styles.postHeader}>
          <TouchableOpacity 
            style={styles.postAuthor} 
            onPress={() => onOpenUser ? onOpenUser(item.username) : null}
          >
            <View style={[styles.smallAvatar, { backgroundColor: theme.primary }]}>
              <Text style={styles.avatarText}>
                {(item.displayName || item.username || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={[styles.displayName, { color: theme.textPrimary }]}>{item.displayName || item.username}</Text>
              <Text style={[styles.usernameText, { color: theme.textMuted }]}>@{item.username}</Text>
            </View>
          </TouchableOpacity>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {item.location ? (
              <Text style={[styles.locationText, { color: theme.textMuted }]}>{item.location}</Text>
            ) : null}
            <TouchableOpacity>
              <Ionicons name="ellipsis-horizontal" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Caption Content */}
        {item.caption ? (
          <View style={styles.captionContainer}>
            <Text style={[styles.captionText, { color: theme.textPrimary }]}>{item.caption}</Text>
          </View>
        ) : null}

        {/* Media: RENDER ONLY IF MEDIA EXISTS & NOT FAILED! NO RESERVED HEIGHT IF NO MEDIA! */}
        {hasMedia && mediaUrl ? (
          <View style={styles.mediaWrapper}>
            {isMediaFailed ? (
              <View style={[styles.mediaFallback, { backgroundColor: theme.surfaceSecondary }]}>
                <Ionicons name="image-outline" size={32} color={theme.textMuted} />
                <Text style={[styles.mediaFallbackText, { color: theme.textMuted }]}>No se pudo cargar la imagen</Text>
              </View>
            ) : (
              <Image 
                source={{ uri: mediaUrl }} 
                style={styles.postImage} 
                resizeMode="cover"
                onError={() => {
                  setFailedImageUrls(prev => ({ ...prev, [mediaUrl]: true }));
                }}
              />
            )}
          </View>
        ) : null}

        {/* Post Actions Bar */}
        <View style={styles.actionsBar}>
          <View style={styles.actionsLeft}>
            {/* Like */}
            <TouchableOpacity onPress={() => handleLikeToggle(item.postId)} style={styles.actionBtn}>
              <Ionicons 
                name={item.hasLiked ? "heart" : "heart-outline"} 
                size={22} 
                color={item.hasLiked ? theme.like : theme.textSecondary} 
              />
              <Text style={[styles.actionLabel, { color: item.hasLiked ? theme.like : theme.textSecondary }]}>
                {item.likesCount}
              </Text>
            </TouchableOpacity>

            {/* Comment */}
            <TouchableOpacity style={styles.actionBtn}>
              <Ionicons name="chatbubble-outline" size={20} color={theme.textSecondary} />
              <Text style={[styles.actionLabel, { color: theme.textSecondary }]}>{item.commentsCount}</Text>
            </TouchableOpacity>

            {/* Share */}
            <TouchableOpacity onPress={() => handleShare(item)} style={styles.actionBtn}>
              <Ionicons name="share-outline" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Save Bookmark */}
          <TouchableOpacity onPress={() => handleSaveToggle(item.postId)}>
            <Ionicons 
              name={item.isSaved ? "bookmark" : "bookmark-outline"} 
              size={20} 
              color={item.isSaved ? theme.accent : theme.textSecondary} 
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header Navigation Bar */}
      <View style={[styles.topNav, { borderBottomColor: theme.border }]}>
        <View style={styles.brandContainer}>
          <View style={[styles.logoBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.logoText}>S</Text>
          </View>
          <Text style={[styles.topNavTitle, { color: theme.textPrimary }]}>SocialTush</Text>
        </View>

        <View style={styles.topNavActions}>
          <TouchableOpacity 
            style={[styles.navIconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]} 
            onPress={() => setShowSearch(true)}
          >
            <Ionicons name="search-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.navIconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]} 
            onPress={() => onOpenNotifications ? onOpenNotifications() : null}
          >
            <Ionicons name="notifications-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.avatarNavBtn, { backgroundColor: theme.primary, borderColor: theme.accent }]} 
            onPress={() => onOpenProfile ? onOpenProfile() : null}
          >
            <Text style={styles.avatarNavText}>
              {(user?.displayName || user?.username || 'U').charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stories Bar */}
      <View style={[styles.storiesBar, { borderBottomColor: theme.border }]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={stories}
          keyExtractor={(item) => item.userId}
          ListHeaderComponent={
            <TouchableOpacity style={styles.createStoryBtn}>
              <View style={[styles.createStoryCircle, { borderColor: theme.accent, backgroundColor: theme.surface }]}>
                <Ionicons name="add" size={20} color={theme.accent} />
              </View>
              <Text style={[styles.storyName, { color: theme.textSecondary }]}>Tu Historia</Text>
            </TouchableOpacity>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.storyBtn}>
              <View style={[styles.storyOuterCircle, { backgroundColor: theme.primary }]}>
                <View style={[styles.storyInnerCircle, { backgroundColor: theme.background }]}>
                  <Text style={styles.storyAvatarText}>
                    {(item.displayName || item.username || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={[styles.storyName, { color: theme.textSecondary }]} numberOfLines={1}>{item.displayName || item.username}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Search Modal */}
      <Modal visible={showSearch} animationType="slide">
        <SearchScreen
          onSelectUser={(username) => {
            setShowSearch(false);
            if (onOpenUser) onOpenUser(username);
          }}
          onSelectCircle={(slug) => {
            setShowSearch(false);
            if (onOpenCircle) onOpenCircle(slug);
          }}
          onClose={() => setShowSearch(false)}
        />
      </Modal>

      {/* Feed List */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item.postId}
        renderItem={renderPostItem}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh} 
            tintColor={theme.accent}
          />
        }
        contentContainerStyle={posts.length === 0 ? styles.emptyContainer : { paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBox, { backgroundColor: theme.surfaceSecondary }]}>
              <Ionicons name="newspaper-outline" size={36} color={theme.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Tu Feed está listo</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>Conecta con personas o publica un momento para comenzar.</Text>
          </View>
        }
      />
    </View>
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
  topNav: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  topNavTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  topNavActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarNavText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  storiesBar: {
    paddingVertical: 12,
    borderBottomWidth: 1,
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
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyBtn: {
    alignItems: 'center',
    marginRight: 16,
    maxWidth: 64,
  },
  storyOuterCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 2,
  },
  storyInnerCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  storyName: {
    fontSize: 10,
    marginTop: 4,
  },
  postCard: {
    borderBottomWidth: 1,
    paddingVertical: 14,
    marginVertical: 4,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  postAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  smallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  displayName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  usernameText: {
    fontSize: 11,
    marginTop: 1,
  },
  locationText: {
    fontSize: 11,
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  captionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  mediaWrapper: {
    marginTop: 8,
    marginBottom: 4,
    width: '100%',
  },
  postImage: {
    width: '100%',
    height: 320,
  },
  mediaFallback: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mediaFallbackText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
  },
});
