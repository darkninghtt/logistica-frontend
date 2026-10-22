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

## Sesión

- Login: el backend devuelve el access token (en memoria) y fija la cookie `refresh_token` (HttpOnly, no accesible desde JS).
- Al recargar la página, el guard de rutas restaura la sesión llamando a `POST /api/auth/refresh` (`restoreSession` en el store `auth`), una sola vez por carga.
- Si una petición recibe 401, `api/http.ts` hace **un solo refresh compartido** entre las peticiones concurrentes y reintenta la original una vez. Si el refresh es rechazado, se limpia la sesión y se vuelve al login con la ruta de retorno.
- Cerrar sesión llama a `POST /api/auth/logout` (revoca la sesión en el servidor) y limpia el store.
