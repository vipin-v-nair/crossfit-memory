"use client";

import { useEffect, useState } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";

type Memory = {
  name: string;
  fact: string;
  topic?: string | null;
  topic_type?: "managed" | "custom";
  create_time?: string;
  update_time?: string;
};

// ── Custom CrossFit topics ────────────────────────────────────────────────────
const CUSTOM_TOPIC_META: Record<
  string,
  { label: string; accent: string; description: string }
> = {
  personal_records: {
    label: "PRs",
    accent: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
    description:
      "Your all-time bests on lifts and benchmark WODs — weight, time, reps, RX or scaled.",
  },
  workout_results: {
    label: "Workouts",
    accent: "from-sky-500/20 to-sky-500/5 border-sky-500/30",
    description:
      "Individual session results — WOD name, score, RX/scaled, and how it felt.",
  },
  recurring_routines: {
    label: "Routines",
    accent: "from-violet-500/20 to-violet-500/5 border-violet-500/30",
    description:
      "Programs and recurring patterns you follow — like CompTrain, 5/3/1, or annual events.",
  },
  physical_state: {
    label: "Body",
    accent: "from-rose-500/20 to-rose-500/5 border-rose-500/30",
    description:
      "Injuries, mobility limits, soreness patterns, and recovery status.",
  },
  goals: {
    label: "Goals",
    accent: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30",
    description:
      "Active training goals with target metrics and timelines you're working toward.",
  },
};

// ── Built-in managed topics (all 4 defaults provided by Memory Bank) ─────────
const MANAGED_TOPIC_META: Record<
  string,
  { label: string; accent: string; description: string }
> = {
  USER_PERSONAL_INFO: {
    label: "About You",
    accent: "from-slate-500/20 to-slate-500/5 border-slate-500/30",
    description:
      "Significant personal details — names, relationships, hobbies, competitive history, and important dates.",
  },
  USER_PREFERENCES: {
    label: "Preferences",
    accent: "from-teal-500/20 to-teal-500/5 border-teal-500/30",
    description:
      "Stated or implied likes, dislikes, preferred training styles, and equipment patterns.",
  },
  KEY_CONVERSATION_DETAILS: {
    label: "Key Events",
    accent: "from-cyan-500/20 to-cyan-500/5 border-cyan-500/30",
    description:
      "Important milestones or conclusions from your conversations — competitions booked, decisions made.",
  },
  EXPLICIT_INSTRUCTIONS: {
    label: "Reminders",
    accent: "from-orange-500/20 to-orange-500/5 border-orange-500/30",
    description:
      "Things you explicitly asked the coach to remember or forget.",
  },
};

// ── Divider between sections ──────────────────────────────────────────────────
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="h-px flex-1 bg-zinc-800" />
      <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-medium">
        {label}
      </span>
      <div className="h-px flex-1 bg-zinc-800" />
    </div>
  );
}

// ── Single topic group with hover tooltip ─────────────────────────────────────
function TopicGroup({
  topic,
  items,
  meta,
}: {
  topic: string;
  items: Memory[];
  meta: { label: string; accent: string; description: string };
}) {
  return (
    <section>
      {/* Heading + tooltip */}
      <div className="relative group inline-flex items-center gap-1 mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 cursor-help">
          {meta.label}
          <span className="text-zinc-700"> · {items.length}</span>
        </h3>
        {/* Tooltip bubble */}
        <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden group-hover:block z-20 w-56">
          <div className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed">
            {meta.description}
          </div>
          {/* Arrow */}
          <div className="w-2 h-2 bg-zinc-800 border-b border-r border-zinc-700 rotate-45 ml-3 -mt-1" />
        </div>
      </div>

      {/* Memory cards */}
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
}

// ── Memory panel ──────────────────────────────────────────────────────────────
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
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Split into custom vs managed, then group by topic within each.
  const customGrouped = memories
    .filter((m) => m.topic_type !== "managed" && m.topic && m.topic in CUSTOM_TOPIC_META)
    .reduce<Record<string, Memory[]>>((acc, m) => {
      const t = m.topic!;
      (acc[t] ||= []).push(m);
      return acc;
    }, {});

  const managedGrouped = memories
    .filter((m) => m.topic_type === "managed" && m.topic && m.topic in MANAGED_TOPIC_META)
    .reduce<Record<string, Memory[]>>((acc, m) => {
      const t = m.topic!;
      (acc[t] ||= []).push(m);
      return acc;
    }, {});

  const otherMemories = memories.filter(
    (m) =>
      !(m.topic && m.topic in CUSTOM_TOPIC_META) &&
      !(m.topic && m.topic in MANAGED_TOPIC_META)
  );

  const totalCount = memories.length;

  const hasCustom = Object.keys(customGrouped).length > 0;
  const hasManaged = Object.keys(managedGrouped).length > 0;
  const hasOther = otherMemories.length > 0;
  const isEmpty = totalCount === 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Memory Bank</h2>
          <p className="text-sm text-zinc-400">
            Live extractions from your conversations · auto-refreshing
          </p>
        </div>
        <span className="text-xs uppercase tracking-wider text-zinc-500">
          {totalCount} {totalCount === 1 ? "memory" : "memories"}
        </span>
      </div>

      {/* Loading / empty states */}
      {loading && isEmpty && (
        <div className="text-zinc-500 text-sm">Connecting…</div>
      )}
      {!loading && isEmpty && (
        <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
          <p className="text-zinc-400">No memories yet.</p>
          <p className="text-sm text-zinc-600 mt-1">
            Tell the coach about a workout to get started.
          </p>
        </div>
      )}

      {/* ── CrossFit Topics ── */}
      {hasCustom && (
        <div className="space-y-5">
          <SectionDivider label="CrossFit Topics" />
          {Object.keys(CUSTOM_TOPIC_META)
            .filter((t) => t in customGrouped)
            .map((topic) => (
              <TopicGroup
                key={topic}
                topic={topic}
                items={customGrouped[topic]}
                meta={CUSTOM_TOPIC_META[topic]}
              />
            ))}
        </div>
      )}

      {/* ── Built-in Topics ── */}
      {hasManaged && (
        <div className="space-y-5">
          <SectionDivider label="Built-in Topics" />
          {Object.keys(MANAGED_TOPIC_META)
            .filter((t) => t in managedGrouped)
            .map((topic) => (
              <TopicGroup
                key={topic}
                topic={topic}
                items={managedGrouped[topic]}
                meta={MANAGED_TOPIC_META[topic]}
              />
            ))}
        </div>
      )}

      {/* ── Uncategorised (fallback) ── */}
      {hasOther && (
        <div className="space-y-2">
          <SectionDivider label="Other" />
          {otherMemories.map((m) => (
            <div
              key={m.name}
              className="rounded-lg border border-zinc-700 bg-zinc-800/40 p-3"
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
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
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
