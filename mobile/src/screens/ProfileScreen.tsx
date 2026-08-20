import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { VideoView, useVideoPlayer } from "expo-video";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../theme";
import UserAvatar from "../components/UserAvatar";

interface ProfileData {
  userId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl?: string;
  isPrivate: boolean;
  canViewContent: boolean;
  relationshipStatus: "NONE" | "PENDING" | "FOLLOWING";
  postCount: number;
  followersCount: number;
  followingCount: number;
}
function ProfileVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={styles.media}
    />
  );
}

export default function ProfileScreen({
  username,
  onLogout,
  onBack,
  onMessage,
  onOpenPost,
  onOpenCircle,
}: {
  username?: string;
  onLogout?: () => void;
  onBack?: () => void;
  onMessage?: (identity: {
    username: string;
    displayName: string;
    avatarUrl?: string;
  }) => void;
  onOpenPost?: (postId: string) => void;
  onOpenCircle?: (slug: string) => void;
}) {
  const { api, user: currentUser, updateUserProfile } = useAuth();
  const { theme } = useAppTheme();
  const target = username || currentUser?.username || "";
  const self = target.toLowerCase() === currentUser?.username.toLowerCase();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [circles, setCircles] = useState<any[]>([]);
  const [tab, setTab] = useState<"POSTS" | "CIRCLES">("POSTS");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [postsError, setPostsError] = useState("");
  const [actionError, setActionError] = useState("");
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [privateValue, setPrivateValue] = useState(false);
  const [avatar, setAvatar] = useState<ImagePicker.ImagePickerAsset | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setProfileError("");
    try {
      const res = await api.get(`/profiles/${encodeURIComponent(target)}`);
      const value = res.data as ProfileData;
      setProfile(value);
      setDisplayName(value.displayName || "");
      setBio(value.bio || "");
      setPrivateValue(value.isPrivate);
      if (value.canViewContent) {
        try {
          const postRes = await api.get(
            `/posts/user/${encodeURIComponent(target)}`,
          );
          setPosts(
            postRes.data?.posts ||
              postRes.data?.content ||
              (Array.isArray(postRes.data) ? postRes.data : []),
          );
          setPostsError("");
        } catch (requestError: any) {
          console.error(requestError);
          setPostsError(
            requestError.response?.status === 403
              ? "El acceso a estos Momentos cambió. Actualiza el perfil."
              : requestError.response?.status === 404
                ? "No se encontró el contenido del perfil."
                : "No se pudieron cargar los Momentos.",
          );
        }
        try {
          const circleRes = await api.get(
            `/circles/user/${encodeURIComponent(target)}`,
          );
          setCircles(circleRes.data || []);
        } catch (requestError) {
          console.error(requestError);
        }
      } else {
        setPosts([]);
        setCircles([]);
        setPostsError("");
      }
    } catch (requestError: any) {
      console.error(requestError);
      setProfile(null);
      setProfileError(
        requestError.response?.status === 404
          ? "Usuario no encontrado"
          : "No se pudo cargar el perfil",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, target]);
  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);
  const follow = async () => {
    if (!profile) return;
    setActionError("");
    try {
      if (profile.relationshipStatus === "FOLLOWING") {
        await api.post(`/social/unfollow/${profile.username}`);
        setProfile({
          ...profile,
          relationshipStatus: "NONE",
          followersCount: Math.max(0, profile.followersCount - 1),
        });
      } else if (profile.relationshipStatus === "NONE") {
        const res = await api.post(`/social/follow/${profile.username}`);
        const status = res.data.status === "PENDING" ? "PENDING" : "FOLLOWING";
        setProfile({
          ...profile,
          relationshipStatus: status,
          canViewContent: status === "FOLLOWING" || profile.canViewContent,
          followersCount:
            status === "FOLLOWING"
              ? profile.followersCount + 1
              : profile.followersCount,
        });
        if (status === "FOLLOWING") void load();
      }
    } catch (requestError: any) {
      setActionError(
        requestError.response?.data?.message ||
          "No se pudo actualizar el seguimiento.",
      );
    }
  };
  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return setActionError("No pudimos acceder a tus fotos.");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled) setAvatar(result.assets[0]);
  };
  const save = async () => {
    if (!profile) return;
    setSaving(true);
    setActionError("");
    try {
      let res;
      if (avatar) {
        const data = new FormData();
        data.append("displayName", displayName.trim());
        data.append("bio", bio.trim());
        data.append("isPrivate", String(privateValue));
        data.append("avatar", {
          uri:
            Platform.OS === "ios"
              ? avatar.uri.replace("file://", "")
              : avatar.uri,
          name: avatar.fileName || `avatar_${Date.now()}.jpg`,
          type: avatar.mimeType || "image/jpeg",
        } as any);
        res = await api.patch("/profiles/me", data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else
        res = await api.put("/profiles/me", {
          displayName: displayName.trim(),
          bio: bio.trim(),
          isPrivate: privateValue,
        });
      setProfile({ ...profile, ...res.data });
      await updateUserProfile({
        displayName: res.data.displayName,
        avatarUrl: res.data.avatarUrl,
      });
      setAvatar(null);
      setEditing(false);
      await load();
    } catch (requestError: any) {
      setActionError(
        requestError.response?.data?.message || "No se pudo guardar el perfil.",
      );
    } finally {
      setSaving(false);
    }
  };
  const removePost = (postId: string) =>
    Alert.alert(
      "¿Eliminar este Momento?",
      "Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/posts/${postId}`);
              setPosts((old) => old.filter((post) => post.postId !== postId));
              setProfile((old) =>
                old
                  ? { ...old, postCount: Math.max(0, old.postCount - 1) }
                  : old,
              );
            } catch {
              setActionError("No se pudo eliminar el Momento.");
            }
          },
        },
      ],
    );
  if (loading)
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  if (!profile)
    return (
      <View
        style={[styles.center, { backgroundColor: theme.background, gap: 12 }]}
      >
        <Ionicons
          name="alert-circle-outline"
          size={38}
          color={theme.textMuted}
        />
        <Text style={{ color: theme.textPrimary, fontWeight: "800" }}>
          {profileError}
        </Text>
        <TouchableOpacity
          onPress={() => {
            setLoading(true);
            void load();
          }}
          style={[styles.primary, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.primaryText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  const blocked = profile.isPrivate && !profile.canViewContent;
  const header = (
    <>
      <View style={[styles.top, { borderColor: theme.border }]}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.icon}>
            <Ionicons name="arrow-back" size={23} color={theme.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.icon} />
        )}
        <Text style={[styles.topTitle, { color: theme.textPrimary }]}>
          @{profile.username}
        </Text>
        {self && onLogout ? (
          <TouchableOpacity onPress={onLogout} style={styles.icon}>
            <Ionicons name="log-out-outline" size={22} color={theme.danger} />
          </TouchableOpacity>
        ) : (
          <View style={styles.icon} />
        )}
      </View>
      <View style={styles.cover}>
        <View style={styles.identity}>
          <UserAvatar
            avatarUrl={profile.avatarUrl}
            displayName={profile.displayName}
            username={profile.username}
            size={94}
          />
          <View style={styles.names}>
            <View style={styles.greenName}>
              <Text numberOfLines={1} style={styles.displayName}>
                {profile.displayName || profile.username}
                {profile.isPrivate ? "  🔒" : ""}
              </Text>
            </View>
            <Text style={[styles.handle, { color: theme.textMuted }]}>
              @{profile.username}
            </Text>
          </View>
        </View>
      </View>
      <View style={[styles.profileBody, { backgroundColor: theme.surface }]}>
        {profile.bio ? (
          <Text style={[styles.bio, { color: theme.textSecondary }]}>
            {profile.bio}
          </Text>
        ) : null}
        <View style={[styles.stats, { borderColor: theme.border }]}>
          {[
            ["Momentos", profile.postCount],
            ["Seguidores", profile.followersCount],
            ["Siguiendo", profile.followingCount],
          ].map(([label, value]) => (
            <View key={String(label)} style={styles.stat}>
              <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                {value}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>
                {label}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.buttons}>
          {self ? (
            <TouchableOpacity
              onPress={() => setEditing(true)}
              style={[styles.secondary, { borderColor: theme.border }]}
            >
              <Text style={{ color: theme.textPrimary, fontWeight: "800" }}>
                Editar perfil
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                disabled={profile.relationshipStatus === "PENDING"}
                onPress={() => void follow()}
                style={[
                  styles.primary,
                  {
                    backgroundColor:
                      profile.relationshipStatus === "PENDING"
                        ? theme.border
                        : theme.primary,
                  },
                ]}
              >
                <Text style={styles.primaryText}>
                  {profile.relationshipStatus === "PENDING"
                    ? "Solicitud enviada"
                    : profile.relationshipStatus === "FOLLOWING"
                      ? "Siguiendo"
                      : "Seguir"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onMessage?.({
                  username: profile.username,
                  displayName: profile.displayName || profile.username,
                  avatarUrl: profile.avatarUrl,
                })}
                style={[styles.secondary, { borderColor: theme.border }]}
              >
                <Text style={{ color: theme.textPrimary, fontWeight: "800" }}>
                  Mensaje
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        {actionError ? (
          <TouchableOpacity onPress={() => setActionError("")}>
            <Text style={styles.error}>{actionError}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {blocked ? (
        <View
          style={[
            styles.privateCard,
            { backgroundColor: theme.surface, borderColor: theme.border },
          ]}
        >
          <Ionicons
            name="lock-closed-outline"
            size={35}
            color={theme.textMuted}
          />
          <Text style={[styles.privateTitle, { color: theme.textPrimary }]}>
            Esta cuenta es privada
          </Text>
          <Text
            style={[styles.privateDescription, { color: theme.textSecondary }]}
          >
            Sigue a @{profile.username} para ver sus Momentos y contenido.
          </Text>
          {profile.relationshipStatus !== "FOLLOWING" ? (
            <TouchableOpacity
              disabled={profile.relationshipStatus === "PENDING"}
              onPress={() => void follow()}
              style={[
                styles.primary,
                {
                  backgroundColor:
                    profile.relationshipStatus === "PENDING"
                      ? theme.border
                      : theme.primary,
                },
              ]}
            >
              <Text style={styles.primaryText}>
                {profile.relationshipStatus === "PENDING"
                  ? "Solicitud enviada"
                  : "Seguir"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View style={[styles.tabs, { borderColor: theme.border }]}>
          <TouchableOpacity
            onPress={() => setTab("POSTS")}
            style={[
              styles.tab,
              tab === "POSTS" && { borderColor: theme.accent },
            ]}
          >
            <Text
              style={{
                color: tab === "POSTS" ? theme.accent : theme.textMuted,
                fontWeight: "800",
              }}
            >
              Momentos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab("CIRCLES")}
            style={[
              styles.tab,
              tab === "CIRCLES" && { borderColor: theme.accent },
            ]}
          >
            <Text
              style={{
                color: tab === "CIRCLES" ? theme.accent : theme.textMuted,
                fontWeight: "800",
              }}
            >
              Círculos
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
  const data = blocked ? [] : tab === "POSTS" ? posts : circles;
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={data}
        keyExtractor={(item) => (tab === "POSTS" ? item.postId : item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={theme.accent}
          />
        }
        ListHeaderComponent={header}
        renderItem={({ item }) =>
          tab === "CIRCLES" ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => onOpenCircle?.(item.slug)}
              style={[
                styles.circleCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <UserAvatar
                avatarUrl={item.avatarUrl}
                displayName={item.name}
                size={46}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.textPrimary, fontWeight: "800" }}>
                  {item.name}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{ color: theme.textMuted, fontSize: 12 }}
                >
                  {item.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => onOpenPost?.(item.postId)}
              style={[
                styles.post,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={styles.author}>
                <UserAvatar
                  avatarUrl={item.avatarUrl || profile.avatarUrl}
                  displayName={item.displayName || profile.displayName}
                  username={profile.username}
                  size={38}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: theme.textPrimary, fontWeight: "800" }}>
                    {item.displayName || profile.displayName}
                  </Text>
                  <Text style={{ color: theme.textMuted, fontSize: 11 }}>
                    @{item.username || profile.username}
                  </Text>
                </View>
                {self ? (
                  <TouchableOpacity onPress={() => removePost(item.postId)}>
                    <Ionicons
                      name="trash-outline"
                      size={19}
                      color={theme.danger}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
              {item.caption ? (
                <Text style={{ color: theme.textPrimary, lineHeight: 20 }}>
                  {item.caption}
                </Text>
              ) : null}
              {item.mediaUrls?.map((uri: string, index: number) =>
                item.mediaTypes?.[index] === "VIDEO" ? (
                  <ProfileVideo key={uri} uri={uri} />
                ) : (
                  <Image
                    key={uri}
                    source={{ uri }}
                    style={styles.media}
                    resizeMode="contain"
                  />
                ),
              )}
            </TouchableOpacity>
          )
        }
        ListEmptyComponent={
          !blocked ? (
            <View style={styles.empty}>
              {postsError && tab === "POSTS" ? (
                <>
                  <Text style={{ color: theme.textPrimary, fontWeight: "800" }}>
                    No se pudieron cargar los Momentos.
                  </Text>
                  <TouchableOpacity onPress={() => void load()}>
                    <Text style={{ color: theme.accent, marginTop: 8 }}>
                      Reintentar
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Ionicons
                    name={tab === "POSTS" ? "grid-outline" : "people-outline"}
                    size={35}
                    color={theme.textMuted}
                  />
                  <Text
                    style={{
                      color: theme.textPrimary,
                      fontWeight: "800",
                      marginTop: 8,
                    }}
                  >
                    {tab === "POSTS"
                      ? "No hay momentos publicados aún"
                      : "No hay Círculos visibles"}
                  </Text>
                </>
              )}
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      />
      <Modal
        visible={editing}
        animationType="slide"
        onRequestClose={() => !saving && setEditing(false)}
      >
        <View style={[styles.edit, { backgroundColor: theme.background }]}>
          <View style={styles.editHeader}>
            <TouchableOpacity onPress={() => setEditing(false)}>
              <Ionicons name="close" size={25} color={theme.textPrimary} />
            </TouchableOpacity>
            <Text
              style={{
                color: theme.textPrimary,
                fontWeight: "900",
                fontSize: 17,
              }}
            >
              Editar perfil
            </Text>
            <TouchableOpacity disabled={saving} onPress={() => void save()}>
              <Text style={{ color: theme.accent, fontWeight: "900" }}>
                {saving ? "Guardando…" : "Guardar"}
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            onPress={() => void pickAvatar()}
            style={{ alignSelf: "center" }}
          >
            <UserAvatar
              avatarUrl={avatar?.uri || profile.avatarUrl}
              displayName={profile.displayName}
              username={profile.username}
              size={96}
            />
            <View style={[styles.camera, { backgroundColor: theme.primary }]}>
              <Ionicons name="camera" size={17} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Nombre
          </Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            style={[
              styles.editInput,
              {
                color: theme.textPrimary,
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          />
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Bio
          </Text>
          <TextInput
            multiline
            value={bio}
            onChangeText={setBio}
            style={[
              styles.editInput,
              styles.bioInput,
              {
                color: theme.textPrimary,
                backgroundColor: theme.surface,
                borderColor: theme.border,
              },
            ]}
          />
          <View
            style={[
              styles.privacy,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.textPrimary, fontWeight: "800" }}>
                Perfil privado
              </Text>
              <Text
                style={{ color: theme.textMuted, fontSize: 11, marginTop: 2 }}
              >
                Solo seguidores aprobados ven tu contenido
              </Text>
            </View>
            <Switch
              value={privateValue}
              onValueChange={setPrivateValue}
              trackColor={{ false: theme.border, true: theme.primary }}
            />
          </View>
          {actionError ? <Text style={styles.error}>{actionError}</Text> : null}
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  top: {
    height: 56,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  icon: { width: 40, alignItems: "center" },
  topTitle: { fontSize: 15, fontWeight: "900" },
  cover: {
    height: 144,
    backgroundColor: "#0f766e",
    justifyContent: "flex-end",
  },
  identity: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 20,
    transform: [{ translateY: 45 }],
  },
  names: { flex: 1, marginLeft: 14, paddingBottom: 5 },
  greenName: { height: 47, justifyContent: "flex-end" },
  displayName: { color: "#fff", fontSize: 22, fontWeight: "900" },
  handle: { fontSize: 13, marginTop: 5 },
  profileBody: { paddingTop: 54, paddingHorizontal: 18, paddingBottom: 16 },
  bio: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  stats: { flexDirection: "row", borderWidth: 1, borderRadius: 16 },
  stat: { flex: 1, alignItems: "center", paddingVertical: 11 },
  statValue: { fontSize: 17, fontWeight: "900" },
  statLabel: { fontSize: 10, fontWeight: "700" },
  buttons: { flexDirection: "row", gap: 9, marginTop: 14 },
  primary: {
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  primaryText: { color: "#fff", fontWeight: "800" },
  secondary: {
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  error: { color: "#ef4444", textAlign: "center", marginTop: 10 },
  privateCard: {
    margin: 16,
    borderWidth: 1,
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    gap: 9,
  },
  privateTitle: { fontSize: 17, fontWeight: "900" },
  privateDescription: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: {
    flex: 1,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderColor: "transparent",
  },
  post: { padding: 15, borderBottomWidth: 1, gap: 12 },
  author: { flexDirection: "row", alignItems: "center", gap: 10 },
  media: {
    height: 310,
    width: "100%",
    backgroundColor: "#000",
    borderRadius: 14,
  },
  circleCard: {
    marginHorizontal: 14,
    marginTop: 12,
    padding: 13,
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  empty: { alignItems: "center", padding: 40 },
  edit: { flex: 1, padding: 18, gap: 10 },
  editHeader: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  camera: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 12, fontWeight: "800", marginTop: 8 },
  editInput: {
    height: 48,
    borderRadius: 13,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  bioInput: { height: 110, paddingTop: 12, textAlignVertical: "top" },
  privacy: {
    marginTop: 8,
    padding: 15,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
});
