import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import { useRouter } from 'next/router'
import Header from './Header'
import { sceneMask } from '../lib/scene-mask'

const OfficeScene = dynamic(() => import('./OfficeScene'), { ssr: false })

interface LayoutProps {
  theme: 'light' | 'dark'
  toggleTheme: () => void
  holding: boolean
  children: ReactNode
}

export default function Layout({ theme, toggleTheme, holding, children }: LayoutProps) {
  const router = useRouter()
  const isHome = router.pathname === '/'
  const mask = sceneMask(theme === 'dark')
  return (
    <div className={holding ? 'shell hold' : 'shell'}>
      <div className="bg-deco">
        <div className="blob1" />
        <div className="blob2" />
        <div className="dots" />
        {isHome && (
          <div
            className="scene-wrap"
            style={{
              maskImage: mask,
              WebkitMaskImage: mask,
              maskComposite: 'intersect',
              WebkitMaskComposite: 'source-in',
            }}
          >
            <OfficeScene dark={theme === 'dark'} />
          </div>
        )}
      </div>
      <Header toggleTheme={toggleTheme} />
      {children}
    </div>
  )
}
