import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { INTRO, DOORS, FOOT_LINKS } from '../data/content'

const FULL = INTRO.join('')

// module-level so the longer "revisit" typing delay applies on client-side
// navigation back to home, and the short one only on first load
let visited = false

export default function Home({ loaderDone }) {
  const nameRef = useRef(null)
  const [dodge, setDodge] = useState([])
  const [typed, setTyped] = useState(0)
  const [typingDone, setTypingDone] = useState(false)

  // typewriter: starts 0.2s after the loader unmounts (≈0.7s after its fade
  // begins), or after 1s when navigating back to home
  useEffect(() => {
    if (!loaderDone) return undefined
    const delay = visited ? 1000 : 200
    visited = true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTyped(FULL.length)
      setTypingDone(true)
      return undefined
    }
    let timer
    let i = 0
    const step = () => {
      i += 1
      setTyped(i)
      if (i >= FULL.length) {
        setTypingDone(true)
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

  // cursor dodge: letters within 90px flee along the pointer→letter vector
  const onNameMove = (e) => {
    const el = nameRef.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const R = 90
    const F = 34
    const out = []
    Array.from(el.children).forEach((sp, i) => {
      const b = sp.getBoundingClientRect()
      const cx = b.left + b.width / 2
      const cy = b.top + b.height / 2
      const dx = cx - e.clientX
      const dy = cy - e.clientY
      const dist = Math.hypot(dx, dy)
      if (dist < R && dist > 0.01) {
        const k = 1 - dist / R
        const f = F * k * k
        out[i] = [Math.round((dx / dist) * f), Math.round((dy / dist) * f), Math.round((dx / dist) * 6 * k)]
      }
    })
    setDodge(out)
  }

  const [a, b] = INTRO
  const typedBefore = a.slice(0, typed)
  const typedBold = b.slice(0, Math.max(0, typed - a.length))
  const typedAfter = INTRO[2].slice(0, Math.max(0, typed - a.length - b.length))

  return (
    <main className="page">
      <Head>
        <title>Gent Yong</title>
        <meta name="description" content="CS senior at Brigham Young University who builds things end to end and researches how networks shape inequality." />
      </Head>
      <div className="hero">
        <div className="hero-col">
          <h1 className="name" ref={nameRef} onMouseMove={onNameMove} onMouseLeave={() => setDodge([])}>
            {'Gent Yong'.split('').map((ch, i) => {
              const d = dodge[i]
              return (
                <span key={i} style={{ transform: d ? `translate(${d[0]}px, ${d[1]}px) rotate(${d[2]}deg)` : 'none' }}>
                  {ch}
                </span>
              )
            })}
          </h1>
          <p className="intro">
            <span className="ghost" aria-hidden="true">
              {a}<b>{b}</b>{INTRO[2]}
            </span>
            <span className="typed">
              <span>{typedBefore}</span>
              <b>{typedBold}</b>
              <span>{typedAfter}</span>
              <span className="caret" style={{ opacity: typingDone ? 0 : 1 }} />
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
