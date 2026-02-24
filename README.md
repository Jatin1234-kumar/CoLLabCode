# 🚀 Real-Time Collaborative Code Editor

A **full-stack MERN application** that lets multiple users edit code together in real time — think Google Docs, but for developers.

Built for **low latency**, **strong security**, and **clean developer experience**.

![License](https://img.shields.io/badge/License-MIT-yellow)
![Node](https://img.shields.io/badge/Node.js-16+-green)
![React](https://img.shields.io/badge/React-18+-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-4.4+-green)
![Socket.io](https://img.shields.io/badge/Socket.io-Latest-red)

---

## ✨ What This Does

- 👥 Real-time multi-user code editing
- 🖱️ Live cursor tracking (Google Docs–style)
- ▶️ Execute code in 10+ languages (JS, Python, Java, C++, Rust, Go...)
- 🤖 AI code review powered by Google Gemini
- 🔐 JWT auth + role-based permissions
- 🧠 Intelligent join request system
- 💾 Full version history with restore
- ⚡ Built with Socket.io + CodeMirror 6

---

## 🧩 Core Features

### Real-Time Collaboration
- Instant code sync across all users
- Live, color-coded cursors with usernames
- Typing-aware cursor visibility
- Debounced updates to prevent noise

### Code Execution
- Run code in **10+ languages**: JavaScript, Python, Java, C++, C, C#, PHP, Ruby, Go, Rust
- Powered by Piston API
- Real-time output & error display
- No servers to configure

### Syntax Highlighting
- **13 languages supported**: JavaScript, TypeScript, Python, Java, C++, C#, Go, Rust, PHP, Ruby, SQL, HTML, CSS
- Powered by CodeMirror 6

### AI Code Review
- Google Gemini integration
- Ask questions about your code
- Get instant refactoring suggestions
- Chat-based interface

### Authentication & Security
- JWT authentication (7-day expiry)
- bcrypt password hashing (10 rounds)
- Token validation on WebSocket connection
- Server-side enforcement for *everything*

### Roles & Permissions
- **Owner** – Full control, role management, ownership transfer  
- **Editor** – Edit code, save & restore versions  
- **Viewer** – Read-only, real-time updates  

### Join Request Flow
- Join by **6-digit room code** or room ID
- Users request access with desired role
- Owner approves / rejects / downgrades
- No approval = no access (period)

### Version History
- Save labeled snapshots
- Restore any previous version
- Automatic pruning (default: 50 versions per room)

---

## 🏗️ Project Structure

```
collaborative-code-editor/
├── backend/                # Node.js + Express + MongoDB
│   └── src/
│       ├── controllers/    # AI, auth, code execution, rooms
│       ├── models/         # MongoDB schemas (User, Room, Version)
│       ├── routes/         # REST API endpoints
│       ├── sockets/        # Socket.io event handlers
│       ├── middleware/     # Auth & error handling
│       └── utils/
│
├── frontend/               # React + Vite + CodeMirror 6
│   └── src/
│       ├── components/     # Editor, panels, modals
│       ├── pages/          # Home, dashboard, editor
│       ├── services/       # API client & Socket.io
│       ├── store/          # Zustand state management
│       └── styles/
│
└── README.md
```

**Tech Stack**
- **Backend**: Node.js, Express, MongoDB, Socket.io, JWT, bcrypt
- **Frontend**: React 18, Vite, CodeMirror 6, Zustand, Axios
- **External APIs**: Piston (code execution), Google Gemini (AI review)

---

## 🚀 Quick Start (5 Minutes)

### Prerequisites
- Node.js 16+
- MongoDB (local or Atlas)
- npm or yarn

---

### Environment Variables

**Backend** (`.env`)
```env
MONGODB_URI=mongodb://localhost:27017/collab-editor
JWT_SECRET=your_super_secret_key_here
JWT_EXPIRE=7d
PORT=5000
FRONTEND_URL=http://localhost:3000

# Optional but recommended
GEMINI_API_KEY=your_gemini_api_key_for_ai_review
PISTON_API_URL=https://emkc.org/api/v2
```

> 💡 **Get Gemini API Key**: Visit [Google AI Studio](https://makersuite.google.com/app/apikey) for free API access

**Frontend** (`.env.local`)
```env
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

---

### Backend Setup

```bash
cd backend
npm install
# Create .env with variables above
npm run dev
# Runs on: http://localhost:5000
```

### Frontend Setup

```bash
cd frontend
npm install
# Create .env.local with variables above
npm run dev
# Runs on: http://localhost:3000
```

---

## 🧪 How It Works (High Level)

1. User logs in → JWT issued
2. User joins or creates a room
3. Socket connection authenticated once
4. All edits sync via Socket.io
5. Permissions enforced server-side
6. Versions saved on demand

Clean. Predictable. Safe.

---

## 🔌 Socket.io Events

### Client → Server
- `room:join` – Join a room
- `room:leave` – Leave current room
- `code:update` – Send code changes (debounced 500ms)
- `cursor:update` – Broadcast cursor position (throttled 50ms)
- `typing:start` / `typing:stop` – Typing state
- `version:save` / `version:restore` / `version:delete` – Version control
- `participant:role-changed` – Role update notification

### Server → Client
- `user:joined` / `user:left` – User presence
- `code:updated` – Code changed by another user
- `cursor:updated` – Remote cursor movement
- `user:typing:started` / `user:typing:stopped` – Typing indicators
- `version:saved` / `version:restored` / `version:deleted` – Version events
- `participant:role-updated` – Role change confirmation

---

## 🔌 API Overview

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Rooms
- `POST /api/rooms`
- `GET /api/rooms`
- `GET /api/rooms/:id`
- `GET /api/rooms/code/:code`
- `DELETE /api/rooms/:id`
- `GET /api/rooms/:id/versions`
- `POST /api/rooms/:id/leave`

### Code Execution & AI
- `POST /api/rooms/:id/run` – Execute code
- `POST /api/rooms/:id/ai-review` – AI code review

### Join Requests
- `POST /api/rooms/:id/join-request`
- `POST /api/rooms/:id/join-request/:requestId/approve`
- `POST /api/rooms/:id/join-request/:requestId/reject`

### Permissions
- `PATCH /api/rooms/:id/participants/:userId/role`
- `POST /api/rooms/:id/transfer-ownership`

---

## ⚡ Performance & Reliability

- **Code updates** – Debounced at 500ms to reduce DB writes
- **Cursor tracking** – Throttled at 50ms for smooth updates
- **Typing detection** – 400ms idle timeout for responsive UX
- **Stale data cleanup** – Automatic removal of disconnected users
- **Indexed queries** – Fast MongoDB lookups on all critical paths
- **Socket.io reconnection** – Automatic recovery on connection loss

Designed to scale reasonably without pretending to be Google Docs.

---

## 🔐 Security Highlights

- JWT validated on socket connect
- Role checks on every action
- Viewers cannot edit — even with client hacks
- No sensitive data leaked in errors
- Environment-based configuration

---

## 🛣️ Roadmap

- [ ] CRDT-based collaboration
- [ ] Multi-file rooms
- [ ] Diff viewer for versions
- [ ] GitHub sync & imports
- [ ] In-room chat panel
- [ ] Live preview (HTML/CSS/JS)
- [ ] Language server protocol (LSP) integration
- [ ] More AI models (OpenAI, Claude)

---

## 🤝 Contributing

PRs are welcome.

```bash
git checkout -b feature/your-feature
git commit -m "Add useful thing"
git push origin feature/your-feature
```

Keep it clean. Keep it tested.

---

## 📄 License

MIT — do whatever you want, just don't sue.

---

⭐ **If this helped you, star the repo.**  
Built for devs who hate lag and love collaboration.
