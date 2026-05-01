"use client";

import { useEffect, useState } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

type Memory = {
  name: string;
  fact: string;
  topic?: string | null;
  create_time?: string;
  update_time?: string;
};

const TOPIC_META: Record<string, { label: string; accent: string }> = {
  personal_records:    { label: "PRs",      accent: "from-amber-500/20 to-amber-500/5  border-amber-500/30" },
  workout_results:     { label: "Workouts", accent: "from-sky-500/20   to-sky-500/5    border-sky-500/30"   },
  recurring_routines:  { label: "Routines", accent: "from-violet-500/20 to-violet-500/5 border-violet-500/30" },
  physical_state:      { label: "Body",     accent: "from-rose-500/20  to-rose-500/5   border-rose-500/30"  },
  goals:               { label: "Goals",    accent: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30" },
};

function MemoryPanel() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchMemories = async () => {
      try {
        const r = await fetch("http://localhost:8000/memories");
        const data = await r.json();
        if (!cancelled) setMemories(data.memories ?? []);
      } catch {
        // backend not up yet — fine
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchMemories();
    const id = setInterval(fetchMemories, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const grouped = memories.reduce<Record<string, Memory[]>>((acc, m) => {
    const t = m.topic ?? "other";
    (acc[t] ||= []).push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Memory Bank</h2>
          <p className="text-sm text-zinc-400">
            Live extractions from your conversations · auto-refreshing
          </p>
        </div>
        <span className="text-xs uppercase tracking-wider text-zinc-500">
          {memories.length} {memories.length === 1 ? "memory" : "memories"}
        </span>
      </div>

      {loading && memories.length === 0 && (
        <div className="text-zinc-500 text-sm">Connecting…</div>
      )}

      {!loading && memories.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
          <p className="text-zinc-400">No memories yet.</p>
          <p className="text-sm text-zinc-600 mt-1">
            Tell the coach about a workout to get started.
          </p>
        </div>
      )}

      {Object.entries(grouped).map(([topic, items]) => {
        const meta = TOPIC_META[topic] ?? { label: topic, accent: "from-zinc-700/20 to-zinc-700/5 border-zinc-700" };
        return (
          <section key={topic}>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              {meta.label} <span className="text-zinc-700">· {items.length}</span>
            </h3>
            <div className="grid gap-2">
              {items.map((m) => (
                <div
                  key={m.name}
                  className={`rounded-lg border bg-gradient-to-br ${meta.accent} p-3 backdrop-blur-sm`}
                >
                  <p className="text-sm text-zinc-100 leading-relaxed">{m.fact}</p>
                  {m.update_time && (
                    <p className="text-[10px] text-zinc-500 mt-2 font-mono">
                      {new Date(m.update_time).toLocaleString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export default function Page() {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="crossfit_coach">
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="border-b border-zinc-900 px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-md bg-gradient-to-br from-amber-400 to-rose-500" />
            <div>
              <h1 className="text-lg font-semibold">CrossFit Memory</h1>
              <p className="text-xs text-zinc-500">
                Powered by Vertex AI Memory Bank · Gemini 2.5 · ADK
              </p>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-3xl px-8 py-12">
          <MemoryPanel />
        </div>

        <CopilotSidebar
          defaultOpen={true}
          clickOutsideToClose={false}
          labels={{
            title: "Coach",
            initial:
              "👋 Tell me about today's workout — times, weights, RX or scaled, how it felt. " +
              "Or ask me about your past PRs.",
          }}
        />
      </main>
    </CopilotKit>
  );
}
