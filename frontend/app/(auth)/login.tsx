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
import { useRouter, Link } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { COLORS, ASSETS, RADIUS } from "../../src/theme";
import { useAuth, useTheme } from "../../src/store";
import { apiError, googleSession, login } from "../../src/api";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const { colors } = useTheme();
  const { setUser } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [gBusy, setGBusy] = useState(false);

  const submit = async () => {
    if (!email || !pw) {
      Alert.alert("Missing info", "Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      const u = await login({ email, password: pw });
      setUser(u);
      router.replace("/(tabs)/chats");
    } catch (e) {
      Alert.alert("Login failed", apiError(e));
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = async () => {
    setGBusy(true);
    try {
      const redirect = Linking.createURL("/auth-callback");
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect);
      if (result.type !== "success" || !result.url) {
        setGBusy(false);
        return;
      }
      const fragment = result.url.split("#")[1] || "";
      const params = new URLSearchParams(fragment);
      const sid = params.get("session_id");
      if (!sid) {
        Alert.alert("Google sign-in", "No session returned.");
        setGBusy(false);
        return;
      }
      const u = await googleSession(sid);
      setUser(u);
      router.replace("/(tabs)/chats");
    } catch (e) {
      Alert.alert("Google sign-in failed", apiError(e));
    } finally {
      setGBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Image source={{ uri: ASSETS.cipherAvatar }} style={styles.logo} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>Welcome to CipherLink</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Secure chat, supercharged with Cipher AI
        </Text>

        <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="mail" size={18} color={colors.textSecondary} />
          <TextInput
            testID="login-email-input"
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            style={[styles.input, { color: colors.textPrimary }]}
          />
        </View>
        <View style={[styles.field, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="lock-closed" size={18} color={colors.textSecondary} />
          <TextInput
            testID="login-password-input"
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            value={pw}
            onChangeText={setPw}
            secureTextEntry
            style={[styles.input, { color: colors.textPrimary }]}
          />
        </View>

        <TouchableOpacity
          testID="login-submit-button"
          onPress={submit}
          disabled={busy}
          style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Sign in</Text>}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>OR</Text>
          <View style={[styles.line, { backgroundColor: colors.border }]} />
        </View>

        <TouchableOpacity
          testID="login-google-button"
          onPress={googleLogin}
          disabled={gBusy}
          style={[styles.googleBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {gBusy ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <>
              <Ionicons name="logo-google" size={18} color="#EA4335" />
              <Text style={{ color: colors.textPrimary, fontWeight: "600", marginLeft: 8 }}>
                Continue with Google
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: "row", marginTop: 24, justifyContent: "center" }}>
          <Text style={{ color: colors.textSecondary }}>New to CipherLink? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity testID="goto-register">
              <Text style={{ color: COLORS.primary, fontWeight: "700" }}>Create account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 80, alignItems: "stretch" },
  logo: { width: 72, height: 72, borderRadius: 22, alignSelf: "center" },
  title: { fontSize: 26, fontWeight: "700", marginTop: 18, textAlign: "center" },
  sub: { textAlign: "center", marginTop: 6, marginBottom: 32 },
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
  primaryBtn: {
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: RADIUS.button,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 18 },
  line: { flex: 1, height: 1 },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: RADIUS.button,
    borderWidth: 1,
  },
});
