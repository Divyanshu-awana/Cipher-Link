import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS } from "../../src/theme";
import { useTheme } from "../../src/store";
import {
  apiError,
  deleteConversation,
  listConversations,
  muteConversation,
} from "../../src/api";
import Avatar from "../../src/Avatar";

function relTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString();
}

export default function ChatsTab() {
  const { colors } = useTheme();
  const router = useRouter();
  const [convs, setConvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listConversations();
      setConvs(data);
    } catch (e) {
      Alert.alert("Error", apiError(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onMute = async (id: string) => {
    try {
      await muteConversation(id);
      load();
    } catch (e) {
      Alert.alert("Error", apiError(e));
    }
  };

  const onDelete = (id: string) =>
    Alert.alert("Delete chat?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteConversation(id);
            load();
          } catch (e) {
            Alert.alert("Error", apiError(e));
          }
        },
      },
    ]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="chats-screen">
      <FlatList
        data={convs}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingVertical: 4 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", padding: 48 }}>
            <Ionicons name="chatbubble-ellipses-outline" size={64} color={colors.textSecondary} />
            <Text style={{ color: colors.textPrimary, fontWeight: "700", marginTop: 12, fontSize: 16 }}>
              No conversations yet
            </Text>
            <Text style={{ color: colors.textSecondary, marginTop: 4, textAlign: "center" }}>
              Tap the + button to start chatting.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const last = item.last_message;
          const lastText =
            last?.deleted
              ? "Message deleted"
              : last?.type === "cipher"
              ? "✨ Cipher answered"
              : last?.type === "image"
              ? "📷 Photo"
              : last?.type === "audio"
              ? "🎤 Voice message"
              : last?.type === "document"
              ? "📎 Document"
              : last?.content || "Tap to start chatting";
          const isGroup = item.type === "group";
          return (
            <TouchableOpacity
              testID={`chat-item-${item.id}`}
              onPress={() => router.push(`/chat/${item.id}`)}
              style={[styles.row, { borderBottomColor: colors.border }]}
              onLongPress={() =>
                Alert.alert(item.name || "Chat", "Choose action", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Mute / Unmute", onPress: () => onMute(item.id) },
                  { text: "Delete", style: "destructive", onPress: () => onDelete(item.id) },
                ])
              }
            >
              <Avatar
                uri={item.photo}
                name={item.name}
                size={52}
                seedId={item.id}
                showOnline={!isGroup}
                online={
                  !isGroup &&
                  item.members?.find((m: any) => m.id !== item.current_user_id)?.online
                }
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                    {item.name || "(unnamed)"}
                  </Text>
                  {isGroup ? (
                    <Ionicons name="people" size={14} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                  ) : null}
                  <Text style={[styles.time, { color: colors.textSecondary }]}>
                    {relTime(last?.created_at || item.created_at)}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                  <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={1}>
                    {lastText}
                  </Text>
                  {item.muted_by?.includes(item.current_user_id) ? (
                    <Ionicons name="volume-mute" size={14} color={colors.textSecondary} style={{ marginLeft: 6 }} />
                  ) : null}
                  {item.unread > 0 ? (
                    <View style={[styles.badge, { backgroundColor: COLORS.primary }]}>
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{item.unread}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        testID="new-chat-fab"
        onPress={() => router.push("/new-chat")}
        style={[styles.fab, { backgroundColor: COLORS.primary }]}
      >
        <Ionicons name="create" size={26} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { fontSize: 16, fontWeight: "700", flex: 1 },
  time: { fontSize: 12, marginLeft: 8 },
  preview: { flex: 1, fontSize: 13 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1A73E8",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
