import React from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ASSETS, COLORS, RADIUS, SPACING } from "./theme";
import { useTheme } from "./store";

export type CipherCard =
  | {
      type: "restaurant";
      name: string;
      cuisine?: string;
      rating?: number;
      price?: string;
      distance_km?: number;
      address?: string;
      image_url?: string;
      book_url?: string;
    }
  | {
      type: "weather";
      location: string;
      current_temp_c: number;
      condition: string;
      icon?: string;
      forecast?: { day: string; high_c: number; low_c: number; icon?: string }[];
    }
  | {
      type: "calendar";
      title: string;
      date: string;
      time?: string;
      duration_min?: number;
      attendees?: string[];
      meet_link?: string;
    }
  | { type: "reminder"; title: string; when_iso?: string; note?: string }
  | { type: "general"; text: string };

export type CipherPayload = {
  intent: string;
  summary: string;
  cards?: CipherCard[];
  fallback?: boolean;
};

const WEATHER_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  sunny: "sunny",
  cloudy: "cloud",
  rainy: "rainy",
  snowy: "snow",
  stormy: "thunderstorm",
  "partly-cloudy": "partly-sunny",
};

function StarRow({ rating = 0 }: { rating?: number }) {
  const full = Math.round(rating);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= full ? "star" : "star-outline"}
          size={12}
          color="#FBBC04"
        />
      ))}
      <Text style={{ marginLeft: 4, fontSize: 12, color: "#5F6368" }}>
        {(rating || 0).toFixed(1)}
      </Text>
    </View>
  );
}

export default function CipherCardView({
  payload,
  loading = false,
}: {
  payload?: CipherPayload | null;
  loading?: boolean;
}) {
  const { colors, mode } = useTheme();
  const surface = colors.surface;
  const border = COLORS.aiAccent + "55";

  return (
    <View
      testID="cipher-card"
      style={[
        styles.wrap,
        {
          backgroundColor: mode === "dark" ? "#241B3F" : "#F6F1FF",
          borderColor: border,
        },
      ]}
    >
      <View style={styles.header}>
        <Image source={{ uri: ASSETS.cipherAvatar }} style={styles.cipherAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: COLORS.aiAccent }]}>Cipher</Text>
          {payload?.fallback ? (
            <Text style={{ fontSize: 11, color: COLORS.error }}>
              Limited mode
            </Text>
          ) : (
            <Text style={{ fontSize: 11, color: colors.textSecondary }}>
              Powered by Cipher AI
            </Text>
          )}
        </View>
      </View>

      {loading ? (
        <View style={{ flexDirection: "row", alignItems: "center", padding: SPACING.md, gap: 12 }}>
          <ActivityIndicator color={COLORS.aiAccent} />
          <Text style={{ color: colors.textSecondary }}>Cipher is thinking…</Text>
        </View>
      ) : (
        <>
          {payload?.summary ? (
            <Text style={[styles.summary, { color: colors.textPrimary }]}>{payload.summary}</Text>
          ) : null}
          {!!payload?.cards?.length && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={260}
              decelerationRate="fast"
              contentContainerStyle={{ gap: 12, paddingHorizontal: 12, paddingVertical: 8 }}
            >
              {payload.cards.slice(0, 3).map((c, i) => (
                <CardRenderer key={i} card={c} surface={surface} textColor={colors.textPrimary} subColor={colors.textSecondary} />
              ))}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

function CardRenderer({
  card,
  surface,
  textColor,
  subColor,
}: {
  card: CipherCard;
  surface: string;
  textColor: string;
  subColor: string;
}) {
  if (card.type === "restaurant") {
    return (
      <View testID="cipher-restaurant-card" style={[styles.card, { backgroundColor: surface }]}>
        <Image
          source={{ uri: card.image_url || ASSETS.restaurant }}
          style={styles.cardImage}
        />
        <View style={{ padding: 12, gap: 4 }}>
          <Text style={{ fontWeight: "700", color: textColor, fontSize: 15 }} numberOfLines={1}>
            {card.name}
          </Text>
          <Text style={{ color: subColor, fontSize: 12 }} numberOfLines={1}>
            {card.cuisine ? `${card.cuisine} · ` : ""}
            {card.price ? card.price : ""}
            {card.distance_km != null ? ` · ${card.distance_km} km` : ""}
          </Text>
          <StarRow rating={card.rating} />
          <TouchableOpacity
            testID="cipher-book-button"
            onPress={() => card.book_url && Linking.openURL(card.book_url).catch(() => {})}
            style={styles.bookBtn}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>Book Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  if (card.type === "weather") {
    const icon = WEATHER_ICONS[card.icon || ""] || "partly-sunny";
    return (
      <View testID="cipher-weather-card" style={[styles.card, { backgroundColor: surface, padding: 16 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Ionicons name={icon} size={48} color={COLORS.aiAccent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: textColor, fontWeight: "700", fontSize: 16 }} numberOfLines={1}>
              {card.location}
            </Text>
            <Text style={{ color: subColor, fontSize: 12 }}>{card.condition}</Text>
            <Text style={{ color: textColor, fontSize: 28, fontWeight: "700" }}>
              {Math.round(card.current_temp_c)}°
            </Text>
          </View>
        </View>
        {!!card.forecast?.length && (
          <View style={{ flexDirection: "row", marginTop: 10, justifyContent: "space-between" }}>
            {card.forecast.slice(0, 4).map((f, i) => {
              const fic = WEATHER_ICONS[f.icon || ""] || "partly-sunny";
              return (
                <View key={i} style={{ alignItems: "center" }}>
                  <Text style={{ fontSize: 11, color: subColor }}>{f.day}</Text>
                  <Ionicons name={fic} size={20} color={COLORS.aiAccent2} />
                  <Text style={{ fontSize: 11, color: textColor }}>
                    {Math.round(f.high_c)}° / {Math.round(f.low_c)}°
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  }
  if (card.type === "calendar") {
    return (
      <View testID="cipher-calendar-card" style={[styles.card, { backgroundColor: surface, padding: 16 }]}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={styles.dateBlock}>
            <Text style={{ color: "#fff", fontSize: 11 }}>
              {(card.date || "").slice(5, 7)}
            </Text>
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 18 }}>
              {(card.date || "").slice(8, 10)}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: textColor, fontWeight: "700" }} numberOfLines={2}>
              {card.title}
            </Text>
            <Text style={{ color: subColor, fontSize: 12 }} numberOfLines={1}>
              {card.time} · {card.duration_min || 30} min
            </Text>
            {!!card.attendees?.length && (
              <Text style={{ color: subColor, fontSize: 11 }} numberOfLines={1}>
                With {card.attendees.join(", ")}
              </Text>
            )}
          </View>
        </View>
        {card.meet_link ? (
          <TouchableOpacity
            onPress={() => Linking.openURL(card.meet_link!).catch(() => {})}
            style={[styles.bookBtn, { marginTop: 10 }]}
          >
            <Ionicons name="videocam" size={14} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", marginLeft: 6 }}>Join Meet</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }
  if (card.type === "reminder") {
    return (
      <View testID="cipher-reminder-card" style={[styles.card, { backgroundColor: surface, padding: 16 }]}>
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <Ionicons name="alarm" size={24} color={COLORS.aiAccent} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: textColor, fontWeight: "700" }}>{card.title}</Text>
            {card.when_iso ? (
              <Text style={{ color: subColor, fontSize: 12 }}>{card.when_iso}</Text>
            ) : null}
            {card.note ? (
              <Text style={{ color: subColor, fontSize: 12 }} numberOfLines={2}>
                {card.note}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.card, { backgroundColor: surface, padding: 14 }]}>
      <Text style={{ color: textColor }}>{(card as any).text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: RADIUS.card,
    borderWidth: 1,
    paddingVertical: 12,
    marginVertical: 4,
    width: "92%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 6,
    gap: 10,
  },
  cipherAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#7C3AED",
  },
  title: { fontWeight: "700", fontSize: 14, letterSpacing: 0.3 },
  summary: { paddingHorizontal: 14, paddingBottom: 6, fontSize: 14, lineHeight: 20 },
  card: {
    width: 240,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#0001",
  },
  cardImage: { width: "100%", height: 110, backgroundColor: "#ddd" },
  bookBtn: {
    backgroundColor: COLORS.aiAccent,
    paddingVertical: 8,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    marginTop: 6,
  },
  dateBlock: {
    width: 50,
    height: 56,
    borderRadius: 12,
    backgroundColor: COLORS.aiAccent,
    alignItems: "center",
    justifyContent: "center",
  },
});
