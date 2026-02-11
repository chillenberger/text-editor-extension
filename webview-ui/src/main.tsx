import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Acquire the vscode API for use in the webview
declare global {
  const vscode: {
    postMessage: (message: any) => void
  }
}

;(globalThis as any).vscode = (globalThis as any).acquireVsCodeApi?.()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
