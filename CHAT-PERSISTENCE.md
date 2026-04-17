# Chat Persistence System Documentation

## Overview
Pluto AI chatbot now has full message persistence. Every conversation is stored in the database with user-specific data isolation.

---

## Database Schema

### Chat Table
```
id (PK, auto-increment)
userId (FK → Users.id)
title (string, auto-generated from first message)
createdAt (timestamp)
updatedAt (timestamp)
```

### Message Table
```
id (PK, auto-increment)
chatId (FK → Chats.id, CASCADE delete)
role (enum: 'user' | 'assistant')
content (text)
timestamp (timestamp, default: NOW)
```

---

## Backend API Endpoints

### Chat Management

**POST /api/chats** - Create new chat
```
Auth: Bearer token required
Response: { chat: { id, title, createdAt, updatedAt } }
```

**GET /api/chats** - Get all chats for authenticated user
```
Auth: Bearer token required
Response: [ { id, userId, title, createdAt, updatedAt }, ... ]
Sorted by: updatedAt DESC (most recent first)
```

**PATCH /api/chats/:chatId** - Update chat title
```
Auth: Bearer token required
Body: { title: "New Title" }
Response: { chat: { ... } }
```

**DELETE /api/chats/:chatId** - Delete chat and all messages
```
Auth: Bearer token required
Response: { message: "Chat deleted" }
```

### Message Management

**GET /api/chats/:chatId/messages** - Get all messages for a chat
```
Auth: Bearer token required
Response: [ { id, chatId, role, content, timestamp }, ... ]
Sorted by: timestamp ASC (oldest first)
```

**POST /api/chats/messages** - Save a message
```
Auth: Bearer token required
Body: { chatId, role: "user"/"assistant", content }
Response: { data: { id, chatId, role, content, timestamp } }

Auto-title behavior:
- When first user message is sent
- Title = first 30 chars of message + "..." if longer
```

**POST /api/chats/complete** - AI completion (existing endpoint)
```
Auth: Not required (legacy endpoint)
Body: { messages: [...], systemPrompt: "" }
Response: { content: [{ text: "AI response" }] }
```

---

## Frontend API Service (api.js)

```javascript
// Create new chat
createChat() → returns { chat: { id, title, createdAt, updatedAt } }

// Get all chats
getChats() → returns [ { id, title, ... }, ... ]

// Load messages for a chat
getChatMessages(chatId) → returns [ { role, content, timestamp }, ... ]

// Save a message
saveMessage(chatId, role, content) → returns { data: { ... } }

// Update chat title
updateChatTitle(chatId, title) → returns { chat: { ... } }

// Delete chat
deleteChat(chatId) → returns { message: "Chat deleted" }

// Send message to AI
sendChatMessage(messages, systemPrompt) → returns { content: [...] }
```

---

## Frontend Data Flow (AIChatbot.jsx)

### Initialization
1. Component mounts
2. useEffect calls `getChats()` from backend
3. Chats loaded into state: `chats = [ { id, title, messages: [] }, ... ]`
4. First chat set as active: `setActiveChatId(chats[0].id)`

### When Active Chat Changes
1. `activeChatId` changes
2. useEffect triggers with `[activeChatId]` dependency
3. Calls `getChatMessages(activeChatId)` from backend
4. Messages loaded into that chat's message array
5. UI displays messages for active chat

### When User Sends Message
1. User submits form with text
2. **User message added to UI immediately** (optimistic update)
3. **User message saved to backend**: `saveMessage(chatId, "user", text)`
4. Message sent to AI: `sendChatMessage(conversationHistory, systemPrompt)`
5. **AI response added to UI immediately**
6. **AI response saved to backend**: `saveMessage(chatId, "assistant", aiText)`
7. Chat title auto-updated if first message
8. Chat's updatedAt timestamp refreshed

### When User Creates New Chat
1. Click "+ New Chat" button
2. `handleNewChat()` function called
3. **Create new chat in backend**: `createChat()`
4. Backend returns new chatId from database
5. New chat added to `chats` state with that ID
6. Switch to new chat: `setActiveChatId(newChatId)`
7. New chat ready for messages

### When User Deletes Chat
1. Click delete (x) button on chat in sidebar
2. `handleDeleteChat(chatId)` called
3. **Delete from backend**: `deleteChat(chatId)`
4. Backend cascades delete to all messages
5. Chat removed from state
6. If deleted chat was active, switch to next chat
7. If no chats remain, create a new one

---

## Data Persistence Guarantees

✅ **User Data Isolation**
- All API endpoints require Bearer token
- Backend extracts userId from JWT
- All queries: WHERE userId = req.userId
- User A cannot see, access, or modify User B's chats

✅ **Chat History Across Sessions**
- Messages stored in database (not just localStorage)
- Upon reload, getChats() fetches all chats
- When selecting a chat, getChatMessages() loads history
- Full conversation history always available

✅ **Auto-Title on First Message**
- When user sends first message in a chat
- Backend auto-generates title from first 30 chars
- Title updates in UI immediately
- Title persisted in database

✅ **Timestamps for Ordering**
- Messages stored with timestamp
- Returned ordered by timestamp ASC (chronological)
- Chat's updatedAt refreshed on each message
- Chats sorted by updatedAt DESC (most recent first)

---

## Error Handling

### Network Errors
- If `getChats()` fails on mount, creates fallback local-only chat
- If `getChatMessages()` fails, keeps existing messages
- If `saveMessage()` fails, still shows message in UI (can retry manually)
- Error logged to console for debugging

### Race Conditions
- `activeChatId` changes handled by useEffect dependency
- Messages load only after chat is fully registered
- Chat creation fully completes before switching to it

### Missing Data
- If no chats exist, **new chat automatically created**
- If no messages in chat, **welcome message shown**
- Null checks on chat/message fields prevent crashes

---

## Testing Chat Persistence

### Test 1: Send Message & Reload
1. Send a message in Pluto chat
2. Reload the page (Cmd+R / Ctrl+R)
3. **Expected:** Message still visible in same chat
4. **Verification:** Check Network tab → GET /api/chats → GET /api/chats/:id/messages

### Test 2: Multiple Chats
1. Create first chat, send message "Hello"
2. Click "+ New Chat", send message "Hi there"
3. Click first chat
4. **Expected:** First chat shows "Hello", second shows "Hi there"
5. **Verification:** Messages isolated per chat

### Test 3: User Isolation
1. User A: Create chat with message "My secrets"
2. User A logs out
3. User B logs in
4. **Expected:** User B does NOT see "My secrets"
5. **Verification:** User B's chats are completely separate

### Test 4: Auto-Title
1. Create new chat (title = "New Conversation")
2. Send first message: "Algorithm design patterns"
3. **Expected:** Title changes to "Algorithm design patterns..."
4. **Verification:** Check Network tab → POST /api/chats/complete PATCH request

### Test 5: Delete Chat
1. Create multiple chats
2. Delete one chat
3. **Expected:** Deleted chat gone, other chats still exist
4. **Verification:** Check Network → DELETE /api/chats/:id

### Test 6: Timestamps
1. Send message A at 10:00 AM
2. Send message B at 10:05 AM
3. **Expected:** Messages shown in order A then B
4. **Verification:** Older messages appear first

---

## Database Queries

### Verify Chat Created
```sql
SELECT * FROM Chats WHERE userId = 1;
-- Should return all chats for user 1
```

### Verify Messages Saved
```sql
SELECT * FROM Messages WHERE chatId = 1 ORDER BY timestamp ASC;
-- Should return messages in chronological order
```

### Verify Data Isolation
```sql
SELECT * FROM Chats WHERE userId = 2;
-- Should return NO chats from user 1
```

---

## Debugging Tips

### If Chats Don't Load
1. Check browser Network tab → get request to `/api/chats`
2. Verify 200 status code
3. Check token is valid: `localStorage.getItem('token')`
4. Verify backend auth middleware is extracting userId correctly
5. Check database has Chat records: `SELECT COUNT(*) FROM Chats;`

### If Messages Don't Save
1. Check POST request to `/api/chats/messages`
2. Check request body: { chatId, role, content }
3. Verify chatId is number (not string)
4. Check 201 status in response
5. Verify Message inserted: `SELECT COUNT(*) FROM Messages;`

### If Titles Don't Auto-Update
1. Send first message and check Network → PATCH request to `/api/chats/:id`
2. Verify title in body: { title: "first 30 chars..." }
3. Check chat.title updated in database
4. Clear localStorage and reload if local state is stale

### Console Errors
```javascript
// Check for these errors:
"Failed to load chats from backend" → Backend not responding
"Failed to save user message to backend" → Message save failed
"Failed to save AI message to backend" → AI response save failed
"Invalid token" → JWT expired, need re-login
```

---

## Performance Considerations

**Optimizations Implemented:**
- Messages loaded only when chat is selected (lazy loading)
- Chats keep messages array to avoid refetching
- Auto-title uses substring (not full AI call)
- updatedAt sorting keeps recent chats at top

**Future Optimizations:**
-[ ] Pagination for long message histories
- [ ] Index database on (userId, createdAt) for faster queries
- [ ] Cache chat list in localStorage for faster load
- [ ] Implement message search/filter
- [ ] Archive old conversations

---

## Migration from localStorage

**Old System (localStorage):**
- Chats stored in localStorage ["pluto_chats"]
- Lost on browser clear or new device
- No user data separation
- Limited to 5MB storage

**New System (Database):**
- Chats stored in PostgreSQL/SQLite
- Persistent across all devices
- Full user data isolation (userId filtering)
- Unlimited storage
- Real-time sync across tabs (with polling/WebSocket)

**Auto-Migration:**
- If user has old localStorage chats, keep as fallback
- First time creating new chat creates backend DB entry
- Next reload loads from backend, not localStorage

---

## API Response Examples

### Create Chat Response
```json
{
  "message": "Chat created",
  "chat": {
    "id": 42,
    "userId": 1,
    "title": "New Conversation",
    "createdAt": "2024-04-12T10:00:00Z",
    "updatedAt": "2024-04-12T10:00:00Z"
  }
}
```

### Get Chats Response
```json
[
  {
    "id": 42,
    "userId": 1,
    "title": "Algorithm design patterns...",
    "createdAt": "2024-04-12T10:00:00Z",
    "updatedAt": "2024-04-12T10:30:00Z"
  },
  {
    "id": 41,
    "userId": 1,
    "title": "Stress Management Tips",
    "createdAt": "2024-04-11T15:00:00Z",
    "updatedAt": "2024-04-11T15:30:00Z"
  }
]
```

### Get Messages Response
```json
[
  {
    "id": 100,
    "chatId": 42,
    "role": "user",
    "content": "What are design patterns?",
    "timestamp": "2024-04-12T10:00:30Z"
  },
  {
    "id": 101,
    "chatId": 42,
    "role": "assistant",
    "content": "Design patterns are reusable solutions...",
    "timestamp": "2024-04-12T10:00:45Z"
  }
]
```

---

## Status: ✅ COMPLETE

Chat persistence is fully operational with:
- ✅ Database schema (Chat, Message tables)
- ✅ Backend API endpoints (create, read, update, delete)
- ✅ Frontend API service methods
- ✅ AIChatbot component refactored for persistence
- ✅ User data isolation (userId-based filtering)
- ✅ Auto-title generation
- ✅ Message history across sessions
- ✅ Error handling & fallbacks
