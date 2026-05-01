import React, { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { COLORS, RADIUS } from "../../src/theme";
import { useAuth, useTheme } from "../../src/store";
import { apiError, deleteAccount, tfaDisable, updateMe } from "../../src/api";
import Avatar from "../../src/Avatar";

export default function ProfileTab() {
  const { user, setUser, signOut, refresh } = useAuth();
  const { mode, colors, toggle } = useTheme();
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    if (!a) return;
    const avatar = a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
    try {
      const u = await updateMe({ avatar });
      setUser(u);
    } catch (e) {
      Alert.alert("Update failed", apiError(e));
    }
  };

  const onDeleteAccount = () =>
    Alert.alert(
      "Delete account?",
      "This will erase ALL your messages, conversations, and AI history. This is irreversible.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete forever",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount();
              setUser(null);
              router.replace("/(auth)/login");
            } catch (e) {
              Alert.alert("Failed", apiError(e));
            }
          },
        },
      ]
    );

  const onToggle2FA = async () => {
    if (user?.two_factor_enabled) {
      try {
        await tfaDisable();
        await refresh();
      } catch (e) {
        Alert.alert("Failed", apiError(e));
      }
    } else {
      router.push("/tfa-setup");
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} testID="profile-screen">
      <View style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity testID="profile-edit-avatar" onPress={pickAvatar}>
          <Avatar uri={user?.avatar} name={user?.name} size={96} seedId={user?.id} />
          <View style={[styles.editAvatarBadge, { backgroundColor: COLORS.aiAccent }]}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </TouchableOpacity>
        <Text style={[styles.name, { color: colors.textPrimary }]}>{user?.name}</Text>
        <Text style={[styles.email, { color: colors.textSecondary }]}>{user?.email}</Text>
        {user?.bio ? (
          <Text style={[styles.bio, { color: colors.textPrimary }]}>{user.bio}</Text>
        ) : null}
      </View>

      <SectionHeader text="Security" colors={colors} />
      <Row
        colors={colors}
        icon="shield-checkmark"
        label="Two-factor authentication"
        right={
          <Switch
            testID="profile-2fa-switch"
            value={!!user?.two_factor_enabled}
            onValueChange={onToggle2FA}
            trackColor={{ true: COLORS.success, false: colors.border }}
          />
        }
      />

      <SectionHeader text="Appearance" colors={colors} />
      <Row
        colors={colors}
        icon={mode === "dark" ? "moon" : "sunny"}
        label={mode === "dark" ? "Dark mode" : "Light mode"}
        right={
          <Switch
            testID="profile-theme-switch"
            value={mode === "dark"}
            onValueChange={toggle}
            trackColor={{ true: COLORS.aiAccent, false: colors.border }}
          />
        }
      />

      <SectionHeader text="Account" colors={colors} />
      <Row
        colors={colors}
        icon="log-out"
        label="Sign out"
        onPress={async () => {
          await signOut();
          router.replace("/(auth)/login");
        }}
        testID="profile-signout"
      />
      <Row
        colors={colors}
        icon="trash"
        label="Delete account & data"
        danger
        onPress={onDeleteAccount}
        testID="profile-delete-account"
      />

      <Text style={{ textAlign: "center", color: colors.textSecondary, fontSize: 12, marginVertical: 24 }}>
        CipherLink · Secure by default · v1.0
      </Text>
    </ScrollView>
  );
}

function SectionHeader({ text, colors }: any) {
  return (
    <Text style={{ marginTop: 22, marginBottom: 6, marginLeft: 16, color: colors.textSecondary, fontSize: 12, fontWeight: "700" }}>
      {text.toUpperCase()}
    </Text>
  );
}

function Row({ colors, icon, label, right, onPress, danger, testID }: any) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Ionicons name={icon} size={20} color={danger ? COLORS.error : COLORS.primary} />
      <Text style={{ flex: 1, marginLeft: 12, color: danger ? COLORS.error : colors.textPrimary, fontWeight: "600" }}>
        {label}
      </Text>
      {right || (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} /> : null)}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    padding: 24,
    paddingTop: 32,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  name: { fontSize: 22, fontWeight: "700", marginTop: 14 },
  email: { fontSize: 14, marginTop: 2 },
  bio: { marginTop: 10, textAlign: "center", paddingHorizontal: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  editAvatarBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
});
