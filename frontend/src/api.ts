/**
 * Lightweight API client + auth token storage for CipherLink.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios, { AxiosError, AxiosInstance } from "axios";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "cipherlink.token";

export const api: AxiosInstance = axios.create({
  baseURL: `${BASE}/api`,
  timeout: 30000,
});

let _token: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (_token) return _token;
  const t = await AsyncStorage.getItem(TOKEN_KEY);
  _token = t;
  if (t) api.defaults.headers.common.Authorization = `Bearer ${t}`;
  return t;
}

export async function setToken(token: string | null) {
  _token = token;
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
    delete api.defaults.headers.common.Authorization;
  }
}

export function apiError(err: unknown, fallback = "Request failed"): string {
  const e = err as AxiosError<any>;
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return e?.message || fallback;
}

// ---- Auth ---------------------------------------------------------
export async function register(input: { email: string; password: string; name: string; phone?: string }) {
  const { data } = await api.post("/auth/register", input);
  await setToken(data.token);
  return data.user;
}

export async function login(input: { email: string; password: string }) {
  const { data } = await api.post("/auth/login", input);
  await setToken(data.token);
  return data.user;
}

export async function googleSession(session_id: string) {
  const { data } = await api.post("/auth/google", { session_id });
  await setToken(data.token);
  return data.user;
}

export async function getMe() {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function updateMe(patch: any) {
  const { data } = await api.patch("/users/me", patch);
  return data;
}

export async function deleteAccount() {
  await api.delete("/users/me");
  await setToken(null);
}

export async function searchUsers(q: string) {
  const { data } = await api.get("/users/search", { params: { q } });
  return data;
}

// ---- Conversations -----------------------------------------------
export async function listConversations() {
  const { data } = await api.get("/conversations");
  return data;
}

export async function createConversation(input: {
  type: "dm" | "group";
  member_ids: string[];
  name?: string;
  photo?: string;
}) {
  const { data } = await api.post("/conversations", input);
  return data;
}

export async function getConversation(id: string) {
  const { data } = await api.get(`/conversations/${id}`);
  return data;
}

export async function muteConversation(id: string) {
  const { data } = await api.post(`/conversations/${id}/mute`);
  return data;
}

export async function deleteConversation(id: string) {
  await api.delete(`/conversations/${id}`);
}

// ---- Messages -----------------------------------------------------
export async function listMessages(convId: string) {
  const { data } = await api.get(`/conversations/${convId}/messages`);
  return data;
}

export async function sendMessage(convId: string, input: any) {
  const { data } = await api.post(`/conversations/${convId}/messages`, input);
  return data;
}

export async function editMessage(id: string, content: string) {
  const { data } = await api.patch(`/messages/${id}`, { content });
  return data;
}

export async function deleteMessage(id: string) {
  await api.delete(`/messages/${id}`);
}

export async function reactMessage(id: string, emoji: string) {
  const { data } = await api.post(`/messages/${id}/react`, { emoji });
  return data;
}

export async function readAll(convId: string) {
  await api.post(`/conversations/${convId}/read-all`);
}

// ---- Cipher -------------------------------------------------------
export async function askCipher(prompt: string, conversationId?: string) {
  const { data } = await api.post("/cipher/ask", {
    prompt,
    conversation_id: conversationId,
  });
  return data;
}

// ---- Search -------------------------------------------------------
export async function search(q: string, type: "all" | "messages" | "contacts" | "ai" = "all") {
  const { data } = await api.get("/search", { params: { q, type } });
  return data;
}

// ---- 2FA ----------------------------------------------------------
export async function tfaSetup() {
  const { data } = await api.post("/2fa/setup");
  return data;
}

export async function tfaVerify(code: string, secret?: string) {
  const { data } = await api.post("/2fa/verify", { code, secret });
  return data;
}

export async function tfaDisable() {
  await api.delete("/2fa");
}

export const BACKEND_URL = BASE;
