import React, { useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme';

export default function StoryComposer({ visible, onClose, onPublished }: { visible: boolean; onClose: () => void; onPublished: () => void }) {
  const { api } = useAuth(); const { theme } = useAppTheme();
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [text, setText] = useState(''); const [mode, setMode] = useState<'SELECT'|'TEXT'|'EDITOR'>('SELECT');
  const [background, setBackground] = useState('#0f766e'); const [publishing, setPublishing] = useState(false); const [error, setError] = useState('');

  const reset = () => { setAsset(null); setText(''); setMode('SELECT'); setError(''); };
  const close = () => { if (publishing) return; reset(); onClose(); };
  const pick = async (camera: boolean) => {
    setError('');
    const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setError(camera ? 'No pudimos acceder a la cámara.' : 'No pudimos acceder a tu galería.');
    const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: .85 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: .85 });
    if (!result.canceled && result.assets[0]) { setAsset(result.assets[0]); setMode('EDITOR'); }
  };
  const publish = async () => {
    if (mode === 'TEXT' && !text.trim()) return setError('Escribe algo para publicar.');
    if (mode === 'EDITOR' && !asset) return;
    setPublishing(true); setError('');
    try {
      const data = new FormData();
      data.append('mediaType', mode === 'TEXT' ? 'TEXT' : asset?.type === 'video' ? 'VIDEO' : 'IMAGE');
      data.append('isBestFriends', 'false');
      if (mode === 'TEXT') { data.append('textContent', text.trim()); data.append('backgroundColor', background); }
      if (asset) data.append('file', { uri: Platform.OS === 'ios' ? asset.uri.replace('file://', '') : asset.uri, name: asset.fileName || `story_${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`, type: asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg') } as any);
      await api.post('/stories', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      reset(); onClose(); onPublished();
    } catch (requestError: any) { console.error(requestError); setError(requestError.response?.data?.message || 'No se pudo publicar la historia.'); }
    finally { setPublishing(false); }
  };

  return <Modal visible={visible} animationType="slide" onRequestClose={close}><View style={[styles.container, { backgroundColor: mode === 'TEXT' ? background : '#09090b' }]}>
    <View style={styles.header}><TouchableOpacity onPress={close} style={styles.icon}><Ionicons name="close" size={26} color="#fff"/></TouchableOpacity><Text style={styles.title}>Crear historia</Text>{mode !== 'SELECT' ? <TouchableOpacity disabled={publishing} onPress={() => void publish()} style={styles.publish}>{publishing ? <ActivityIndicator color="#fff"/> : <Text style={styles.publishText}>Publicar</Text>}</TouchableOpacity> : <View style={{ width: 80 }}/>}</View>
    {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
    {mode === 'SELECT' ? <View style={styles.choices}><Text style={styles.heading}>Comparte una historia</Text><TouchableOpacity onPress={() => void pick(true)} style={styles.choice}><Ionicons name="camera-outline" size={30} color="#2dd4bf"/><View><Text style={styles.choiceTitle}>Cámara</Text><Text style={styles.choiceSub}>Toma una foto ahora</Text></View></TouchableOpacity><TouchableOpacity onPress={() => void pick(false)} style={styles.choice}><Ionicons name="images-outline" size={30} color="#2dd4bf"/><View><Text style={styles.choiceTitle}>Galería</Text><Text style={styles.choiceSub}>Elige una imagen o video</Text></View></TouchableOpacity><TouchableOpacity onPress={() => setMode('TEXT')} style={styles.choice}><Ionicons name="text-outline" size={30} color="#2dd4bf"/><View><Text style={styles.choiceTitle}>Texto</Text><Text style={styles.choiceSub}>Publica sobre un fondo</Text></View></TouchableOpacity></View> : null}
    {mode === 'TEXT' ? <View style={styles.editor}><TextInput autoFocus multiline value={text} onChangeText={setText} placeholder="Escribe algo…" placeholderTextColor="#ffffff88" style={styles.textInput}/><View style={styles.colors}>{['#0f766e','#312e81','#881337','#7c2d12','#090d16','#1e293b'].map(color => <TouchableOpacity key={color} onPress={() => setBackground(color)} style={[styles.color, { backgroundColor: color }, background === color && styles.colorActive]}/>)}</View></View> : null}
    {mode === 'EDITOR' && asset ? <View style={styles.mediaEditor}>{asset.type === 'video' ? <View style={styles.videoPlaceholder}><Ionicons name="videocam" size={46} color="#fff"/><Text style={styles.choiceTitle}>Video seleccionado</Text></View> : <Image source={{ uri: asset.uri }} style={styles.preview} resizeMode="contain"/>}<TouchableOpacity onPress={() => { setAsset(null); setMode('SELECT'); }} style={styles.remove}><Ionicons name="trash-outline" size={18} color="#fff"/><Text style={styles.removeText}>Quitar</Text></TouchableOpacity></View> : null}
  </View></Modal>;
}

const styles = StyleSheet.create({
  container:{flex:1},header:{height:64,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',zIndex:2},icon:{width:44,height:44,alignItems:'center',justifyContent:'center'},title:{color:'#fff',fontSize:16,fontWeight:'800'},publish:{minWidth:80,height:38,paddingHorizontal:14,borderRadius:12,backgroundColor:'#0f766e',alignItems:'center',justifyContent:'center'},publishText:{color:'#fff',fontWeight:'800'},error:{marginHorizontal:16,padding:12,borderRadius:12,backgroundColor:'#7f1d1d'},errorText:{color:'#fee2e2',textAlign:'center'},choices:{flex:1,justifyContent:'center',padding:22,gap:12},heading:{color:'#fff',fontSize:26,fontWeight:'900',marginBottom:14,textAlign:'center'},choice:{minHeight:78,borderRadius:18,borderWidth:1,borderColor:'#334155',backgroundColor:'#0f172a',padding:16,flexDirection:'row',alignItems:'center',gap:14},choiceTitle:{color:'#fff',fontSize:16,fontWeight:'800'},choiceSub:{color:'#94a3b8',fontSize:12,marginTop:3},editor:{flex:1,alignItems:'center',justifyContent:'center',padding:26},textInput:{color:'#fff',fontSize:30,fontWeight:'800',textAlign:'center',width:'100%',maxHeight:300},colors:{position:'absolute',bottom:30,flexDirection:'row',gap:12},color:{width:34,height:34,borderRadius:17,borderWidth:2,borderColor:'#ffffff55'},colorActive:{borderColor:'#fff',transform:[{scale:1.15}]},mediaEditor:{flex:1,alignItems:'center',justifyContent:'center'},preview:{width:'100%',height:'80%'},videoPlaceholder:{alignItems:'center',gap:10},remove:{position:'absolute',bottom:28,flexDirection:'row',gap:7,backgroundColor:'#000a',paddingHorizontal:16,paddingVertical:10,borderRadius:20},removeText:{color:'#fff',fontWeight:'700'}
});
