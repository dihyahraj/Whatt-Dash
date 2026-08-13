# Whatt Dash — WhatsApp Business Dashboard

Full-featured WhatsApp Business Dashboard built with Next.js, Supabase, and WhatsApp Cloud API. Real-time messaging, media support, reactions, replies, and full conversation management.

## Features

### Chat Features
- ✅ **Real-time messaging** via Supabase Realtime
- ✅ **All message types** — text, image, video, audio, document, sticker, location, contacts
- ✅ **Reply to messages** — with reply quote context (shows in WhatsApp too)
- ✅ **React to messages** — emoji reactions sent via WhatsApp API
- ✅ **Message status** — sent ✓, delivered ✓✓, read (blue) ✓✓
- ✅ **Star messages** — bookmark important messages
- ✅ **Delete messages** — soft delete with "message was deleted" placeholder
- ✅ **Image preview** — full-screen lightbox for images
- ✅ **Date separators** — Today, Yesterday, or full date between message groups
- ✅ **Copy text** — right-click to copy message content

### Conversation Management
- ✅ **Pin chats** — pinned conversations stay at top
- ✅ **Mute chats** — muted indicator on chat
- ✅ **Mark as unread** — manually set unread badge
- ✅ **Archive chats** — hide conversations from main list
- ✅ **Delete chats** — permanently delete conversation + messages
- ✅ **Unread badges** — green counter for new messages
- ✅ **Search conversations** — filter by name, phone, or message content

### UI/UX
- ✅ **Browser notifications** — for incoming messages when chat isn't selected
- ✅ **Right-click context menus** — for both chats and messages
- ✅ **Hover actions** — reply + react buttons on message hover
- ✅ **Emoji quick-picker** — in message input area
- ✅ **Keyboard shortcuts** — Ctrl+K for search, Escape to close
- ✅ **Colored avatars** — unique gradient per contact
- ✅ **Last message preview** — with type icons (📷 Photo, 🎥 Video, etc.)
- ✅ **Dark theme** — full dark mode UI

## Setup

### 1. Supabase
Create a Supabase project and run the migrations **in this order** in the SQL Editor:

```
supabase-schema.sql              -- base tables
supabase-migration.sql           -- message/conversation columns
supabase-auth-migration.sql      -- allowed_users
supabase-labels-migration.sql    -- labels + junction table
supabase-labels-v2-migration.sql -- label creator tracking
supabase-perf-migration.sql      -- denormalized last_message on conversations
supabase-perf-v2-migration.sql   -- indexes, NOT NULLs, atomic unread counter
```

`supabase-perf-v2-migration.sql` is what keeps the app fast as data grows: the
composite index behind message paging, partial indexes for the conversation list,
and `bump_conversation_inbound()` (an atomic unread increment — without it the
webhook falls back to a read-modify-write that can lose increments under
concurrent deliveries). Re-running it is safe.

Make sure Realtime is enabled for `messages` and `conversations` tables.

### 2. Environment Variables
Create `.env.local`:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# WhatsApp Cloud API
WHATSAPP_PHONE_NUMBER_ID=123456789
WHATSAPP_ACCESS_TOKEN=EAAG...
WHATSAPP_VERIFY_TOKEN=your-verify-token

# AI (optional - for auto-reply)
OPENROUTER_API_KEY=sk-or-...
AI_MODEL=anthropic/claude-sonnet-4-20250514
```

### 3. WhatsApp Webhook
Set your webhook URL in Meta Developer Console:
```
https://your-domain.com/api/webhook
```

Subscribe to these webhook fields:
- messages
- message_deliveries
- message_reads

### 4. Install & Run
```bash
npm install
npm run dev
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/webhook` | GET/POST | WhatsApp webhook verification & message receiving |
| `/api/conversations` | GET | One page of conversations — pinned first, then keyset by `updated_at` |
| `/api/conversations/archived` | GET | One page of archived conversations |
| `/api/conversations/[id]/messages` | GET | One page of messages, keyset on `(created_at, id)` |
| `/api/conversations/[id]/send` | POST | Send a message (with optional reply) |
| `/api/conversations/[id]/pin` | POST | Pin/unpin a conversation |
| `/api/conversations/[id]/mute` | POST | Mute/unmute a conversation |
| `/api/conversations/[id]/read` | POST | Mark conversation as read (reset unread) |
| `/api/conversations/[id]/unread` | POST | Mark conversation as unread |
| `/api/conversations/[id]/archive` | POST | Archive a conversation |
| `/api/conversations/[id]/delete` | POST | Delete conversation + all messages |
| `/api/conversations/[id]/react` | POST | Send emoji reaction |
| `/api/messages/[id]/star` | POST | Star/unstar a message |
| `/api/messages/[id]/delete` | POST | Soft-delete a message |
| `/api/media/[mediaId]` | GET | Proxy to download WhatsApp media |

### Pagination contract

Both list endpoints return `{ items, hasMore, nextCursor }` and are **keyset**
paginated, not offset paginated — the list is ordered by `updated_at`, which moves
every time a message arrives, so an offset would serve some chats twice and never
serve the ones they displaced.

```
GET /api/conversations?limit=40&filter=all|unread|<labelId>&cursor=<updated_at>&q=<search>
GET /api/conversations/archived?limit=40&cursor=<updated_at>
GET /api/conversations/[id]/messages?limit=50&before=<created_at>&beforeId=<id>   # older page
GET /api/conversations/[id]/messages?limit=100&after=<created_at>&afterId=<id>    # only new ones
```

Search and the filter chips are resolved **server-side**: with a paginated list,
filtering in the browser could only ever see the page that happened to be loaded.

The message cursor carries the id on purpose. A webhook batch inserts several rows
in one transaction, so they share `created_at` to the microsecond, and a
timestamp-only cursor would skip every row after the first of each tie.

## Tech Stack
- **Next.js 16** — App Router
- **Supabase** — PostgreSQL + Realtime subscriptions
- **WhatsApp Cloud API** — Meta Business Platform
- **Tailwind CSS 4** — Styling
- **TypeScript** — Full type safety
