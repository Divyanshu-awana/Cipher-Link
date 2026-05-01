import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS } from "../../src/theme";
import { useAuth, useTheme } from "../../src/store";
import {
  apiError,
  deleteConversation,
  getConversation,
} from "../../src/api";
import Avatar from "../../src/Avatar";

export default function GroupInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [conv, setConv] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const c = await getConversation(id);
      setConv(c);
    } catch (e) {
      Alert.alert("Error", apiError(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const leaveGroup = () =>
    Alert.alert("Leave group?", "You'll stop receiving its messages.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteConversation(id);
            router.replace("/(tabs)/groups");
          } catch (e) {
            Alert.alert("Error", apiError(e));
          }
        },
      },
    ]);

  if (loading || !conv) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  const admins: string[] = conv.admin_ids || [];
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="group-info-screen">
      <Stack.Screen options={{ title: "Group info" }} />
      <View style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Avatar uri={conv.photo} name={conv.name} seedId={conv.id} size={96} />
        <Text style={[styles.name, { color: colors.textPrimary }]}>{conv.name}</Text>
        <Text style={{ color: colors.textSecondary }}>
          Group · {conv.members?.length || 0} members
        </Text>
      </View>

      <Text
        style={{
          color: colors.textSecondary,
          fontSize: 12,
          fontWeight: "700",
          marginTop: 18,
          marginLeft: 16,
        }}
      >
        MEMBERS
      </Text>

      <FlatList
        data={conv.members || []}
        keyExtractor={(m: any) => m.id}
        renderItem={({ item }) => {
          const isAdmin = admins.includes(item.id);
          const isYou = item.id === user?.id;
          return (
            <View
              testID={`group-member-row-${item.id}`}
              style={[styles.row, { borderBottomColor: colors.border }]}
            >
              <Avatar
                uri={item.avatar}
                name={item.name}
                seedId={item.id}
                size={44}
                showOnline
                online={item.online}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>
                  {item.name} {isYou ? <Text style={{ color: colors.textSecondary, fontWeight: "400" }}>· you</Text> : null}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {item.email}
                </Text>
              </View>
              {isAdmin ? (
                <View style={[styles.adminChip, { borderColor: COLORS.aiAccent }]}>
                  <Ionicons name="star" size={11} color={COLORS.aiAccent} />
                  <Text style={{ color: COLORS.aiAccent, fontSize: 11, fontWeight: "700", marginLeft: 4 }}>
                    Admin
                  </Text>
                </View>
              ) : null}
            </View>
          );
        }}
      />

      <TouchableOpacity
        testID="group-leave-button"
        onPress={leaveGroup}
        style={[styles.leaveBtn, { borderColor: COLORS.error }]}
      >
        <Ionicons name="exit" size={18} color={COLORS.error} />
        <Text style={{ color: COLORS.error, fontWeight: "700", marginLeft: 8 }}>
          Leave group
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    alignItems: "center",
    padding: 24,
    paddingTop: 32,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { fontSize: 22, fontWeight: "700", marginTop: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  adminChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
  },
  leaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    margin: 16,
    paddingVertical: 12,
    borderRadius: RADIUS.button,
    borderWidth: 1,
  },
});
