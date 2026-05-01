import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../src/theme";
import { useTheme } from "../../src/store";
import { search as searchApi } from "../../src/api";
import Avatar from "../../src/Avatar";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "messages", label: "Messages" },
  { key: "contacts", label: "Contacts" },
  { key: "ai", label: "AI Conversations" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default function SearchTab() {
  const { colors } = useTheme();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [data, setData] = useState<any>({ messages: [], contacts: [], ai: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setData({ messages: [], contacts: [], ai: [] });
      return;
    }
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchApi(q.trim(), filter);
        setData(res);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
  }, [q, filter]);

  const showMessages = filter === "all" || filter === "messages";
  const showContacts = filter === "all" || filter === "contacts";
  const showAi = filter === "all" || filter === "ai";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="search-screen">
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          testID="search-input"
          value={q}
          onChangeText={setQ}
          placeholder="Search messages, people, AI…"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          style={[styles.input, { color: colors.textPrimary }]}
        />
        {!!q && (
          <TouchableOpacity onPress={() => setQ("")}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              testID={`search-filter-${f.key}`}
              onPress={() => setFilter(f.key)}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? COLORS.primary : colors.surface,
                  borderColor: active ? COLORS.primary : colors.border,
                },
              ]}
            >
              <Text style={{ color: active ? "#fff" : colors.textPrimary, fontWeight: "600" }}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 24 }} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          {showContacts && data.contacts?.length > 0 && (
            <Section title="Contacts" colors={colors}>
              {data.contacts.map((c: any) => (
                <View key={c.id} style={[styles.row, { borderBottomColor: colors.border }]}>
                  <Avatar uri={c.avatar} name={c.name} seedId={c.id} size={42} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: colors.textPrimary, fontWeight: "700" }}>{c.name}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{c.email}</Text>
                  </View>
                </View>
              ))}
            </Section>
          )}

          {showMessages && data.messages?.length > 0 && (
            <Section title="Messages" colors={colors}>
              {data.messages.map((m: any) => (
                <View key={m.id} style={[styles.row, { borderBottomColor: colors.border, alignItems: "flex-start" }]}>
                  <Ionicons name="chatbubble" size={18} color={COLORS.primary} style={{ marginTop: 4 }} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: colors.textPrimary }} numberOfLines={3}>
                      {m.content}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                      {new Date(m.created_at).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </Section>
          )}

          {showAi && data.ai?.length > 0 && (
            <Section title="Cipher AI" colors={colors}>
              {data.ai.map((m: any) => (
                <View key={m.id} style={[styles.row, { borderBottomColor: colors.border, alignItems: "flex-start" }]}>
                  <Ionicons name="sparkles" size={18} color={COLORS.aiAccent} style={{ marginTop: 4 }} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={{ color: colors.textPrimary }} numberOfLines={3}>
                      {m.content}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                      {m.role} · {new Date(m.created_at).toLocaleString()}
                    </Text>
                  </View>
                </View>
              ))}
            </Section>
          )}

          {q.trim() &&
            !data.contacts?.length &&
            !data.messages?.length &&
            !data.ai?.length && (
              <View style={{ alignItems: "center", marginTop: 32 }}>
                <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
                <Text style={{ color: colors.textSecondary, marginTop: 8 }}>No results for “{q}”</Text>
              </View>
            )}
        </ScrollView>
      )}
    </View>
  );
}

function Section({ title, colors, children }: any) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ color: colors.textSecondary, fontWeight: "700", marginBottom: 6, fontSize: 12, letterSpacing: 0.5 }}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    margin: 12,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 100,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: { flex: 1, fontSize: 15 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
