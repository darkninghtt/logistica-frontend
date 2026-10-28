import type { PiniaPlugin } from 'pinia'

/** Acciones del store de sesión tras las cuales ya no hay sesión: cerrarla o perderla. */
const SESSION_END_ACTIONS = ['logout', 'clearSession']

/**
 * Plugin de Pinia: al terminar la sesión devuelve todos los demás stores a su estado inicial.
 * Sin esto, quien inicia sesión después en el mismo navegador (sin recargar) vería, durante la
 * vigencia de la caché, los datos de la persona anterior, incluidos los costos que el OPERATOR
 * no debe ver.
 */
export function createResetOnSessionEnd(): PiniaPlugin {
  const resetters = new Set<() => void>()

  return ({ store }) => {
    if (store.$id === 'auth') {
      store.$onAction(({ name, after }) => {
        if (SESSION_END_ACTIONS.includes(name)) after(() => resetters.forEach((reset) => reset()))
      })
      return
    }
    // Foto del estado recién creado (aún sin datos). El estado de los stores es solo JSON
    // (ids, textos, números, null), así que se guarda como texto y se reconstruye al restaurar.
    const initial = JSON.stringify(store.$state)
    resetters.add(() => {
      // Primero se descartan las respuestas en vuelo (si el store lo permite), luego se vacía
      const cancelPending: unknown = Reflect.get(store, 'cancelPending')
      if (typeof cancelPending === 'function') cancelPending()
      store.$state = JSON.parse(initial)
    })
  }
}
