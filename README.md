# Logística y Trazabilidad de Stock — Frontend

Vue 3 + Pinia + TypeScript (Vite). Proyecto 21: traspasos inter-bodegas, mermas y costo promedio ponderado.

## Requisitos

- Node 24 (ver `.nvmrc`)

## Uso

```bash
npm install
npm run dev        # http://localhost:5173, /api se reenvía al backend (puerto 3000)
npm run lint
npm run typecheck
npm test
npm run build
```

## Estructura

`src/` → `api/` (cliente axios único), `types/`, `stores/`, `composables/`, `router/`, `layouts/`, `views/`, `components/`.

El access token vive solo en memoria (`src/api/token.ts`), nunca en `localStorage`.
