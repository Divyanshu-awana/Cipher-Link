import React from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS } from "./theme";
import { useTheme } from "./store";
import VoiceWaveform from "./VoiceWaveform";
import CipherCardView, { CipherPayload } from "./CipherCard";

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender?: { id: string; name: string; avatar?: string };
  content: string;
  type: "text" | "image" | "video" | "audio" | "document" | "cipher";
  media_b64?: string;
  media_name?: string;
  media_size?: number;
  reply_to?: string | null;
  reactions?: Record<string, string[]>;
  edited?: boolean;
  deleted?: boolean;
  delivered_to?: string[];
  read_by?: string[];
  cipher_payload?: CipherPayload;
  created_at: string;
};

function formatTime(iso?: string) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function StatusTicks({ msg, total }: { msg: Message; total: number }) {
  const others = Math.max(0, total - 1);
  const read = (msg.read_by || []).filter((u) => u !== msg.sender_id).length;
  const delivered = (msg.delivered_to || []).filter((u) => u !== msg.sender_id).length;
  let icon: keyof typeof Ionicons.glyphMap = "checkmark";
  let color = "#FFFFFFAA";
  if (read >= others && others > 0) {
    icon = "checkmark-done";
    color = "#9FD3FF";
  } else if (delivered >= others && others > 0) {
    icon = "checkmark-done";
    color = "#FFFFFFAA";
  }
  return <Ionicons name={icon} size={14} color={color} />;
}

export default function MessageBubble({
  msg,
  isMe,
  totalMembers,
  showSender,
  onLongPress,
}: {
  msg: Message;
  isMe: boolean;
  totalMembers: number;
  showSender?: boolean;
  onLongPress?: (m: Message) => void;
}) {
  const { colors } = useTheme();

  if (msg.type === "cipher" && msg.cipher_payload) {
    return (
      <View style={{ alignItems: "center", marginVertical: 4 }}>
        <CipherCardView payload={msg.cipher_payload} />
        <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}>
          {formatTime(msg.created_at)}
        </Text>
      </View>
    );
  }

  const bubbleBg = isMe ? colors.bubbleSent : colors.bubbleReceived;
  const textColor = isMe ? colors.bubbleTextSent : colors.bubbleTextReceived;
  const reactions = Object.entries(msg.reactions || {}).filter(([, u]) => (u || []).length > 0);

  return (
    <View
      testID="message-bubble"
      style={[
        styles.row,
        { justifyContent: isMe ? "flex-end" : "flex-start", paddingHorizontal: 10 },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={() => onLongPress && onLongPress(msg)}
        style={[
          styles.bubble,
          {
            backgroundColor: bubbleBg,
            borderBottomLeftRadius: isMe ? RADIUS.bubble : 6,
            borderBottomRightRadius: isMe ? 6 : RADIUS.bubble,
            maxWidth: "78%",
          },
        ]}
      >
        {showSender && !isMe && msg.sender ? (
          <Text style={{ fontSize: 11, fontWeight: "700", color: COLORS.primary, marginBottom: 2 }}>
            {msg.sender.name}
          </Text>
        ) : null}

        {msg.deleted ? (
          <Text style={{ color: textColor, fontStyle: "italic", opacity: 0.7 }}>
            Message deleted
          </Text>
        ) : msg.type === "image" && msg.media_b64 ? (
          <Image source={{ uri: msg.media_b64 }} style={styles.mediaImg} />
        ) : msg.type === "audio" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="play-circle" size={28} color={textColor} />
            <VoiceWaveform id={msg.id} color={textColor} />
            <Text style={{ color: textColor, fontSize: 11 }}>0:08</Text>
          </View>
        ) : msg.type === "document" ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="document" size={26} color={textColor} />
            <View style={{ maxWidth: 180 }}>
              <Text style={{ color: textColor, fontWeight: "600" }} numberOfLines={1}>
                {msg.media_name || "Document"}
              </Text>
              {msg.media_size ? (
                <Text style={{ color: textColor, opacity: 0.8, fontSize: 11 }}>
                  {(msg.media_size / 1024).toFixed(1)} KB
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          <Text style={{ color: textColor, fontSize: 15, lineHeight: 21 }}>{msg.content}</Text>
        )}

        <View style={styles.metaRow}>
          {msg.edited ? (
            <Text style={{ color: textColor, opacity: 0.65, fontSize: 10, marginRight: 4 }}>
              edited
            </Text>
          ) : null}
          <Text style={{ color: textColor, opacity: 0.75, fontSize: 10 }}>
            {formatTime(msg.created_at)}
          </Text>
          {isMe ? (
            <View style={{ marginLeft: 4 }}>
              <StatusTicks msg={msg} total={totalMembers} />
            </View>
          ) : null}
        </View>

        {!!reactions.length && (
          <View style={styles.reactionsRow}>
            {reactions.map(([emoji, users]) => (
              <View key={emoji} style={[styles.reactionChip, { backgroundColor: colors.surface }]}>
                <Text style={{ fontSize: 12 }}>
                  {emoji} {users.length > 1 ? users.length : ""}
                </Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", marginVertical: 3 },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.bubble },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  mediaImg: { width: 220, height: 160, borderRadius: 12, backgroundColor: "#0002" },
  reactionsRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 6,
    flexWrap: "wrap",
  },
  reactionChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: "#0001",
  },
});
