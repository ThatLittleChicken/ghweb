import '../styles/globals.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import Loader from '../components/Loader'
import initFirebase, { logEvent } from '../config/firebase'

initFirebase()

export default function MyApp({ Component, pageProps }) {
  const [theme, setTheme] = useState('light')
  const [loading, setLoading] = useState(true)
  const [fading, setFading] = useState(false)
  const router = useRouter()

  // analytics: page_view on every client-side navigation (the initial load
  // is logged automatically by gtag's config call)
  useEffect(() => {
    const onRoute = (url) => {
      logEvent('page_view', {
        page_path: url,
        page_location: window.location.origin + url,
      })
    }
    router.events.on('routeChangeComplete', onRoute)
    return () => router.events.off('routeChangeComplete', onRoute)
  }, [router])

  // analytics: one delegated listener logs every link/button click with a
  // readable label (data-track wins, then aria-label, then visible text)
  useEffect(() => {
    const onClick = (e) => {
      const el = e.target && e.target.closest && e.target.closest('a, button')
      if (!el) return
      const params = {
        label:
          el.dataset.track ||
          el.getAttribute('aria-label') ||
          (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60),
        page_path: window.location.pathname,
      }
      const href = el.getAttribute('href')
      if (href) params.href = href
      logEvent('ui_click', params)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  // theme is set on <html> before paint by the inline script in _document
  // (stored choice, else system preference); sync React state to it, and
  // follow live system changes until the user picks a theme explicitly
  useEffect(() => {
    if (document.documentElement.getAttribute('data-theme') === 'dark') setTheme('dark')
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (e) => {
      let stored = null
      try { stored = localStorage.getItem('theme') } catch (err) { /* private mode */ }
      if (stored === 'dark' || stored === 'light') return
      const next = e.matches ? 'dark' : 'light'
      setTheme(next)
      document.documentElement.setAttribute('data-theme', next)
    }
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else mq.addListener(onChange)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
      else mq.removeListener(onChange)
    }
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try { localStorage.setItem('theme', next) } catch (e) { /* private mode */ }
  }

  // loader: dismiss only once everything that renders is actually ready —
  // document loaded, web fonts active, and (on home) the office scene has
  // drawn its first frame — minimum 1.2s, maximum 6s on screen
  useEffect(() => {
    const t0 = performance.now()
    const needsScene = window.location.pathname.replace(/\/$/, '') === ''
    let timer
    let fontsReady = !(document.fonts && document.fonts.ready)
    if (!fontsReady) document.fonts.ready.then(() => { fontsReady = true })
    const ready = () =>
      document.readyState === 'complete' &&
      fontsReady &&
      (!needsScene || document.querySelector('office-scene[data-rendered]'))
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
