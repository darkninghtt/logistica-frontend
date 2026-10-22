import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { setSessionExpiredHandler } from './api/http'
import { router } from './router'
import { useAuthStore } from './stores/auth'

const pinia = createPinia()

// Si el refresh falla (sesión vencida o revocada), se limpia la sesión y se va al login
// conservando la ruta actual para volver después de iniciar sesión.
setSessionExpiredHandler(() => {
  useAuthStore(pinia).clearSession()
  void router.replace({ path: '/login', query: { redirect: router.currentRoute.value.fullPath } })
})

createApp(App).use(pinia).use(router).mount('#app')
