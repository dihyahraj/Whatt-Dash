// ============================================================
// WHATT-DASH: Offline-first cache (IndexedDB)
// ------------------------------------------------------------
// Stores ONLY lightweight data: the conversation list + message
// records (text + media URLs). It NEVER stores media bytes
// (images/videos/audio) — those stay on Supabase and are fetched
// on demand. Cache persists across sessions and is scoped per
// user so a shared browser doesn't leak chats between accounts.
// ============================================================

import type { ConversationWithLastMessage, Message } from "@/lib/types";

const DB_NAME = "whatt-dash-cache";
const DB_VERSION = 1;
const STORE_CONV = "conversations"; // key: `conv:${scope}`  -> ConversationWithLastMessage[]
const STORE_MSGS = "messages"; // key: `${scope}:${cid}` -> Message[] (chronological asc)

// Keep at most this many messages per conversation in cache.
// Older ones are re-fetched from the server on demand (scroll up).
const MAX_CACHED_PER_CONVO = 300;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("no-indexeddb"));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CONV)) db.createObjectStore(STORE_CONV);
      if (!db.objectStoreNames.contains(STORE_MSGS)) db.createObjectStore(STORE_MSGS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function idbGet<T>(store: string, key: string): Promise<T | null> {
  return openDB()
    .then(
      (db) =>
        new Promise<T | null>((resolve, reject) => {
          const tx = db.transaction(store, "readonly");
          const req = tx.objectStore(store).get(key);
          req.onsuccess = () => resolve((req.result ?? null) as T | null);
          req.onerror = () => reject(req.error);
        })
    )
    .catch(() => null);
}

function idbSet(store: string, key: string, val: unknown): Promise<void> {
  return openDB()
    .then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).put(val, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        })
    )
    .catch(() => {});
}

/* ── Conversation list ── */

export function getCachedConversations(scope: string): Promise<ConversationWithLastMessage[] | null> {
  return idbGet<ConversationWithLastMessage[]>(STORE_CONV, `conv:${scope}`);
}

export function setCachedConversations(scope: string, list: ConversationWithLastMessage[]): Promise<void> {
  return idbSet(STORE_CONV, `conv:${scope}`, list);
}

/* ── Messages ── */

// Never persist optimistic (temp_) messages — they get replaced by
// the real server record via realtime/polling.
function clean(msgs: Message[]): Message[] {
  return msgs.filter((m) => m && !String(m.id).startsWith("temp_"));
}

export function getCachedMessages(scope: string, cid: string): Promise<Message[] | null> {
  return idbGet<Message[]>(STORE_MSGS, `${scope}:${cid}`);
}

export function setCachedMessages(scope: string, cid: string, msgs: Message[]): Promise<void> {
  const capped = clean(msgs).slice(-MAX_CACHED_PER_CONVO);
  return idbSet(STORE_MSGS, `${scope}:${cid}`, capped);
}

// Merge incoming records into the cached list (upsert by id, newest
// server data wins), keep chronological order, cap length.
export async function mergeCachedMessages(scope: string, cid: string, incoming: Message[]): Promise<void> {
  const existing = (await getCachedMessages(scope, cid)) || [];
  const map = new Map<string, Message>();
  for (const m of clean(existing)) map.set(m.id, m);
  for (const m of clean(incoming)) map.set(m.id, m); // incoming overrides
  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  await setCachedMessages(scope, cid, merged);
}

// Upsert a single message (used by realtime insert/update).
export async function upsertCachedMessage(scope: string, cid: string, msg: Message): Promise<void> {
  if (!msg || String(msg.id).startsWith("temp_")) return;
  await mergeCachedMessages(scope, cid, [msg]);
}

// Optional: wipe everything (e.g. call on logout from a shared device).
export async function clearCache(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction([STORE_CONV, STORE_MSGS], "readwrite");
      tx.objectStore(STORE_CONV).clear();
      tx.objectStore(STORE_MSGS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}
