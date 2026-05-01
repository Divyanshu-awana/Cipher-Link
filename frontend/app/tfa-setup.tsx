import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS } from "../src/theme";
import { useAuth, useTheme } from "../src/store";
import { apiError, tfaSetup, tfaVerify } from "../src/api";

export default function TfaSetupScreen() {
  const { colors } = useTheme();
  const { refresh } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await tfaSetup();
        setData(d);
      } catch (e) {
        Alert.alert("Failed", apiError(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const verify = async () => {
    if (!code) return Alert.alert("Enter the 6-digit code");
    setBusy(true);
    try {
      await tfaVerify(code, data.secret);
      await refresh();
      Alert.alert("2FA enabled", "Your account is now extra-secure.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Invalid code", apiError(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading || !data) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 24 }}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Scan with your authenticator</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        Use Google Authenticator, 1Password, Authy, or similar to scan this QR code.
      </Text>

      <View style={{ alignItems: "center", marginVertical: 24 }}>
        <Image source={{ uri: data.qr_b64 }} style={{ width: 220, height: 220, borderRadius: 16, backgroundColor: "#fff" }} />
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>Or enter this secret manually:</Text>
      <View style={[styles.secret, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text selectable style={{ color: colors.textPrimary, fontFamily: "monospace", letterSpacing: 1 }}>
          {data.secret}
        </Text>
        <Ionicons name="key" size={16} color={COLORS.aiAccent} />
      </View>

      <Text style={[styles.label, { color: colors.textSecondary, marginTop: 24 }]}>
        Enter the 6-digit code from your app
      </Text>
      <TextInput
        testID="tfa-code-input"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="123 456"
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.codeInput,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
        ]}
      />

      <TouchableOpacity
        testID="tfa-verify-button"
        onPress={verify}
        disabled={busy}
        style={[styles.btn, { backgroundColor: COLORS.aiAccent, opacity: busy ? 0.6 : 1 }]}
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Enable 2FA</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700" },
  sub: { marginTop: 6, fontSize: 14, lineHeight: 20 },
  label: { fontSize: 12, fontWeight: "700", marginBottom: 8 },
  secret: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  codeInput: {
    borderWidth: 1,
    borderRadius: 14,
    height: 56,
    fontSize: 24,
    textAlign: "center",
    letterSpacing: 6,
  },
  btn: {
    height: 50,
    borderRadius: RADIUS.button,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
