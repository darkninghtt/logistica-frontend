// Navegadores y sistemas, en orden: Edge y Opera también dicen "Chrome", y Chrome dice "Safari".
const BROWSERS: [RegExp, string][] = [
  [/Edg\//, 'Edge'],
  [/OPR\//, 'Opera'],
  [/Firefox\//, 'Firefox'],
  [/Chrome\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]
const SYSTEMS: [RegExp, string][] = [
  [/Android/, 'Android'],
  [/iPhone|iPad/, 'iOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X/, 'macOS'],
  [/Linux/, 'Linux'],
]

function firstMatch(text: string, table: [RegExp, string][]): string | null {
  return table.find(([pattern]) => pattern.test(text))?.[1] ?? null
}

/**
 * Resume el User-Agent en algo legible ("Chrome en Windows"). Es solo para reconocer la sesión en la
 * lista: no se usa para nada de seguridad.
 */
export function describeUserAgent(userAgent: string | null): string {
  if (!userAgent) return 'Navegador desconocido'
  const browser = firstMatch(userAgent, BROWSERS)
  const system = firstMatch(userAgent, SYSTEMS)
  if (browser && system) return `${browser} en ${system}`
  return browser ?? system ?? 'Navegador desconocido'
}
