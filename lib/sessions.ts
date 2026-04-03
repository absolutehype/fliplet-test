import type { UIMessage } from "ai";

const STORAGE_KEY = "fliplet-chat-sessions";

export interface ChatSession {
  createdAt: number;
  id: string;
  messages: UIMessage[];
  title: string;
}

export function generateId(): string {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getSessions(): ChatSession[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return [];
  }
  const sessions: ChatSession[] = JSON.parse(raw);
  return sessions.sort((a, b) => b.createdAt - a.createdAt);
}

export function saveSession(session: ChatSession): void {
  const sessions = getSessions();
  const index = sessions.findIndex((s) => s.id === session.id);
  if (index >= 0) {
    sessions[index] = session;
  } else {
    sessions.unshift(session);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function deleteSession(id: string): void {
  const sessions = getSessions().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function getSession(id: string): ChatSession | undefined {
  return getSessions().find((s) => s.id === id);
}
