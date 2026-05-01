import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import { COLORS, RADIUS, ASSETS } from "../../src/theme";
import { useAuth, useTheme } from "../../src/store";
import {
  apiError,
  askCipher,
  deleteMessage,
  editMessage,
  getConversation,
  listMessages,
  reactMessage,
  readAll,
  sendMessage,
} from "../../src/api";
import Avatar from "../../src/Avatar";
import MessageBubble, { Message } from "../../src/MessageBubble";
import TypingIndicator from "../../src/TypingIndicator";
import CipherCardView, { CipherPayload } from "../../src/CipherCard";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
const POLL_MS = 3500;

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors, mode } = useTheme();
  const [conv, setConv] = useState<any>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [askingCipher, setAskingCipher] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [contextMsg, setContextMsg] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showCipherModal, setShowCipherModal] = useState(false);
  const [cipherPrompt, setCipherPrompt] = useState("");
  const listRef = useRef<FlatList>(null);
  const pollRef = useRef<any>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [c, m] = await Promise.all([getConversation(id), listMessages(id)]);
      setConv(c);
      // Re-attach cipher_payload from local cache (server stores summary as text + payload separately)
      setMsgs(m as Message[]);
      readAll(id).catch(() => {});
    } catch (e) {
      Alert.alert("Error", apiError(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
      pollRef.current = setInterval(async () => {
        try {
          const m = await listMessages(id);
          setMsgs((prev) => mergeMessages(prev, m));
        } catch {}
      }, POLL_MS);
      return () => {
        clearInterval(pollRef.current);
      };
    }, [load, id])
  );

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [msgs.length]);

  const others = useMemo(
    () => (conv?.members || []).filter((m: any) => m.id !== user?.id),
    [conv, user]
  );

  const headerTitle = conv?.name || "Chat";
  const headerSub = useMemo(() => {
    if (!conv) return "";
    if (conv.type === "group") return `${conv.members?.length || 0} members`;
    const o = others[0];
    return o?.online ? "Online" : o?.last_seen ? "Last seen recently" : "Offline";
  }, [conv, others]);

  const send = async () => {
    const value = text.trim();
    if (!value) return;
    if (editingMsg) {
      try {
        const updated = await editMessage(editingMsg.id, value);
        setMsgs((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        setEditingMsg(null);
        setText("");
      } catch (e) {
        Alert.alert("Edit failed", apiError(e));
      }
      return;
    }
    if (value.toLowerCase().startsWith("@cipher")) {
      const prompt = value.replace(/^@cipher/i, "").trim() || "Hi";
      setText("");
      await askCipherAndPost(prompt);
      return;
    }
    setSending(true);
    try {
      const newMsg = await sendMessage(id, {
        content: value,
        type: "text",
        reply_to: replyTo?.id,
      });
      setMsgs((prev) => [...prev, newMsg]);
      setText("");
      setReplyTo(null);
    } catch (e) {
      Alert.alert("Send failed", apiError(e));
    } finally {
      setSending(false);
    }
  };

  const askCipherAndPost = async (prompt: string) => {
    setAskingCipher(true);
    // Immediately render the user's question so the conversation feels live.
    const userMsg = await sendMessage(id, {
      content: `@Cipher ${prompt}`,
      type: "text",
    });
    setMsgs((prev) => [...prev, userMsg]);
    try {
      const payload: CipherPayload = await askCipher(prompt, id);
      const summary = payload.summary || "Here you go.";
      const aiMsg = await sendMessage(id, {
        content: summary,
        type: "cipher",
      });
      // attach the payload locally so the bubble renders rich cards
      const enriched = { ...aiMsg, cipher_payload: payload } as Message;
      setMsgs((prev) => [...prev, enriched]);
    } catch (e) {
      Alert.alert("Cipher error", apiError(e));
    } finally {
      setAskingCipher(false);
    }
  };

  const onLongPress = (m: Message) => {
    if (m.deleted || m.type === "cipher") return;
    setContextMsg(m);
  };

  const reactTo = async (emoji: string) => {
    if (!contextMsg) return;
    try {
      const r = await reactMessage(contextMsg.id, emoji);
      setMsgs((prev) =>
        prev.map((m) => (m.id === contextMsg.id ? { ...m, reactions: r.reactions } : m))
      );
    } catch (e) {
      Alert.alert("Failed", apiError(e));
    }
    setContextMsg(null);
  };

  const sendImage = async () => {
    setShowAttach(false);
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.5,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    if (!a) return;
    const data = a.base64 ? `data:image/jpeg;base64,${a.base64}` : undefined;
    if (!data) return;
    const newMsg = await sendMessage(id, {
      content: "📷 Photo",
      type: "image",
      media_b64: data,
    });
    setMsgs((prev) => [...prev, newMsg]);
  };

  const sendCamera = async () => {
    setShowAttach(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Camera access denied.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.5 });
    if (res.canceled) return;
    const a = res.assets[0];
    if (!a) return;
    const data = a.base64 ? `data:image/jpeg;base64,${a.base64}` : undefined;
    if (!data) return;
    const newMsg = await sendMessage(id, { content: "📷 Photo", type: "image", media_b64: data });
    setMsgs((prev) => [...prev, newMsg]);
  };

  const sendDoc = async () => {
    setShowAttach(false);
    const res = await DocumentPicker.getDocumentAsync({ type: "*/*" });
    if (res.canceled) return;
    const f = res.assets?.[0];
    if (!f) return;
    const newMsg = await sendMessage(id, {
      content: f.name,
      type: "document",
      media_name: f.name,
      media_size: f.size,
    });
    setMsgs((prev) => [...prev, newMsg]);
  };

  const sendVoiceMock = async () => {
    setShowAttach(false);
    const newMsg = await sendMessage(id, {
      content: "Voice message",
      type: "audio",
    });
    setMsgs((prev) => [...prev, newMsg]);
  };

  const onDelete = async () => {
    if (!contextMsg) return;
    try {
      await deleteMessage(contextMsg.id);
      setMsgs((prev) => prev.map((m) => (m.id === contextMsg.id ? { ...m, deleted: true, content: "" } : m)));
    } catch (e) {
      Alert.alert("Failed", apiError(e));
    }
    setContextMsg(null);
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Avatar
                uri={conv?.photo}
                name={headerTitle}
                size={36}
                seedId={conv?.id}
                showOnline={conv?.type === "dm"}
                online={others[0]?.online}
              />
              <View style={{ marginLeft: 10 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{headerTitle}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{headerSub}</Text>
              </View>
            </View>
          ),
        }}
      />

      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingVertical: 8, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item, index }) => {
          const prev = msgs[index - 1];
          const isMe = item.sender_id === user?.id;
          const showSender = conv?.type === "group" && !isMe && (!prev || prev.sender_id !== item.sender_id);
          return (
            <MessageBubble
              msg={item}
              isMe={isMe}
              totalMembers={conv?.members?.length || 1}
              showSender={showSender}
              onLongPress={onLongPress}
            />
          );
        }}
        ListFooterComponent={askingCipher ? <TypingIndicator name="Cipher" /> : null}
      />

      {replyTo ? (
        <View style={[styles.replyStrip, { backgroundColor: colors.surface, borderColor: COLORS.primary }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: COLORS.primary, fontSize: 12, fontWeight: "700" }}>
              Replying to {replyTo.sender?.name || "message"}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
              {replyTo.content || replyTo.type}
            </Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : null}

      {editingMsg ? (
        <View style={[styles.replyStrip, { backgroundColor: colors.surface, borderColor: COLORS.warning }]}>
          <Text style={{ color: COLORS.warning, fontSize: 12, fontWeight: "700" }}>
            Editing message…
          </Text>
          <TouchableOpacity
            onPress={() => {
              setEditingMsg(null);
              setText("");
            }}
          >
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity testID="chat-attach-button" onPress={() => setShowAttach(true)} style={styles.iconBtn}>
          <Ionicons name="add" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <TextInput
          testID="chat-input"
          value={text}
          onChangeText={setText}
          placeholder="Message… (try @Cipher)"
          placeholderTextColor={colors.textSecondary}
          multiline
          style={[styles.textInput, { color: colors.textPrimary, backgroundColor: colors.surfaceVariant }]}
        />
        {text.trim() ? (
          <TouchableOpacity testID="chat-send-button" onPress={send} disabled={sending} style={[styles.sendBtn, { backgroundColor: COLORS.primary }]}>
            {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity testID="chat-mic-button" onPress={sendVoiceMock} style={[styles.sendBtn, { backgroundColor: COLORS.primary }]}>
            <Ionicons name="mic" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        testID="cipher-floating-button"
        onPress={() => setShowCipherModal(true)}
        style={[styles.fab, { backgroundColor: COLORS.aiAccent }]}
      >
        <Image source={{ uri: ASSETS.cipherAvatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />
      </TouchableOpacity>

      {/* Attach picker */}
      <Modal transparent visible={showAttach} animationType="slide" onRequestClose={() => setShowAttach(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAttach(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: 12 }}>
              Share
            </Text>
            <View style={styles.attachGrid}>
              <AttachOption icon="camera" label="Camera" onPress={sendCamera} testID="attach-camera" />
              <AttachOption icon="image" label="Gallery" onPress={sendImage} testID="attach-gallery" />
              <AttachOption icon="document" label="Document" onPress={sendDoc} testID="attach-doc" />
              <AttachOption icon="mic" label="Audio" onPress={sendVoiceMock} testID="attach-audio" />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Reaction / context menu */}
      <Modal transparent visible={!!contextMsg} animationType="fade" onRequestClose={() => setContextMsg(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setContextMsg(null)}>
          <Pressable
            style={[styles.contextMenu, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 8 }}>
              {REACTIONS.map((r) => (
                <TouchableOpacity key={r} testID={`react-${r}`} onPress={() => reactTo(r)} style={{ padding: 8 }}>
                  <Text style={{ fontSize: 26 }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <ContextItem
              icon="arrow-undo"
              label="Reply"
              onPress={() => {
                setReplyTo(contextMsg);
                setContextMsg(null);
              }}
              colors={colors}
              testID="ctx-reply"
            />
            <ContextItem
              icon="copy"
              label="Copy"
              onPress={async () => {
                if (contextMsg?.content) {
                  await Clipboard.setStringAsync(contextMsg.content);
                }
                setContextMsg(null);
              }}
              colors={colors}
              testID="ctx-copy"
            />
            {contextMsg?.sender_id === user?.id ? (
              <>
                <ContextItem
                  icon="create"
                  label="Edit"
                  onPress={() => {
                    setEditingMsg(contextMsg);
                    setText(contextMsg?.content || "");
                    setContextMsg(null);
                  }}
                  colors={colors}
                  testID="ctx-edit"
                />
                <ContextItem icon="trash" label="Delete" onPress={onDelete} danger colors={colors} testID="ctx-delete" />
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Ask Cipher modal */}
      <Modal transparent visible={showCipherModal} animationType="slide" onRequestClose={() => setShowCipherModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowCipherModal(false)}>
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: mode === "dark" ? "#241B3F" : "#F6F1FF",
                borderColor: COLORS.aiAccent,
                borderWidth: 1,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <Image source={{ uri: ASSETS.cipherAvatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
              <View style={{ marginLeft: 10 }}>
                <Text style={{ color: COLORS.aiAccent, fontWeight: "700", fontSize: 16 }}>
                  Ask Cipher AI
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  Restaurants · Weather · Calendar · Q&A
                </Text>
              </View>
            </View>
            <TextInput
              testID="cipher-modal-input"
              value={cipherPrompt}
              onChangeText={setCipherPrompt}
              placeholder="e.g. Find a cozy Italian for 4 near Connaught Place Saturday evening"
              placeholderTextColor={colors.textSecondary}
              multiline
              style={[
                styles.cipherInput,
                { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: 8 }}>
              {[
                "Weather in Delhi tomorrow?",
                "Schedule sprint retro Mon 10 AM",
                "A cheaper option?",
              ].map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setCipherPrompt(s)}
                  style={[styles.suggestionChip, { borderColor: COLORS.aiAccent + "55" }]}
                >
                  <Text style={{ color: COLORS.aiAccent, fontSize: 12 }}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              testID="cipher-modal-send"
              onPress={async () => {
                const p = cipherPrompt.trim();
                if (!p) return;
                setShowCipherModal(false);
                setCipherPrompt("");
                await askCipherAndPost(p);
              }}
              style={[styles.cipherSendBtn, { backgroundColor: COLORS.aiAccent }]}
            >
              <Ionicons name="sparkles" size={16} color="#fff" />
              <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 8 }}>Ask Cipher</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function AttachOption({ icon, label, onPress, testID }: any) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={{ alignItems: "center", width: "23%" }}>
      <View style={[styles.attachCircle, { backgroundColor: COLORS.primary + "22" }]}>
        <Ionicons name={icon} size={26} color={COLORS.primary} />
      </View>
      <Text style={{ color: COLORS.primary, marginTop: 6, fontSize: 12, fontWeight: "600" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ContextItem({ icon, label, onPress, danger, colors, testID }: any) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 8,
        gap: 10,
      }}
    >
      <Ionicons name={icon} size={20} color={danger ? COLORS.error : colors.textPrimary} />
      <Text style={{ color: danger ? COLORS.error : colors.textPrimary, fontWeight: "600" }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function mergeMessages(prev: Message[], next: Message[]): Message[] {
  const map: Record<string, Message> = {};
  for (const m of prev) map[m.id] = m;
  for (const m of next) {
    map[m.id] = { ...m, cipher_payload: prev.find((p) => p.id === m.id)?.cipher_payload };
  }
  return Object.values(map).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 80,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C3AED",
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  modalBackdrop: { flex: 1, backgroundColor: "#0008", justifyContent: "flex-end" },
  sheet: {
    padding: 20,
    paddingBottom: 36,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 200,
  },
  attachGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  attachCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  contextMenu: {
    margin: 16,
    borderRadius: 16,
    padding: 12,
    alignSelf: "center",
    minWidth: 280,
    marginBottom: 80,
  },
  replyStrip: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    borderLeftWidth: 3,
    marginHorizontal: 8,
    borderRadius: 8,
    marginBottom: 4,
  },
  cipherInput: {
    minHeight: 80,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    textAlignVertical: "top",
    fontSize: 15,
  },
  cipherSendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: RADIUS.button,
    marginTop: 12,
  },
  suggestionChip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 100,
  },
});
