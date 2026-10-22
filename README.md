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

## Roles

El rol llega con el usuario de la sesión (`auth.role`) y la interfaz se adapta, pero **la seguridad real está en el backend** (ocultar botones no cuenta): cada endpoint comprueba rol y bodega y responde `403` si no corresponde.

| Rol               | Bodegas y productos | Stock                         | Entrada de stock |
| ----------------- | ------------------- | ----------------------------- | ---------------- |
| ADMIN             | ver y editar        | todas las bodegas, con costos | sí               |
| WAREHOUSE_MANAGER | ver las suyas       | sus bodegas, con costos       | sí (sus bodegas) |
| OPERATOR          | ver las suyas       | sus bodegas, **sin costos**   | no               |
| AUDITOR           | ver todas           | todas las bodegas, con costos | no               |

- Los permisos de la interfaz están en `src/permissions.ts` (`auth.can('catalog:write')`, `auth.can('stock:entry')`). Las rutas los piden con `meta.permission`; si el rol no lo tiene, el guard lleva a `/sin-permiso`.
- Las columnas de costo se ocultan porque la API no las envía al OPERATOR (no por el rol): los tipos de `types/stock.ts` tienen los costos como opcionales.
- Los errores `403` y `429` se muestran con el mensaje de la API; si la respuesta no lo trae, `api/http.ts` usa uno de respaldo.
- Para probar cada rol en local, el backend siembra un usuario por rol con `npm run seed` (ver el README del backend).
