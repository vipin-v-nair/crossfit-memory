"use client";

import { useEffect, useState, useRef } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar, CopilotChat } from "@copilotkit/react-ui";
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

// ── Single Memory Card (Editable & Deletable) ──────────────────────────────────
function MemoryCard({
  m,
  accent,
  editingId,
  editFact,
  editTopic,
  setEditingId,
  setEditFact,
  setEditTopic,
  onDelete,
  onSave,
}: {
  m: Memory;
  accent: string;
  editingId: string | null;
  editFact: string;
  editTopic: string;
  setEditingId: (id: string | null) => void;
  setEditFact: (fact: string) => void;
  setEditTopic: (topic: string) => void;
  onDelete: (name: string) => Promise<void>;
  onSave: (name: string) => Promise<void>;
}) {
  const isEditing = editingId === m.name;
  const [showRevisions, setShowRevisions] = useState(false);
  const [revisions, setRevisions] = useState<{ fact: string; create_time: string }[]>([]);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  const handleToggleRevisions = async () => {
    const nextState = !showRevisions;
    setShowRevisions(nextState);
    if (nextState && revisions.length === 0) {
      setLoadingRevisions(true);
      try {
        const memoryId = m.name.split("/").pop();
        const r = await fetch(`/api/memories/${memoryId}/revisions`);
        const data = await r.json();
        setRevisions(data.revisions ?? []);
      } catch (err) {
        console.error("Failed to fetch revisions:", err);
      } finally {
        setLoadingRevisions(false);
      }
    }
  };

  return (
    <div
      className={`rounded-lg border bg-gradient-to-br ${accent} p-3 backdrop-blur-sm relative group`}
    >
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editFact}
            onChange={(e) => setEditFact(e.target.value)}
            className="w-full bg-zinc-900/80 border border-zinc-700 rounded p-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
            rows={3}
          />
          <div className="flex items-center justify-between gap-2">
            <select
              value={editTopic}
              onChange={(e) => setEditTopic(e.target.value)}
              className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none"
            >
              <option value="">Uncategorized</option>
              {Object.entries(CUSTOM_TOPIC_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
              {Object.entries(MANAGED_TOPIC_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => setEditingId(null)}
                className="px-2 py-1 text-xs border border-zinc-700 rounded hover:bg-zinc-800 text-zinc-400"
              >
                Cancel
              </button>
              <button
                onClick={() => onSave(m.name)}
                className="px-2 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-zinc-950 font-medium rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-zinc-100 leading-relaxed pr-16">{m.fact}</p>
          {m.update_time && (
            <p className="text-[10px] text-zinc-500 mt-2 font-mono">
              {new Date(m.update_time).toLocaleString()}
            </p>
          )}
          
          {/* Revisions Section */}
          {showRevisions && (
            <div className="mt-3 pt-3 border-t border-zinc-800/60 space-y-2">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Revision History
              </h4>
              {loadingRevisions ? (
                <p className="text-xs text-zinc-600">Loading history...</p>
              ) : revisions.length <= 1 ? (
                <p className="text-xs text-zinc-600">No past revisions</p>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                  {revisions.map((rev, idx) => (
                    <div key={idx} className="text-xs border-l-2 border-zinc-700 pl-2 py-0.5">
                      <p className="text-zinc-300">{rev.fact}</p>
                      <span className="text-[9px] text-zinc-500 font-mono">
                        {new Date(rev.create_time).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Hover Actions Menu */}
          <div className="absolute top-3 right-3 hidden group-hover:flex items-center gap-1 bg-zinc-900/90 border border-zinc-800 rounded-md p-1 shadow-lg">
            <button
              onClick={handleToggleRevisions}
              className={`p-1 rounded ${
                showRevisions ? "text-amber-400 bg-zinc-800" : "text-zinc-400 hover:text-amber-400 hover:bg-zinc-800"
              }`}
              title="View History"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </button>
            <button
              onClick={() => {
                setEditingId(m.name);
                setEditFact(m.fact);
                setEditTopic(m.topic || "");
              }}
              className="p-1 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded"
              title="Edit"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(m.name)}
              className="p-1 text-zinc-400 hover:text-rose-500 hover:bg-zinc-800 rounded"
              title="Delete"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Single topic group with hover tooltip ─────────────────────────────────────
function TopicGroup({
  topic,
  items,
  meta,
  editingId,
  editFact,
  editTopic,
  setEditingId,
  setEditFact,
  setEditTopic,
  onDelete,
  onSave,
}: {
  topic: string;
  items: Memory[];
  meta: { label: string; accent: string; description: string };
  editingId: string | null;
  editFact: string;
  editTopic: string;
  setEditingId: (id: string | null) => void;
  setEditFact: (fact: string) => void;
  setEditTopic: (topic: string) => void;
  onDelete: (name: string) => Promise<void>;
  onSave: (name: string) => Promise<void>;
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
          <MemoryCard
            key={m.name}
            m={m}
            accent={meta.accent}
            editingId={editingId}
            editFact={editFact}
            editTopic={editTopic}
            setEditingId={setEditingId}
            setEditFact={setEditFact}
            setEditTopic={setEditTopic}
            onDelete={onDelete}
            onSave={onSave}
          />
        ))}
      </div>
    </section>
  );
}


type Profile = {
  name?: string;
  age?: number;
  weight_lbs?: number;
  experience_years?: number;
  back_squat_1rm_lbs?: number;
  deadlift_1rm_lbs?: number;
  clean_jerk_1rm_lbs?: number;
  snatch_1rm_lbs?: number;
  bench_press_1rm_lbs?: number;
  fran_pr?: string;
  training_routine?: {
    program_name?: string;
    frequency?: string;
    focus?: string;
  };
  recent_workouts?: {
    wod_name: string;
    score: string;
    date?: string;
    feeling?: string;
  }[];
  other_prs?: {
    name: string;
    score: string;
    date?: string;
  }[];
  active_goals?: string[];
  physical_limitations?: string[];
  featured_metrics?: string[];
};

// ── Modular Card: Training Routine ─────────────────────────────────────────────
function TrainingRoutineCard({ routine }: { routine?: Profile["training_routine"] }) {
  if (!routine || (!routine.program_name && !routine.frequency && !routine.focus)) {
    return (
      <div className="bg-zinc-900/20 border border-zinc-800/60 rounded-xl p-4 flex flex-col justify-center text-center h-full min-h-[120px]">
        <span className="text-[9px] uppercase font-bold text-zinc-600">Active Routine</span>
        <p className="text-xs text-zinc-500 mt-1">No training routines logged yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-2.5 h-full shadow-lg">
      <span className="text-[9px] uppercase font-bold text-violet-400 tracking-wider">Active Routine</span>
      <div className="space-y-1">
        <h3 className="text-base font-extrabold text-white">{routine.program_name || "Custom Split"}</h3>
        {routine.frequency && <p className="text-xs text-zinc-400 font-semibold">{routine.frequency}</p>}
        {routine.focus && (
          <p className="text-[10px] uppercase bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded px-1.5 py-0.5 inline-block font-bold mt-1">
            Focus: {routine.focus}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Modular Card: Athlete Bio ──────────────────────────────────────────────────
function AthleteBioCard({ profile, userId }: { profile: Profile; userId: string }) {
  return (
    <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-3 h-full shadow-lg relative group">
      <div>
        <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Athlete Profile</span>
        <h2 className="text-2xl font-extrabold text-white mt-1 tracking-tight">{profile.name || userId}</h2>
      </div>
      <div className="h-px bg-zinc-800/50" />
      <div className="grid grid-cols-3 gap-4">
        <div>
          <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Age</span>
          <p className="text-sm font-extrabold text-zinc-200 mt-0.5">{profile.age ? `${profile.age} yrs` : "—"}</p>
        </div>
        <div>
          <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Weight</span>
          <p className="text-sm font-extrabold text-zinc-200 mt-0.5">{profile.weight_lbs ? `${profile.weight_lbs} lbs` : "—"}</p>
        </div>
        <div>
          <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Experience</span>
          <p className="text-sm font-extrabold text-zinc-200 mt-0.5">{profile.experience_years ? `${profile.experience_years} yrs` : "—"}</p>
        </div>
      </div>
    </div>
  );
}

// ── Modular Card: Recent Workouts Feed (Logbook) ──────────────────────────────
function RecentWorkoutsFeed({ workouts }: { workouts?: Profile["recent_workouts"] }) {
  if (!workouts || workouts.length === 0) {
    return (
      <div className="bg-zinc-900/20 border border-zinc-800/60 rounded-xl p-6 text-center flex flex-col justify-center items-center min-h-[200px] w-full">
        <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider mb-1">Recent Workouts Feed</span>
        <p className="text-xs text-zinc-500">Your training logs are currently empty.</p>
        <p className="text-[10px] text-zinc-600 mt-0.5 leading-normal max-w-xs">Log your daily WOD session scores in the chat to build your training timeline!</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-zinc-900/40 to-zinc-950/40 border border-zinc-800 rounded-xl p-4 space-y-3 shadow-lg w-full">
      <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider">Recent Workouts Feed</span>
      <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
        {workouts.map((w, idx) => (
          <div key={idx} className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between items-baseline">
              <h4 className="text-xs font-extrabold text-zinc-200">{w.wod_name}</h4>
              <span className="text-[9px] font-bold bg-sky-500/10 border border-sky-500/20 text-sky-400 rounded-md px-1.5 py-0.5 shadow-inner">
                {w.score}
              </span>
            </div>
            {w.feeling && <p className="text-[10px] text-zinc-400 leading-relaxed pl-1 border-l-2 border-zinc-800">{w.feeling}</p>}
            {w.date && <p className="text-[8px] text-zinc-500 font-bold text-right uppercase tracking-wider">{w.date}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Modular Card: Other Benchmarks PR Table ──────────────────────────────────
function OtherPRsTable({ prs }: { prs?: Profile["other_prs"] }) {
  if (!prs || prs.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-zinc-900/40 to-zinc-950/40 border border-zinc-800 rounded-xl p-4 space-y-3 shadow-lg w-full">
      <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Other Benchmarks & PRs</span>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px] leading-normal border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider">
              <th className="py-2 pl-2">Movement / WOD</th>
              <th className="py-2 pr-2 text-right">PR Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-900 font-semibold">
            {prs.map((p, idx) => (
              <tr key={idx} className="hover:bg-zinc-900/20 transition">
                <td className="py-2.5 pl-2 text-zinc-200">{p.name}</td>
                <td className="py-2.5 pr-2 text-right text-amber-400 font-extrabold">{p.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Highly Interactive AthleteMetricBox Component ────────────────────────────
function AthleteMetricBox({
  label,
  metricKey,
  value,
  userId,
  onSaveMetric,
}: {
  label: string;
  metricKey: string;
  value: number | string | undefined;
  userId: string;
  onSaveMetric: (key: string, val: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editVal, setEditVal] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<{ value: string; create_time: string }[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const handleSave = async () => {
    if (editVal.trim() && editVal !== String(value)) {
      await onSaveMetric(metricKey, editVal);
    }
    setIsEditing(false);
  };

  const toggleHistory = async () => {
    const nextState = !showHistory;
    setShowHistory(nextState);
    if (nextState && history.length === 0) {
      setLoadingHistory(true);
      try {
        const r = await fetch(`/api/profile/revisions?user_id=${userId}`);
        const data = await r.json();
        const pastRevisions = (data.revisions ?? [])
          .map((rev: any) => ({
            value: rev.profile?.[metricKey],
            create_time: rev.create_time,
          }))
          .filter((rev: any) => rev.value !== undefined);

        // Filter out consecutive identical values
        const deduped: typeof pastRevisions = [];
        let prevValue: any = null;
        for (const item of pastRevisions) {
          const strVal = String(item.value);
          if (strVal !== prevValue) {
            deduped.push(item);
            prevValue = strVal;
          }
        }
        setHistory(deduped);
      } catch (err) {
        console.error("Failed to fetch metric history:", err);
      } finally {
        setLoadingHistory(false);
      }
    }
  };


  return (
    <div className="bg-zinc-900/40 border border-zinc-900/80 hover:border-zinc-800/60 rounded-xl p-3 text-center relative group transition backdrop-blur-sm">
      <div className="absolute top-1.5 right-1.5 hidden group-hover:flex gap-1">
        <button
          onClick={toggleHistory}
          className="w-5 h-5 flex items-center justify-center bg-zinc-800 border border-zinc-700 hover:border-sky-500/40 text-zinc-400 hover:text-sky-400 rounded-md text-[10px] transition"
          title="Inspect Progress"
        >
          🕒
        </button>
        <button
          onClick={() => {
            setIsEditing(true);
            setEditVal(String(value ?? ""));
          }}
          className="w-5 h-5 flex items-center justify-center bg-zinc-800 border border-zinc-700 hover:border-amber-500/40 text-zinc-400 hover:text-amber-400 rounded-md text-[10px] transition"
          title="Edit PR"
        >
          ✏️
        </button>
      </div>

      <span className="text-[9px] text-zinc-500 uppercase font-semibold tracking-wider">{label}</span>
      
      {isEditing ? (
        <div className="mt-1 flex gap-1 justify-center">
          <input
            type="text"
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setIsEditing(false);
            }}
            className="bg-zinc-950 border border-zinc-800 text-xs font-extrabold text-amber-400 text-center focus:outline-none w-16 rounded px-1"
            autoFocus
          />
        </div>
      ) : (
        <p className="text-base font-extrabold text-amber-400 mt-0.5">
          {value !== undefined ? (
            <>
              {value}{" "}
              <span className="text-[9px] font-normal text-zinc-600 uppercase">
                {typeof value === "number" ? "lbs" : ""}
              </span>
            </>
          ) : (
            <span className="text-xs font-medium text-zinc-700">—</span>
          )}
        </p>
      )}

      {showHistory && (
        <div className="mt-2 border-t border-zinc-900/60 pt-2 text-left space-y-1.5 max-h-24 overflow-y-auto scrollbar-thin">
          <p className="text-[8px] uppercase font-bold text-zinc-600 tracking-wider">Progress Timeline</p>
          {loadingHistory ? (
            <span className="text-[8px] text-zinc-600">Loading...</span>
          ) : history.length === 0 ? (
            <span className="text-[8px] text-zinc-600">No past changes recorded</span>
          ) : (
            <div className="space-y-1 border-l border-zinc-850 pl-1.5 ml-1">
              {history.map((h, idx) => (
                <div key={idx} className="text-[9px] leading-normal">
                  <span className="font-extrabold text-zinc-400">{h.value}</span>{" "}
                  <span className="text-[8px] text-zinc-600">
                    {new Date(h.create_time).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Athlete Profile Card Component (Modular & Interactive) ────────────────
function AthleteProfileCard({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const r = await fetch(`/api/profile?user_id=${userId}`);
      if (!r.ok) {
        setLoading(false);
        return;
      }
      const data = await r.json();
      const athleteProfile = data.profiles?.athlete_profile?.profile || {};
      setProfile(athleteProfile);
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    const id = setInterval(fetchProfile, 5000);
    return () => clearInterval(id);
  }, [userId]);

  const handleSaveMetric = async (key: string, val: string) => {
    try {
      await fetch(`/api/memories/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fact: `Manual PR override: ${key} is now ${val}`, user_id: userId }),
      });
      fetchProfile();
    } catch (err) {
      console.error("Failed to override metric:", err);
    }
  };

  if (loading && !profile) {
    return <div className="text-zinc-500 text-xs">Loading Athlete Portal...</div>;
  }

  const hasProfileData = profile && Object.keys(profile).length > 0;

  if (!hasProfileData) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-850 p-6 text-center bg-zinc-900/20 space-y-3">
        <div>
          <span className="text-[10px] uppercase text-amber-400 font-bold tracking-wider">Onboarding Status</span>
          <p className="text-sm text-zinc-400 font-extrabold mt-1">AI Athlete Onboarding Pending</p>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed max-w-md mx-auto">
          Welcome to your CrossFit Portal! Please **greet the coach in the chat on the right** to initiate your interactive onboarding dialog.
        </p>
        <p className="text-[10px] text-zinc-600 max-w-xs mx-auto">
          Tell the coach your age, body weight, experience, and active goals so we can provision your structured training dashboard!
        </p>
      </div>
    );
  }

  const featuredMetrics = profile.featured_metrics && profile.featured_metrics.length > 0
    ? profile.featured_metrics
    : ["back_squat_1rm_lbs", "deadlift_1rm_lbs", "clean_jerk_1rm_lbs", "snatch_1rm_lbs", "bench_press_1rm_lbs", "fran_pr"];

  const metricLabels: Record<string, string> = {
    back_squat_1rm_lbs: "Back Squat",
    deadlift_1rm_lbs: "Deadlift",
    clean_jerk_1rm_lbs: "Clean & Jerk",
    snatch_1rm_lbs: "Snatch",
    bench_press_1rm_lbs: "Bench Press",
    fran_pr: "Fran PR",
  };

  return (
    <div className="space-y-4">
      {/* Top Row: Bio (Left) and Active Routine (Right) */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <AthleteBioCard profile={profile} userId={userId} />
        </div>
        <div>
          <TrainingRoutineCard routine={profile.training_routine} />
        </div>
      </div>

      {/* Strength Benchmarks PR Grid */}
      <div className="space-y-2.5">
        <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider pl-1">Featured Strength Benchmarks</span>
        <div className="grid grid-cols-6 gap-3">
          {featuredMetrics.map((mKey) => (
            <AthleteMetricBox
              key={mKey}
              label={metricLabels[mKey] || mKey}
              metricKey={mKey}
              value={profile[mKey as keyof Profile] as string | number}
              userId={userId}
              onSaveMetric={handleSaveMetric}
            />
          ))}
        </div>
      </div>

      {/* Bottom Row: Goals/Injuries (Left) and Recent Workouts Feed (Right) */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3 shadow-lg">
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Active Training Goals</span>
            {profile.active_goals && profile.active_goals.length > 0 ? (
              <ul className="space-y-2 text-xs text-zinc-300 font-semibold leading-relaxed">
                {profile.active_goals.map((g, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-500 mt-0.5">☑</span>
                    <span>{g}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-600">No active goals logged.</p>
            )}
          </div>

          <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl p-4 space-y-3 shadow-lg">
            <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">Injuries & Limitations</span>
            {profile.physical_limitations && profile.physical_limitations.length > 0 ? (
              <ul className="space-y-2 text-xs text-zinc-300 font-semibold leading-relaxed">
                {profile.physical_limitations.map((l, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-rose-500 mt-0.5">⚠</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-600">No active limitations (Healthy!).</p>
            )}
          </div>
        </div>

        <div className="col-span-2 space-y-4">
          <RecentWorkoutsFeed workouts={profile.recent_workouts} />
          <OtherPRsTable prs={profile.other_prs} />
        </div>
      </div>
    </div>
  );
}

// ── Memory panel ──────────────────────────────────────────────────────────────
function MemoryPanel({ userId }: { userId: string }) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFact, setEditFact] = useState("");
  const [editTopic, setEditTopic] = useState("");

  const handleDelete = async (memoryName: string) => {
    if (!confirm("Are you sure you want to delete this memory?")) return;
    try {
      const memoryId = memoryName.split("/").pop();
      const r = await fetch(`/api/memories/${memoryId}?user_id=${userId}`, {
        method: "DELETE",
      });
      if (r.ok) {
        setMemories((prev) => prev.filter((m) => m.name !== memoryName));
      }
    } catch (err) {
      console.error("Failed to delete memory:", err);
    }
  };

  const handleSave = async (memoryName: string) => {
    try {
      const memoryId = memoryName.split("/").pop();
      const r = await fetch(`/api/memories/${memoryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fact: editFact, topic: editTopic, user_id: userId }),
      });
      if (r.ok) {
        setEditingId(null);
      }
    } catch (err) {
      console.error("Failed to save memory:", err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const fetchMemories = async () => {
      try {
        const r = await fetch(`/api/memories?user_id=${userId}`);

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
  }, [userId]);

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
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Athlete Portal Logs</h2>
          <p className="text-sm text-zinc-400">
            Episodic logbook extractions · auto-refreshing
          </p>
        </div>
        <span className="text-xs uppercase tracking-wider text-zinc-500 font-medium whitespace-nowrap">
          {totalCount} {totalCount === 1 ? "log" : "logs"}
        </span>
      </div>

      {/* Structured Athlete Profile Card */}
      <AthleteProfileCard userId={userId} />

      {/* Loading / empty states */}
      {loading && isEmpty && (
        <div className="text-zinc-500 text-sm">Connecting…</div>
      )}
      {!loading && isEmpty && (
        <div className="rounded-xl border border-dashed border-zinc-850 p-8 text-center">
          <p className="text-zinc-400">No logs extracted yet.</p>
          <p className="text-sm text-zinc-600 mt-1">
            Your training logbook is currently empty. Log a WOD score in the chat!
          </p>
        </div>
      )}

      {/* ── CrossFit Topics ── */}
      {hasCustom && (
        <div className="space-y-5">
          <SectionDivider label="Logbook Sections" />
          {Object.keys(CUSTOM_TOPIC_META)
            .filter((t) => t in customGrouped)
            .map((topic) => (
              <TopicGroup
                key={topic}
                topic={topic}
                items={customGrouped[topic]}
                meta={CUSTOM_TOPIC_META[topic]}
                editingId={editingId}
                editFact={editFact}
                editTopic={editTopic}
                setEditingId={setEditingId}
                setEditFact={setEditFact}
                setEditTopic={setEditTopic}
                onDelete={handleDelete}
                onSave={handleSave}
              />
            ))}
        </div>
      )}

      {/* ── Built-in Topics ── */}
      {hasManaged && (
        <div className="space-y-5">
          <SectionDivider label="Coaching Preferences" />
          {Object.keys(MANAGED_TOPIC_META)
            .filter((t) => t in managedGrouped)
            .map((topic) => (
              <TopicGroup
                key={topic}
                topic={topic}
                items={managedGrouped[topic]}
                meta={MANAGED_TOPIC_META[topic]}
                editingId={editingId}
                editFact={editFact}
                editTopic={editTopic}
                setEditingId={setEditingId}
                setEditFact={setEditFact}
                setEditTopic={setEditTopic}
                onDelete={handleDelete}
                onSave={handleSave}
              />
            ))}
        </div>
      )}

      {/* ── Uncategorised (fallback) ── */}
      {hasOther && (
        <div className="space-y-2">
          <SectionDivider label="Other Log Details" />
          {otherMemories.map((m) => (
            <MemoryCard
              key={m.name}
              m={m}
              accent="border-zinc-700 bg-zinc-800/40"
              editingId={editingId}
              editFact={editFact}
              editTopic={editTopic}
              setEditingId={setEditingId}
              setEditFact={setEditFact}
              setEditTopic={setEditTopic}
              onDelete={handleDelete}
              onSave={handleSave}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Styled Athlete LoginPage Component ────────────────────────────────────────
function LoginPage({ onLogin }: { onLogin: (username: string, mode: "text" | "audio-visual") => void }) {
  const [users, setUsers] = useState<string[]>([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [isNewAthlete, setIsNewAthlete] = useState(false);
  const [interactionMode, setInteractionMode] = useState<"text" | "audio-visual">("text");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const r = await fetch("/api/users");
        const data = await r.json();
        const userList = data.users ?? [];
        setUsers(userList);
        if (userList.length > 0) {
          setSelectedUser(userList[0]);
        } else {
          setIsNewAthlete(true);
        }
      } catch (err) {
        console.error("Failed to load athletes:", err);
        setIsNewAthlete(true);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isNewAthlete) {
      const trimmed = newUsername.trim();
      if (!trimmed) {
        setError("Athlete ID cannot be empty");
        return;
      }
      if (users.includes(trimmed)) {
        setError("This Athlete ID already exists");
        return;
      }
      onLogin(trimmed, interactionMode);
    } else {
      if (!selectedUser) {
        setError("Please select an existing athlete");
        return;
      }
      onLogin(selectedUser, interactionMode);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-950 text-white px-4 select-none">
      <div className="max-w-md w-full bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-400 text-2xl font-bold shadow-inner">
          🏋️‍♂️
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight uppercase font-mono text-amber-400">Athlete Portal</h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mt-1">CrossFit Performance Coach</p>
        </div>

        {loading ? (
          <div className="text-zinc-500 text-xs font-semibold">Connecting to Memory Bank...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Athlete Type Toggle */}
            {users.length > 0 && (
              <div className="grid grid-cols-2 gap-2 bg-zinc-900/60 p-1.5 border border-zinc-850 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewAthlete(false);
                    setError("");
                  }}
                  className={`py-2 text-xs uppercase tracking-wider font-bold rounded-lg transition-all ${
                    !isNewAthlete
                      ? "bg-amber-500 text-zinc-950 shadow-md"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Existing Athlete
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsNewAthlete(true);
                    setError("");
                  }}
                  className={`py-2 text-xs uppercase tracking-wider font-bold rounded-lg transition-all ${
                    isNewAthlete
                      ? "bg-amber-500 text-zinc-950 shadow-md"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  New Athlete
                </button>
              </div>
            )}

            <div className="text-left space-y-2">
              {isNewAthlete ? (
                <>
                  <label className="text-[9px] uppercase text-zinc-500 font-extrabold tracking-widest pl-1">
                    Register New Athlete ID
                  </label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => {
                      setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""));
                      setError("");
                    }}
                    className="w-full bg-zinc-900/40 border border-zinc-850 focus:border-amber-500/40 rounded-xl px-4 py-3.5 text-sm font-bold text-amber-400 focus:outline-none placeholder-zinc-700 transition shadow-inner"
                    placeholder="e.g. rookie_bob, rich_froning"
                    autoFocus
                  />
                </>
              ) : (
                <>
                  <label className="text-[9px] uppercase text-zinc-500 font-extrabold tracking-widest pl-1">
                    Select Athlete Profile
                  </label>
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-zinc-850 focus:border-amber-500/40 rounded-xl px-4 py-3.5 text-sm font-bold text-amber-400 focus:outline-none transition shadow-inner appearance-none cursor-pointer"
                  >
                    {users.map((u) => (
                      <option key={u} value={u} className="bg-zinc-900 text-zinc-100 font-semibold py-2">
                        {u}
                      </option>
                    ))}
                  </select>
                </>
              )}
              {error && <p className="text-rose-500 text-[10px] font-extrabold mt-1 pl-1">{error}</p>}
            </div>

            {/* Interaction Mode Toggle */}
            <div className="text-left space-y-2">
              <label className="text-[9px] uppercase text-zinc-500 font-extrabold tracking-widest pl-1">
                Interaction Mode
              </label>
              <div className="grid grid-cols-2 gap-2 bg-zinc-900/60 p-1.5 border border-zinc-850 rounded-xl">
                <button
                  type="button"
                  onClick={() => setInteractionMode("text")}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    interactionMode === "text"
                      ? "bg-amber-500 text-zinc-950 shadow-md"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  💬 Text Chat
                </button>
                <button
                  type="button"
                  onClick={() => setInteractionMode("audio-visual")}
                  className={`py-2 text-xs font-bold rounded-lg transition-all ${
                    interactionMode === "audio-visual"
                      ? "bg-amber-500 text-zinc-950 shadow-md"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  🎙️ Audio-Visual
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-black text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-xl hover:shadow-amber-500/5 active:scale-[0.98] transition duration-150"
            >
              {isNewAthlete ? "Register & Enter" : "Access Portal"}
            </button>
          </form>
        )}

        <div className="h-px bg-zinc-900" />

        <p className="text-[10px] text-zinc-600 leading-relaxed">
          {isNewAthlete
            ? "Creating a new Athlete ID will automatically initiate the interactive AI Onboarding dialog to construct your personalized training dashboard."
            : "Accessing an existing athlete profile loads all historically consolidated workout PRs and routines from Memory Bank."}
        </p>
      </div>

    </div>
  );
}

// ── Real-time Audio-Visual Voice Interface ───────────────────────────────────
function AudioVisualInterface({ username, isNewUser }: { username: string; isNewUser: boolean }) {
  const [isListening, setIsListening] = useState(false);
  const [transcripts, setTranscripts] = useState<{ role: "coach" | "athlete"; text: string }[]>([]);
  const [partialUserSpeech, setPartialUserSpeech] = useState("");
  const [activeCaption, setActiveCaption] = useState<{ role: "coach" | "athlete"; text: string } | null>(null);


  const socketRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const partialSpeechRef = useRef<string>("");

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcripts, partialUserSpeech]);

  const handleExportTranscript = () => {
    if (transcripts.length === 0) return;
    
    const initialGreeting = isNewUser 
      ? `Coach: Welcome to your CrossFit Athlete Portal, ${username}! I see you're a new athlete. Let's build your training profile! Speak to me about your age, body weight, experience, and active goals.`
      : `Coach: Welcome back, ${username}! Let's continue your training. Speak to me about your latest WOD score or any new PRs.`;

    const lines = [
      initialGreeting,
      ...transcripts.map((t) => `${t.role === "coach" ? "Coach" : "Athlete"}: ${t.text}`)
    ];
    
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${username}-coaching-transcript.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };



  // Resamples Float32Array from inputRate to outputRate (16000Hz)
  const resampleAudio = (buffer: Float32Array, inputRate: number, outputRate: number = 16000): Float32Array => {
    if (inputRate === outputRate) return buffer;
    const ratio = inputRate / outputRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffset = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffset && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffset;
    }
    return result;
  };

  // Converts Float32Array to 16-bit PCM ArrayBuffer
  const convertTo16BitPCM = (input: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  };

  // Base64 encodes ArrayBuffer
  const encodeBase64 = (buffer: ArrayBuffer): string => {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Plays back 24kHz mono 16-bit PCM audio seamlessly
  const playPCM24kHz = (base64Data: string) => {
    if (!audioCtxRef.current) return;
    const audioCtx = audioCtxRef.current;

    const binary = atob(base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const audioBuffer = audioCtx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);

    const currentTime = audioCtx.currentTime;
    if (nextPlayTimeRef.current < currentTime) {
      nextPlayTimeRef.current = currentTime;
    }
    source.start(nextPlayTimeRef.current);
    nextPlayTimeRef.current += audioBuffer.duration;
  };

  const stopRecording = () => {
    setIsListening(false);
    setPartialUserSpeech("");
    setActiveCaption(null);

    if (processorNodeRef.current) {
      processorNodeRef.current.disconnect();
      processorNodeRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      micStreamRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      nextPlayTimeRef.current = 0;

      const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";
      const wsProtocol = BACKEND_URL.startsWith("https") ? "wss" : "ws";
      const cleanBackendHost = BACKEND_URL.replace(/^https?:\/\//, "");
      const wsUrl = `${wsProtocol}://${cleanBackendHost}/voice?user_id=${username}`;

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsListening(true);
        console.log("[WS] Connected to Gemini Live voice endpoint");
      };

      ws.onmessage = (e) => {
        const payload = JSON.parse(e.data);
        if (payload.type === "audio") {
          playPCM24kHz(payload.data);
        } else if (payload.type === "transcript") {
          const role = payload.role === "model" ? "coach" : "athlete";
          if (role === "athlete") {
            setPartialUserSpeech(payload.text);
            partialSpeechRef.current = payload.text;
            setActiveCaption({ role: "athlete", text: payload.text });
          } else {
            setTranscripts((prev) => {
              const last = prev[prev.length - 1];
              let newText = payload.text;
              if (last && last.role === "coach") {
                newText = last.text + payload.text;
                setActiveCaption({ role: "coach", text: newText });
                return [...prev.slice(0, -1), { role: "coach", text: newText }];
              }
              setActiveCaption({ role: "coach", text: newText });
              return [...prev, { role: "coach", text: newText }];
            });
          }
        } else if (payload.type === "turn_complete") {
          if (partialSpeechRef.current) {
            const speech = partialSpeechRef.current;
            setTranscripts((prev) => [...prev, { role: "athlete", text: speech }]);
            setPartialUserSpeech("");
            partialSpeechRef.current = "";
          }
        }
      };

      ws.onerror = (err) => {
        console.error("[WS] Error:", err);
        stopRecording();
      };

      ws.onclose = () => {
        console.log("[WS] Connection closed");
        stopRecording();
      };

      const source = audioCtx.createMediaStreamSource(stream);
      // Capture audio chunks using ScriptProcessor (1024 buffer size is standard)
      const processor = audioCtx.createScriptProcessor(1024, 1, 1);
      processorNodeRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const resampled = resampleAudio(inputData, audioCtx.sampleRate, 16000);
        const pcmBuffer = convertTo16BitPCM(resampled);
        const base64Audio = encodeBase64(pcmBuffer);

        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "audio", data: base64Audio }));
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
    } catch (err) {
      console.error("Microphone access denied or failed:", err);
      stopRecording();
    }
  };

  const handleToggleMic = () => {
    if (isListening) {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "end_turn" }));
      }
      stopRecording();
    } else {
      startRecording();
    }
  };

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 p-6 justify-between select-none h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isListening ? "bg-emerald-400 animate-pulse" : "bg-amber-400"} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isListening ? "bg-emerald-500" : "bg-amber-500"}`}></span>
          </span>
          <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-mono">Audio-Visual Mode</h3>
        </div>
        
        <div className="flex items-center gap-2">
          {transcripts.length > 0 && (
            <button
              onClick={handleExportTranscript}
              className="text-[9px] uppercase font-mono bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-750 text-amber-400 hover:text-amber-300 font-bold px-2.5 py-1.5 rounded-lg tracking-widest transition active:scale-95 shadow-sm"
            >
              Export Transcript 📥
            </button>
          )}
          <span className="text-[8px] font-mono uppercase bg-zinc-900 border border-zinc-800 text-emerald-400 font-extrabold px-2 py-1.5 rounded tracking-widest">
            Gemini Live Active
          </span>
        </div>
      </div>

      {/* Center Mic & Live Subtitle Captions */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-6 py-6 flex-shrink-0">
        <button
          onClick={handleToggleMic}
          className={`size-24 rounded-full flex items-center justify-center border transition-all duration-300 ${
            isListening
              ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20 scale-105 animate-pulse"
              : "bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75v3.75m-3.75 0h7.5" />
          </svg>
        </button>
        
        {/* Unified Real-time Subtitle Captions Box */}
        <div className="text-center max-w-md min-h-[70px] flex flex-col justify-center px-4 my-2 border border-zinc-900/40 bg-zinc-900/10 rounded-2xl p-3">
          {activeCaption ? (
            <div className="space-y-1">
              <span className={`text-[8px] uppercase font-black tracking-widest font-mono ${
                activeCaption.role === "coach" ? "text-amber-400 animate-pulse" : "text-sky-400 animate-pulse"
              }`}>
                {activeCaption.role === "coach" ? "Coach Speaking" : "Athlete Speaking"}
              </span>
              <p className={`text-sm font-bold leading-relaxed ${
                activeCaption.role === "coach" ? "text-amber-200" : "text-sky-200"
              }`}>
                "{activeCaption.text}"
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="text-[8px] uppercase font-black tracking-widest text-zinc-600 font-mono">Coaching HUD</span>
              <p className="text-xs font-semibold text-zinc-500 italic">
                {isListening ? "[Listening... Speak naturally into your microphone]" : "[Voice assistant standby. Tap mic to speak]"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Neat Transcripts Chat Log */}
      <div className="border border-zinc-900 bg-zinc-900/20 rounded-xl p-4 flex flex-col space-y-3 h-[220px] overflow-hidden flex-shrink-0">
        <span className="text-[9px] uppercase font-extrabold text-zinc-500 tracking-widest font-mono border-b border-zinc-900 pb-1.5">
          Conversation Log
        </span>
        
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin flex flex-col">
          {/* Initial Coach Greeting */}
          <div className="max-w-[85%] self-start flex flex-col gap-1">
            <span className="text-[7px] uppercase font-black text-amber-400 tracking-wider font-mono">Coach</span>
            <div className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/80 border border-zinc-800 rounded-2xl rounded-tl-none px-3.5 py-2 font-semibold shadow-sm">
              {isNewUser 
                ? `Welcome to your CrossFit Athlete Portal, ${username}! I see you're a new athlete. Let's build your training profile! Speak to me about your age, body weight, experience, and active goals.`
                : `Welcome back, ${username}! Let's continue your training. Speak to me about your latest WOD score or any new lift PRs.`
              }
            </div>
          </div>
          
          {/* Dynamic bubbles */}
          {transcripts.map((t, idx) => {
            const isCoach = t.role === "coach";
            return (
              <div 
                key={idx} 
                className={`max-w-[85%] flex flex-col gap-1 ${isCoach ? "self-start" : "self-end items-end"}`}
              >
                <span className={`text-[7px] uppercase font-black tracking-wider font-mono ${isCoach ? "text-amber-400" : "text-sky-400"}`}>
                  {isCoach ? "Coach" : "Athlete"}
                </span>
                <div className={`text-xs leading-relaxed px-3.5 py-2 font-semibold shadow-sm border rounded-2xl ${
                  isCoach 
                    ? "bg-zinc-900/80 border-zinc-800 text-zinc-300 rounded-tl-none" 
                    : "bg-sky-950/30 border-sky-800/30 text-sky-200 rounded-tr-none"
                }`}>
                  {t.text}
                </div>
              </div>
            );
          })}

          <div ref={transcriptEndRef} />
        </div>
      </div>
    </div>
  );
}


// ── Page ──────────────────────────────────────────────────────────────────────
export default function Page() {
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
  const [interactionMode, setInteractionMode] = useState<"text" | "audio-visual">("text");
  const [leftWidth, setLeftWidth] = useState(55); // initial split %
  const [isResizing, setIsResizing] = useState(false);

  const startResize = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isResizing) return;

    const doResize = (e: MouseEvent) => {
      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 20 && newWidth < 80) {
        setLeftWidth(newWidth);
      }
    };

    const stopResize = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", doResize);
    window.addEventListener("mouseup", stopResize);
    return () => {
      window.removeEventListener("mousemove", doResize);
      window.removeEventListener("mouseup", stopResize);
    };
  }, [isResizing]);

  useEffect(() => {
    if (!activeUserId) {
      setIsNewUser(null);
      return;
    }
    const checkProfile = async () => {
      try {
        const r = await fetch(`/api/profile?user_id=${activeUserId}`);
        if (!r.ok) {
          setIsNewUser(true);
          return;
        }
        const data = await r.json();
        const profile = data.profiles?.athlete_profile?.profile || {};
        setIsNewUser(Object.keys(profile).length === 0);
      } catch (err) {
        console.error("Error checking athlete profile:", err);
        setIsNewUser(true);
      }
    };
    checkProfile();
  }, [activeUserId]);

  if (activeUserId === null) {
    return <LoginPage onLogin={(uid, mode) => {
      setActiveUserId(uid);
      setInteractionMode(mode);
    }} />;
  }

  const initialMessage = isNewUser
    ? `👋 Welcome to your CrossFit Athlete Portal, ${activeUserId}! I see you're a new athlete. Let's build your personalized training dashboard!\n\nTo get started, could you tell me a bit about yourself? Specifically, I'd love to know:\n1. Your name, age, and current body weight.\n2. How many years of CrossFit experience you have.\n3. A couple of active training goals or any physical limitations you're managing.\n\nLet's get after it! 🚀`
    : `👋 Welcome back to your Athlete Portal, ${activeUserId}! Let's continue your training journey. Tell me about your latest WOD score, a new lift PR, or updates to your routines. How can I help you train today? 🏋️‍♂️`;

  return (
    <CopilotKit 
      runtimeUrl="/api/copilotkit" 
      agent="crossfit_coach"
      headers={{ "x-user-id": activeUserId }}
    >
      <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
        {/* Fixed Header */}
        <header className="border-b border-zinc-900 px-8 py-5 flex-shrink-0 bg-zinc-950 z-10 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-md bg-gradient-to-br from-amber-400 to-rose-500" />
            <div>
              <h1 className="text-lg font-semibold font-mono uppercase tracking-wider text-white">CrossFit Memory</h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">
                Powered by Vertex AI Memory Bank · Gemini 2.5 · ADK
              </p>
            </div>
          </div>

          {/* Active User Portal Info & Exit */}
          <div className="flex items-center gap-3">
            <div className="bg-zinc-900/80 border border-zinc-850 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <span className="text-[9px] uppercase text-zinc-500 font-extrabold tracking-widest">Portal Active:</span>
              <span className="text-xs font-black text-amber-400">{activeUserId}</span>
            </div>
            <button
              onClick={() => setActiveUserId(null)}
              className="bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 text-[10px] font-extrabold uppercase text-zinc-400 hover:text-white rounded-lg tracking-widest transition active:scale-95"
              title="Exit Portal"
            >
              Exit Portal 🚪
            </button>
          </div>
        </header>

        {/* Resizable Split Layout Body */}
        <div className="flex flex-1 overflow-hidden relative">
          {/* Left Pane (Memory Panel) */}
          <div
            style={{ width: `${leftWidth}%` }}
            className="overflow-y-auto px-8 py-10 bg-zinc-950 border-r border-zinc-900"
          >
            <div className="max-w-3xl mx-auto">
              <MemoryPanel userId={activeUserId} />
            </div>
          </div>

          {/* Resize Handle Bar */}
          <div
            onMouseDown={startResize}
            className={`w-1 cursor-col-resize flex-shrink-0 transition-all duration-150 bg-zinc-900 group hover:bg-amber-500/50 flex items-center justify-center relative ${
              isResizing ? "bg-amber-500 w-1.5" : ""
            }`}
          >
            <div className={`w-px h-8 bg-zinc-800 group-hover:bg-amber-400 ${isResizing ? "bg-amber-400" : ""}`} />
          </div>

          {/* Right Pane (Inline CopilotChat or Audio-Visual Dummy) */}
          <div
            style={{ width: `${100 - leftWidth}%` }}
            className="flex flex-col bg-zinc-950 relative overflow-hidden"
          >
            {isNewUser !== null ? (
              interactionMode === "text" ? (
                <CopilotChat
                  className="flex-1 copilotKitInlineChat"
                  labels={{
                    title: "Coach",
                    initial: initialMessage,
                    placeholder: "Send a message to the coach...",
                  }}
                />
              ) : (
                <AudioVisualInterface 
                  username={activeUserId} 
                  isNewUser={isNewUser} 
                />
              )
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs font-semibold">
                Loading Athlete Session...
              </div>
            )}
          </div>
        </div>
      </main>
    </CopilotKit>
  );
}


