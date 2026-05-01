import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS } from "../../src/theme";
import { useAuth, useTheme } from "../../src/store";
import { apiError, updateMe } from "../../src/api";
import Avatar from "../../src/Avatar";

export default function ProfileSetupScreen() {
  const { colors } = useTheme();
  const { user, setUser } = useAuth();
  const router = useRouter();
  const [bio, setBio] = useState(user?.bio || "");
  const [avatar, setAvatar] = useState<string | null>(user?.avatar || null);
  const [busy, setBusy] = useState(false);

  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
    });
    if (res.canceled) return;
    const a = res.assets[0];
    if (a?.base64) setAvatar(`data:image/jpeg;base64,${a.base64}`);
    else if (a?.uri) setAvatar(a.uri);
  };

  const save = async () => {
    setBusy(true);
    try {
      const u = await updateMe({ bio, avatar });
      setUser(u);
      router.replace("/onboarding-tour");
    } catch (e) {
      Alert.alert("Save failed", apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Set up your profile</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Add a photo and a short bio so friends recognize you.
        </Text>

        <View style={{ alignItems: "center", marginVertical: 24 }}>
          <TouchableOpacity testID="profile-avatar-pick" onPress={pickAvatar} style={{ position: "relative" }}>
            <Avatar uri={avatar} name={user?.name} size={110} seedId={user?.id} />
            <View style={[styles.editBadge, { backgroundColor: COLORS.aiAccent }]}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={{ color: colors.textPrimary, fontWeight: "700", marginTop: 12, fontSize: 18 }}>
            {user?.name}
          </Text>
          <Text style={{ color: colors.textSecondary }}>{user?.email}</Text>
        </View>

        <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            testID="profile-bio-input"
            value={bio}
            onChangeText={setBio}
            placeholder="Write a short bio"
            placeholderTextColor={colors.textSecondary}
            multiline
            style={[styles.input, { color: colors.textPrimary, minHeight: 80, textAlignVertical: "top" }]}
          />
        </View>

        <TouchableOpacity
          testID="profile-save-button"
          onPress={save}
          disabled={busy}
          style={[styles.btn, busy && { opacity: 0.6 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Continue</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: "700" },
  sub: { marginTop: 6 },
  field: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12 },
  input: { fontSize: 15 },
  btn: {
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: RADIUS.button,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
});
