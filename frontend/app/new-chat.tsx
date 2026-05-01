import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../src/theme";
import { useTheme } from "../src/store";
import { apiError, createConversation, searchUsers } from "../src/api";
import Avatar from "../src/Avatar";

export default function NewChatScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchUsers(q.trim());
        setUsers(data);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const startChat = async (uid: string) => {
    try {
      const conv = await createConversation({ type: "dm", member_ids: [uid] });
      router.replace(`/chat/${conv.id}`);
    } catch (e) {
      Alert.alert("Error", apiError(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          testID="newchat-search-input"
          autoFocus
          value={q}
          onChangeText={setQ}
          placeholder="Search by name or email"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          style={[styles.input, { color: colors.textPrimary }]}
        />
      </View>

      <TouchableOpacity
        onPress={() => router.replace("/group-create")}
        style={[styles.row, { borderBottomColor: colors.border }]}
      >
        <View style={[styles.iconCircle, { backgroundColor: COLORS.aiAccent }]}>
          <Ionicons name="people" size={20} color="#fff" />
        </View>
        <Text style={{ color: colors.textPrimary, fontWeight: "700", marginLeft: 14, fontSize: 16 }}>
          New group
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} style={{ marginLeft: "auto" }} />
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          ListEmptyComponent={
            <Text style={{ color: colors.textSecondary, textAlign: "center", marginTop: 32 }}>
              No people found.
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`newchat-user-${item.id}`}
              onPress={() => startChat(item.id)}
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <Avatar uri={item.avatar} name={item.name} seedId={item.id} size={44} showOnline online={item.online} />
              <View style={{ marginLeft: 12 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{item.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.email}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    margin: 12,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 100,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: { flex: 1, fontSize: 15 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
