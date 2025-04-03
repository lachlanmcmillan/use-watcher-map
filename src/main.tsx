import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Simple } from './SimpleExample.tsx'
import { SubPathExample } from './SubPath.tsx'
import { SubPathArraysExample } from './SubPathArrays.tsx'

const App = () => {
  const [tab, setTab] = useState<'simple' | 'subpath' | 'subpath-arrays'>('simple')
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // Check for user's preferred theme on initial load
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
    return 'light'
  })

  useEffect(() => {
    // Set the theme on the document element
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light')
  }

  return (
    <div>
      <button 
        onClick={toggleTheme}
        className="theme-toggle"
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>
      <h1>WatcherMap</h1>

      <div className="tab-navigation">
        <button 
          className={`tab-button ${tab === 'simple' ? 'active' : ''}`} 
          onClick={() => setTab('simple')}
        >
          Simple
        </button>
        <button 
          className={`tab-button ${tab === 'subpath' ? 'active' : ''}`} 
          onClick={() => setTab('subpath')}
        >
          SubPath
        </button>
        <button 
          className={`tab-button ${tab === 'subpath-arrays' ? 'active' : ''}`} 
          onClick={() => setTab('subpath-arrays')}
        >
          SubPath Arrays
        </button>
      </div>
      
      <div className="tab-content">
        {tab === 'simple' && <Simple />}
        {tab === 'subpath' && <SubPathExample />}
        {tab === 'subpath-arrays' && <SubPathArraysExample />}
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
