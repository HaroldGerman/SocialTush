import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, AppState, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioPlayer, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAuth } from '../context/AuthContext';
import { getWebSocketUrl } from '../config/api';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';

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
}

interface ChatRoomScreenProps {
  conversation: Conversation;
  onBack: () => void;
  onConversationPersisted: (conversation: Conversation) => void;
}

export default function ChatRoomScreen({ conversation, onBack, onConversationPersisted }: ChatRoomScreenProps) {
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
  const recorder=useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState=useAudioRecorderState(recorder,250);

  const ws = useRef<WebSocket | null>(null);

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
        return;
      }
      if (typeof data === 'string' && data.includes('MESSAGE')) {
        const bodyMatch = data.match(/\n\n([\s\S]*)\u0000$/);
        if (bodyMatch && bodyMatch[1]) {
          try {
            const parsed = JSON.parse(bodyMatch[1]);
            if (parsed.type === 'READ_RECEIPT') {
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

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={theme.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>{conversation.name}</Text>
          <Text style={[styles.status, { color: theme.textSecondary }]}>Conversación directa</Text>
        </View>

        <Text style={[styles.webCallNotice, { color: theme.textMuted }]}>Llamadas disponibles en web</Text>
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
  headerInfo: {
    alignItems: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  status: {
    fontSize: 11,
    marginTop: 1,
  },
  webCallNotice: {
    maxWidth: 90,
    fontSize: 9,
    textAlign: 'right',
  },
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
});

function formatDuration(seconds:number){return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;}
function ChatAudio({uri,duration}:{uri:string;duration?:number}){const player=useAudioPlayer(uri);return <TouchableOpacity onPress={()=>{player.seekTo(0);player.play();}} style={styles.audio}><Ionicons name="play-circle" size={30} color="#14b8a6"/><Text style={{color:'#94a3b8',fontSize:12}}>Audio {duration?formatDuration(duration):''}</Text></TouchableOpacity>;}
function ChatVideo({uri}:{uri:string}){const player=useVideoPlayer(uri);return <VideoView player={player} nativeControls contentFit="contain" style={styles.attachmentVideo}/>;}
