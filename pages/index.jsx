import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { INTRO, DOORS, FOOT_LINKS } from '../data/content'

const FULL = INTRO.join('')

// module-level so the longer "revisit" typing delay applies on client-side
// navigation back to home, and the short one only on first load
let visited = false

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Home({ loaderDone }) {
  const nameRef = useRef(null)
  const beforeRef = useRef(null)
  const boldRef = useRef(null)
  const afterRef = useRef(null)
  const caretRef = useRef(null)
  const dodgeRaf = useRef(0)

  // typewriter: starts 0.2s after the loader unmounts (≈0.7s after its fade
  // begins), or after 1s when navigating back to home. Writes straight to the
  // DOM — a setState per character would re-render the whole page ~200 times.
  useEffect(() => {
    if (!loaderDone) return undefined
    const delay = visited ? 1000 : 200
    visited = true
    const [a, b, c] = INTRO
    const setTyped = (n) => {
      if (!beforeRef.current) return
      beforeRef.current.textContent = a.slice(0, n)
      boldRef.current.textContent = b.slice(0, Math.max(0, n - a.length))
      afterRef.current.textContent = c.slice(0, Math.max(0, n - a.length - b.length))
    }
    const finish = () => {
      if (caretRef.current) caretRef.current.style.opacity = 0
    }
    if (reducedMotion()) {
      setTyped(FULL.length)
      finish()
      return undefined
    }
    let timer
    let i = 0
    const step = () => {
      i += 1
      setTyped(i)
      if (i >= FULL.length) {
        finish()
        return
      }
      const ch = FULL[i - 1]
      let d = 7 + Math.random() * 14
      if (ch === ' ') d += Math.random() < 0.15 ? 30 : 2
      if (/[,.]/.test(ch)) d += 70 + Math.random() * 60
      if (Math.random() < 0.02) d += 90
      timer = setTimeout(step, d)
    }
    timer = setTimeout(step, delay)
    return () => clearTimeout(timer)
  }, [loaderDone])

  useEffect(() => () => cancelAnimationFrame(dodgeRaf.current), [])

  // cursor dodge: letters within 90px flee along the pointer→letter vector.
  // Transforms are applied directly in a rAF — no React state per mousemove.
  const onNameMove = (e) => {
    const el = nameRef.current
    if (!el || reducedMotion()) return
    const mx = e.clientX
    const my = e.clientY
    cancelAnimationFrame(dodgeRaf.current)
    dodgeRaf.current = requestAnimationFrame(() => {
      const R = 90
      const F = 34
      Array.from(el.children).forEach((sp) => {
        const rect = sp.getBoundingClientRect()
        const dx = rect.left + rect.width / 2 - mx
        const dy = rect.top + rect.height / 2 - my
        const dist = Math.hypot(dx, dy)
        if (dist < R && dist > 0.01) {
          const k = 1 - dist / R
          const f = F * k * k
          sp.style.transform = `translate(${Math.round((dx / dist) * f)}px, ${Math.round((dy / dist) * f)}px) rotate(${Math.round((dx / dist) * 6 * k)}deg)`
        } else {
          sp.style.transform = 'none'
        }
      })
    })
  }

  const onNameLeave = () => {
    cancelAnimationFrame(dodgeRaf.current)
    const el = nameRef.current
    if (el) Array.from(el.children).forEach((sp) => { sp.style.transform = 'none' })
  }

  return (
    <main className="page">
      <Head>
        <title>Gent Yong</title>
        <meta name="description" content="CS senior at Brigham Young University who builds things end to end and researches how networks shape inequality." />
      </Head>
      <div className="hero">
        <div className="hero-col">
          <h1 className="name" ref={nameRef} onMouseMove={onNameMove} onMouseLeave={onNameLeave}>
            {'Gent Yong'.split('').map((ch, i) => (
              <span key={i}>{ch}</span>
            ))}
          </h1>
          <p className="intro">
            <span className="ghost" aria-hidden="true">
              {INTRO[0]}<b>{INTRO[1]}</b>{INTRO[2]}
            </span>
            <span className="typed">
              <span ref={beforeRef} />
              <b ref={boldRef} />
              <span ref={afterRef} />
              <span className="caret" ref={caretRef} />
            </span>
          </p>
        </div>
      </div>

      <div className="doors">
        {DOORS.map((d) => (
          <Link href={d.href} key={d.label}>
            <a className="door">
              <div className="door-meta">
                <span>{d.index}</span>
                <span>{d.count}</span>
              </div>
              <div className="door-label">{d.label}</div>
              <div className="door-sub">{d.sub}</div>
            </a>
          </Link>
        ))}
      </div>

      <div className="foot-links">
        {FOOT_LINKS.map(([label, href]) => (
          <a href={href} key={label} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
            {label}
          </a>
        ))}
      </div>
    </main>
  )
}
