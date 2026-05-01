import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../src/theme";
import { useTheme } from "../../src/store";
import { listConversations } from "../../src/api";
import Avatar from "../../src/Avatar";

export default function GroupsTab() {
  const { colors } = useTheme();
  const router = useRouter();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await listConversations();
      setGroups((data || []).filter((c: any) => c.type === "group"));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="groups-screen">
      <FlatList
        data={groups}
        keyExtractor={(g) => g.id}
        ListEmptyComponent={
          <View style={{ alignItems: "center", padding: 48 }}>
            <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
            <Text style={{ color: colors.textPrimary, fontWeight: "700", marginTop: 12, fontSize: 16 }}>
              No groups yet
            </Text>
            <Text style={{ color: colors.textSecondary, marginTop: 4 }}>
              Create one to chat with your team or friends.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            testID={`group-item-${item.id}`}
            onPress={() => router.push(`/chat/${item.id}`)}
            style={[styles.row, { borderBottomColor: colors.border }]}
          >
            <Avatar uri={item.photo} name={item.name} seedId={item.id} size={52} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>
                {item.name}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                {item.members?.length || 0} members
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity
        testID="create-group-fab"
        onPress={() => router.push("/group-create")}
        style={[styles.fab, { backgroundColor: COLORS.aiAccent }]}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
    shadowColor: "#7C3AED",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
