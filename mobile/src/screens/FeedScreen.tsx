import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';

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
      setPosts(clear ? res.data.posts : [...posts, ...res.data.posts]);
    } catch (err) {
      // Fallback
      if (clear) setPosts(getMockPosts());
    }
  }, [api, posts]);

  const fetchStories = useCallback(async () => {
    try {
      const res = await api.get('/stories/active');
      setStories(res.data);
    } catch (err) {
      setStories(getMockStories());
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
            <Text style={styles.avatarText}>{item.displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.displayName}>{item.displayName}</Text>
            {item.location ? (
              <Text style={styles.locationText}>{item.location}</Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Image */}
      {item.mediaUrls && item.mediaUrls.length > 0 ? (
        <Image 
          source={{ uri: item.mediaUrls[0] }} 
          style={styles.postImage} 
          resizeMode="cover"
        />
      ) : (
        <View style={styles.mediaPlaceholder}>
          <Text style={{ color: '#3f3f46' }}>Sin Multimedia</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionsBar}>
        <View style={styles.actionsLeft}>
          <TouchableOpacity onPress={() => handleLikeToggle(item.postId)} style={styles.actionBtn}>
            <Text style={[styles.actionLabel, item.hasLiked && styles.likedLabel]}>
              ❤️ {item.likesCount}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Text style={styles.actionLabel}>💬 {item.commentsCount}</Text>
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity>
          <Text style={styles.bookmarkLabel}>{item.isSaved ? '⭐️' : '☆'}</Text>
        </TouchableOpacity>
      </View>

      {/* Caption */}
      {item.caption ? (
        <View style={styles.captionContainer}>
          <Text style={styles.captionText}>
            <Text style={styles.captionUsername}>{item.username} </Text>
            {item.caption}
          </Text>
        </View>
      ) : null}
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
                <Text style={{ color: '#a1a1aa', fontSize: 18 }}>+</Text>
              </View>
              <Text style={styles.storyName}>Tu Historia</Text>
            </TouchableOpacity>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.storyBtn}>
              <View style={styles.storyOuterCircle}>
                <View style={styles.storyInnerCircle}>
                  <Text style={styles.storyAvatarText}>
                    {item.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.storyName}>{item.displayName}</Text>
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
            tintColor="#6366f1"
          />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}

// Resilient mocks
function getMockPosts(): Post[] {
  return [
    {
      postId: '1',
      userId: 'mock-1',
      username: 'alex_futurist',
      displayName: 'Alex Futurist',
      avatarUrl: '',
      caption: 'Explorando las fronteras del diseño minimalista en SocialTush Mobile.',
      location: 'Silicon Valley, CA',
      musicTitle: 'Horizon',
      mediaUrls: ['https://picsum.photos/seed/alex/800/800'],
      likesCount: 142,
      commentsCount: 3,
      hasLiked: false,
      isSaved: false
    },
    {
      postId: '2',
      userId: 'mock-2',
      username: 'sophia_creative',
      displayName: 'Sophia Loren',
      avatarUrl: '',
      caption: 'Contraste, luces y colores.',
      location: 'Roma, Italia',
      musicTitle: 'Sunset Ride',
      mediaUrls: ['https://picsum.photos/seed/sophia/800/800'],
      likesCount: 98,
      commentsCount: 0,
      hasLiked: true,
      isSaved: true
    }
  ];
}

function getMockStories(): GroupedStory[] {
  return [
    {
      userId: 'mock-1',
      username: 'alex_futurist',
      displayName: 'Alex',
      avatarUrl: '',
      stories: [{}]
    },
    {
      userId: 'mock-2',
      username: 'sophia_creative',
      displayName: 'Sophia',
      avatarUrl: '',
      stories: [{}]
    }
  ];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  center: {
    flex: 1,
    backgroundColor: '#09090b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storiesBar: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#18181b',
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
    borderWidth: 1,
    borderColor: '#27272a',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181b',
  },
  storyBtn: {
    alignItems: 'center',
    marginRight: 16,
  },
  storyOuterCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6366f1',
    padding: 2,
  },
  storyInnerCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    backgroundColor: '#09090b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyAvatarText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  storyName: {
    color: '#a1a1aa',
    fontSize: 10,
    marginTop: 4,
  },
  postCard: {
    backgroundColor: '#18181b30',
    borderBottomWidth: 1,
    borderColor: '#18181b',
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  displayName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  locationText: {
    color: '#71717a',
    fontSize: 10,
    marginTop: 2,
  },
  postImage: {
    width: '100%',
    height: 380,
  },
  mediaPlaceholder: {
    width: '100%',
    height: 300,
    backgroundColor: '#09090b',
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
    gap: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionLabel: {
    color: '#a1a1aa',
    fontSize: 12,
  },
  likedLabel: {
    color: '#ef4444',
  },
  bookmarkLabel: {
    color: '#a1a1aa',
    fontSize: 16,
  },
  captionContainer: {
    paddingHorizontal: 16,
    paddingTop: 2,
  },
  captionText: {
    color: '#d4d4d8',
    fontSize: 12,
    lineHeight: 18,
  },
  captionUsername: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
});
