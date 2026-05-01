import React from "react";
import { Image, Text, View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ASSETS, RADIUS, avatarFor } from "./theme";

type Props = {
  uri?: string | null;
  name?: string;
  size?: number;
  showOnline?: boolean;
  online?: boolean;
  isAi?: boolean;
  seedId?: string;
};

export default function Avatar({
  uri,
  name = "?",
  size = 48,
  showOnline = false,
  online = false,
  isAi = false,
  seedId,
}: Props) {
  const src = isAi ? ASSETS.cipherAvatar : uri || avatarFor(seedId || name);
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <View style={{ width: size, height: size }}>
      {src ? (
        <Image
          source={{ uri: src }}
          style={{ width: size, height: size, borderRadius: RADIUS.avatar, backgroundColor: "#ddd" }}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: RADIUS.avatar,
            backgroundColor: "#7C3AED",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#fff", fontSize: size * 0.4, fontWeight: "700" }}>{initial}</Text>
        </View>
      )}
      {isAi && (
        <View
          style={[
            styles.aiBadge,
            { width: size * 0.32, height: size * 0.32, borderRadius: size },
          ]}
        >
          <Ionicons name="sparkles" size={size * 0.18} color="#fff" />
        </View>
      )}
      {showOnline && (
        <View
          style={[
            styles.dot,
            {
              backgroundColor: online ? "#34A853" : "#9AA0A6",
              width: size * 0.28,
              height: size * 0.28,
              borderRadius: size,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    borderWidth: 2,
    borderColor: "#fff",
  },
  aiBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
});
