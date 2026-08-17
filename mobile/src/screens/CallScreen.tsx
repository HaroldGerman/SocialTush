import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';

interface CallScreenProps {
  recipientUsername: string;
  isIncoming: boolean;
  onHangUp: () => void;
}

const { height: WINDOW_HEIGHT } = Dimensions.get('window');

export default function CallScreen({ recipientUsername, isIncoming, onHangUp }: CallScreenProps) {
  const [status, setStatus] = useState<'RINGING' | 'CONNECTED'>('RINGING');
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);

  useEffect(() => {
    // Simulate connection lag
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
          <Text style={styles.avatarText}>{recipientUsername.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>@{recipientUsername}</Text>
        <Text style={styles.status}>
          {status === 'RINGING' ? 'Estableciendo llamada WebRTC...' : 'Llamada Conectada (P2P)'}
        </Text>
      </View>

      {/* Camera / Audio Placeholder view */}
      <View style={styles.mediaContainer}>
        {videoOff ? (
          <View style={styles.placeholderBg}>
            <Text style={styles.placeholderText}>Cámara Desactivada</Text>
          </View>
        ) : (
          <View style={styles.activeVideoMocks}>
            <Text style={styles.activeText}>Transmisión de Video Activa</Text>
            {status === 'RINGING' ? (
              <ActivityIndicator size="small" color="#ffffff" style={{ marginTop: 8 }} />
            ) : null}
          </View>
        )}
      </View>

      {/* Call Buttons panel footer */}
      <View style={styles.buttonRow}>
        <TouchableOpacity 
          style={[styles.btn, micMuted && styles.btnActive]} 
          onPress={() => setMicMuted(!micMuted)}
        >
          <Text style={styles.btnLabel}>{micMuted ? '🎙️ On' : '🎙️ Off'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.declineBtn} onPress={onHangUp}>
          <Text style={styles.hangupLabel}>📞 Colgar</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.btn, videoOff && styles.btnActive]} 
          onPress={() => setVideoOff(!videoOff)}
        >
          <Text style={styles.btnLabel}>{videoOff ? '📹 On' : '📹 Off'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  topSection: {
    alignItems: 'center',
    marginTop: 40,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366f115',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#6366f130',
  },
  avatarText: {
    color: '#6366f1',
    fontSize: 32,
    fontWeight: 'bold',
  },
  name: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  status: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mediaContainer: {
    flex: 1,
    marginVertical: 40,
    backgroundColor: '#18181b30',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272a30',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  placeholderBg: {
    alignItems: 'center',
  },
  placeholderText: {
    color: '#3f3f46',
    fontSize: 13,
    fontWeight: '600',
  },
  activeVideoMocks: {
    alignItems: 'center',
  },
  activeText: {
    color: '#a1a1aa',
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnActive: {
    backgroundColor: '#ef444420',
    borderColor: '#ef444450',
  },
  btnLabel: {
    fontSize: 14,
    color: '#ffffff',
  },
  declineBtn: {
    height: 52,
    paddingHorizontal: 24,
    borderRadius: 26,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hangupLabel: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
