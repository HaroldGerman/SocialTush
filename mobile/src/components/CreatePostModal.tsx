import React, { useState } from 'react';
import { StyleSheet, Text, View, Modal, TextInput, TouchableOpacity, Image, ActivityIndicator, ScrollView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme';
import { useVideoPlayer, VideoView } from 'expo-video';

function PreviewVideo({uri}:{uri:string}){const player=useVideoPlayer(uri);return <VideoView player={player} nativeControls contentFit="contain" style={styles.imagePreview}/>;}

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

export default function CreatePostModal({ visible, onClose, onPostCreated }: CreatePostModalProps) {
  const { api } = useAuth();
  const { theme } = useAppTheme();
  
  const [caption, setCaption] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePickMedia = async (mediaType: 'image' | 'video' | 'all') => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        setErrorMsg('Permiso de acceso a fotos y videos denegado.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType === 'video' 
          ? ImagePicker.MediaTypeOptions.Videos 
          : mediaType === 'image' 
          ? ImagePicker.MediaTypeOptions.Images 
          : ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setSelectedAsset(result.assets[0]);
        setErrorMsg(null);
      }
    } catch (err) {
      setErrorMsg('Error al seleccionar archivo.');
    }
  };

  const handleCamera = async () => {
    try { const permission=await ImagePicker.requestCameraPermissionsAsync(); if(!permission.granted){setErrorMsg('Permiso de cámara denegado.');return;} const result=await ImagePicker.launchCameraAsync({mediaTypes:['images'],quality:.85}); if(!result.canceled)setSelectedAsset(result.assets[0]); }
    catch(error){console.error(error);setErrorMsg('No se pudo abrir la cámara.');}
  };

  const handlePublish = async () => {
    if (!caption.trim() && !selectedAsset) {
      setErrorMsg('Escribe un mensaje o selecciona un archivo multimedia.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const formData = new FormData();
      if (caption.trim()) {
        formData.append('caption', caption.trim());
      }

      if (selectedAsset) {
        const uri = selectedAsset.uri;
        const uriParts = uri.split('.');
        const fileType = uriParts[uriParts.length - 1];

        const fileObj = {
          uri: Platform.OS === 'ios' ? uri.replace('file://', '') : uri,
          name: `upload_${Date.now()}.${fileType || 'jpg'}`,
          type: selectedAsset.type === 'video' ? `video/${fileType || 'mp4'}` : `image/${fileType || 'jpeg'}`,
        } as any;

        formData.append('files', fileObj);
      }

      await api.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setCaption('');
      setSelectedAsset(null);
      onPostCreated();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Error al publicar la entrada.';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    if (isSubmitting) return;
    setErrorMsg(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleModalClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={handleModalClose} disabled={isSubmitting}>
              <Ionicons name="close" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>Crear Publicación</Text>
            <TouchableOpacity 
              onPress={handlePublish} 
              disabled={isSubmitting || (!caption.trim() && !selectedAsset)}
              style={[
                styles.publishBtn, 
                { backgroundColor: theme.primary },
                (isSubmitting || (!caption.trim() && !selectedAsset)) && { opacity: 0.5 }
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.publishBtnText}>Publicar</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {/* Error Message Display */}
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color="#ef4444" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            {/* Input Caption Text */}
            <TextInput
              style={[styles.input, { color: theme.textPrimary, backgroundColor: theme.background, borderColor: theme.border }]}
              placeholder="¿Qué quieres compartir hoy?..."
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={4}
              value={caption}
              onChangeText={setCaption}
            />

            {/* Media Selected Preview */}
            {selectedAsset ? (
              <View style={[styles.previewBox, { borderColor: theme.border }]}>
                {selectedAsset.type === 'video' ? (
                  <PreviewVideo uri={selectedAsset.uri}/>
                ) : (
                  <Image source={{ uri: selectedAsset.uri }} style={styles.imagePreview} resizeMode="cover" />
                )}
                <TouchableOpacity style={styles.removeMediaBtn} onPress={() => setSelectedAsset(null)}>
                  <Ionicons name="close-circle" size={24} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Action Bar: Add Photo/Video */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionOptionBtn,{backgroundColor:theme.surfaceSecondary,borderColor:theme.border}]} onPress={()=>void handleCamera()}><Ionicons name="camera-outline" size={20} color={theme.accent}/><Text style={[styles.actionOptionText,{color:theme.textPrimary}]}>Cámara</Text></TouchableOpacity>
              <TouchableOpacity 
                style={[styles.actionOptionBtn, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
                onPress={() => handlePickMedia('image')}
              >
                <Ionicons name="image-outline" size={20} color={theme.emerald} />
                <Text style={[styles.actionOptionText, { color: theme.textPrimary }]}>Agregar Foto</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionOptionBtn, { backgroundColor: theme.surfaceSecondary, borderColor: theme.border }]}
                onPress={() => handlePickMedia('video')}
              >
                <Ionicons name="videocam-outline" size={20} color={theme.accent} />
                <Text style={[styles.actionOptionText, { color: theme.textPrimary }]}>Agregar Video</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    height: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  publishBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  publishBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ef444415',
    borderWidth: 1,
    borderColor: '#ef444440',
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  previewBox: {
    marginTop: 14,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    position: 'relative',
    height: 200,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  videoPreviewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  previewText: {
    fontSize: 13,
    fontWeight: '600',
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 24,
  },
  actionOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionOptionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
