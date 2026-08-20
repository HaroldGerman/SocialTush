import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Image, Share, Modal, TextInput } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';
import SearchScreen from './SearchScreen';
import UserAvatar from '../components/UserAvatar';
import StoryComposer from '../components/StoryComposer';
import StoryViewer, { MobileStoryGroup } from '../components/StoryViewer';
import { useVideoPlayer, VideoView } from 'expo-video';

interface Post {
  postId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  caption: string;
  location?: string;
  musicTitle?: string;
  mediaUrls: string[];
  mediaTypes?: string[];
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
  avatarUrl?: string;
  stories: any[];
}

interface FeedScreenProps {
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
  onOpenUser?: (username: string) => void;
  onOpenCircle?: (slug: string) => void;
  onOpenReels?: () => void;
}

export default function FeedScreen({ onOpenNotifications, onOpenProfile, onOpenUser, onOpenCircle, onOpenReels }: FeedScreenProps) {
  const { api, user } = useAuth();
  const { theme } = useAppTheme();
  
  const [posts, setPosts] = useState<Post[]>([]);
  const [stories, setStories] = useState<GroupedStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [failedImageUrls, setFailedImageUrls] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const [commentsPost, setCommentsPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [page,setPage]=useState(0);const [isLast,setIsLast]=useState(true);const [loadingMore,setLoadingMore]=useState(false);

  const fetchFeed = useCallback(async (clear = false, nextPage = 0) => {
    try {
      if(!clear)setLoadingMore(true);
      const res = await api.get(`/posts/feed?page=${nextPage}&size=10`);
      const fetchedPosts = res.data?.posts || res.data?.content || (Array.isArray(res.data) ? res.data : []);
      setPosts(old=>clear?fetchedPosts:[...old,...fetchedPosts.filter((post:Post)=>!old.some(item=>item.postId===post.postId))]);
      setPage(nextPage);setIsLast(Boolean(res.data?.isLast ?? fetchedPosts.length < 10));
      setLoadError('');
    } catch (err: any) {
      console.error(err);
      if (clear) setLoadError(err.response?.status === 403 ? 'No tienes acceso a este feed.' : 'No se pudo cargar el feed.');
    } finally {setLoadingMore(false);}
  }, [api]);

  const fetchStories = useCallback(async () => {
    try {
      const res = await api.get('/stories/active');
      setStories(res.data || []);
    } catch (err) {
      console.error(err);
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
      console.error(err);
      setActionError('No se pudo actualizar el Me gusta.');
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
      console.error(err);
      setActionError('No se pudo actualizar Guardados.');
    }
  };

  const handleShare = async (post: Post) => {
    try {
      await Share.share({
        message: `${post.caption || 'Mira esta publicación en Lifonk'} - por @${post.username}`,
      });
    } catch (error) {
      // Share cancelled
    }
  };

  const openComments = async (post: Post) => {
    setCommentsPost(post); setComments([]); setCommentsLoading(true); setActionError('');
    try { const res = await api.get(`/comments/${post.postId}`); setComments(res.data || []); }
    catch (err) { console.error(err); setActionError('No se pudieron cargar los comentarios.'); }
    finally { setCommentsLoading(false); }
  };

  const sendComment = async () => {
    if (!commentsPost || !commentText.trim()) return;
    try { const res = await api.post(`/comments/${commentsPost.postId}`, { content: commentText.trim() }); setComments(old => [...old, res.data]); setCommentText(''); setPosts(old => old.map(post => post.postId === commentsPost.postId ? { ...post, commentsCount: post.commentsCount + 1 } : post)); }
    catch (err) { console.error(err); setActionError('No se pudo publicar el comentario. Conservamos tu texto.'); }
  };

  const renderPostItem = ({ item }: { item: Post }) => {
    const hasMedia = item.mediaUrls && item.mediaUrls.length > 0;
    const mediaUrl = hasMedia ? item.mediaUrls[0] : null;
    const isVideo = item.mediaTypes?.[0] === 'VIDEO';
    const isMediaFailed = mediaUrl ? failedImageUrls[mediaUrl] : false;

    return (
      <View style={[styles.postCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {/* Header Post */}
        <View style={styles.postHeader}>
          <TouchableOpacity 
            style={styles.postAuthor} 
            onPress={() => onOpenUser ? onOpenUser(item.username) : null}
          >
            <UserAvatar avatarUrl={item.avatarUrl} displayName={item.displayName} username={item.username} size={36}/>
            <View>
              <Text style={[styles.displayName, { color: theme.textPrimary }]}>{item.displayName || item.username}</Text>
              <Text style={[styles.usernameText, { color: theme.textMuted }]}>@{item.username}</Text>
            </View>
          </TouchableOpacity>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {item.location ? (
              <Text style={[styles.locationText, { color: theme.textMuted }]}>{item.location}</Text>
            ) : null}
            <TouchableOpacity disabled accessibilityLabel="Opciones de publicación, disponible próximamente" style={{ opacity: 0.45 }}>
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
            ) : isVideo ? <FeedVideo url={mediaUrl}/> : <Image
                source={{ uri: mediaUrl }} 
                style={styles.postImage} 
                resizeMode="cover"
                onError={() => {
                  setFailedImageUrls(prev => ({ ...prev, [mediaUrl]: true }));
                }}
              />}
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
            <TouchableOpacity onPress={() => void openComments(item)} style={styles.actionBtn}>
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

  if (loadError && posts.length === 0) return <View style={[styles.center,{backgroundColor:theme.background,gap:12}]}><Ionicons name="alert-circle-outline" size={38} color={theme.textMuted}/><Text style={{color:theme.textPrimary,fontWeight:'800'}}>{loadError}</Text><TouchableOpacity onPress={()=>void initData()} style={{backgroundColor:theme.primary,paddingHorizontal:18,paddingVertical:10,borderRadius:12}}><Text style={{color:'#fff',fontWeight:'800'}}>Reintentar</Text></TouchableOpacity></View>;

  const ownStoryIndex = stories.findIndex(group => (user?.userId && String(group.userId) === String(user.userId)) || (!user?.userId && user?.username && group.username?.toLowerCase() === user.username.toLowerCase()));
  const otherStories = stories.map((group, originalIndex) => ({ group, originalIndex })).filter(({ originalIndex }) => originalIndex !== ownStoryIndex);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {actionError ? <TouchableOpacity onPress={() => setActionError('')} style={{ backgroundColor: '#7f1d1d', padding: 9 }}><Text style={{ color: '#fee2e2', textAlign: 'center', fontSize: 12 }}>{actionError}</Text></TouchableOpacity> : null}
      {/* Top Header Navigation Bar */}
      <View style={[styles.topNav, { borderBottomColor: theme.border }]}>
        <View style={styles.brandContainer}>
          <View style={[styles.logoBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.logoText}>L</Text>
          </View>
          <Text style={[styles.topNavTitle, { color: theme.textPrimary }]}>Lifonk</Text>
        </View>

        <View style={styles.topNavActions}>
          <TouchableOpacity
            style={[styles.navIconBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={onOpenReels}
            disabled={!onOpenReels}
          >
            <Ionicons name="play-circle-outline" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
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

          <TouchableOpacity style={styles.avatarNavBtn}
            onPress={() => onOpenProfile ? onOpenProfile() : null}
          >
            <UserAvatar avatarUrl={user?.avatarUrl} displayName={user?.displayName} username={user?.username} size={36}/>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stories Bar */}
      <View style={[styles.storiesBar, { borderBottomColor: theme.border }]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={otherStories}
          keyExtractor={(item) => item.group.userId}
          ListHeaderComponent={
            <TouchableOpacity onPress={() => ownStoryIndex >= 0 ? setStoryViewerIndex(ownStoryIndex) : setStoryComposerOpen(true)} style={styles.createStoryBtn}>
              <View style={[styles.createStoryCircle, { borderColor: theme.accent, backgroundColor: theme.surface }]}>
                {ownStoryIndex >= 0 ? <UserAvatar avatarUrl={stories[ownStoryIndex].avatarUrl || user?.avatarUrl} displayName={user?.displayName} username={user?.username} size={48} ring/> : <Ionicons name="add" size={20} color={theme.accent}/>}
                {ownStoryIndex >= 0 ? <TouchableOpacity onPress={(event)=>{event.stopPropagation();setStoryComposerOpen(true);}} style={[styles.storyAdd,{backgroundColor:theme.primary}]}><Ionicons name="add" size={13} color="#fff"/></TouchableOpacity>:null}
              </View>
              <Text style={[styles.storyName, { color: theme.textSecondary }]}>Tu Historia</Text>
            </TouchableOpacity>
          }
          renderItem={({ item: entry }) => { const item=entry.group; return (
            <TouchableOpacity onPress={()=>setStoryViewerIndex(entry.originalIndex)} style={styles.storyBtn}>
              <View style={[styles.storyOuterCircle, { backgroundColor: theme.primary }]}>
                <View style={[styles.storyInnerCircle, { backgroundColor: theme.background }]}>
                  <UserAvatar avatarUrl={item.avatarUrl} displayName={item.displayName} username={item.username} size={46}/>
                </View>
              </View>
              <Text style={[styles.storyName, { color: theme.textSecondary }]} numberOfLines={1}>{item.displayName || item.username}</Text>
            </TouchableOpacity>);}}
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
      <StoryComposer visible={storyComposerOpen} onClose={()=>setStoryComposerOpen(false)} onPublished={()=>void fetchStories()}/>
      <StoryViewer visible={storyViewerIndex !== null} groups={stories as MobileStoryGroup[]} initialIndex={storyViewerIndex || 0} onClose={()=>setStoryViewerIndex(null)} onStoriesChange={setStories}/>
      <Modal visible={Boolean(commentsPost)} transparent animationType="slide" onRequestClose={()=>setCommentsPost(null)}><View style={styles.modalBackdrop}><View style={[styles.commentSheet,{backgroundColor:theme.surface}]}><View style={styles.commentHeader}><Text style={[styles.commentTitle,{color:theme.textPrimary}]}>Comentarios</Text><TouchableOpacity onPress={()=>setCommentsPost(null)}><Ionicons name="close" size={25} color={theme.textPrimary}/></TouchableOpacity></View>{commentsLoading?<ActivityIndicator color={theme.accent}/>:<FlatList data={comments} keyExtractor={item=>item.commentId} renderItem={({item})=><View style={styles.commentRow}><UserAvatar avatarUrl={item.avatarUrl} displayName={item.displayName} username={item.username} size={32}/><View style={{flex:1}}><Text style={{color:theme.textPrimary,fontWeight:'800',fontSize:12}}>@{item.username}</Text><Text style={{color:theme.textSecondary,fontSize:13}}>{item.content}</Text></View></View>} ListEmptyComponent={<Text style={{color:theme.textMuted,textAlign:'center',padding:24}}>Sé el primero en comentar.</Text>}/>}<View style={[styles.commentComposer,{borderColor:theme.border}]}><TextInput value={commentText} onChangeText={setCommentText} placeholder="Escribe un comentario…" placeholderTextColor={theme.textMuted} style={[styles.commentInput,{color:theme.textPrimary,backgroundColor:theme.background}]}/><TouchableOpacity disabled={!commentText.trim()} onPress={()=>void sendComment()} style={[styles.commentSend,{backgroundColor:theme.primary}]}><Ionicons name="send" color="#fff" size={18}/></TouchableOpacity></View></View></View></Modal>

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
        onEndReached={()=>{if(!isLast&&!loadingMore)void fetchFeed(false,page+1);}}
        onEndReachedThreshold={0.6}
        ListFooterComponent={loadingMore?<ActivityIndicator color={theme.accent} style={{padding:14}}/>:null}
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
  storyAdd:{position:'absolute',right:-2,bottom:-2,width:20,height:20,borderRadius:10,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'#fff'},
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
  modalBackdrop:{flex:1,backgroundColor:'#0008',justifyContent:'flex-end'},commentSheet:{height:'68%',borderTopLeftRadius:24,borderTopRightRadius:24,padding:16},commentHeader:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},commentTitle:{fontSize:17,fontWeight:'900'},commentRow:{flexDirection:'row',gap:10,paddingVertical:10},commentComposer:{borderTopWidth:1,paddingTop:10,flexDirection:'row',gap:8},commentInput:{flex:1,height:44,borderRadius:22,paddingHorizontal:16},commentSend:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center'},
});

function FeedVideo({url}:{url:string}) { const player=useVideoPlayer(url); return <VideoView player={player} style={styles.postImage} nativeControls contentFit="contain"/>; }
