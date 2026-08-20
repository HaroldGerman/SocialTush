import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useAuth } from "../context/AuthContext";
import { useAppTheme } from "../theme";

interface Overlay {
  id: string;
  type: "TEXT" | "EMOJI";
  value: string;
  x: number;
  y: number;
  scale: number;
  color?: string;
  bg?: boolean;
}
const EMOJIS = [
  "🔥",
  "🚀",
  "😂",
  "❤️",
  "😍",
  "😎",
  "👍",
  "✨",
  "🎉",
  "🤔",
  "😭",
  "🙏",
];
function StoryVideoPreview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.play();
  });
  return (
    <VideoView
      player={player}
      style={styles.preview}
      contentFit="contain"
      nativeControls
    />
  );
}

export default function StoryComposer({
  visible,
  onClose,
  onPublished,
}: {
  visible: boolean;
  onClose: () => void;
  onPublished: () => void;
}) {
  const { api } = useAuth();
  const { theme } = useAppTheme();
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"SELECT" | "TEXT" | "EDITOR">("SELECT");
  const [background, setBackground] = useState("#0f766e");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [cameraFacing, setCameraFacing] = useState<ImagePicker.CameraType>(
    ImagePicker.CameraType.back,
  );
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [overlayText, setOverlayText] = useState("");
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);

  const reset = () => {
    setAsset(null);
    setText("");
    setMode("SELECT");
    setError("");
    setOverlays([]);
    setOverlayText("");
    setSelectedOverlay(null);
    setShowTools(false);
  };
  const close = () => {
    if (publishing) return;
    reset();
    onClose();
  };
  const pick = async (camera: boolean) => {
    setError("");
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted)
      return setError(
        camera
          ? "No pudimos acceder a la cámara."
          : "No pudimos acceder a tu galería.",
      );
    const result = camera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images"],
          quality: 0.85,
          cameraType: cameraFacing,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"],
          quality: 0.85,
        });
    if (!result.canceled && result.assets[0]) {
      setAsset(result.assets[0]);
      setMode("EDITOR");
    }
  };
  const publish = async () => {
    if (mode === "TEXT" && !text.trim())
      return setError("Escribe algo para publicar.");
    if (mode === "EDITOR" && !asset) return;
    setPublishing(true);
    setError("");
    try {
      const data = new FormData();
      data.append(
        "mediaType",
        mode === "TEXT" ? "TEXT" : asset?.type === "video" ? "VIDEO" : "IMAGE",
      );
      data.append("isBestFriends", "false");
      if (mode === "TEXT") {
        data.append("textContent", text.trim());
        data.append("backgroundColor", background);
      }
      if (asset)
        data.append("file", {
          uri:
            Platform.OS === "ios"
              ? asset.uri.replace("file://", "")
              : asset.uri,
          name:
            asset.fileName ||
            `story_${Date.now()}.${asset.type === "video" ? "mp4" : "jpg"}`,
          type:
            asset.mimeType ||
            (asset.type === "video" ? "video/mp4" : "image/jpeg"),
        } as any);
      if (overlays.length) data.append("overlayData", JSON.stringify(overlays));
      await api.post("/stories", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      reset();
      onClose();
      onPublished();
    } catch (requestError: any) {
      console.error(requestError);
      setError(
        requestError.response?.data?.message ||
          "No se pudo publicar la historia.",
      );
    } finally {
      setPublishing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View
        style={[
          styles.container,
          { backgroundColor: mode === "TEXT" ? background : "#09090b" },
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={close} style={styles.icon}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>Crear historia</Text>
          {mode !== "SELECT" ? (
            <TouchableOpacity
              disabled={publishing}
              onPress={() => void publish()}
              style={styles.publish}
            >
              {publishing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.publishText}>Publicar momento</Text>
              )}
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} />
          )}
        </View>
        {error ? (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {mode === "SELECT" ? (
          <View style={styles.choices}>
            <Text style={styles.heading}>Comparte una historia</Text>
            <TouchableOpacity
              onPress={() => void pick(true)}
              style={styles.choice}
            >
              <Ionicons name="camera-outline" size={30} color="#2dd4bf" />
              <View>
                <Text style={styles.choiceTitle}>Cámara</Text>
                <Text style={styles.choiceSub}>
                  Toma una foto con cámara{" "}
                  {cameraFacing === ImagePicker.CameraType.front
                    ? "frontal"
                    : "trasera"}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                setCameraFacing((value) =>
                  value === ImagePicker.CameraType.front
                    ? ImagePicker.CameraType.back
                    : ImagePicker.CameraType.front,
                )
              }
              style={styles.cameraSwitch}
            >
              <Ionicons
                name="camera-reverse-outline"
                size={20}
                color="#2dd4bf"
              />
              <Text style={styles.choiceSub}>
                Usar cámara{" "}
                {cameraFacing === ImagePicker.CameraType.front
                  ? "trasera"
                  : "frontal"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => void pick(false)}
              style={styles.choice}
            >
              <Ionicons name="images-outline" size={30} color="#2dd4bf" />
              <View>
                <Text style={styles.choiceTitle}>Galería</Text>
                <Text style={styles.choiceSub}>Elige una imagen o video</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMode("TEXT")}
              style={styles.choice}
            >
              <Ionicons name="text-outline" size={30} color="#2dd4bf" />
              <View>
                <Text style={styles.choiceTitle}>Texto</Text>
                <Text style={styles.choiceSub}>Publica sobre un fondo</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : null}
        {mode === "TEXT" ? (
          <View style={styles.editor}>
            <TextInput
              autoFocus
              multiline
              value={text}
              onChangeText={setText}
              placeholder="Escribe algo…"
              placeholderTextColor="#ffffff88"
              style={styles.textInput}
            />
            <View style={styles.colors}>
              {[
                "#0f766e",
                "#312e81",
                "#881337",
                "#7c2d12",
                "#090d16",
                "#1e293b",
              ].map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setBackground(color)}
                  style={[
                    styles.color,
                    { backgroundColor: color },
                    background === color && styles.colorActive,
                  ]}
                />
              ))}
            </View>
          </View>
        ) : null}
        {mode === "EDITOR" && asset ? (
          <View style={styles.mediaEditor}>
            {asset.type === "video" ? (
              <StoryVideoPreview uri={asset.uri} />
            ) : (
              <Image
                source={{ uri: asset.uri }}
                style={styles.preview}
                resizeMode="contain"
              />
            )}
            {overlays.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => setSelectedOverlay(item.id)}
                style={[
                  styles.overlay,
                  { left: `${item.x * 100}%`, top: `${item.y * 100}%` } as any,
                  selectedOverlay === item.id && styles.overlaySelected,
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
              </TouchableOpacity>
            ))}
            <View style={styles.tools}>
              <TouchableOpacity
                onPress={() => setShowTools((value) => !value)}
                style={styles.toolButton}
              >
                <Ionicons name="text-outline" size={20} color="#fff" />
                <Text style={styles.removeText}>Texto / Emoji</Text>
              </TouchableOpacity>
              {selectedOverlay ? (
                <View style={styles.positionControls}>
                  <TouchableOpacity
                    onPress={() =>
                      setOverlays((old) =>
                        old.map((item) =>
                          item.id === selectedOverlay
                            ? { ...item, x: Math.max(0.05, item.x - 0.05) }
                            : item,
                        ),
                      )
                    }
                  >
                    <Ionicons name="arrow-back" size={19} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      setOverlays((old) =>
                        old.map((item) =>
                          item.id === selectedOverlay
                            ? { ...item, y: Math.max(0.08, item.y - 0.05) }
                            : item,
                        ),
                      )
                    }
                  >
                    <Ionicons name="arrow-up" size={19} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      setOverlays((old) =>
                        old.map((item) =>
                          item.id === selectedOverlay
                            ? { ...item, y: Math.min(0.82, item.y + 0.05) }
                            : item,
                        ),
                      )
                    }
                  >
                    <Ionicons name="arrow-down" size={19} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      setOverlays((old) =>
                        old.map((item) =>
                          item.id === selectedOverlay
                            ? { ...item, x: Math.min(0.9, item.x + 0.05) }
                            : item,
                        ),
                      )
                    }
                  >
                    <Ionicons name="arrow-forward" size={19} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setOverlays((old) =>
                        old.filter((item) => item.id !== selectedOverlay),
                      );
                      setSelectedOverlay(null);
                    }}
                  >
                    <Ionicons name="trash-outline" size={19} color="#f87171" />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
            {showTools ? (
              <View style={styles.toolPanel}>
                <View style={styles.textTool}>
                  <TextInput
                    value={overlayText}
                    onChangeText={setOverlayText}
                    placeholder="Texto sobre la historia"
                    placeholderTextColor="#94a3b8"
                    style={styles.overlayInput}
                  />
                  <TouchableOpacity
                    onPress={() => {
                      if (!overlayText.trim()) return;
                      const id = `text_${Date.now()}`;
                      setOverlays((old) => [
                        ...old,
                        {
                          id,
                          type: "TEXT",
                          value: overlayText.trim(),
                          x: 0.35,
                          y: 0.4,
                          scale: 1,
                          color: "#fff",
                        },
                      ]);
                      setSelectedOverlay(id);
                      setOverlayText("");
                    }}
                    style={styles.addOverlay}
                  >
                    <Text style={styles.publishText}>Añadir</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.emojiGrid}>
                  {EMOJIS.map((value) => (
                    <TouchableOpacity
                      key={value}
                      onPress={() => {
                        const id = `emoji_${Date.now()}`;
                        setOverlays((old) => [
                          ...old,
                          {
                            id,
                            type: "EMOJI",
                            value,
                            x: 0.4,
                            y: 0.45,
                            scale: 1,
                          },
                        ]);
                        setSelectedOverlay(id);
                      }}
                    >
                      <Text style={styles.emoji}>{value}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null}
            <TouchableOpacity
              onPress={() => {
                setAsset(null);
                setMode("SELECT");
              }}
              style={styles.remove}
            >
              <Ionicons name="trash-outline" size={18} color="#fff" />
              <Text style={styles.removeText}>Quitar</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 64,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
  },
  icon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: "#fff", fontSize: 16, fontWeight: "800" },
  publish: {
    minWidth: 80,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#0f766e",
    alignItems: "center",
    justifyContent: "center",
  },
  publishText: { color: "#fff", fontWeight: "800" },
  error: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#7f1d1d",
  },
  errorText: { color: "#fee2e2", textAlign: "center" },
  choices: { flex: 1, justifyContent: "center", padding: 22, gap: 12 },
  heading: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 14,
    textAlign: "center",
  },
  choice: {
    minHeight: 78,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0f172a",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  choiceTitle: { color: "#fff", fontSize: 16, fontWeight: "800" },
  choiceSub: { color: "#94a3b8", fontSize: 12, marginTop: 3 },
  cameraSwitch: {
    alignSelf: "center",
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    padding: 8,
  },
  editor: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 26,
  },
  textInput: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "800",
    textAlign: "center",
    width: "100%",
    maxHeight: 300,
  },
  colors: { position: "absolute", bottom: 30, flexDirection: "row", gap: 12 },
  color: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "#ffffff55",
  },
  colorActive: { borderColor: "#fff", transform: [{ scale: 1.15 }] },
  mediaEditor: { flex: 1, alignItems: "center", justifyContent: "center" },
  preview: { width: "100%", height: "80%" },
  videoPlaceholder: { alignItems: "center", gap: 10 },
  overlay: { position: "absolute", zIndex: 4, padding: 5, borderRadius: 8 },
  overlaySelected: {
    borderWidth: 1,
    borderColor: "#2dd4bf",
    backgroundColor: "#0005",
  },
  overlayText: { fontSize: 22, fontWeight: "900" },
  overlayEmoji: { fontSize: 34 },
  tools: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 76,
    zIndex: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  toolButton: {
    backgroundColor: "#000b",
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: "row",
    gap: 7,
  },
  positionControls: {
    backgroundColor: "#000b",
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: "row",
    gap: 13,
  },
  toolPanel: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 124,
    zIndex: 8,
    backgroundColor: "#0f172af5",
    borderRadius: 18,
    padding: 12,
    gap: 10,
  },
  textTool: { flexDirection: "row", gap: 8 },
  overlayInput: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    color: "#fff",
    paddingHorizontal: 12,
  },
  addOverlay: {
    backgroundColor: "#0f766e",
    paddingHorizontal: 13,
    borderRadius: 12,
    justifyContent: "center",
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  emoji: { fontSize: 25, padding: 5 },
  remove: {
    position: "absolute",
    bottom: 28,
    flexDirection: "row",
    gap: 7,
    backgroundColor: "#000a",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  removeText: { color: "#fff", fontWeight: "700" },
});
