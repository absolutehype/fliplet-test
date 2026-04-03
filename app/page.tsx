"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  type ChatSession,
  deleteSession,
  generateId,
  getSession,
  getSessions,
  saveSession,
} from "@/lib/sessions";

const EXAMPLE_PROMPTS = [
  "List all my data sources",
  "Show me records from a data source",
  "What data sources are available?",
];

export default function Chat() {
  const [ready, setReady] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pendingMessage = useRef<string | null>(null);

  const activeSession = activeId ? getSession(activeId) : undefined;
  const chatId = activeId ?? "new";

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: chatId,
    messages: activeSession?.messages as UIMessage[] | undefined,
  });

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLoading = status === "streaming" || status === "submitted";
  const hasSessions = sessions.length > 0;
  const isInChat = activeId !== null && messages.length > 0;

  // Load sessions from localStorage on mount with minimum display time
  useEffect(() => {
    const loaded = getSessions();
    const timer = setTimeout(() => {
      setSessions(loaded);
      setReady(true);
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  // Send pending message after activeId changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: fire once after activeId changes
  useEffect(() => {
    if (activeId && pendingMessage.current) {
      const msg = pendingMessage.current;
      pendingMessage.current = null;
      sendMessage({ parts: [{ type: "text", text: msg }], role: "user" });
    }
  }, [activeId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message/loading changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Persist messages to localStorage when they change
  // biome-ignore lint/correctness/useExhaustiveDependencies: save on message changes
  useEffect(() => {
    if (!activeId || messages.length === 0) {
      return;
    }
    const firstUserMsg = messages.find((m) => m.role === "user");
    const title = firstUserMsg
      ? firstUserMsg.parts
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("")
          .slice(0, 50)
      : "New chat";

    const session: ChatSession = {
      createdAt: activeSession?.createdAt ?? Date.now(),
      id: activeId,
      messages,
      title,
    };
    saveSession(session);
    setSessions(getSessions());
  }, [messages, activeId]);

  const startNewSession = (text: string) => {
    const newId = generateId();
    pendingMessage.current = text;
    setActiveId(newId);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) {
      return;
    }
    const message = input;
    setInput("");

    if (activeId) {
      sendMessage({ parts: [{ type: "text", text: message }], role: "user" });
    } else {
      startNewSession(message);
    }
  };

  const handlePromptClick = (prompt: string) => {
    if (activeId) {
      sendMessage({ parts: [{ type: "text", text: prompt }], role: "user" });
    } else {
      startNewSession(prompt);
    }
  };

  const handleNewChat = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setInput("");
    setSidebarOpen(false);
  }, [setMessages]);

  const handleSelectSession = useCallback(
    (id: string) => {
      const session = getSession(id);
      if (session) {
        setActiveId(id);
        setMessages(session.messages as UIMessage[]);
        setSidebarOpen(false);
      }
    },
    [setMessages]
  );

  const handleDeleteSession = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      deleteSession(id);
      const updated = getSessions();
      setSessions(updated);

      if (activeId === id) {
        if (updated.length > 0) {
          handleSelectSession(updated[0].id);
        } else {
          handleNewChat();
        }
      }
    },
    [activeId, handleSelectSession, handleNewChat]
  );

  const showLaunchState = !isInChat && messages.length === 0;

  return (
    <div className="chat-layout">
      <header className="chat-header">
        {hasSessions && (
          <button
            aria-label="Toggle sidebar"
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            type="button"
          >
            <span className="sidebar-toggle-icon" />
          </button>
        )}
        <Image
          alt="Fliplet"
          className="chat-header-logo"
          height={28}
          src="/fliplet-logo.svg"
          width={98}
        />
      </header>

      <div className="chat-body">
        <AnimatePresence>
          {!ready && (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="page-loader"
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.3 } }}
              initial={{ opacity: 0, scale: 0.9 }}
              key="page-loader"
              transition={{ duration: 0.3 }}
            >
              <div className="page-spinner" />
            </motion.div>
          )}
        </AnimatePresence>

        {ready && hasSessions && (
          <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
            <button
              className="sidebar-new-chat"
              onClick={handleNewChat}
              type="button"
            >
              + New chat
            </button>
            <nav className="sidebar-sessions">
              {sessions.map((session) => (
                <button
                  className={`sidebar-session ${session.id === activeId ? "sidebar-session-active" : ""}`}
                  key={session.id}
                  onClick={() => handleSelectSession(session.id)}
                  type="button"
                >
                  <span className="sidebar-session-title">{session.title}</span>
                  <button
                    aria-label={`Delete ${session.title}`}
                    className="sidebar-session-delete"
                    onClick={(e) => handleDeleteSession(session.id, e)}
                    type="button"
                  >
                    &times;
                  </button>
                </button>
              ))}
            </nav>
          </aside>
        )}

        {ready && (
          <main className="chat-main">
            <AnimatePresence>
              {showLaunchState && (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  className="launch-state"
                  exit={{ opacity: 0, y: -20, transition: { duration: 0.2 } }}
                  initial={{ opacity: 0, y: 12 }}
                  key="launch"
                  transition={{ duration: 0.5, ease: "easeOut" }}
                >
                  <h2 className="launch-greeting">Hello, how can I help?</h2>
                  <form className="launch-form" onSubmit={handleSubmit}>
                    <input
                      aria-label="Chat message"
                      className="chat-input launch-input"
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask about your data sources..."
                      value={input}
                    />
                    <button
                      className="chat-submit"
                      disabled={!input.trim()}
                      type="submit"
                    >
                      Send
                    </button>
                  </form>
                  <div className="launch-prompts">
                    {EXAMPLE_PROMPTS.map((prompt, i) => (
                      <motion.button
                        animate={{ opacity: 1, y: 0 }}
                        className="launch-prompt"
                        initial={{ opacity: 0, y: 8 }}
                        key={prompt}
                        onClick={() => handlePromptClick(prompt)}
                        transition={{ delay: 0.3 + i * 0.1, duration: 0.4 }}
                        type="button"
                      >
                        {prompt}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!showLaunchState && (
              <motion.div
                animate={{ opacity: 1 }}
                className="chat-container"
                initial={{ opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
              >
                <div className="chat-messages">
                  {messages.map((message) => {
                    const text = message.parts
                      .filter((part) => part.type === "text")
                      .map((part) => part.text)
                      .join("");

                    if (!text && message.role === "assistant") {
                      return null;
                    }

                    return (
                      <motion.div
                        animate={{ opacity: 1, y: 0 }}
                        className={`message message-${message.role}`}
                        initial={{ opacity: 0, y: 6 }}
                        key={message.id}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                      >
                        {text}
                      </motion.div>
                    );
                  })}

                  <AnimatePresence>
                    {isLoading && (
                      <motion.div
                        animate={{ opacity: 1, scale: 1 }}
                        className="thinking-bubble"
                        exit={{ opacity: 0, scale: 0.5 }}
                        initial={{ opacity: 0, scale: 0.5 }}
                        key="thinking"
                        transition={{ duration: 0.25 }}
                      />
                    )}
                    {error && (
                      <motion.div
                        animate={{ opacity: 1, y: 0 }}
                        className="message message-error"
                        initial={{ opacity: 0, y: 6 }}
                        key="error"
                        transition={{ duration: 0.35 }}
                      >
                        Something went wrong. Please try again.
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div ref={messagesEndRef} />
                </div>

                <form className="chat-form" onSubmit={handleSubmit}>
                  <input
                    aria-label="Chat message"
                    className="chat-input"
                    disabled={isLoading}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about your data sources..."
                    value={input}
                  />
                  <button
                    className="chat-submit"
                    disabled={isLoading || !input.trim()}
                    type="submit"
                  >
                    Send
                  </button>
                </form>
              </motion.div>
            )}
          </main>
        )}
      </div>
    </div>
  );
}
