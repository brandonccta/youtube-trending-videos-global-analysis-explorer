# 🌍 Globe Explorer

Interactive 3D globe that queries your MySQL database when a country is selected.

Built with **React + Vite + react-globe.gl + Express + MySQL**.

---

## Project Structure

```
globe-explorer/
├── src/
│   ├── api/
│   │   └── countries.js       ← All fetch logic. Swap mock → real here.
│   ├── components/
│   │   ├── GlobeView.jsx      ← react-globe.gl wrapper
│   │   ├── GlobeView.module.css
│   │   ├── SearchBar.jsx      ← Search + sensitivity slider
│   │   ├── SearchBar.module.css
│   │   ├── Sidebar.jsx        ← Data panel
│   │   └── Sidebar.module.css
│   ├── data/
│   │   └── countries.js       ← Country list with lat/lng for fly-to
│   ├── hooks/
│   │   └── useCountryData.js  ← Fetch state management
│   ├── styles/
│   │   └── global.css
│   ├── App.jsx                ← Root, owns all shared state
│   ├── App.module.css
│   └── main.jsx
├── server/
│   ├── index.js               ← Express + MySQL API
│   ├── package.json
│   └── .env.example
├── .env.example
├── index.html
├── package.json
└── vite.config.js
```

---

## Quick Start (Mock Data — no backend needed)

```bash
# 1. Install dependencies
npm install

# 2. Run the dev server
npm run dev

# 3. Open http://localhost:3000
```

The app runs with built-in mock data by default — no database required.

---

## Connecting to the Remote MySQL Database

The backend connects to the `youtube_analysis` MySQL database on `class-148.cs.ucr.edu`
through an SSH tunnel (via `bolt.cs.ucr.edu` as a jump host). Each team member needs
to set up their SSH key and `.env` file.

### Step 1 — Load your SSH key into the agent

Your SSH private key (`~/.ssh/id_rsa`) is encrypted with a passphrase. The SSH agent
holds the decrypted key in memory so the server can use it without prompting you.

```bash
# Check if your key is already loaded
ssh-add -l

# If it says "The agent has no identities", add your key:
ssh-add ~/.ssh/id_rsa
# Enter your key passphrase when prompted
```

> **Note:** You need to re-run `ssh-add` after every reboot or new terminal session.
> To verify it worked: `ssh-add -l` should show your key fingerprint.

### Step 2 — Start the remote database

The MySQL database on the class server must be started manually before the backend
can connect to it.

```bash
ssh -J [YourNetID]@bolt.cs.ucr.edu cs179g@class-148.cs.ucr.edu "cs179g_db_start"
```

Wait a few seconds for MySQL to finish starting up.

### Step 3 — Set up the backend `.env`

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env` and replace `[Your NetID]` with your UCR NetID:

```
PORT=4000

SSH_ENABLED=true

SSH_JUMP_HOST=bolt.cs.ucr.edu
SSH_JUMP_PORT=22
SSH_JUMP_USER=[Your NetID]

SSH_TARGET_HOST=class-148.cs.ucr.edu
SSH_TARGET_PORT=22
SSH_TARGET_USER=cs179g

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=youtube_analysis
```

### Step 4 — Set up the frontend `.env`

```bash
# From the project root
cp .env.example .env
```

Edit `.env`:

```
VITE_API_BASE=http://localhost:4000
VITE_KEY_COLUMN=iso_code
VITE_USE_MOCK=false
```

### Step 5 — Start both servers

Terminal 1 (API):

```bash
cd server
npm run dev
```

You should see:

```
[SSH] Jump host connected  (bolt.cs.ucr.edu)
[SSH] Target host connected (class-148.cs.ucr.edu)
[SSH] Tunnel open  localhost:XXXXX → 127.0.0.1:3306
[DB] Connected to "youtube_analysis"

YouTube Analysis API  →  http://localhost:4000
```

Terminal 2 (React):

```bash
# From the project root
npm run dev
```

Open http://localhost:3000.

### Stopping

Press `Ctrl+C` in the API terminal. This closes the SSH tunnel and shuts down
the remote MySQL database automatically.

To stop the database manually:

```bash
ssh -J [YourNetID]@bolt.cs.ucr.edu cs179g@class-148.cs.ucr.edu "mysqladmin -h 127.0.0.1 -u root shutdown"
```

### Troubleshooting

| Problem | Fix |
|---|---|
| `Cannot parse privateKey: Encrypted private OpenSSH key detected, but no passphrase given` | Run `ssh-add ~/.ssh/id_rsa` and enter your key passphrase |
| `All configured authentication methods failed` (jump host) | Your SSH key isn't loaded — run `ssh-add -l` to check |
| `All configured authentication methods failed` (target host) | Your public key isn't in the class server's `authorized_keys` |
| `Connection lost: The server closed the connection` | Remote MySQL isn't running — start it with `cs179g_db_start` (see Step 2) |
| `EADDRINUSE: address already in use :::4000` | Another server is on port 4000 — run `lsof -ti:4000 \| xargs kill -9` |
| SSH connection times out | Check that you're on the UCR network or VPN |

---

## Customisation

| What                        | Where                              |
|-----------------------------|------------------------------------|
| Add more countries to search | `src/data/countries.js`            |
| Change which fields are "featured" stat cards | `src/components/Sidebar.jsx` → `FEATURED` array |
| Change field display labels | `src/components/Sidebar.jsx` → `LABELS` object   |
| Change globe texture / colours | `src/components/GlobeView.jsx`    |
| Add authentication to API   | `server/index.js`                  |
| Deploy                      | Vite → any static host; Express → Railway / Render / VPS |

---

## Tech Stack

| Layer     | Library            | Why                                      |
|-----------|--------------------|------------------------------------------|
| UI        | React 18 + Vite    | Fast dev, CSS Modules for scoped styles  |
| Globe     | react-globe.gl     | WebGL via Three.js, drag/fly built-in    |
| API calls | native fetch       | No extra lib needed                      |
| Backend   | Express 4          | Simple, pairs naturally with React       |
| Database  | mysql2             | Promise-based, connection pooling        |
