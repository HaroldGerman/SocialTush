import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useAppTheme } from '../theme';

const interests = [
  ['Tecnología', 'hardware-chip-outline'], ['Arte', 'color-palette-outline'], ['Música', 'musical-notes-outline'],
  ['Fotografía', 'camera-outline'], ['Viajes', 'airplane-outline'], ['Deportes', 'fitness-outline'],
] as const;
const goals = [
  ['learn', 'Aprender y descubrir'], ['share', 'Compartir mis ideas'], ['connect', 'Conocer personas'],
] as const;

export default function OnboardingScreen() {
  const { api, completeRegistrationOnboarding } = useAuth();
  const { theme } = useAppTheme();
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [goal, setGoal] = useState('learn');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const finish = async () => {
    setSubmitting(true); setError('');
    try {
      await api.post('/profiles/onboarding', { interests: selected, circles: [], socialGoal: goal });
      await completeRegistrationOnboarding();
    } catch (requestError) {
      console.error(requestError);
      setError('No se pudo completar el onboarding. Inténtalo nuevamente.');
    } finally { setSubmitting(false); }
  };

  return <ScrollView contentContainerStyle={[styles.container, { backgroundColor: theme.background }]} keyboardShouldPersistTaps="handled">
    <View style={[styles.logo, { backgroundColor: theme.primary }]}><Text style={styles.logoText}>L</Text></View>
    <Text style={[styles.eyebrow, { color: theme.accent }]}>PASO {step} DE 2</Text>
    <Text style={[styles.title, { color: theme.textPrimary }]}>{step === 1 ? '¿Qué te inspira?' : '¿Qué buscas en Lifonk?'}</Text>
    <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{step === 1 ? 'Elige tus intereses para personalizar tu experiencia.' : 'Esto nos ayuda a preparar tu inicio.'}</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {step === 1 ? <View style={styles.grid}>{interests.map(([label, icon]) => { const active = selected.includes(label); return <TouchableOpacity key={label} onPress={() => setSelected(old => active ? old.filter(item => item !== label) : [...old, label])} style={[styles.option, { backgroundColor: active ? theme.primary : theme.surface, borderColor: active ? theme.accent : theme.border }]}><Ionicons name={icon} size={22} color={active ? '#fff' : theme.accent}/><Text style={{ color: active ? '#fff' : theme.textPrimary, fontWeight: '700' }}>{label}</Text></TouchableOpacity>; })}</View> : <View style={styles.goalList}>{goals.map(([value, label]) => <TouchableOpacity key={value} onPress={() => setGoal(value)} style={[styles.goal, { backgroundColor: theme.surface, borderColor: goal === value ? theme.accent : theme.border }]}><Ionicons name={goal === value ? 'radio-button-on' : 'radio-button-off'} size={22} color={theme.accent}/><Text style={{ color: theme.textPrimary, fontWeight: '700' }}>{label}</Text></TouchableOpacity>)}</View>}
    <TouchableOpacity disabled={submitting} onPress={() => step === 1 ? setStep(2) : void finish()} style={[styles.continue, { backgroundColor: theme.primary }, submitting && { opacity: .6 }]}>{submitting ? <ActivityIndicator color="#fff"/> : <Text style={styles.continueText}>{step === 1 ? 'Continuar' : 'Entrar a Lifonk'}</Text>}</TouchableOpacity>
  </ScrollView>;
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 24 },
  logoText: { color: '#fff', fontSize: 26, fontWeight: '900' }, eyebrow: { fontSize: 11, fontWeight: '900', textAlign: 'center', letterSpacing: 1.5 },
  title: { fontSize: 27, fontWeight: '900', textAlign: 'center', marginTop: 8 }, subtitle: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 7, marginBottom: 22 },
  error: { color: '#ef4444', textAlign: 'center', marginBottom: 12 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  option: { width: '48%', minHeight: 78, borderWidth: 1, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 7 },
  goalList: { gap: 10 }, goal: { minHeight: 58, borderWidth: 1, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  continue: { minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 24 }, continueText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
