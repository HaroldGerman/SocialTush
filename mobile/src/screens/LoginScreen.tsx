import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme';
import { Ionicons } from '@expo/vector-icons';

interface LoginScreenProps {
  onNavigateToRegister: () => void;
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onNavigateToRegister, onLoginSuccess }: LoginScreenProps) {
  const { login, isLoading } = useAuth();
  const { theme } = useAppTheme();
  
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPassword,setShowPassword]=useState(false);

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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View style={[styles.logoBadge, { backgroundColor: theme.primary }]}>
          <Text style={styles.logoText}>L</Text>
        </View>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Iniciar sesión</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Conéctate a tu cuenta de Lifonk</Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Usuario o Email</Text>
          <View style={[styles.passwordBox,{backgroundColor:theme.surface,borderColor:theme.border}]}><TextInput
            style={[styles.passwordInput,{color:theme.textPrimary}]}
            placeholder="Usuario o correo"
            placeholderTextColor={theme.textMuted}
            value={usernameOrEmail}
            onChangeText={setUsernameOrEmail}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Contraseña</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.textPrimary }]}
            placeholder="Tu contraseña"
            placeholderTextColor={theme.textMuted}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
          /><TouchableOpacity accessibilityLabel={showPassword?'Ocultar contraseña':'Mostrar contraseña'} onPress={()=>setShowPassword(value=>!value)}><Ionicons name={showPassword?'eye-off-outline':'eye-outline'} size={21} color={theme.textMuted}/></TouchableOpacity></View>
        </View>

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: theme.primary }]} 
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
        <Text style={[styles.footerText, { color: theme.textMuted }]}>
          ¿No tienes una cuenta? <Text style={[styles.signUpText, { color: theme.accent }]}>Regístrate</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    gap: 16,
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
  passwordBox:{height:50,borderWidth:1,borderRadius:14,paddingHorizontal:16,flexDirection:'row',alignItems:'center'},passwordInput:{flex:1,fontSize:14},
  button: {
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
    fontSize: 13,
  },
  signUpText: {
    fontWeight: 'bold',
  },
});
