import '../lib/office-scene'
import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'office-scene': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { dark?: string }
    }
  }
}

// Renders the <office-scene> web component. Client-only: import via
// next/dynamic with ssr:false.
export default function OfficeScene({ dark }: { dark: boolean }) {
  return (
    <office-scene
      dark={dark ? '1' : '0'}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    />
  )
}
