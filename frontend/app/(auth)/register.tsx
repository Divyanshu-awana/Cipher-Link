import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS } from "../../src/theme";
import { useAuth, useTheme } from "../../src/store";
import { apiError, register } from "../../src/api";

export default function RegisterScreen() {
  const { colors } = useTheme();
  const { setUser } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name || !email || !pw) {
      Alert.alert("Missing info", "Name, email and password are required.");
      return;
    }
    setBusy(true);
    try {
      const u = await register({ name, email, password: pw, phone: phone || undefined });
      setUser(u);
      router.replace("/(auth)/profile-setup");
    } catch (e) {
      Alert.alert("Registration failed", apiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 64 }} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: colors.textPrimary }]}>Create your account</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          End-to-end encrypted chats with Cipher AI built-in.
        </Text>

        {[
          { icon: "person", v: name, set: setName, ph: "Full name", testID: "register-name-input" },
          { icon: "mail", v: email, set: setEmail, ph: "Email", auto: "email-address", testID: "register-email-input" },
          { icon: "call", v: phone, set: setPhone, ph: "Phone (optional)", auto: "phone-pad", testID: "register-phone-input" },
        ].map((f) => (
          <View key={f.ph} style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name={f.icon as any} size={18} color={colors.textSecondary} />
            <TextInput
              testID={f.testID}
              value={f.v}
              onChangeText={f.set}
              placeholder={f.ph}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              keyboardType={(f.auto as any) || "default"}
              style={[styles.input, { color: colors.textPrimary }]}
            />
          </View>
        ))}
        <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="lock-closed" size={18} color={colors.textSecondary} />
          <TextInput
            testID="register-password-input"
            value={pw}
            onChangeText={setPw}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            style={[styles.input, { color: colors.textPrimary }]}
          />
        </View>

        <TouchableOpacity testID="register-submit-button" onPress={submit} disabled={busy} style={[styles.btn, busy && { opacity: 0.6 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create account</Text>}
        </TouchableOpacity>

        <View style={{ flexDirection: "row", marginTop: 20, justifyContent: "center" }}>
          <Text style={{ color: colors.textSecondary }}>Already a member? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity testID="goto-login">
              <Text style={{ color: COLORS.primary, fontWeight: "700" }}>Sign in</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 26, fontWeight: "700" },
  sub: { marginTop: 6, marginBottom: 24 },
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 12,
    gap: 10,
  },
  input: { flex: 1, fontSize: 15 },
  btn: {
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: RADIUS.button,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
