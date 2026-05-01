import React from "react";
import { View } from "react-native";

/** Static waveform visualization; bar heights are seeded by id. */
export default function VoiceWaveform({
  id = "wave",
  color = "#1A73E8",
  width = 140,
  height = 28,
}: {
  id?: string;
  color?: string;
  width?: number;
  height?: number;
}) {
  const bars = 22;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const heights = Array.from({ length: bars }, (_, i) => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return 4 + (h % (height - 4));
  });
  return (
    <View style={{ width, height, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      {heights.map((bh, i) => (
        <View
          key={i}
          style={{
            width: 3,
            height: bh,
            borderRadius: 2,
            backgroundColor: color,
            opacity: 0.8,
          }}
        />
      ))}
    </View>
  );
}
