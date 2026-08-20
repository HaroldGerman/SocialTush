import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme';

function PostVideo({ url }: { url:string }) {
  const player = useVideoPlayer(url);
  useEffect(() => () => player.pause(), [player]);
  return <VideoView player={player} style={styles.media} nativeControls contentFit="contain"/>;
}

export default function PostDetailScreen({ postId, onBack, onOpenProfile }: { postId:string; onBack:()=>void; onOpenProfile:(username:string)=>void }) {
  const { api }=useAuth(); const { theme }=useAppTheme();
  const [post,setPost]=useState<any>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=async()=>{setLoading(true);try{const res=await api.get(`/posts/${postId}`);setPost(res.data);setError('');}catch(requestError:any){console.error(requestError);setError(requestError.response?.status===403?'No tienes acceso a esta publicación.':requestError.response?.status===404?'Publicación no encontrada.':'No se pudo cargar la publicación.');}finally{setLoading(false);}};
  useEffect(()=>{void load();},[postId]);
  return <View style={[styles.container,{backgroundColor:theme.background}]}><View style={[styles.header,{borderColor:theme.border}]}><TouchableOpacity onPress={onBack}><Ionicons name="arrow-back" size={24} color={theme.textPrimary}/></TouchableOpacity><Text style={[styles.title,{color:theme.textPrimary}]}>Publicación</Text></View>{loading?<ActivityIndicator style={{marginTop:40}} color={theme.accent}/>:error&&!post?<View style={styles.center}><Text style={{color:theme.textSecondary}}>{error}</Text><TouchableOpacity onPress={()=>void load()}><Text style={{color:theme.accent,marginTop:12}}>Reintentar</Text></TouchableOpacity></View>:post?<ScrollView contentContainerStyle={styles.content}><TouchableOpacity onPress={()=>onOpenProfile(post.username)} style={styles.author}>{post.avatarUrl?<Image source={{uri:post.avatarUrl}} style={styles.avatar}/>:<View style={[styles.avatar,{backgroundColor:theme.primary}]}/>}<View><Text style={{color:theme.textPrimary,fontWeight:'800'}}>{post.displayName||post.username}</Text><Text style={{color:theme.textMuted}}>@{post.username}</Text></View></TouchableOpacity>{post.caption?<Text style={{color:theme.textPrimary,lineHeight:21}}>{post.caption}</Text>:null}{post.mediaUrls?.map((url:string,index:number)=>post.mediaTypes?.[index]==='VIDEO'?<PostVideo key={url} url={url}/>:<Image key={url} source={{uri:url}} style={styles.media} resizeMode="contain"/>)}</ScrollView>:null}</View>;
}
const styles=StyleSheet.create({container:{flex:1},header:{height:54,flexDirection:'row',alignItems:'center',gap:16,paddingHorizontal:16,borderBottomWidth:1},title:{fontSize:18,fontWeight:'800'},center:{flex:1,alignItems:'center',justifyContent:'center',padding:24},content:{padding:18,gap:16},author:{flexDirection:'row',alignItems:'center',gap:10},avatar:{width:42,height:42,borderRadius:21},media:{width:'100%',height:420,borderRadius:18,backgroundColor:'#000'}});
