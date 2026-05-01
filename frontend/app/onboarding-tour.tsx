import React, { useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, ASSETS, RADIUS } from "../src/theme";
import { useTheme } from "../src/store";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    title: "Meet Cipher AI",
    body: "Mention @Cipher in any chat to find restaurants, schedule meetings, or summarize docs.",
    icon: "sparkles" as const,
  },
  {
    title: "Encrypted by default",
    body: "Bank-grade transport, JWT, optional 2FA, and a one-tap GDPR data wipe.",
    icon: "shield-checkmark" as const,
  },
  {
    title: "All your conversations",
    body: "DMs, groups, voice notes, files & rich AI cards in one calm inbox.",
    icon: "chatbubbles" as const,
  },
];

export default function OnboardingTour() {
  const router = useRouter();
  const { colors } = useTheme();
  const [page, setPage] = useState(0);
  const ref = useRef<FlatList>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  };

  const next = () => {
    if (page < SLIDES.length - 1) {
      ref.current?.scrollToIndex({ index: page + 1, animated: true });
    } else {
      router.replace("/(tabs)/chats");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        data={SLIDES}
        keyExtractor={(s) => s.title}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Image source={{ uri: ASSETS.onboardingHero }} style={styles.hero} />
            <View style={[styles.iconWrap, { backgroundColor: COLORS.aiAccent + "22" }]}>
              <Ionicons name={item.icon} size={28} color={COLORS.aiAccent} />
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{item.title}</Text>
            <Text style={[styles.body, { color: colors.textSecondary }]}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === page
                ? { backgroundColor: COLORS.primary, width: 22 }
                : { backgroundColor: colors.border },
            ]}
          />
        ))}
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: 32 }}>
        <TouchableOpacity testID="tour-next-button" onPress={next} style={styles.btn}>
          <Text style={styles.btnText}>{page < SLIDES.length - 1 ? "Next" : "Start chatting"}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="tour-skip-button"
          onPress={() => router.replace("/(tabs)/chats")}
          style={{ alignItems: "center", marginTop: 12 }}
        >
          <Text style={{ color: colors.textSecondary }}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slide: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  hero: { width: 240, height: 240, borderRadius: 28, marginBottom: 24 },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 26, fontWeight: "700", textAlign: "center" },
  body: { fontSize: 15, textAlign: "center", marginTop: 10, lineHeight: 22 },
  dots: { flexDirection: "row", alignSelf: "center", gap: 6, marginVertical: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  btn: {
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: RADIUS.button,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
