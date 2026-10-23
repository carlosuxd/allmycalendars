import { createRoot } from 'react-dom/client'
import { IconContext } from '@phosphor-icons/react'
import { App } from './App'
import './styles.css'

// Phosphor icon defaults: clean line style, colored like the surrounding text
const iconDefaults = { size: 18, weight: 'regular', color: 'currentColor' } as const

createRoot(document.getElementById('root')!).render(
  <IconContext.Provider value={iconDefaults}>
    <App />
  </IconContext.Provider>
)
