import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../theme";
import UserAvatar from "../components/UserAvatar";

const INTERESTS = [
  { id: "tech", label: "💻 Tecnología", desc: "IA, código y gadgets" },
  { id: "gaming", label: "🎮 Gaming", desc: "PC, consolas y eSports" },
  {
    id: "music",
    label: "🎵 Música",
    desc: "Géneros, playlists e instrumentos",
  },
  {
    id: "anime",
    label: "⛩️ Anime & Manga",
    desc: "Series, cultura y discusión",
  },
  { id: "photo", label: "📷 Fotografía", desc: "Capturas, edición y galerías" },
  {
    id: "science",
    label: "🔬 Ciencia",
    desc: "Universo, biología e investigación",
  },
  { id: "travel", label: "✈️ Viajes", desc: "Rutas, destinos y consejos" },
  {
    id: "fitness",
    label: "💪 Fitness & Salud",
    desc: "Deporte, nutrición y rutinas",
  },
  {
    id: "art",
    label: "🎨 Arte & Diseño",
    desc: "Ilustración, UI/UX y creación",
  },
  {
    id: "code",
    label: "👨‍💻 Programación",
    desc: "Java, React, WebSockets y backend",
  },
  {
    id: "cinema",
    label: "🎬 Cine & Series",
    desc: "Películas, críticas y debates",
  },
  {
    id: "nature",
    label: "🌿 Naturaleza",
    desc: "Ecología, senderismo y medio ambiente",
  },
];
const GOALS = [
  {
    id: "learn",
    title: "🧠 Aprender cosas nuevas",
    desc: "Descubrir contenido educativo y tutoriales",
  },
  {
    id: "chat",
    title: "💬 Conversar y debatir",
    desc: "Participar en conversaciones en tiempo real",
  },
  {
    id: "people",
    title: "👥 Conocer personas",
    desc: "Conectar con integrantes de tus intereses",
  },
  {
    id: "share",
    title: "✨ Compartir contenido",
    desc: "Publicar proyectos, imágenes y notas de audio",
  },
  {
    id: "collab",
    title: "🤝 Colaborar en proyectos",
    desc: "Unirte a iniciativas comunitarias",
  },
  {
    id: "events",
    title: "📅 Encontrar eventos locales",
    desc: "Descubrir encuentros presenciales y virtuales",
  },
];
interface Circle {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  membersCount: number;
}

export default function OnboardingScreen() {
  const { api, completeRegistrationOnboarding } = useAuth();
  const { theme } = useAppTheme();
  const [step, setStep] = useState(1);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [circles, setCircles] = useState<Circle[]>([]);
  const [selectedCircles, setSelectedCircles] = useState<string[]>([]);
  const [goal, setGoal] = useState("learn");
  const [loadingCircles, setLoadingCircles] = useState(true);
  const [circleError, setCircleError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const loadCircles = useCallback(async () => {
    setLoadingCircles(true);
    setCircleError("");
    try {
      const res = await api.get("/circles");
      setCircles(res.data || []);
    } catch (requestError) {
      console.error(requestError);
      setCircleError("No se pudieron cargar los Círculos.");
    } finally {
      setLoadingCircles(false);
    }
  }, [api]);
  useEffect(() => {
    void loadCircles();
  }, [loadCircles]);
  const toggle = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) =>
    setter((old) =>
      old.includes(value)
        ? old.filter((item) => item !== value)
        : [...old, value],
    );
  const finish = async () => {
    setSubmitting(true);
    setError("");
    try {
      await api.post("/profiles/onboarding", {
        interests: selectedInterests,
        circles: selectedCircles,
        socialGoal: goal,
      });
      await completeRegistrationOnboarding();
    } catch (requestError: any) {
      console.error(requestError);
      setError(
        requestError.response?.data?.message ||
          "No se pudo completar el onboarding. Inténtalo nuevamente.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  const titles = [
    [
      "¿Qué temas te interesan? 💡",
      "Selecciona temas para personalizar tu feed inicial.",
    ],
    [
      "Únete a tus primeros Círculos ⭕",
      "Elige comunidades reales disponibles en Lifonk.",
    ],
    [
      "Conecta con tu comunidad 👥",
      "Tu red se construirá con personas y Círculos que realmente elijas.",
    ],
    [
      "¿Qué buscas en Lifonk? 🎯",
      "Esto ayudará a personalizar tu experiencia.",
    ],
  ];
  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: theme.background },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: theme.primary }]}>
          <Text style={styles.logoText}>L</Text>
        </View>
        <View>
          <Text style={[styles.brandName, { color: theme.textPrimary }]}>
            Lifonk
          </Text>
          <Text style={[styles.brandSub, { color: theme.textMuted }]}>
            BIENVENIDA PERSONALIZADA
          </Text>
        </View>
      </View>
      <View style={styles.progress}>
        {[1, 2, 3, 4].map((value) => (
          <View
            key={value}
            style={[
              styles.progressItem,
              { backgroundColor: value <= step ? theme.primary : theme.border },
              value === step && styles.progressActive,
            ]}
          />
        ))}
      </View>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.eyebrow, { color: theme.accent }]}>
          PASO {step} DE 4
        </Text>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          {titles[step - 1][0]}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {titles[step - 1][1]}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {step === 1 ? (
          <View style={styles.grid}>
            {INTERESTS.map((item) => {
              const active = selectedInterests.includes(item.id);
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => toggle(item.id, setSelectedInterests)}
                  style={[
                    styles.interest,
                    {
                      backgroundColor: active
                        ? theme.surfaceSecondary
                        : theme.background,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <View style={styles.itemHeader}>
                    <Text
                      style={[styles.itemTitle, { color: theme.textPrimary }]}
                    >
                      {item.label}
                    </Text>
                    {active ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={theme.accent}
                      />
                    ) : null}
                  </View>
                  <Text
                    style={[styles.itemDescription, { color: theme.textMuted }]}
                  >
                    {item.desc}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        {step === 2 ? (
          <View style={styles.list}>
            {loadingCircles ? (
              <ActivityIndicator color={theme.accent} />
            ) : circleError ? (
              <View style={styles.center}>
                <Text style={styles.error}>{circleError}</Text>
                <TouchableOpacity onPress={() => void loadCircles()}>
                  <Text style={{ color: theme.accent, fontWeight: "800" }}>
                    Reintentar
                  </Text>
                </TouchableOpacity>
              </View>
            ) : circles.length ? (
              circles.map((circle) => {
                const active = selectedCircles.includes(circle.name);
                return (
                  <TouchableOpacity
                    key={circle.id}
                    onPress={() => toggle(circle.name, setSelectedCircles)}
                    style={[
                      styles.circle,
                      {
                        backgroundColor: theme.background,
                        borderColor: active ? theme.primary : theme.border,
                      },
                    ]}
                  >
                    <UserAvatar
                      avatarUrl={circle.avatarUrl}
                      displayName={circle.name}
                      size={44}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[styles.itemTitle, { color: theme.textPrimary }]}
                      >
                        {circle.name}
                      </Text>
                      <Text style={[styles.members, { color: theme.accent }]}>
                        {circle.membersCount} {circle.membersCount === 1 ? "integrante" : "integrantes"}
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={[
                          styles.itemDescription,
                          { color: theme.textMuted },
                        ]}
                      >
                        {circle.description || "Comunidad de Lifonk"}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.join,
                        {
                          backgroundColor: active
                            ? theme.primary
                            : theme.border,
                          color: active ? "#fff" : theme.textPrimary,
                        },
                      ]}
                    >
                      {active ? "Unido" : "Unirme"}
                    </Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Text style={[styles.empty, { color: theme.textMuted }]}>
                No hay Círculos públicos disponibles todavía.
              </Text>
            )}
          </View>
        ) : null}
        {step === 3 ? (
          <View style={styles.peopleStep}>
            <View
              style={[
                styles.peopleIcon,
                { backgroundColor: theme.surfaceSecondary },
              ]}
            >
              <Ionicons name="people-outline" size={46} color={theme.accent} />
            </View>
            <Text style={[styles.peopleTitle, { color: theme.textPrimary }]}>
              Conexiones reales, sin perfiles inventados
            </Text>
            <Text style={[styles.peopleCopy, { color: theme.textSecondary }]}>
              Al entrar podrás descubrir personas reales desde Buscar, abrir sus
              perfiles y seguirlas según sus preferencias de privacidad.
            </Text>
          </View>
        ) : null}
        {step === 4 ? (
          <View style={styles.list}>
            {GOALS.map((item) => {
              const active = goal === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setGoal(item.id)}
                  style={[
                    styles.goal,
                    {
                      backgroundColor: theme.background,
                      borderColor: active ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.itemTitle, { color: theme.textPrimary }]}
                    >
                      {item.title}
                    </Text>
                    <Text
                      style={[
                        styles.itemDescription,
                        { color: theme.textMuted },
                      ]}
                    >
                      {item.desc}
                    </Text>
                  </View>
                  <Ionicons
                    name={active ? "radio-button-on" : "radio-button-off"}
                    size={22}
                    color={theme.accent}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        <View style={[styles.navigation, { borderColor: theme.border }]}>
          {step > 1 ? (
            <TouchableOpacity
              onPress={() => setStep((value) => value - 1)}
              style={[styles.back, { backgroundColor: theme.surfaceSecondary }]}
            >
              <Text style={{ color: theme.textPrimary, fontWeight: "800" }}>
                Anterior
              </Text>
            </TouchableOpacity>
          ) : (
            <View />
          )}
          <TouchableOpacity
            disabled={submitting}
            onPress={() =>
              step < 4 ? setStep((value) => value + 1) : void finish()
            }
            style={[
              styles.next,
              { backgroundColor: theme.primary },
              submitting && { opacity: 0.6 },
            ]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.nextText}>
                {step < 4 ? "Siguiente" : "Comenzar en Lifonk"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      <Text style={[styles.footer, { color: theme.textMuted }]}>
        Lifonk • Tu comunidad, tu gente, tus momentos.
      </Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 18 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#fff", fontSize: 20, fontWeight: "900" },
  brandName: { fontSize: 20, fontWeight: "900" },
  brandSub: { fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  progress: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 6,
    marginVertical: 16,
  },
  progressItem: { width: 16, height: 7, borderRadius: 4 },
  progressActive: { width: 32 },
  card: { borderWidth: 1, borderRadius: 24, padding: 18 },
  eyebrow: { fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  title: { fontSize: 23, fontWeight: "900", marginTop: 5 },
  subtitle: { fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 18 },
  error: { color: "#ef4444", textAlign: "center", marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  interest: {
    width: "48%",
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 15,
    padding: 12,
  },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", gap: 4 },
  itemTitle: { fontSize: 13, fontWeight: "900", flexShrink: 1 },
  itemDescription: { fontSize: 10, lineHeight: 15, marginTop: 5 },
  list: { gap: 10 },
  circle: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  members: { fontSize: 10, fontWeight: "800", marginTop: 2 },
  join: {
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    fontSize: 10,
    fontWeight: "900",
  },
  center: { alignItems: "center", gap: 9, padding: 20 },
  empty: { textAlign: "center", padding: 24 },
  peopleStep: { alignItems: "center", paddingVertical: 30 },
  peopleIcon: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  peopleTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginTop: 18,
    textAlign: "center",
  },
  peopleCopy: {
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 8,
  },
  goal: {
    minHeight: 70,
    borderWidth: 1,
    borderRadius: 15,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  navigation: {
    borderTopWidth: 1,
    marginTop: 20,
    paddingTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  back: {
    minHeight: 43,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  next: {
    minHeight: 43,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  nextText: { color: "#fff", fontWeight: "900" },
  footer: { fontSize: 10, textAlign: "center", marginVertical: 18 },
});
