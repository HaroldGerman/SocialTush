import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CallScreenProps {
  recipientUsername: string;
  isIncoming?: boolean;
  onHangUp: () => void;
}

const { height: WINDOW_HEIGHT } = Dimensions.get('window');

export default function CallScreen({ recipientUsername, isIncoming, onHangUp }: CallScreenProps) {
  const [status, setStatus] = useState<'RINGING' | 'CONNECTED'>('RINGING');
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setStatus('CONNECTED');
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      {/* Top caller info */}
      <View style={styles.topSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(recipientUsername || 'U').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>@{recipientUsername}</Text>
        <Text style={styles.status}>
          {status === 'RINGING' ? 'Estableciendo llamada WebRTC...' : 'Llamada Conectada'}
        </Text>
      </View>

      {/* Camera / Audio View */}
      <View style={styles.mediaContainer}>
        {videoOff ? (
          <View style={styles.placeholderBg}>
            <Ionicons name="videocam-off-outline" size={40} color="#64748b" />
            <Text style={styles.placeholderText}>Cámara Desactivada</Text>
          </View>
        ) : (
          <View style={styles.activeVideoView}>
            <Ionicons name="videocam-outline" size={40} color="#14b8a6" />
            <Text style={styles.activeText}>Transmisión de Video Activa</Text>
            {status === 'RINGING' ? (
              <ActivityIndicator size="small" color="#14b8a6" style={{ marginTop: 12 }} />
            ) : null}
          </View>
        )}
      </View>

      {/* Call Buttons panel */}
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.btn, micMuted && styles.btnActive]} 
          onPress={() => setMicMuted(!micMuted)}
        >
          <Ionicons name={micMuted ? "mic-off" : "mic"} size={22} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.declineBtn} onPress={onHangUp}>
          <Ionicons name="call" size={22} color="#ffffff" />
          <Text style={styles.hangupLabel}>Colgar</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.btn, videoOff && styles.btnActive]} 
          onPress={() => setVideoOff(!videoOff)}
        >
          <Ionicons name={videoOff ? "videocam-off" : "videocam"} size={22} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    justifyContent: 'space-between',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  topSection: {
    alignItems: 'center',
    marginTop: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#14b8a650',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  name: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 16,
  },
  status: {
    color: '#10b981',
    fontSize: 12,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  mediaContainer: {
    flex: 1,
    marginVertical: 30,
    backgroundColor: '#0f172a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  placeholderBg: {
    alignItems: 'center',
    gap: 8,
  },
  placeholderText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600',
  },
  activeVideoView: {
    alignItems: 'center',
    gap: 8,
  },
  activeText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
  },
  btn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: '#ef444420',
    borderColor: '#ef444450',
  },
  declineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 54,
    paddingHorizontal: 28,
    borderRadius: 27,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
  },
  hangupLabel: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
