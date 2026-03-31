"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

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

  // Redirect if not admin
  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) router.push("/");
  }, [user, loading, router]);

  // Fetch users
  async function fetchUsers() {
    if (!supabase) return;
    const { data } = await supabase.from("allowed_users").select("*").order("created_at", { ascending: true });
    if (data) setUsers(data);
  }

  useEffect(() => { fetchUsers(); }, [supabase]);

  // Add user
  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !newEmail || !newPassword) return;
    setErr(""); setMsg(""); setBusy(true);

    try {
      // 1. Create auth user via admin API endpoint
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail.toLowerCase().trim(), password: newPassword, display_name: newName || null, role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Failed to create user"); setBusy(false); return; }

      setMsg(`User ${newEmail} created!`);
      setNewEmail(""); setNewName(""); setNewPassword(""); setNewRole("user");
      fetchUsers();
    } catch (e) { setErr(String(e)); }
    finally { setBusy(false); }
  }

  // Toggle active
  async function toggleActive(u: AllowedUser) {
    if (!supabase) return;
    await supabase.from("allowed_users").update({ is_active: !u.is_active }).eq("id", u.id);
    fetchUsers();
  }

  // Delete user
  async function deleteUser(u: AllowedUser) {
    if (!confirm(`Delete ${u.email}?`)) return;
    if (!supabase) return;
    await supabase.from("allowed_users").delete().eq("id", u.id);
    fetchUsers();
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
        {/* Add User Form */}
        <div className="bg-[#111b21] rounded-xl border border-white/[0.06] p-6 mb-6">
          <h2 className="text-[15px] font-semibold mb-4">Add New User</h2>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-white/40 mb-1">Email *</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="user@example.com" required className="w-full bg-[#2a3942] rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:outline-none border border-white/[0.06]"/>
              </div>
              <div>
                <label className="block text-[11px] text-white/40 mb-1">Name</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Display name" className="w-full bg-[#2a3942] rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:outline-none border border-white/[0.06]"/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-white/40 mb-1">Password *</label>
                <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} className="w-full bg-[#2a3942] rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-white/25 focus:outline-none border border-white/[0.06]"/>
              </div>
              <div>
                <label className="block text-[11px] text-white/40 mb-1">Role</label>
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as "user" | "admin")} className="w-full bg-[#2a3942] rounded-lg px-3 py-2.5 text-[13px] text-white focus:outline-none border border-white/[0.06]">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {err && <p className="text-[12px] text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{err}</p>}
            {msg && <p className="text-[12px] text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-lg">{msg}</p>}
            <button type="submit" disabled={busy || !newEmail || !newPassword} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium py-2.5 px-5 rounded-lg text-[13px]">
              {busy ? "Creating..." : "Create User"}
            </button>
          </form>
        </div>

        {/* Users List */}
        <div className="bg-[#111b21] rounded-xl border border-white/[0.06] overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <h2 className="text-[15px] font-semibold">Users ({users.length})</h2>
          </div>
          {users.map((u) => (
            <div key={u.id} className="flex items-center px-6 py-3 border-b border-white/[0.04] hover:bg-white/[0.02]">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0">
                {(u.display_name || u.email).slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 ml-3">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-white">{u.display_name || u.email}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${u.role === "admin" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}>{u.role}</span>
                  {!u.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Disabled</span>}
                </div>
                <p className="text-[11px] text-white/35">{u.email}</p>
              </div>
              {u.email !== user.email && (
                <div className="flex gap-2 flex-shrink-0 ml-3">
                  <button onClick={() => toggleActive(u)} className={`px-2.5 py-1 text-[11px] rounded font-medium ${u.is_active ? "bg-amber-600/20 text-amber-400 hover:bg-amber-600/30" : "bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"}`}>
                    {u.is_active ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => deleteUser(u)} className="px-2.5 py-1 text-[11px] bg-red-600/20 text-red-400 rounded hover:bg-red-600/30 font-medium">Delete</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
