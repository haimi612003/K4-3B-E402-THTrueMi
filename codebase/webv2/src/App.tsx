import { useEffect, useMemo, useState, type ReactNode } from "react";
import { HttpAgent } from "@ag-ui/client";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useAgUiRuntime } from "@assistant-ui/react-ag-ui";
import { MoonIcon, SunIcon } from "@heroicons/react/20/solid";
import classPulseLogo from "./assets/class-pulse-logo.svg";
import { ChatThread, type StateSnapshot } from "./components/ChatThread";
import { SamplePanel, type Sample } from "./components/SamplePanel";
import { updateClusterRun, type ClusterRunState } from "./cluster-run";

const agentUrl = import.meta.env.VITE_AG_UI_URL || "/api/ag-ui/cluster";
type Theme = "light" | "dark";

type ActiveCommandStore = {
  get: () => string | null;
  set: (commandId: string | null) => void;
};

function createActiveCommandStore(): ActiveCommandStore {
  let currentCommand: string | null = null;
  return {
    get: () => currentCommand,
    set: (commandId) => {
      currentCommand = commandId;
    },
  };
}

const activeCommandStore = createActiveCommandStore();

function initialTheme(): Theme {
  const saved = localStorage.getItem("class-pulse-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function textFromMessageContent(content: unknown) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part) {
        return typeof part.text === "string" ? part.text : "";
      }
      return "";
    })
    .join("");
}

async function forwardClassPulsePayload(
  url: string,
  requestInit: RequestInit,
  activeCommandStore: ActiveCommandStore,
  onPrepared: (count: number, command: string | null) => void,
) {
  if (typeof requestInit.body !== "string") {
    return fetch(url, { ...requestInit, credentials: "include" });
  }

  const input = JSON.parse(requestInit.body) as {
    messages?: Array<{ role?: string; content?: unknown }>;
    forwardedProps?: Record<string, unknown>;
  };
  const splitQuestionsForGom = activeCommandStore.get() === "gom";
  const userMessages = (input.messages || []).filter(
    (message) => message.role === "user",
  );
  const questions = (splitQuestionsForGom
    ? userMessages.slice(-1)
    : userMessages
  ).flatMap((message) => {
    const text = textFromMessageContent(message.content).trim();
    if (!text) return [];
    if (!splitQuestionsForGom) return [text];
    return text
      .split(/\r?\n/)
      .map((question) => question.trim())
      .filter(Boolean);
  });

  onPrepared(questions.length, activeCommandStore.get());
  activeCommandStore.set(null);

  return fetch(url, {
    ...requestInit,
    credentials: "include",
    body: JSON.stringify({
      ...input,
      forwardedProps: {
        ...input.forwardedProps,
        payload: { label: "Trò chuyện Class Pulse", questions },
      },
    }),
  });
}

function AgUiRuntimeProvider({
  children,
}: {
  children: (
    snapshot: StateSnapshot | null,
    setActiveCommand: (commandId: string | null) => void,
    runState: ClusterRunState,
    onRetry: () => void,
  ) => ReactNode;
}) {
  const [latestSnapshot, setLatestSnapshot] = useState<StateSnapshot | null>(
    null,
  );
  const [runState, setRunState] = useState<ClusterRunState>({ status: "idle", phase: "preparing" });
  const [retryStore] = useState(() => {
    let command: string | null = null;
    let parentId: string | null = null;
    return {
      setCommand: (value: string | null) => { command = value; },
      setParentId: (value: string | null) => { parentId = value; },
      get: () => ({ command, parentId }),
    };
  });
  const agent = useMemo(
    () =>
      new HttpAgent({
        url: agentUrl,
        debug: import.meta.env.DEV,
        fetch: (url, requestInit) =>
          forwardClassPulsePayload(url, requestInit, activeCommandStore, (count, command) => {
            retryStore.setCommand(command);
            setRunState((previous) => ({ ...previous, count }));
          }),
      }),
    [retryStore],
  );
  const runtime = useAgUiRuntime({
    agent,
    showThinking: false,
    onCancel: () => setRunState((previous) => ({ ...previous, status: "idle" })),
  });

  useEffect(() => {
    let assistantMessageId: string | undefined;
    const subscription = agent.subscribe({
      onRunInitialized: ({ input }) => {
        assistantMessageId = undefined;
        retryStore.setParentId(input.messages.filter((message) => message.role === "user").at(-1)?.id ?? null);
        setRunState({ status: "loading", phase: "preparing" });
      },
      onRunFailed: ({ error }) => {
        setRunState((previous) => ({ ...previous, status: error.name === "AbortError" ? "idle" : "error" }));
      },
      onRunFinalized: () => {
        // Cancelled runs have no terminal SSE event; do not leave a skeleton behind.
        setRunState((previous) => previous.status === "loading" ? { ...previous, status: "idle" } : previous);
      },
      onEvent: ({ event }) => {
        setRunState((previous) => updateClusterRun(previous, event));
        if (event.type === "RUN_STARTED") {
          assistantMessageId = undefined;
        }
        if (event.type === "TEXT_MESSAGE_START" && event.role !== "user" && typeof event.messageId === "string") {
          assistantMessageId = event.messageId;
        }
        if (event.type === "STATE_SNAPSHOT") {
          const snapshot = event.snapshot as StateSnapshot;
          if (snapshot.status !== "completed") return;
          const messageId = assistantMessageId;
          setLatestSnapshot((previous) => ({
            ...snapshot,
            messageId,
            resultsByMessage: {
              ...previous?.resultsByMessage,
              ...(messageId ? { [messageId]: snapshot.result } : {}),
            },
          }));
        }
      },
    });
    return () => subscription.unsubscribe();
  }, [agent, retryStore]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children(latestSnapshot, (commandId) => {
        activeCommandStore.set(commandId);
      }, runState, () => {
        const { parentId, command } = retryStore.get();
        if (!parentId || runtime.thread.getState().isRunning) return;
        activeCommandStore.set(command);
        runtime.thread.startRun({ parentId });
      })}
    </AssistantRuntimeProvider>
  );
}

function App() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [samples, setSamples] = useState<Sample[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    localStorage.setItem("class-pulse-theme", theme);
  }, [theme]);

  return (
    <AgUiRuntimeProvider>
      {(latestSnapshot, setActiveCommand, runState, onRetry) => (
        <main className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground transition-colors">
          <header className="shrink-0 bg-background/80 px-5 py-4 backdrop-blur md:px-8">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
              <img
                src={classPulseLogo}
                alt="Class Pulse"
                className="h-8 w-auto dark:invert"
              />

              <button
                type="button"
                aria-label={
                  theme === "dark"
                    ? "Chuyển sang nền sáng"
                    : "Chuyển sang nền tối"
                }
                aria-pressed={theme === "dark"}
                onClick={() =>
                  setTheme((current) => (current === "dark" ? "light" : "dark"))
                }
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-card-foreground transition hover:bg-accent"
              >
                {theme === "dark" ? (
                  <SunIcon className="size-4" />
                ) : (
                  <MoonIcon className="size-4" />
                )}
                <span className="hidden sm:inline">
                  {theme === "dark" ? "Sáng" : "Tối"}
                </span>
              </button>
            </div>
          </header>

          <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-4 overflow-hidden px-2 py-4 md:px-0 lg:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.8fr)] lg:grid-rows-1">
            <section
              aria-label="Trò chuyện với Class Pulse"
              className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
            >
            <ChatThread
              runState={runState}
              onRetry={onRetry}
              samples={samples}
              latestSnapshot={latestSnapshot}
              onSlashCommandChange={setActiveCommand}
            />
            </section>
            <SamplePanel onSamplesChange={setSamples} />
          </div>
        </main>
      )}
    </AgUiRuntimeProvider>
  );
}

export default App;
