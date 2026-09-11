import '../styles/globals.css'
import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Loader from '../components/Loader'
import initFirebase from '../config/firebase'

initFirebase()

export default function MyApp({ Component, pageProps }) {
  const [theme, setTheme] = useState('light')
  const [loading, setLoading] = useState(true)
  const [fading, setFading] = useState(false)

  // theme is set on <html> before paint by the inline script in _document;
  // sync React state to it after mount
  useEffect(() => {
    if (document.documentElement.getAttribute('data-theme') === 'dark') setTheme('dark')
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('theme', next) } catch (e) { /* private mode */ }
  }

  // loader: dismiss when the document is loaded and (on home) the office
  // canvas exists — minimum 1.2s, maximum 6s on screen
  useEffect(() => {
    const t0 = performance.now()
    const needsScene = window.location.pathname.replace(/\/$/, '') === ''
    let timer
    const ready = () =>
      document.readyState === 'complete' && (!needsScene || document.querySelector('office-scene canvas'))
    const done = () => {
      const wait = Math.max(0, 1200 - (performance.now() - t0))
      timer = setTimeout(() => {
        setFading(true)
        timer = setTimeout(() => setLoading(false), 500)
      }, wait)
    }
    const poll = () => {
      if (ready()) done()
      else if (performance.now() - t0 > 6000) done()
      else timer = setTimeout(poll, 120)
    }
    poll()
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      {loading && <Loader fading={fading} />}
      <Layout theme={theme} toggleTheme={toggleTheme} holding={loading}>
        <Component {...pageProps} loaderDone={!loading} />
      </Layout>
    </>
  )
}
