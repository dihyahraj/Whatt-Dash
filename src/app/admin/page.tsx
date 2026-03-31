"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

const OWNER_EMAIL = "bioshop.pk@gmail.com";

interface AllowedUser {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminPage() {
  const { user, supabase, loading, signOut } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) router.push("/");
  }, [user, loading, router]);

  const fetchUsers = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/users");
      const d = await r.json();
      if (Array.isArray(d)) setUsers(d);
    } catch (e) { console.error("Fetch users:", e); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !newEmail || !newPassword) return;
    if (newPassword.length < 6) { setErr("Password must be at least 6 characters"); return; }
    setErr(""); setMsg(""); setBusy(true);

    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.toLowerCase().trim(), password: newPassword, display_name: newName.trim() || null, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Failed to create user"); setBusy(false); return; }

      setMsg(`✅ User "${newEmail}" created successfully as ${newRole}!`);
      setNewEmail(""); setNewName(""); setNewPassword(""); setNewRole("user");
      // Refresh user list
      await fetchUsers();
    } catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }

  async function toggleActive(u: AllowedUser) {
    if (u.email === OWNER_EMAIL) return;
    const r = await fetch("/api/admin/update-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, updates: { is_active: !u.is_active } }) });
    if (!r.ok) { alert("Error toggling user"); return; }
    await fetchUsers();
  }

  async function changeRole(u: AllowedUser, newRole: string) {
    if (u.email === OWNER_EMAIL) return;
    const r = await fetch("/api/admin/update-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, updates: { role: newRole } }) });
    if (!r.ok) { alert("Error changing role"); return; }
    await fetchUsers();
  }

  async function deleteUser(u: AllowedUser) {
    if (u.email === OWNER_EMAIL) { alert("Owner account cannot be deleted!"); return; }
    if (!confirm(`Delete user "${u.display_name || u.email}"?`)) return;
    const r = await fetch("/api/admin/delete-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id }) });
    if (!r.ok) { alert("Error deleting user"); return; }
    setMsg(`🗑️ User "${u.email}" deleted.`);
    await fetchUsers();
  }

  if (loading || !user || user.role !== "admin") return (
    <div className="min-h-screen bg-[#0b141a] flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0b141a] text-white" style={{ fontFamily: "'Segoe UI', Helvetica, Arial, sans-serif" }}>
      {/* Header */}
      <div className="bg-[#202c33] border-b border-white/[0.06] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="w-8 h-8 rounded-full hover:bg-white/[0.08] flex items-center justify-center text-white/50">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
          </button>
          <h1 className="text-[16px] font-bold">User Management</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-white/40">{user.email}</span>
          <button onClick={signOut} className="px-3 py-1.5 text-[12px] bg-white/[0.06] rounded-lg hover:bg-white/[0.10] text-white/60">Sign Out</button>
        </div>
      </div>

      <div className="max-w-[700px] mx-auto px-6 py-8">

        {/* Global messages */}
        {msg && <div className="mb-4 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[13px] text-emerald-400 flex items-center justify-between">
          <span>{msg}</span>
          <button onClick={() => setMsg("")} className="text-emerald-400/50 hover:text-emerald-400 ml-3">✕</button>
        </div>}

        {/* Add User Form */}
        <div className="bg-[#111b21] rounded-xl border border-white/[0.06] p-6 mb-6">
          <h2 className="text-[15px] font-semibold mb-4 flex items-center gap-2">
            <span>➕</span> Add New User
          </h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-white/40 mb-1">Email *</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@example.com" required className="w-full bg-[#2a3942] rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:outline-none border border-white/[0.06] focus:border-emerald-500/30"/>
              </div>
              <div>
                <label className="block text-[11px] text-white/40 mb-1">Display Name</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name" className="w-full bg-[#2a3942] rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:outline-none border border-white/[0.06] focus:border-emerald-500/30"/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-white/40 mb-1">Password * (min 6 chars)</label>
                <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Strong password" required minLength={6} className="w-full bg-[#2a3942] rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:outline-none border border-white/[0.06] focus:border-emerald-500/30"/>
              </div>
              <div>
                <label className="block text-[11px] text-white/40 mb-1">Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as "user" | "admin")} className="w-full bg-[#2a3942] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none border border-white/[0.06]">
                  <option value="user">User — Can view & reply chats</option>
                  <option value="admin">Admin — Can manage users too</option>
                </select>
              </div>
            </div>
            {err && <p className="text-[12px] text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{err}</p>}
            <button type="submit" disabled={busy || !newEmail || !newPassword} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium py-2.5 px-6 rounded-lg text-[13px] transition-colors">
              {busy ? "Creating..." : "Create User"}
            </button>
          </form>
        </div>

        {/* Users List */}
        <div className="bg-[#111b21] rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">All Users ({users.length})</h2>
            <button onClick={fetchUsers} className="text-[11px] text-white/30 hover:text-white/60 px-2 py-1 rounded hover:bg-white/[0.04]">↻ Refresh</button>
          </div>
          
          {users.length === 0 && (
            <div className="px-6 py-8 text-center text-white/25 text-[13px]">No users found. Create one above.</div>
          )}

          {users.map((u) => {
            const isOwner = u.email === OWNER_EMAIL;
            const isSelf = u.email === user.email;
            return (
              <div key={u.id} className="flex items-center px-6 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.02]">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0">
                  {(u.display_name || u.email).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 ml-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-medium text-white">{u.display_name || u.email.split("@")[0]}</span>
                    {isOwner && <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">OWNER</span>}
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${u.role === "admin" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}>{u.role.toUpperCase()}</span>
                    {!u.is_active && <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 font-bold">DISABLED</span>}
                    {isSelf && <span className="text-[9px] text-white/30">(you)</span>}
                  </div>
                  <p className="text-[11px] text-white/35 mt-0.5">{u.email}</p>
                </div>

                {/* Actions — not shown for owner */}
                {!isOwner && (
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    {/* Role toggle */}
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                      className="bg-[#2a3942] text-[11px] text-white/70 rounded px-2 py-1 border border-white/[0.06] focus:outline-none"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>

                    <button onClick={() => toggleActive(u)} className={`px-2.5 py-1 text-[11px] rounded font-medium transition-colors ${u.is_active ? "bg-amber-600/20 text-amber-400 hover:bg-amber-600/30" : "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"}`}>
                      {u.is_active ? "Disable" : "Enable"}
                    </button>

                    <button onClick={() => deleteUser(u)} className="px-2.5 py-1 text-[11px] bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 font-medium transition-colors">
                      Delete
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
