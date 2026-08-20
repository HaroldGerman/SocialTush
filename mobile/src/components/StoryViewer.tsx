import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useAuth } from "../context/AuthContext";
import UserAvatar from "./UserAvatar";

export interface MobileStory {
  storyId: string;
  mediaType: string;
  mediaUrl?: string;
  textContent?: string;
  backgroundColor?: string;
  createdAt?: string;
  overlayData?: string;
}
export interface MobileStoryGroup {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  stories: MobileStory[];
}

function StoryVideo({
  uri,
  paused,
  onDuration,
}: {
  uri: string;
  paused: boolean;
  onDuration: (seconds: number) => void;
}) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = false;
    instance.play();
  });
  useEffect(() => {
    paused ? player.pause() : player.play();
  }, [paused, player]);
  useEffect(() => {
    const subscription = player.addListener("statusChange", ({ status }) => {
      if (status === "readyToPlay" && player.duration > 0)
        onDuration(player.duration);
    });
    return () => subscription.remove();
  }, [player, onDuration]);
  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
    />
  );
}

export default function StoryViewer({
  visible,
  groups,
  initialIndex,
  onClose,
  onStoriesChange,
}: {
  visible: boolean;
  groups: MobileStoryGroup[];
  initialIndex: number;
  onClose: () => void;
  onStoriesChange: (groups: MobileStoryGroup[]) => void;
}) {
  const { api, user } = useAuth();
  const [userIndex, setUserIndex] = useState(initialIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(5);
  const [menu, setMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  useEffect(() => {
    setUserIndex(initialIndex);
    setStoryIndex(0);
    setProgress(0);
  }, [initialIndex, visible]);
  const group = groups[userIndex];
  const story = group?.stories[storyIndex];
  const overlays = useMemo(() => {
    if (!story?.overlayData) return [];
    try {
      const value = JSON.parse(story.overlayData);
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }, [story?.overlayData]);
  const own = Boolean(
    user &&
      group &&
      ((user.userId &&
        group.userId &&
        String(user.userId) === String(group.userId)) ||
        user.username.toLowerCase() === group.username.toLowerCase()),
  );
  const next = () => {
    if (!group) return;
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((value) => value + 1);
      setProgress(0);
    } else if (userIndex < groups.length - 1) {
      setUserIndex((value) => value + 1);
      setStoryIndex(0);
      setProgress(0);
    } else onClose();
  };
  useEffect(() => {
    if (!visible || !story || paused || menu || viewersOpen) return;
    const timer = setInterval(
      () =>
        setProgress((value) => {
          if (value >= 100) {
            setTimeout(next, 0);
            return 0;
          }
          return value + 100 / (duration * 10);
        }),
      100,
    );
    return () => clearInterval(timer);
  }, [visible, story?.storyId, paused, menu, viewersOpen, duration]);
  useEffect(() => {
    if (story && !own)
      api
        .post(`/stories/${story.storyId}/view`)
        .catch((requestError: any) =>
          console.error("No se pudo registrar la vista:", requestError),
        );
  }, [story?.storyId, own]);
  const deleteStory = async () => {
    if (!story || !group) return;
    setDeleting(true);
    setError("");
    try {
      await api.delete(`/stories/${story.storyId}`);
      const remaining = group.stories.filter(
        (item) => item.storyId !== story.storyId,
      );
      const nextGroups = remaining.length
        ? groups.map((item, index) =>
            index === userIndex ? { ...item, stories: remaining } : item,
          )
        : groups.filter((_, index) => index !== userIndex);
      onStoriesChange(nextGroups);
      setMenu(false);
      if (!remaining.length) {
        onClose();
        return;
      }
      setStoryIndex((index) => Math.min(index, remaining.length - 1));
      setProgress(0);
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message ||
          "No se pudo eliminar el momento.",
      );
    } finally {
      setDeleting(false);
    }
  };
  const confirmDelete = () =>
    Alert.alert(
      "¿Eliminar este momento?",
      "Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => void deleteStory(),
        },
      ],
    );
  const openViewers = async () => {
    if (!story || !own) return;
    setMenu(false);
    setViewersOpen(true);
    setPaused(true);
    setViewersLoading(true);
    setError("");
    try {
      const response = await api.get(`/stories/${story.storyId}/viewers`);
      setViewers(response.data || []);
    } catch (requestError: any) {
      setError(requestError.response?.data?.message || "No se pudieron cargar las vistas.");
    } finally {
      setViewersLoading(false);
    }
  };
  const sendReply = async () => {
    if (!reply.trim() || !story || own) return;
    const content = reply.trim();
    try {
      await api.post(
        `/chat/direct/${encodeURIComponent(group.username)}/messages`,
        { content, messageType: "STORY_REPLY", storyPreviewId: story.storyId },
      );
      setReply("");
      setError("");
    } catch (requestError: any) {
      setError(
        requestError.response?.data?.message ||
          "No se pudo enviar la respuesta.",
      );
    }
  };
  if (!group || !story) return null;
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View
        style={[
          styles.container,
          {
            backgroundColor:
              story.mediaType === "TEXT"
                ? story.backgroundColor || "#0f766e"
                : "#000",
          },
        ]}
      >
        {story.mediaType === "VIDEO" && story.mediaUrl ? (
          <StoryVideo
            uri={story.mediaUrl}
            paused={paused || menu}
            onDuration={setDuration}
          />
        ) : story.mediaType === "IMAGE" && story.mediaUrl ? (
          <Image
            source={{ uri: story.mediaUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
          />
        ) : story.mediaType === "TEXT" ? (
          <View style={styles.textStory}>
            <Text style={styles.storyText}>{story.textContent}</Text>
          </View>
        ) : null}
        {overlays.map((item: any) => (
          <View
            key={item.id}
            pointerEvents="none"
            style={[
              styles.overlayItem,
              {
                left: `${Number(item.x || 0) * 100}%`,
                top: `${Number(item.y || 0) * 100}%`,
              } as any,
            ]}
          >
            <Text
              style={[
                item.type === "EMOJI"
                  ? styles.overlayEmoji
                  : styles.overlayText,
                { color: item.color || "#fff" },
              ]}
            >
              {item.value}
            </Text>
          </View>
        ))}
        <View style={styles.progressRow}>
          {group.stories.map((item, index) => (
            <View key={item.storyId} style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    width:
                      index < storyIndex
                        ? "100%"
                        : index === storyIndex
                          ? `${Math.min(progress, 100)}%`
                          : "0%",
                  },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.header}>
          <UserAvatar
            avatarUrl={group.avatarUrl}
            displayName={group.displayName}
            username={group.username}
            size={38}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {group.displayName || group.username}
            </Text>
            <Text style={styles.username}>@{group.username}</Text>
          </View>
          {own ? (
            <TouchableOpacity
              accessibilityLabel="Opciones del momento"
              onPress={() => {
                setMenu(true);
                setPaused(true);
              }}
              style={styles.icon}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            onPress={() => setPaused((value) => !value)}
            style={styles.icon}
          >
            <Ionicons name={paused ? "play" : "pause"} size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.icon}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.leftTap}
          onPress={() => {
            if (storyIndex > 0) {
              setStoryIndex((value) => value - 1);
              setProgress(0);
            } else if (userIndex > 0) {
              setUserIndex((value) => value - 1);
              setStoryIndex(0);
              setProgress(0);
            }
          }}
        />
        <TouchableOpacity style={styles.rightTap} onPress={next} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {!own ? (
          <View style={styles.reply}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder={`Responder a @${group.username}…`}
              placeholderTextColor="#ffffff99"
              style={styles.replyInput}
            />
            <TouchableOpacity
              disabled={!reply.trim()}
              onPress={() => void sendReply()}
              style={styles.send}
            >
              <Ionicons name="send" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : null}
        {menu ? (
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Opciones del momento</Text>
            <TouchableOpacity onPress={() => void openViewers()} style={styles.viewersAction}>
              <Ionicons name="eye-outline" size={20} color="#fff" />
              <Text style={styles.viewersText}>Ver quién lo vio</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={deleting}
              onPress={confirmDelete}
              style={styles.delete}
            >
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <Text style={styles.deleteText}>
                {deleting ? "Eliminando…" : "Eliminar momento"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setMenu(false);
                setPaused(false);
              }}
              style={styles.cancel}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {own ? (
          <TouchableOpacity onPress={() => void openViewers()} style={styles.viewsPill}>
            <Ionicons name="eye-outline" size={17} color="#fff" />
            <Text style={styles.viewsPillText}>Vistas</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Modal visible={viewersOpen} transparent animationType="slide" onRequestClose={() => { setViewersOpen(false); setPaused(false); }}>
        <View style={styles.viewersBackdrop}>
          <View style={styles.viewersSheet}>
            <View style={styles.viewersHeader}>
              <View><Text style={styles.sheetTitle}>Vistas del momento</Text><Text style={styles.viewerMeta}>{viewers.length} {viewers.length === 1 ? "persona" : "personas"}</Text></View>
              <TouchableOpacity onPress={() => { setViewersOpen(false); setPaused(false); }} style={styles.icon}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
            </View>
            {viewersLoading ? <ActivityIndicator color="#14b8a6" style={{ margin: 30 }} /> : <FlatList data={viewers} keyExtractor={item => item.userId} ListEmptyComponent={<Text style={styles.emptyViews}>Aún nadie ha visto este momento.</Text>} renderItem={({ item }) => <View style={styles.viewerRow}><UserAvatar avatarUrl={item.avatarUrl} displayName={item.displayName} username={item.username} size={44} /><View><Text style={styles.viewerName}>{item.displayName || item.username}</Text><Text style={styles.viewerMeta}>@{item.username}</Text></View></View>} />}
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  textStory: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  storyText: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  progressRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    gap: 4,
    zIndex: 5,
  },
  track: {
    height: 3,
    flex: 1,
    backgroundColor: "#ffffff44",
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: "#14b8a6" },
  overlayItem: {
    position: "absolute",
    zIndex: 4,
    padding: 5,
    borderRadius: 8,
    backgroundColor: "#0003",
  },
  overlayText: { color: "#fff", fontSize: 22, fontWeight: "900" },
  overlayEmoji: { fontSize: 34 },
  header: {
    position: "absolute",
    top: 24,
    left: 12,
    right: 8,
    zIndex: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  name: { color: "#fff", fontSize: 13, fontWeight: "800" },
  username: { color: "#ffffffaa", fontSize: 11 },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  leftTap: { position: "absolute", left: 0, top: 80, bottom: 90, width: "33%" },
  rightTap: {
    position: "absolute",
    right: 0,
    top: 80,
    bottom: 90,
    width: "33%",
  },
  reply: {
    position: "absolute",
    bottom: 18,
    left: 14,
    right: 14,
    flexDirection: "row",
    gap: 8,
    zIndex: 6,
  },
  replyInput: {
    flex: 1,
    minHeight: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#ffffff55",
    backgroundColor: "#0008",
    color: "#fff",
    paddingHorizontal: 17,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
  },
  error: {
    position: "absolute",
    bottom: 76,
    left: 20,
    right: 20,
    color: "#fecaca",
    backgroundColor: "#7f1d1ddd",
    padding: 10,
    borderRadius: 10,
    textAlign: "center",
    zIndex: 8,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    gap: 10,
  },
  sheetTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  delete: {
    height: 50,
    borderRadius: 14,
    backgroundColor: "#ef444418",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  deleteText: { color: "#ef4444", fontWeight: "800" },
  viewersAction: { height: 50, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#ffffff12" },
  viewersText: { color: "#fff", fontWeight: "800" },
  viewsPill: { position: "absolute", bottom: 22, alignSelf: "center", zIndex: 7, flexDirection: "row", gap: 7, alignItems: "center", backgroundColor: "#000a", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22 },
  viewsPillText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  viewersBackdrop: { flex: 1, backgroundColor: "#0009", justifyContent: "flex-end" },
  viewersSheet: { backgroundColor: "#09090b", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "70%", minHeight: 260, paddingBottom: 28 },
  viewersHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 18, borderBottomColor: "#27272a", borderBottomWidth: 1 },
  viewerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 11 },
  viewerName: { color: "#fff", fontWeight: "800", fontSize: 14 },
  viewerMeta: { color: "#a1a1aa", fontSize: 11, marginTop: 2 },
  emptyViews: { color: "#a1a1aa", textAlign: "center", padding: 34 },
  cancel: { height: 46, alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#cbd5e1", fontWeight: "700" },
});
