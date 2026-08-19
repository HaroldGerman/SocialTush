import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onNavigateToRegister, onLoginSuccess }: LoginScreenProps) {
  const { login, isLoading } = useAuth();
  
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!usernameOrEmail.trim() || !password.trim()) {
      setError('Por favor completa todos los campos');
      return;
    }
    setError(null);
    try {
      await login(usernameOrEmail.trim(), password);
      onLoginSuccess();
    } catch (err: any) {
      setError(err.message || 'Error de credenciales');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoText}>S</Text>
        </View>
        <Text style={styles.title}>Iniciar sesión</Text>
        <Text style={styles.subtitle}>Conéctate a tu cuenta de SocialTush</Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.form}>
        {/* Username/Email */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Usuario o Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Usuario o correo"
            placeholderTextColor="#64748b"
            value={usernameOrEmail}
            onChangeText={setUsernameOrEmail}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Password */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Tu contraseña"
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
          onPress={handleLogin}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Iniciar sesión</Text>
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={onNavigateToRegister} style={styles.footerLink}>
        <Text style={styles.footerText}>
          ¿No tienes una cuenta? <Text style={styles.signUpText}>Regístrate</Text>
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
    marginBottom: 32,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#14b8a650',
  },
  logoText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
  },
  title: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#0f766e',
    height: 50,
    borderRadius: 14,
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
    marginTop: 28,
    alignItems: 'center',
  },
  footerText: {
    color: '#64748b',
    fontSize: 13,
  },
  signUpText: {
    color: '#14b8a6',
    fontWeight: 'bold',
  },
});
