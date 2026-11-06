import type { components } from './api.generated'

/**
 * Un esquema del contrato de la API. `api.generated.ts` lo escribe `npm run api:types` a partir del
 * `openapi.json` del backend (que sale de sus esquemas Zod), y el CI falla si no está al día.
 * Los tipos de `src/types/` que describen la API son alias de estos: no se escriben a mano.
 */
export type ApiSchema<Name extends keyof components['schemas']> = components['schemas'][Name]
