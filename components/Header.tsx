import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { NAV } from '../data/content'

export default function Header({ toggleTheme }: { toggleTheme: () => void }) {
  const router = useRouter()
  const [menu, setMenu] = useState(false)
  return (
    <header className="header">
      <div className="header-inner">
      <Link href="/">
        <a className="logo">
          <span className="logo-dot" />
          gentyo.ng
        </a>
      </Link>
      <nav className={menu ? 'nav open' : 'nav'}>
        {NAV.map(([href, label]) => (
          <Link href={href} key={href}>
            <a
              className={router.pathname === href ? 'nav-link active' : 'nav-link'}
              onClick={() => setMenu(false)}
            >
              {label}
            </a>
          </Link>
        ))}
      </nav>
      <div className="header-right">
        <a className="resume-btn" data-track="resume" href="https://drive.google.com/file/d/1-lyh1Ut4VZl_sBH1CvkTIE7ngcoPfIxg" target="_blank" rel="noreferrer">
          <span className="resume-label">Resume.pdf</span>
          <span>↓</span>
        </a>
        <button className="theme-toggle" aria-label="Toggle theme" onClick={toggleTheme}>
          <svg className="sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
          <svg className="moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        </button>
        <button className="burger" aria-label="Menu" onClick={() => setMenu((m) => !m)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {menu ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>
      </div>
    </header>
  )
}
