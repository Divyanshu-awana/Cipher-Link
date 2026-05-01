import React, { useEffect, useRef } from "react";
import { Animated, Easing, View, Text, StyleSheet } from "react-native";
import { useTheme } from "./store";

export default function TypingIndicator({ name }: { name?: string }) {
  const { colors } = useTheme();
  const a = useRef(new Animated.Value(0)).current;
  const b = useRef(new Animated.Value(0)).current;
  const c = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const dot = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: -4, duration: 300, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.delay(200),
        ])
      );
    const loops = [dot(a, 0), dot(b, 150), dot(c, 300)];
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [a, b, c]);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surfaceVariant }]} testID="typing-indicator">
      {name ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>{name} is typing</Text>
      ) : null}
      <View style={styles.dots}>
        {[a, b, c].map((v, i) => (
          <Animated.View
            key={i}
            style={[styles.dot, { backgroundColor: colors.textSecondary, transform: [{ translateY: v }] }]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    margin: 8,
  },
  label: { fontSize: 12 },
  dots: { flexDirection: "row", gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
