import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './modules/App'
import './index.css'
import { initAutosave } from './modules/autosave'

initAutosave()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
