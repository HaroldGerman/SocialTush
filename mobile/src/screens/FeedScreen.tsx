import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Image, Share, Modal } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../theme';
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
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<GroupedStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

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
      // Toggle locally on error
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
      // Share cancelled or unavailable
    }
  };

  const renderPostItem = ({ item }: { item: Post }) => (
    <View style={styles.postCard}>
      {/* Header Post: Avatar + Name + Username + Date */}
      <View style={styles.postHeader}>
        <TouchableOpacity 
          style={styles.postAuthor} 
          onPress={() => onOpenUser ? onOpenUser(item.username) : null}
        >
          <View style={styles.smallAvatar}>
            <Text style={styles.avatarText}>
              {(item.displayName || item.username || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.displayName}>{item.displayName || item.username}</Text>
            <Text style={styles.usernameText}>@{item.username}</Text>
          </View>
        </TouchableOpacity>
        
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {item.location ? (
            <Text style={styles.locationText}>{item.location}</Text>
          ) : null}
          <TouchableOpacity>
            <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Caption Content */}
      {item.caption ? (
        <View style={styles.captionContainer}>
          <Text style={styles.captionText}>{item.caption}</Text>
        </View>
      ) : null}

      {/* Media: RENDER ONLY IF mediaUrls EXISTS AND IS NOT EMPTY! NO RESERVED HEIGHT IF EMPTY! */}
      {item.mediaUrls && item.mediaUrls.length > 0 ? (
        <View style={styles.mediaWrapper}>
          <Image 
            source={{ uri: item.mediaUrls[0] }} 
            style={styles.postImage} 
            resizeMode="cover"
          />
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
              color={item.hasLiked ? theme.colors.like : theme.colors.textSecondary} 
            />
            <Text style={[styles.actionLabel, item.hasLiked && styles.likedLabel]}>
              {item.likesCount}
            </Text>
          </TouchableOpacity>

          {/* Comment */}
          <TouchableOpacity style={styles.actionBtn}>
            <Ionicons name="chatbubble-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.actionLabel}>{item.commentsCount}</Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity onPress={() => handleShare(item)} style={styles.actionBtn}>
            <Ionicons name="share-outline" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Save Bookmark */}
        <TouchableOpacity onPress={() => handleSaveToggle(item.postId)}>
          <Ionicons 
            name={item.isSaved ? "bookmark" : "bookmark-outline"} 
            size={20} 
            color={item.isSaved ? theme.colors.accent : theme.colors.textSecondary} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Header Navigation Bar with Logo, Search, Notifications Bell & Profile */}
      <View style={styles.topNav}>
        {/* Left: Brand Logo */}
        <View style={styles.brandContainer}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>S</Text>
          </View>
          <Text style={styles.topNavTitle}>SocialTush</Text>
        </View>

        {/* Right Header Actions */}
        <View style={styles.topNavActions}>
          <TouchableOpacity 
            style={styles.navIconBtn} 
            onPress={() => setShowSearch(true)}
          >
            <Ionicons name="search-outline" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.navIconBtn} 
            onPress={() => onOpenNotifications ? onOpenNotifications() : null}
          >
            <Ionicons name="notifications-outline" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.avatarNavBtn} 
            onPress={() => onOpenProfile ? onOpenProfile() : null}
          >
            <Text style={styles.avatarNavText}>
              {(user?.displayName || user?.username || 'U').charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
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
                <Ionicons name="add" size={20} color={theme.colors.accent} />
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
              <Text style={styles.storyName} numberOfLines={1}>{item.displayName || item.username}</Text>
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
            tintColor={theme.colors.accent}
          />
        }
        contentContainerStyle={posts.length === 0 ? styles.emptyContainer : { paddingBottom: 24 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="newspaper-outline" size={36} color={theme.colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Tu Feed está listo</Text>
            <Text style={styles.emptySub}>Conecta con personas o publica un momento para comenzar.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topNav: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
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
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  topNavTitle: {
    color: theme.colors.textPrimary,
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
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatarNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  avatarNavText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  storiesBar: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
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
    borderColor: theme.colors.accent,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
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
    backgroundColor: theme.colors.primary,
    padding: 2,
  },
  storyInnerCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  storyName: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
  },
  postCard: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    marginVertical: 4,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
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
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  displayName: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  usernameText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  locationText: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  captionContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 4,
  },
  captionText: {
    color: theme.colors.textPrimary,
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
    height: 340,
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
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
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  likedLabel: {
    color: theme.colors.like,
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
    backgroundColor: theme.colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  emptySub: {
    color: theme.colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
