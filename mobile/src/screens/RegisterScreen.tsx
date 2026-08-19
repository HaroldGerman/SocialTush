import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
  onRegisterSuccess: () => void;
}

export default function RegisterScreen({ onNavigateToLogin, onRegisterSuccess }: RegisterScreenProps) {
  const { register, isLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!email.trim() || !username.trim() || !displayName.trim() || !password.trim()) {
      setError('Por favor completa todos los campos');
      return;
    }
    setError(null);
    try {
      await register(email.trim(), username.trim(), displayName.trim(), password);
      onRegisterSuccess();
    } catch (err: any) {
      setError(err.message || 'Error al crear cuenta');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>S</Text>
        </View>
        <Text style={styles.title}>Crear una cuenta</Text>
        <Text style={styles.subtitle}>Únete a la comunidad de SocialTush</Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.form}>
        {/* Name */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre Público</Text>
          <TextInput
            style={styles.input}
            placeholder="Tu nombre visible"
            placeholderTextColor="#64748b"
            value={displayName}
            onChangeText={setDisplayName}
          />
        </View>

        {/* Username */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nombre de usuario</Text>
          <TextInput
            style={styles.input}
            placeholder="Usuario (ej: carlos)"
            placeholderTextColor="#64748b"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Email */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Correo Electrónico</Text>
          <TextInput
            style={styles.input}
            placeholder="correo@ejemplo.com"
            placeholderTextColor="#64748b"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Password */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor="#64748b"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={handleRegister}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Crear cuenta</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={onNavigateToLogin} style={styles.footerLink}>
        <Text style={styles.footerText}>
          ¿Ya tienes una cuenta? <Text style={styles.loginText}>Inicia sesión</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#14b8a650',
  },
  logoText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 10,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    textAlign: 'center',
  },
  form: {
    gap: 12,
  },
  inputGroup: {
    gap: 4,
  },
  label: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    height: 46,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#0f766e',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  footerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  footerText: {
    color: '#64748b',
    fontSize: 12,
  },
  loginText: {
    color: '#14b8a6',
    fontWeight: 'bold',
  },
});
