/**
 * Entrega al navegador un archivo ya descargado: crea un enlace temporal al Blob, lo "pulsa" y
 * libera la URL. No recarga la página.
 */
export function saveFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
