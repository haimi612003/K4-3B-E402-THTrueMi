import { useEffect, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";

type SampleItem = {
  turn_id: string;
  q: string;
};

export type Sample = {
  id: string;
  title: string;
  hint: string;
  n: number;
  items: SampleItem[];
};

type SamplesResponse = {
  samples: Sample[];
  have_chatlog: boolean;
};

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: SamplesResponse }
  | { status: "error"; message: string };

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Không thể kết nối tới backend.";
}

export function SamplePanel({ onSamplesChange }: { onSamplesChange: (samples: Sample[]) => void }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/samples", {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          let detail = "";
          try {
            const body = (await response.json()) as { detail?: string; error?: string };
            detail = body.detail || body.error || "";
          } catch {
            // Keep the fallback message when the backend does not return JSON.
          }
          throw new Error(detail || `Backend trả về lỗi ${response.status}.`);
        }
        return (await response.json()) as SamplesResponse;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", data });
        onSamplesChange(data.samples);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({ status: "error", message: errorMessage(error) });
      });

    return () => controller.abort();
  }, [reloadKey, onSamplesChange]);

  return (
    <aside
      aria-label="Dữ liệu đầu vào"
      className="flex h-full min-h-0 max-h-full min-w-0 flex-col overflow-hidden rounded-3xl bg-background"
    >
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Dữ liệu đầu vào
            </p>
            <h2 className="mt-1 text-lg font-semibold text-card-foreground">
              Mẫu phân tích
            </h2>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {state.status === "loading" && (
          <div className="grid gap-3" aria-live="polite">
            {Array.from({ length: 4 }, (_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-2xl bg-muted"
              />
            ))}
          </div>
        )}

        {state.status === "error" && (
          <div className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
            <p className="font-medium">Không tải được dữ liệu mẫu</p>
            <p className="mt-1 text-destructive/80">{state.message}</p>
            <button
              type="button"
              onClick={() => {
                setState({ status: "loading" });
                setReloadKey((key) => key + 1);
              }}
              className="mt-3 rounded-lg border border-destructive/25 px-3 py-1.5 text-xs font-medium transition hover:bg-destructive/10"
            >
              Thử lại
            </button>
          </div>
        )}

        {state.status === "ready" && (
          <div className="grid gap-3">
            {!state.data.have_chatlog && (
              <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-xs leading-5 text-amber-700 dark:text-amber-300">
                Backend chưa có chatlog nên các thẻ hiện chưa có câu hỏi cụ thể.
              </div>
            )}

            {state.data.samples.map((sample) => (
              <article
                key={sample.id}
                className="rounded-2xl border border-border bg-background p-3 transition hover:border-primary/30"
              >
                <Accordion className="border-0">
                  <AccordionItem value={sample.id} className="border-0">
                    <AccordionTrigger className="p-1 hover:no-underline">
                      <div className="min-w-0 pr-2">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-medium leading-5 text-foreground">
                            {sample.title}
                          </h3>
                          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                            {sample.n} câu
                          </span>
                        </div>
                        <p className="mt-2 text-left text-xs leading-5 text-muted-foreground">
                          {sample.hint}
                        </p>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-0">
                      {sample.items.length > 0 ? (
                        <ul className="space-y-2 border-t border-border pt-3">
                          {sample.items.map((item) => (
                            <li key={item.turn_id} className="text-xs leading-5">
                              <span className="mr-2 font-mono text-[10px] text-muted-foreground">
                                {item.turn_id}
                              </span>
                              <span className="text-card-foreground">{item.q}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="border-t border-border pt-3 text-xs italic text-muted-foreground">
                          Chưa có câu hỏi mẫu.
                        </p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </article>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
