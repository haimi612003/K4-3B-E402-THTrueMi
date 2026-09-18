# Class Pulse AG-UI frontend

This Vite + React frontend uses Tailwind CSS v4 and assistant-ui's AG-UI
runtime. It expects an AG-UI-compatible agent server; the default endpoint is
`/api/ag-ui/cluster`, matching Class Pulse's backend action route.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The Vite config proxies `/api` to the Class Pulse backend on port `8765`, so
run `python codebase/serve.py` from the repository root in another terminal.

Set `VITE_AG_UI_URL` in `.env.local` when the agent is hosted elsewhere. The
frontend sends current user messages as `forwardedProps.payload.questions` and
preserves the `cp_session` cookie for the existing Class Pulse backend. The
server must accept the AG-UI HTTP agent protocol and stream its events as SSE
or another supported AG-UI stream. See `../AG-UI.md` for the full contract.

## Checks

```bash
npm run lint
npm run build
```

The runtime wiring lives in `src/App.tsx`; the styled assistant-ui thread and
composer are in `src/components/ChatThread.tsx`.
