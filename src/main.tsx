import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './app/App.tsx'

// Nouvelle version en ligne : elle s'installe seule, vérifiée à chaque retour sur l'appli.
registerSW({
  immediate: true,
  onRegisteredSW(_url, enregistrement) {
    if (!enregistrement) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') enregistrement.update().catch(() => {})
    })
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
