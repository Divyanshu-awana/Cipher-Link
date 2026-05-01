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
import { COLORS, RADIUS } from "../src/theme";
import { useTheme } from "../src/store";
import { apiError, createConversation, searchUsers } from "../src/api";
import Avatar from "../src/Avatar";

export default function GroupCreateScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [name, setName] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await searchUsers("");
        setUsers(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (u: any) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[u.id]) delete next[u.id];
      else next[u.id] = u;
      return next;
    });

  const create = async () => {
    if (!name.trim()) return Alert.alert("Group name required");
    const ids = Object.keys(selected);
    if (ids.length < 1) return Alert.alert("Add at least one member");
    setBusy(true);
    try {
      const c = await createConversation({ type: "group", member_ids: ids, name: name.trim() });
      router.replace(`/chat/${c.id}`);
    } catch (e) {
      Alert.alert("Error", apiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 16, gap: 12 }}>
        <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="people" size={18} color={colors.textSecondary} />
          <TextInput
            testID="group-name-input"
            value={name}
            onChangeText={setName}
            placeholder="Group name"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.textPrimary }]}
          />
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
          {Object.keys(selected).length} member(s) selected
        </Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => {
          const on = !!selected[item.id];
          return (
            <TouchableOpacity
              testID={`group-member-${item.id}`}
              onPress={() => toggle(item)}
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <Avatar uri={item.avatar} name={item.name} seedId={item.id} size={44} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{item.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.email}</Text>
              </View>
              <Ionicons
                name={on ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={on ? COLORS.success : colors.textSecondary}
              />
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        testID="group-create-button"
        onPress={create}
        disabled={busy}
        style={[styles.btn, { backgroundColor: COLORS.aiAccent, opacity: busy ? 0.6 : 1 }]}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create group</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  btn: {
    margin: 16,
    height: 50,
    borderRadius: RADIUS.button,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
