import React, { useEffect } from "react";
import { View, ActivityIndicator, Image, Text, StyleSheet } from "react-native";
import { Redirect } from "expo-router";
import { COLORS, ASSETS } from "../src/theme";
import { useAuth } from "../src/store";

export default function Index() {
  const { ready, user } = useAuth();
  // tiny visible splash while we hydrate
  if (!ready) {
    return (
      <View style={styles.wrap} testID="splash-screen">
        <Image source={{ uri: ASSETS.cipherAvatar }} style={styles.logo} />
        <Text style={styles.title}>CipherLink</Text>
        <ActivityIndicator color={COLORS.aiAccent} style={{ marginTop: 16 }} />
      </View>
    );
  }
  return <Redirect href={user ? "/(tabs)/chats" : "/(auth)/login"} />;
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0E0820",
  },
  logo: { width: 88, height: 88, borderRadius: 24 },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "700",
    marginTop: 18,
    letterSpacing: 1,
  },
});
