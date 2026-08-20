import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator, TouchableOpacity, TextInput, RefreshControl, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';
import UserAvatar from '../components/UserAvatar';

interface Conversation {
  conversationId: string | null;
  isDraft?: boolean;
  otherUsername?: string;
  name: string;
  avatarUrl: string;
  isGroup: boolean;
  latestMessage: string;
  updatedAt: string;
  unreadCount?: number;
  isPinned?: boolean;
  nickname?: string;
  notificationsMuted?: boolean;
  chatTheme?: string;
}

interface ChatListScreenProps {
  onSelectConversation: (conversation: Conversation) => void;
}

export default function ChatListScreen({ onSelectConversation }: ChatListScreenProps) {
  const { api } = useAuth();
  const { theme } = useAppTheme();
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error,setError]=useState('');
  const [refreshing,setRefreshing]=useState(false);
  const [filter,setFilter]=useState<'ALL'|'UNREAD'|'PINNED'|'CIRCLES'>('ALL');
  const searchInputRef=useRef<TextInput>(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await api.get('/chat/conversations');
      setConversations(res.data || []);
      setError('');
    } catch (err) {
      console.error(err);setError('No se pudieron cargar tus conversaciones.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleStartConversation = async () => {
    const username = searchQuery.trim();
    if (!username) return;
    try {
      const existing = conversations.find(c => !c.isGroup && c.otherUsername?.toLowerCase() === username.toLowerCase());
      if (existing) {
        setSearchQuery('');
        onSelectConversation(existing);
        return;
      }
      const res = await api.get(`/profiles/${encodeURIComponent(username)}`);
      const profile = res.data;
      setSearchQuery('');
      const newConv: Conversation = {
        conversationId: null,
        isDraft: true,
        otherUsername: profile.username,
        name: profile.displayName || profile.username,
        avatarUrl: profile.avatarUrl || '',
        isGroup: false,
        latestMessage: '',
        updatedAt: new Date().toISOString()
      };
      onSelectConversation(newConv);
    } catch (err:any) {
      setError(err.response?.status===404?'Usuario no encontrado.':'No se pudo abrir el chat.');
    }
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    const hasUnread = (item.unreadCount || 0) > 0;
    return (
    <TouchableOpacity 
      style={[styles.chatCard, { borderColor: theme.border }]} 
      onPress={() => onSelectConversation(item)}
      onLongPress={async()=>{if(!item.conversationId)return;try{item.isPinned?await api.delete(`/chat/conversations/${item.conversationId}/pin`):await api.patch(`/chat/conversations/${item.conversationId}/pin`);await fetchConversations();}catch{setError('No se pudo cambiar el anclado.');}}}
      activeOpacity={0.8}
    >
      {item.isGroup?<View style={[styles.avatar,{backgroundColor:theme.primary}]}>
        {item.isGroup ? (
          <Ionicons name="people" size={18} color="#ffffff" />
        ) : (
          <Text style={styles.avatarText}>
            {(item.name || 'U').charAt(0).toUpperCase()}
          </Text>
        )}
      </View>:<UserAvatar avatarUrl={item.avatarUrl} displayName={item.name} username={item.otherUsername} size={46}/>}
      
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={[styles.chatName, { color: theme.textPrimary }, hasUnread && styles.unreadText]}>{item.isPinned?'📌 ':''}{item.name}{item.notificationsMuted?'  🔕':''}</Text>
          <View style={styles.cardMeta}><Text style={[styles.time,{color:theme.textMuted}]}>{new Date(item.updatedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</Text>{hasUnread ? <View style={[styles.unreadBadge, { backgroundColor: theme.primary }]}><Text style={styles.unreadBadgeText}>{Math.min(item.unreadCount||0,99)}{(item.unreadCount||0)>99?'+':''}</Text></View> : null}</View>
        </View>
        <Text style={[styles.latestMessage, { color: theme.textSecondary }, hasUnread && styles.unreadText]} numberOfLines={1}>
          {item.latestMessage}
        </Text>
      </View>
    </TouchableOpacity>
    );
  };
  const visibleConversations=conversations.filter(item=>{
    if(filter==='UNREAD'&&!(item.unreadCount||0))return false;
    if(filter==='PINNED'&&!item.isPinned)return false;
    if(filter==='CIRCLES'&&!item.isGroup)return false;
    const query=searchQuery.trim().toLowerCase();
    return !query||item.name.toLowerCase().includes(query)||item.otherUsername?.toLowerCase().includes(query);
  });
  const recents=conversations.filter(item=>!item.isGroup).slice(0,7);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View><Text style={[styles.brand, { color: theme.accent }]}>LIFONK</Text><Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Conversaciones</Text></View>
        <TouchableOpacity onPress={()=>searchInputRef.current?.focus()} style={[styles.newButton,{backgroundColor:theme.primary}]} accessibilityLabel="Nueva conversación"><Ionicons name="add" size={22} color="#fff"/></TouchableOpacity>
      </View>
      {error?<TouchableOpacity onPress={()=>setError('')} style={{backgroundColor:'#7f1d1d',padding:9}}><Text style={{color:'#fee2e2',textAlign:'center'}}>{error}</Text></TouchableOpacity>:null}

      {/* Start Chat Form */}
      <View style={styles.searchSection}>
        <TextInput
          ref={searchInputRef}
          style={[styles.searchInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
          placeholder="Buscar conversaciones o personas..."
          placeholderTextColor={theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity style={[styles.searchBtn, { backgroundColor: theme.primary }]} onPress={handleStartConversation}>
          <Ionicons name="search" size={17} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* List */}
      <FlatList
        data={visibleConversations}
        keyExtractor={(item) => item.conversationId || `draft-${item.otherUsername}`}
        renderItem={renderConversationItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void fetchConversations();}} tintColor={theme.accent}/>}
        ListHeaderComponent={<><Text style={[styles.sectionLabel,{color:theme.textMuted}]}>RECIENTES</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRail}>{recents.map(item=><TouchableOpacity key={item.conversationId} onPress={()=>onSelectConversation(item)} style={styles.recentItem}><UserAvatar avatarUrl={item.avatarUrl} displayName={item.name} username={item.otherUsername} size={48}/><Text numberOfLines={1} style={[styles.recentName,{color:theme.textSecondary}]}>{item.name.split(' ')[0]}</Text></TouchableOpacity>)}</ScrollView><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{([['ALL','Todas'],['UNREAD','No leídas'],['PINNED','Ancladas'],['CIRCLES','Círculos']] as const).map(([value,label])=><TouchableOpacity key={value} onPress={()=>setFilter(value)} style={[styles.filterChip,{borderColor:theme.border},filter===value&&{backgroundColor:theme.primary,borderColor:theme.primary}]}><Text style={{color:filter===value?'#fff':theme.textSecondary,fontSize:11,fontWeight:'800'}}>{label}</Text></TouchableOpacity>)}</ScrollView><Text style={[styles.sectionLabel,{color:theme.textMuted}]}>CONVERSACIONES</Text></>}
        contentContainerStyle={visibleConversations.length === 0 ? styles.emptyContainer : { paddingHorizontal: 16 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBox, { backgroundColor: theme.surfaceSecondary }]}>
              <Ionicons name="chatbubbles-outline" size={36} color={theme.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Aún no tienes conversaciones</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>Busca una persona para iniciar una conversación.</Text>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: { fontSize: 14, fontWeight: '900', letterSpacing: 2.6, fontFamily: 'sans-serif-medium' },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  newButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginTop: 12, marginBottom: 9 },
  recentRail: { gap: 13, paddingBottom: 8 },
  recentItem: { width: 58, alignItems: 'center' },
  recentName: { width: 58, textAlign: 'center', fontSize: 10, fontWeight: '700', marginTop: 5 },
  filters: { gap: 8, paddingVertical: 8 },
  filterChip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7 },
  cardMeta:{alignItems:'flex-end',gap:5},time:{fontSize:9,fontWeight:'600'},
  searchSection: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 13,
  },
  searchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  latestMessage: {
    fontSize: 12,
  },
  unreadText: {
    fontWeight: '800',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 10,
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
