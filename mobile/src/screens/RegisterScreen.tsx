import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme';

interface RegisterScreenProps {
  onNavigateToLogin: () => void;
  onRegisterSuccess: () => void;
}

export default function RegisterScreen({ onNavigateToLogin, onRegisterSuccess }: RegisterScreenProps) {
  const { register, isLoading } = useAuth();
  const { theme } = useAppTheme();
  
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
      setError(err.message || 'Error al crear la cuenta');
    }
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View style={[styles.logoBadge, { backgroundColor: theme.primary }]}>
          <Text style={styles.logoText}>S</Text>
        </View>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Crear cuenta</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Únete a la comunidad de SocialTush</Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.form}>
        {/* Email */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Correo Electrónico</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
            placeholder="ejemplo@correo.com"
            placeholderTextColor={theme.textMuted}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
        </View>

        {/* Username */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Nombre de Usuario</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
            placeholder="usuario_123"
            placeholderTextColor={theme.textMuted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
        </View>

        {/* Display Name */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Nombre Visible</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
            placeholder="Tu Nombre Real"
            placeholderTextColor={theme.textMuted}
            value={displayName}
            onChangeText={setDisplayName}
          />
        </View>

        {/* Password */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Contraseña</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={theme.textMuted}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.primary }]} 
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
        <Text style={[styles.footerText, { color: theme.textMuted }]}>
          ¿Ya tienes una cuenta? <Text style={[styles.signUpText, { color: theme.accent }]}>Inicia sesión</Text>
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
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
    fontSize: 26,
    fontWeight: 'bold',
  },
  subtitle: {
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
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  button: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  footerLink: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
  },
  signUpText: {
    fontWeight: 'bold',
  },
});
