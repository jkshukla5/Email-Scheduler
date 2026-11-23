import { useCallback, useEffect, useState } from "react";

const TABS = ["all", "scheduled", "sending", "sent", "failed"];
const BADGE = {
  scheduled: "bg-amber-100 text-amber-800",
  sending: "bg-blue-100 text-blue-800",
  sent: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
};

// value for <input type="datetime-local">, 1 minute from now
function defaultTime() {
  const d = new Date(Date.now() + 60_000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-xl bg-white p-3 shadow-sm">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value ?? 0}</div>
    </div>
  );
}

function ScheduleForm({ onScheduled }) {
  const [form, setForm] = useState({ to: "", subject: "", body: "", sendAt: defaultTime() });
  const [msg, setMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/emails/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sendAt: new Date(form.sendAt).toISOString() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setMsg({ ok: true, text: "Scheduled for " + new Date(data.scheduledFor).toLocaleString() });
      setForm({ to: "", subject: "", body: "", sendAt: defaultTime() });
      onScheduled();
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally {
      setLoading(false);
    }
  }

  const input = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
      <h2 className="font-semibold">Schedule an email</h2>
      <input className={input} type="email" placeholder="To (e.g. test@example.com)" value={form.to} onChange={set("to")} required />
      <input className={input} placeholder="Subject" value={form.subject} onChange={set("subject")} required />
      <textarea className={input} rows={3} placeholder="Message" value={form.body} onChange={set("body")} required />
      <label className="block text-xs text-gray-500">Send at</label>
      <input className={input} type="datetime-local" value={form.sendAt} onChange={set("sendAt")} required />
      <button disabled={loading} className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
        {loading ? "Scheduling..." : "Schedule"}
      </button>
      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
    </form>
  );
}

export default function App() {
  const [tab, setTab] = useState("all");
  const [emails, setEmails] = useState([]);
  const [stats, setStats] = useState({});
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const url = tab === "all" ? "/api/emails" : `/api/emails?status=${tab}`;
      const [e, s] = await Promise.all([fetch(url), fetch("/api/stats")]);
      if (!e.ok || !s.ok) throw new Error("API error");
      setEmails(await e.json());
      setStats(await s.json());
      setError(null);
    } catch {
      setError("Cannot reach the backend. Is it running on port 3000?");
    }
  }, [tab]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // auto-refresh
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-4xl space-y-4 p-4">
        <h1 className="text-xl font-bold">📧 Email Scheduler</h1>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Scheduled" value={stats.scheduled} color="text-amber-600" />
          <StatCard label="Sending" value={stats.sending} color="text-blue-600" />
          <StatCard label="Sent" value={stats.sent} color="text-green-600" />
          <StatCard label="Failed" value={stats.failed} color="text-red-600" />
        </div>

        <ScheduleForm onScheduled={load} />

        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-full px-3 py-1 text-sm capitalize ${tab === t ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-700"}`}
              >
                {t}
              </button>
            ))}
          </div>

          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-2">To</th>
                  <th className="p-2">Subject</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Send time</th>
                  <th className="p-2">Tries</th>
                  <th className="p-2">Preview / Error</th>
                </tr>
              </thead>
              <tbody>
                {emails.length === 0 && (
                  <tr><td colSpan={6} className="p-4 text-center text-gray-400">No emails</td></tr>
                )}
                {emails.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="whitespace-nowrap p-2">{m.to}</td>
                    <td className="whitespace-nowrap p-2">{m.subject}</td>
                    <td className="p-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${BADGE[m.status]}`}>{m.status}</span>
                    </td>
                    <td className="whitespace-nowrap p-2">{new Date(m.sendAt).toLocaleString()}</td>
                    <td className="p-2">{m.attempts}</td>
                    <td className="whitespace-nowrap p-2">
                      {m.previewUrl ? (
                        <a className="text-indigo-600 underline" href={m.previewUrl} target="_blank" rel="noreferrer">Open</a>
                      ) : (
                        <span className="text-red-500">{m.error || "-"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
