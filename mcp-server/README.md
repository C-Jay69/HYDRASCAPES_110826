# Hydrascapes MCP server

A read-only [MCP](https://modelcontextprotocol.io) server that lets Claude query the
Hydrascapes marketplace — properties, availability, quotes, bookings and payouts — from a
chat or a coding agent.

It is a **stdio** server: Claude Code (or any MCP host) launches it as a child process. It
holds no database credentials; every tool calls the app's `/api/mcp/*` endpoints with a
bearer key, and those endpoints run fixed, read-only queries.

---

## Tools

| Tool | Use it for |
| :--- | :--- |
| `search_properties` | Find listed properties by title, city, guest capacity or nightly price |
| `get_property` | Full details for one property, including its Property Eye analysis |
| `get_availability` | Reserved and owner-blocked ranges for a property in a window |
| `quote_stay` | Price a stay (nights × rate + cleaning) and check availability — creates nothing |
| `list_bookings` | Bookings newest first, filterable by status and "upcoming" |
| `get_booking` | One booking with its money breakdown and payout record |
| `list_payouts` | Owner/host/platform shares and release status |
| `get_overview` | Counts and payout totals in one call |

Money is always **integer minor units** (`42000` = `420.00`), and totals are summed
server-side so the model never does arithmetic on money.

**There are no write tools.** Creating bookings, cancelling stays and moving payouts are
deliberately excluded: a prompt-injected tool call there spends real money. Those deserve a
separate design with per-user authorization, audit logging and human confirmation.

---

## Setup

### 1. Generate a key

```bash
openssl rand -hex 32
```

### 2. Give it to the app

In the repository root `.env.local`:

```bash
MCP_API_KEY=<the key>
```

Restart the app afterwards. Without this, `/api/mcp/*` returns 503.

### 3. Configure this server

```bash
cp .env.example .env
# HYDRASCAPES_URL=http://localhost:3000
# HYDRASCAPES_MCP_KEY=<the same key>
```

### 4. Build

```bash
npm install
npm run build
```

### 5. Register it with Claude Code

Local scope keeps the key out of the repository:

```bash
cd ..
claude mcp add --scope local hydrascapes \
  -e HYDRASCAPES_URL=http://localhost:3000 \
  -e HYDRASCAPES_MCP_KEY="$(grep '^HYDRASCAPES_MCP_KEY' mcp-server/.env | cut -d= -f2)" \
  -- node mcp-server/dist/index.js
```

Then `claude mcp list` should show `hydrascapes` as connected. The app must be running for
tool calls to succeed.

Other hosts (Desktop, editors) take the same command and arguments in their own config.

---

## Security posture

- **Key, not session.** One bearer token, compared in constant time, rate limited to 120
  requests/minute per key.
- **No database credentials here.** The server can only do what `/api/mcp/*` exposes; it
  cannot run arbitrary SQL.
- **Read-only by construction.** There is no tool that writes, and the endpoints behind
  them only issue `select` queries.
- **Narrow responses.** No guest emails, no Stripe identifiers, no storage paths, no signed
  URLs — tool output lands in a model's context, so it stays minimal.
- **The key is operator-level.** Anyone holding it can read the whole marketplace. Rotate it
  by changing `MCP_API_KEY` in the app and `HYDRASCAPES_MCP_KEY` here.

## Troubleshooting

| Symptom | Cause |
| :--- | :--- |
| `Hydrascapes API 503: MCP access is not configured` | `MCP_API_KEY` missing in the app's env |
| `Hydrascapes API 401: Invalid MCP API key` | Server and app keys differ |
| `fetch failed` | The app is not running, or `HYDRASCAPES_URL` is wrong |
| Tools return "not found" for a real id | Ids must be UUIDs, not titles |
