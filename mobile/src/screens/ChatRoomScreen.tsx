import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, AppState, Image, Modal, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAuth } from '../context/AuthContext';
import { getWebSocketUrl } from '../config/api';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';
import UserAvatar from '../components/UserAvatar';

interface Message {
  messageId: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string;
  senderAvatarUrl: string;
  content: string;
  messageType: string;
  createdAt: string;
  readByRecipient?: boolean;
  readReceiptVisible?: boolean;
  attachments?: Array<{id:string;fileUrl:string;fileType:'IMAGE'|'VIDEO'|'AUDIO';fileName?:string;fileSize?:number;durationSeconds?:number}>;
  reactions?: Array<{emoji:string;count:number;reactedByMe:boolean}>;
}

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

interface ChatRoomScreenProps {
  conversation: Conversation;
  onBack: () => void;
  onConversationPersisted: (conversation: Conversation) => void;
  onOpenCircle: (slug: string) => void;
}

export default function ChatRoomScreen({ conversation, onBack, onConversationPersisted, onOpenCircle }: ChatRoomScreenProps) {
  const { api, user, accessToken } = useAuth();
  const { theme } = useAppTheme();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendError, setSendError] = useState('');
  const [selectedMedia,setSelectedMedia]=useState<ImagePicker.ImagePickerAsset|null>(null);
  const [audioPreview,setAudioPreview]=useState<{uri:string;durationSeconds:number}|null>(null);
  const [sendingMedia,setSendingMedia]=useState(false);
  const [recordingCancelled,setRecordingCancelled]=useState(false);
  const [showInfo,setShowInfo]=useState(false);
  const [reactionMessageId,setReactionMessageId]=useState<string|null>(null);
  const [nickname,setNickname]=useState(conversation.nickname||'');
  const [presence,setPresence]=useState<{online:boolean;lastSeenAt?:string;lastSeenVisible?:boolean}|null>(null);
  const [infoMedia,setInfoMedia]=useState<Message['attachments']>([]);
  const [messageSearch,setMessageSearch]=useState('');
  const [searchResults,setSearchResults]=useState<Message[]>([]);
  const [commonCircles,setCommonCircles]=useState<Array<{slug:string;name:string;avatarUrl?:string}>>([]);
  const recorder=useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState=useAudioRecorderState(recorder,250);

  const ws = useRef<WebSocket | null>(null);
  useEffect(()=>setNickname(conversation.nickname||''),[conversation.nickname,conversation.conversationId]);

  const markRead = async () => {
    if (!conversation.conversationId) return false;
    try {
      await api.patch(`/chat/conversations/${conversation.conversationId}/read`);
      return true;
    } catch (err) {
      setSendError('Los mensajes se cargaron, pero no pudimos marcarlos como leídos.');
      return false;
    }
  };

  const fetchMessages = async () => {
    if (!conversation.conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/chat/conversations/${conversation.conversationId}/messages`);
      setMessages(res.data || []);
      await markRead();
    } catch (err) {
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    if (!conversation.conversationId || !accessToken) return;

    const wsUrl = getWebSocketUrl();
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      const connectFrame = `CONNECT\naccept-version:1.1,1.2\nheart-beat:10000,10000\nAuthorization:Bearer ${accessToken}\n\n\u0000`;
      socket.send(connectFrame);
    };

    socket.onmessage = (e) => {
      const data = e.data;
      if (typeof data === 'string' && data.startsWith('CONNECTED')) {
        socket.send(`SUBSCRIBE\nid:sub-0\ndestination:/topic/conversation.${conversation.conversationId}\n\n\u0000`);
        socket.send(`SUBSCRIBE\nid:sub-presence\ndestination:/topic/presence\n\n\u0000`);
        return;
      }
      if (typeof data === 'string' && data.includes('MESSAGE')) {
        const bodyMatch = data.match(/\n\n([\s\S]*)\u0000$/);
        if (bodyMatch && bodyMatch[1]) {
          try {
            const parsed = JSON.parse(bodyMatch[1]);
            if(parsed.type==='PRESENCE_CHANGED'&&parsed.username?.toLowerCase()===conversation.otherUsername?.toLowerCase()){
              setPresence(old=>({online:Boolean(parsed.online),lastSeenAt:parsed.lastSeenAt||old?.lastSeenAt,lastSeenVisible:Boolean(parsed.lastSeenAt)}));
            } else if (parsed.type === 'READ_RECEIPT') {
              if (parsed.readerUsername?.toLowerCase() !== user?.username?.toLowerCase()) {
                setMessages((prev) => {
                  const lastRead = prev.find(message => message.messageId === parsed.lastReadMessageId);
                  if (!lastRead) return prev;
                  const cutoff = new Date(lastRead.createdAt).getTime();
                  return prev.map(message =>
                    (message.senderId === user?.userId || message.senderUsername === user?.username)
                    && message.readReceiptVisible
                    && new Date(message.createdAt).getTime() <= cutoff
                      ? { ...message, readByRecipient: true }
                      : message
                  );
                });
              }
            } else if(parsed.type==='MESSAGE_REACTION_UPDATED'){
              void fetchMessages();
            } else if (parsed.messageId) {
              setMessages((prev) => {
                if (prev.some((m) => m.messageId === parsed.messageId)) return prev;
                return [...prev, parsed];
              });
              if (parsed.senderId !== user?.userId && AppState.currentState === 'active') {
                void markRead();
              }
            }
          } catch (err) {}
        }
      }
    };

    ws.current = socket;

    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, [conversation.conversationId, accessToken, user?.userId, user?.username]);

  useEffect(()=>{if(!conversation.otherUsername)return setPresence(null);api.get(`/chat/presence/${encodeURIComponent(conversation.otherUsername)}`).then(res=>setPresence(res.data)).catch(()=>setPresence(null));},[conversation.otherUsername,api]);

  useEffect(() => {
    if (!conversation.conversationId) return;
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void markRead();
    });
    return () => subscription.remove();
  }, [conversation.conversationId]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const contentToSend = inputText.trim();
    setSendError('');

    try {
      const res = conversation.conversationId
        ? await api.post(`/chat/conversations/${conversation.conversationId}/messages`, {
            content: contentToSend,
            messageType: 'TEXT'
          })
        : await api.post(`/chat/direct/${encodeURIComponent(conversation.otherUsername || '')}/messages`, {
            content: contentToSend,
            messageType: 'TEXT'
          });

      const newMsg: Message = conversation.conversationId ? res.data : res.data.message;
      if (!conversation.conversationId) {
        onConversationPersisted({
          ...conversation,
          conversationId: res.data.conversationId,
          isDraft: false,
          latestMessage: newMsg.content,
          updatedAt: newMsg.createdAt
        });
      }
      setInputText('');
      setMessages((prev) => {
        if (prev.some((m) => m.messageId === newMsg.messageId)) return prev;
        return [...prev, newMsg];
      });
    } catch (err) {
      setSendError('No se pudo enviar el mensaje. Inténtalo de nuevo.');
    }
  };

  const pickMedia=async(camera=false)=>{setSendError('');const permission=camera?await ImagePicker.requestCameraPermissionsAsync():await ImagePicker.requestMediaLibraryPermissionsAsync();if(!permission.granted)return setSendError(camera?'No pudimos acceder a la cámara.':'No pudimos acceder a tus fotos.');const result=camera?await ImagePicker.launchCameraAsync({mediaTypes:['images'],quality:.85}):await ImagePicker.launchImageLibraryAsync({mediaTypes:['images','videos'],quality:.85});if(!result.canceled)setSelectedMedia(result.assets[0]);};
  const startRecording=async()=>{setSendError('');const permission=await AudioModule.requestRecordingPermissionsAsync();if(!permission.granted)return setSendError('No pudimos acceder al micrófono.');try{setRecordingCancelled(false);setAudioPreview(null);await setAudioModeAsync({allowsRecording:true,playsInSilentMode:true});await recorder.prepareToRecordAsync();recorder.record();}catch(error){console.error(error);setSendError('No se pudo iniciar la grabación.');}};
  const stopRecording=async(cancel=false)=>{setRecordingCancelled(cancel);try{await recorder.stop();await setAudioModeAsync({allowsRecording:false,playsInSilentMode:true});if(!cancel&&recorder.uri)setAudioPreview({uri:recorder.uri,durationSeconds:Math.max(1,Math.round((recorderState.durationMillis||0)/1000))});}catch(error){console.error(error);if(!cancel)setSendError('No se pudo preparar la nota de voz.');}};
  const sendMedia=async(kind:'asset'|'audio')=>{const source=kind==='audio'?audioPreview?{uri:audioPreview.uri,name:`voice_${Date.now()}.m4a`,type:'audio/mp4'}:null:selectedMedia?{uri:selectedMedia.uri,name:selectedMedia.fileName||`chat_${Date.now()}.${selectedMedia.type==='video'?'mp4':'jpg'}`,type:selectedMedia.mimeType||(selectedMedia.type==='video'?'video/mp4':'image/jpeg')}:null;if(!source)return;setSendingMedia(true);setSendError('');try{const data=new FormData();data.append('file',{...source,uri:Platform.OS==='ios'?source.uri.replace('file://',''):source.uri} as any);if(inputText.trim())data.append('content',inputText.trim());if(kind==='audio'&&audioPreview)data.append('durationSeconds',String(audioPreview.durationSeconds));const res=conversation.conversationId?await api.post(`/chat/conversations/${conversation.conversationId}/messages/media`,data,{headers:{'Content-Type':'multipart/form-data'}}):await api.post(`/chat/direct/${encodeURIComponent(conversation.otherUsername||'')}/messages/media`,data,{headers:{'Content-Type':'multipart/form-data'}});const message:Message=conversation.conversationId?res.data:res.data.message;if(!conversation.conversationId)onConversationPersisted({...conversation,conversationId:res.data.conversationId,isDraft:false,latestMessage:message.content|| (kind==='audio'?'Nota de voz':'Archivo'),updatedAt:message.createdAt});setMessages(old=>old.some(item=>item.messageId===message.messageId)?old:[...old,message]);setInputText('');if(kind==='audio')setAudioPreview(null);else setSelectedMedia(null);}catch(error:any){console.error(error);setSendError(kind==='audio'?'No se pudo enviar el audio. Reintentar.':'No se pudo enviar el archivo. Reintentar.');}finally{setSendingMedia(false);}};
  const mediaAttachments=infoMedia?.length?infoMedia:messages.flatMap(message=>message.attachments||[]);
  const toggleReaction=async(message:Message,emoji:string)=>{try{const mine=message.reactions?.find(item=>item.reactedByMe);if(mine?.emoji===emoji)await api.delete(`/chat/messages/${message.messageId}/reaction`);else await api.put(`/chat/messages/${message.messageId}/reaction`,{emoji});await fetchMessages();setReactionMessageId(null);}catch{setSendError('No se pudo actualizar la reacción.');}};
  const togglePin=async()=>{if(!conversation.conversationId)return;try{conversation.isPinned?await api.delete(`/chat/conversations/${conversation.conversationId}/pin`):await api.patch(`/chat/conversations/${conversation.conversationId}/pin`);onConversationPersisted({...conversation,isPinned:!conversation.isPinned});}catch{setSendError('No se pudo cambiar el anclado.');}};
  const saveNickname=async()=>{if(!conversation.conversationId)return;try{await api.patch(`/chat/conversations/${conversation.conversationId}/nickname`,{nickname});onConversationPersisted({...conversation,nickname:nickname.trim()||undefined,name:nickname.trim()||conversation.name});}catch{setSendError('No se pudo guardar el apodo.');}};
  const updatePreferences=async(values:{notificationsMuted?:boolean;mutedUntil?:string|null;chatTheme?:string})=>{if(!conversation.conversationId)return;try{const res=await api.patch(`/chat/conversations/${conversation.conversationId}/preferences`,values);onConversationPersisted({...conversation,...res.data});}catch{setSendError('No se pudieron guardar los ajustes.');}};
  const openMuteMenu=()=>Alert.alert('Señales de conversación','Elige durante cuánto tiempo silenciarlas.',[
    {text:'Todas',onPress:()=>void updatePreferences({notificationsMuted:false})},
    {text:'1 hora',onPress:()=>void updatePreferences({notificationsMuted:true,mutedUntil:new Date(Date.now()+3600000).toISOString()})},
    {text:'8 horas',onPress:()=>void updatePreferences({notificationsMuted:true,mutedUntil:new Date(Date.now()+8*3600000).toISOString()})},
    {text:'1 día',onPress:()=>void updatePreferences({notificationsMuted:true,mutedUntil:new Date(Date.now()+24*3600000).toISOString()})},
    {text:'Siempre',onPress:()=>void updatePreferences({notificationsMuted:true,mutedUntil:null})},
    {text:'Cancelar',style:'cancel'}]);
  const searchConversation=async()=>{if(!conversation.conversationId||messageSearch.trim().length<2)return;try{const res=await api.get(`/chat/conversations/${conversation.conversationId}/messages/search`,{params:{q:messageSearch.trim()}});setSearchResults(res.data?.content||[]);}catch{setSendError('No se pudo buscar en la conversación.');}};
  useEffect(()=>{if(!showInfo||!conversation.conversationId)return;api.get(`/chat/conversations/${conversation.conversationId}/media`).then(res=>setInfoMedia((res.data?.content||[]).flatMap((message:Message)=>message.attachments||[]))).catch(()=>setSendError('No se pudo cargar la multimedia.'));},[showInfo,conversation.conversationId,api]);
  useEffect(()=>{if(!showInfo||!user?.username||!conversation.otherUsername)return setCommonCircles([]);Promise.all([api.get(`/circles/user/${encodeURIComponent(user.username)}`),api.get(`/circles/user/${encodeURIComponent(conversation.otherUsername)}`)]).then(([mine,theirs])=>{const own=new Set((mine.data||[]).map((circle:{slug:string})=>circle.slug));setCommonCircles((theirs.data||[]).filter((circle:{slug:string})=>own.has(circle.slug)));}).catch(()=>setCommonCircles([]));},[showInfo,user?.username,conversation.otherUsername,api]);
  const deleteConversation=()=>{if(!conversation.conversationId)return;Alert.alert('Eliminar conversación','Se eliminará solo de tus Conversaciones. La otra persona conservará la suya.',[{text:'Cancelar',style:'cancel'},{text:'Eliminar',style:'destructive',onPress:async()=>{try{await api.delete(`/chat/conversations/${conversation.conversationId}`);setShowInfo(false);onBack();}catch{setSendError('No se pudo eliminar la conversación.');}}}]);};

  const renderMessageItem = ({ item }: { item: Message }) => {
    const isOwn = item.senderUsername === user?.username || item.senderId === user?.userId;

    return (
      <View style={[styles.messageRow, isOwn ? styles.ownRow : styles.otherRow]}>
        {!isOwn && (
          <Text style={[styles.senderName, { color: theme.accent }]}>@{item.senderUsername}</Text>
        )}
        <View style={[
          styles.bubble, 
          isOwn 
            ? [styles.ownBubble, { backgroundColor: theme.primary }] 
            : [styles.otherBubble, { backgroundColor: theme.surface, borderColor: theme.border }]
        ]}>
          {item.attachments?.map(attachment=>attachment.fileType==='IMAGE'?<Image key={attachment.id} source={{uri:attachment.fileUrl}} style={styles.attachmentImage} resizeMode="cover"/>:attachment.fileType==='VIDEO'?<ChatVideo key={attachment.id} uri={attachment.fileUrl}/>:<ChatAudio key={attachment.id} uri={attachment.fileUrl} duration={attachment.durationSeconds}/>)}
          {item.content ? <Text style={[styles.messageText, isOwn ? styles.ownText : [styles.otherText, { color: theme.textPrimary }]]}>
            {item.content}
          </Text> : null}
        </View>
        <View style={styles.reactionRow}>{item.reactions?.map(reaction=><TouchableOpacity key={reaction.emoji} onPress={()=>void toggleReaction(item,reaction.emoji)} style={[styles.reactionChip,{borderColor:reaction.reactedByMe?theme.accent:theme.border,backgroundColor:theme.surface}]}><Text>{reaction.emoji} {reaction.count}</Text></TouchableOpacity>)}<TouchableOpacity onPress={()=>setReactionMessageId(reactionMessageId===item.messageId?null:item.messageId)} style={styles.reactionAdd}><Ionicons name="happy-outline" size={15} color={theme.textMuted}/></TouchableOpacity></View>
        {reactionMessageId===item.messageId?<View style={[styles.reactionPicker,{backgroundColor:theme.surface,borderColor:theme.border}]}>{['❤️','😂','😮','😢','🔥','👍'].map(emoji=><TouchableOpacity key={emoji} onPress={()=>void toggleReaction(item,emoji)}><Text style={{fontSize:21}}>{emoji}</Text></TouchableOpacity>)}</View>:null}
        {isOwn && (
          <Text style={[styles.receipt, { color: item.readReceiptVisible && item.readByRecipient ? theme.accent : theme.textMuted }]}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {item.readReceiptVisible && item.readByRecipient ? 'Leído' : 'Enviado'}
          </Text>
        )}
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
  const themedBackground=({DEEP_TEAL:'#082b2a',OCEAN:'#082230',FOREST:'#10281d',NIGHT:'#071018'} as Record<string,string>)[conversation.chatTheme||'']||theme.background;

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: themedBackground }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.headerIdentity} onPress={()=>setShowInfo(true)} accessibilityLabel="Abrir información de la conversación">
          <UserAvatar avatarUrl={conversation.avatarUrl} displayName={conversation.name} username={conversation.otherUsername} size={38}/>
          <View style={styles.headerInfo}><Text style={[styles.title, { color: theme.textPrimary }]}>{conversation.name}</Text>{conversation.otherUsername?<Text style={[styles.status, { color: presence?.online?theme.accent:theme.textSecondary }]}>{presence?.online?'Disponible':`@${conversation.otherUsername}`}</Text>:null}</View>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=>setShowInfo(true)} style={styles.infoButton} accessibilityLabel="Abrir información"><Ionicons name="ellipsis-vertical" size={20} color={theme.textPrimary}/></TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.messageId}
        renderItem={renderMessageItem}
        contentContainerStyle={messages.length === 0 ? styles.emptyContainer : { paddingHorizontal: 16, paddingVertical: 12 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubble-ellipses-outline" size={36} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>Sin mensajes aún</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>Escribe el primer mensaje para comenzar la conversación.</Text>
          </View>
        }
      />

      {/* Input */}
      {sendError ? <Text style={[styles.sendError, { color: theme.danger }]}>{sendError}</Text> : null}
      {recorderState.isRecording?<View style={[styles.recording,{backgroundColor:theme.surface,borderColor:theme.border}]}><Text style={{color:theme.danger,fontWeight:'800'}}>● Grabando… {formatDuration(Math.floor((recorderState.durationMillis||0)/1000))}</Text><View style={styles.recordActions}><TouchableOpacity onPress={()=>void stopRecording(true)}><Text style={{color:theme.danger,fontWeight:'800'}}>Cancelar</Text></TouchableOpacity><TouchableOpacity onPress={()=>void stopRecording(false)} style={[styles.stop,{backgroundColor:theme.primary}]}><Text style={{color:'#fff',fontWeight:'800'}}>Detener</Text></TouchableOpacity></View></View>:null}
      {audioPreview&&!recorderState.isRecording?<View style={[styles.preview,{backgroundColor:theme.surface,borderColor:theme.border}]}><ChatAudio uri={audioPreview.uri} duration={audioPreview.durationSeconds}/><TouchableOpacity disabled={sendingMedia} onPress={()=>setAudioPreview(null)}><Text style={{color:theme.danger,fontWeight:'800'}}>Quitar</Text></TouchableOpacity><TouchableOpacity disabled={sendingMedia} onPress={()=>void sendMedia('audio')} style={[styles.audioSend,{backgroundColor:theme.primary}]}>{sendingMedia?<ActivityIndicator color="#fff"/>:<Text style={{color:'#fff',fontWeight:'800'}}>Enviar audio ➤</Text>}</TouchableOpacity></View>:null}
      {selectedMedia?<View style={[styles.preview,{backgroundColor:theme.surface,borderColor:theme.border}]}>{selectedMedia.type==='image'?<Image source={{uri:selectedMedia.uri}} style={styles.selectedThumb}/>:<Ionicons name="videocam" size={30} color={theme.accent}/>}<Text numberOfLines={1} style={{color:theme.textSecondary,flex:1}}>{selectedMedia.fileName||'Archivo seleccionado'}</Text><TouchableOpacity onPress={()=>setSelectedMedia(null)}><Ionicons name="close-circle" size={24} color={theme.danger}/></TouchableOpacity><TouchableOpacity disabled={sendingMedia} onPress={()=>void sendMedia('asset')} style={[styles.audioSend,{backgroundColor:theme.primary}]}><Ionicons name="send" size={17} color="#fff"/></TouchableOpacity></View>:null}
      <View style={[styles.inputRow, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TouchableOpacity disabled={recorderState.isRecording} onPress={()=>void pickMedia(false)}><Ionicons name="image-outline" size={22} color={theme.textMuted}/></TouchableOpacity>
        <TouchableOpacity disabled={recorderState.isRecording} onPress={()=>void pickMedia(true)}><Ionicons name="camera-outline" size={22} color={theme.textMuted}/></TouchableOpacity>
        <TouchableOpacity disabled={recorderState.isRecording||Boolean(audioPreview)} onPress={()=>void startRecording()}><Ionicons name="mic-outline" size={22} color={theme.textMuted}/></TouchableOpacity>
        <TextInput
          style={[styles.input, { backgroundColor: theme.background, borderColor: theme.border, color: theme.textPrimary }]}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={theme.textMuted}
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity disabled={Boolean(selectedMedia)||Boolean(audioPreview)} style={[styles.sendBtn, { backgroundColor: theme.primary },(selectedMedia||audioPreview)&&{opacity:.45}]} onPress={handleSend}>
          <Ionicons name="send" size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>
      <Modal visible={showInfo} animationType="slide" onRequestClose={()=>setShowInfo(false)}>
        <ScrollView style={{backgroundColor:theme.background}} contentContainerStyle={styles.infoContent}>
          <View style={styles.infoTop}><TouchableOpacity onPress={()=>setShowInfo(false)} accessibilityLabel="Volver"><Ionicons name="arrow-back" size={23} color={theme.textPrimary}/></TouchableOpacity><Text style={[styles.infoTitle,{color:theme.textPrimary}]}>Información</Text><View style={{width:23}}/></View>
          <View style={[styles.infoHero,{backgroundColor:theme.surface,borderColor:theme.border}]}><View style={styles.halo}/><UserAvatar avatarUrl={conversation.avatarUrl} displayName={conversation.name} username={conversation.otherUsername} size={96}/><Text style={[styles.infoName,{color:theme.textPrimary}]}>{conversation.name}</Text>{conversation.otherUsername?<Text style={{color:theme.textSecondary}}>@{conversation.otherUsername}</Text>:null}</View>
          <Text style={[styles.infoSection,{color:theme.textPrimary}]}>Multimedia, enlaces y archivos</Text>
          {mediaAttachments.length?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRail}>{mediaAttachments.slice(0,12).map(item=>item.fileType==='IMAGE'?<Image key={item.id} source={{uri:item.fileUrl}} style={styles.mediaTile}/>:<View key={item.id} style={[styles.mediaTile,styles.mediaType,{backgroundColor:theme.surface}]}><Ionicons name={item.fileType==='VIDEO'?'videocam':'musical-notes'} size={25} color={theme.accent}/><Text style={{fontSize:10,color:theme.textMuted}}>{item.fileType==='VIDEO'?'Video':'Audio'}</Text></View>)}</ScrollView>:<Text style={{color:theme.textMuted,fontSize:13}}>Todavía no hay archivos compartidos.</Text>}
          <TouchableOpacity onPress={()=>void togglePin()} style={[styles.infoCard,{backgroundColor:theme.surface,borderColor:theme.border}]}><View style={styles.infoOption}><Ionicons name={conversation.isPinned?'bookmark':'bookmark-outline'} size={20} color={theme.accent}/><Text style={{color:theme.textPrimary,fontWeight:'700'}}>{conversation.isPinned?'Desanclar conversación':'Anclar conversación'}</Text></View></TouchableOpacity>
          <View style={[styles.infoCard,{backgroundColor:theme.surface,borderColor:theme.border}]}><Text style={[styles.optionLabel,{color:theme.textMuted}]}>APODO PRIVADO</Text><View style={styles.nicknameRow}><TextInput value={nickname} onChangeText={setNickname} maxLength={40} placeholder="Añadir apodo" placeholderTextColor={theme.textMuted} style={[styles.nicknameInput,{borderColor:theme.border,color:theme.textPrimary}]}/><TouchableOpacity onPress={()=>void saveNickname()} style={[styles.smallButton,{backgroundColor:theme.primary}]}><Text style={styles.smallButtonText}>Guardar</Text></TouchableOpacity></View></View>
          <TouchableOpacity onPress={openMuteMenu} style={[styles.infoCard,{backgroundColor:theme.surface,borderColor:theme.border}]}><View style={styles.infoOption}><Ionicons name={conversation.notificationsMuted?'notifications-off-outline':'notifications-outline'} size={20} color={theme.accent}/><View><Text style={{color:theme.textPrimary,fontWeight:'700'}}>Señales</Text><Text style={{color:theme.textMuted,fontSize:11}}>{conversation.notificationsMuted?'Silenciadas':'Todas'}</Text></View></View></TouchableOpacity>
          <View style={[styles.infoCard,{backgroundColor:theme.surface,borderColor:theme.border}]}><Text style={[styles.optionLabel,{color:theme.textMuted}]}>FONDO DEL CHAT</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{[['DEFAULT','Predeterminado'],['DEEP_TEAL','Teal'],['OCEAN','Océano'],['FOREST','Bosque'],['NIGHT','Noche']].map(([value,label])=><TouchableOpacity key={value} onPress={()=>void updatePreferences({chatTheme:value})} style={[styles.themeChip,{borderColor:conversation.chatTheme===value?theme.accent:theme.border}]}><Text style={{color:theme.textPrimary,fontSize:11,fontWeight:'700'}}>{label}</Text></TouchableOpacity>)}</ScrollView></View>
          <View style={[styles.infoCard,{backgroundColor:theme.surface,borderColor:theme.border}]}><View style={styles.infoOption}><Ionicons name="person-outline" size={20} color={theme.accent}/><Text style={{color:theme.textPrimary,fontWeight:'700'}}>Espacio de @{conversation.otherUsername||conversation.name}</Text></View></View>
          {conversation.conversationId?<TouchableOpacity onPress={deleteConversation} style={[styles.deleteOption,{borderColor:theme.danger}]}><Ionicons name="trash-outline" size={20} color={theme.danger}/><Text style={{color:theme.danger,fontWeight:'800'}}>Eliminar conversación</Text></TouchableOpacity>:null}
          {conversation.conversationId?<View style={[styles.infoCard,{backgroundColor:theme.surface,borderColor:theme.border}]}><Text style={[styles.optionLabel,{color:theme.textMuted}]}>BUSCAR MENSAJES</Text><View style={styles.nicknameRow}><TextInput value={messageSearch} onChangeText={setMessageSearch} placeholder="Buscar texto…" placeholderTextColor={theme.textMuted} style={[styles.nicknameInput,{borderColor:theme.border,color:theme.textPrimary}]}/><TouchableOpacity onPress={()=>void searchConversation()} style={[styles.smallButton,{backgroundColor:theme.primary}]}><Ionicons name="search" size={18} color="#fff"/></TouchableOpacity></View>{searchResults.map(item=><Text key={item.messageId} numberOfLines={2} style={{color:theme.textSecondary,fontSize:11,marginTop:9}}>@{item.senderUsername}: {item.content}</Text>)}</View>:null}
          {commonCircles.length?<View><Text style={[styles.infoSection,{color:theme.textPrimary}]}>Círculos en común</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRail}>{commonCircles.map(circle=><TouchableOpacity key={circle.slug} style={styles.commonCircle} onPress={()=>{setShowInfo(false);onOpenCircle(circle.slug);}}><UserAvatar avatarUrl={circle.avatarUrl} displayName={circle.name} size={48}/><Text numberOfLines={1} style={{color:theme.textSecondary,fontSize:10,width:62,textAlign:'center'}}>{circle.name}</Text></TouchableOpacity>)}</ScrollView></View>:null}
          <Text style={{color:theme.textMuted,fontSize:11,textAlign:'center',marginTop:24}}>Las llamadas de audio y video están disponibles en Lifonk Web.</Text>
        </ScrollView>
      </Modal>
    </KeyboardAvoidingView>
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    padding: 4,
  },
  headerIdentity:{flex:1,flexDirection:'row',alignItems:'center',gap:10,marginHorizontal:8},
  headerInfo: {alignItems:'flex-start'},
  title: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  status: {
    fontSize: 11,
    marginTop: 1,
  },
  infoButton:{width:40,height:40,alignItems:'center',justifyContent:'center'},
  messageRow: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  ownRow: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherRow: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
  },
  ownBubble: {
    borderTopRightRadius: 2,
  },
  otherBubble: {
    borderWidth: 1,
    borderTopLeftRadius: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 19,
  },
  ownText: {
    color: '#ffffff',
  },
  otherText: {},
  senderName: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  receipt: {
    fontSize: 10,
    marginTop: 3,
  },
  inputRow: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: 1,
    gap: 10,alignItems:'center',
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendError: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
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
  emptyTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    textAlign: 'center',
  },
  attachmentImage:{width:220,height:220,borderRadius:12,marginBottom:6},attachmentVideo:{width:240,height:220,borderRadius:12,backgroundColor:'#000'},audio:{minWidth:190,flexDirection:'row',alignItems:'center',gap:10,paddingVertical:4},recording:{borderTopWidth:1,padding:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},recordActions:{flexDirection:'row',alignItems:'center',gap:15},stop:{paddingHorizontal:15,paddingVertical:8,borderRadius:10},preview:{borderTopWidth:1,padding:10,flexDirection:'row',alignItems:'center',gap:10},selectedThumb:{width:44,height:44,borderRadius:9},audioSend:{minHeight:38,paddingHorizontal:13,borderRadius:11,alignItems:'center',justifyContent:'center'},
  infoContent:{padding:18,paddingBottom:42},infoTop:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:10},infoTitle:{fontSize:15,fontWeight:'900'},infoHero:{height:250,borderWidth:1,borderRadius:28,alignItems:'center',justifyContent:'center',overflow:'hidden',marginTop:10},halo:{position:'absolute',width:260,height:160,borderRadius:130,backgroundColor:'rgba(20,184,166,.22)',transform:[{scaleX:1.5}]},infoName:{fontSize:20,fontWeight:'900',marginTop:12},infoSection:{fontSize:13,fontWeight:'900',marginTop:24,marginBottom:12},mediaRail:{gap:8},mediaTile:{width:76,height:76,borderRadius:14},mediaType:{alignItems:'center',justifyContent:'center',gap:5},infoCard:{borderWidth:1,borderRadius:18,padding:16,marginTop:22},infoOption:{flexDirection:'row',alignItems:'center',gap:12},deleteOption:{borderWidth:1,borderRadius:18,padding:16,marginTop:12,flexDirection:'row',alignItems:'center',gap:12},
  reactionRow:{flexDirection:'row',alignItems:'center',gap:4,marginTop:3},reactionChip:{borderWidth:1,borderRadius:14,paddingHorizontal:7,paddingVertical:3},reactionAdd:{padding:4},reactionPicker:{flexDirection:'row',gap:8,borderWidth:1,borderRadius:20,paddingHorizontal:10,paddingVertical:6,marginTop:5},optionLabel:{fontSize:10,fontWeight:'900',marginBottom:9},nicknameRow:{flexDirection:'row',gap:8},nicknameInput:{flex:1,borderWidth:1,borderRadius:12,paddingHorizontal:11,height:42},smallButton:{borderRadius:12,paddingHorizontal:12,justifyContent:'center'},smallButtonText:{color:'#fff',fontSize:11,fontWeight:'800'},themeChip:{borderWidth:1,borderRadius:16,paddingHorizontal:12,paddingVertical:8},
  commonCircle:{width:64,alignItems:'center',gap:5},
});

function formatDuration(seconds:number){return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;}
function ChatAudio({uri,duration}:{uri:string;duration?:number}){const player=useAudioPlayer(uri);return <TouchableOpacity onPress={()=>{player.seekTo(0);player.play();}} style={styles.audio}><Ionicons name="play-circle" size={30} color="#14b8a6"/><Text style={{color:'#94a3b8',fontSize:12}}>Audio {duration?formatDuration(duration):''}</Text></TouchableOpacity>;}
function ChatVideo({uri}:{uri:string}){const player=useVideoPlayer(uri);return <VideoView player={player} nativeControls contentFit="contain" style={styles.attachmentVideo}/>;}
