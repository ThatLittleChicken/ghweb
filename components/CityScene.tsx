import '../lib/city-scene'
import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'city-scene': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { dark?: string }
    }
  }
}

// Renders the <city-scene> web component (a downtown in Utah Valley under the
// Wasatch Front). Client-only: import via next/dynamic with ssr:false.
export default function CityScene({ dark }: { dark: boolean }) {
  return (
    <city-scene
      dark={dark ? '1' : '0'}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    />
  )
}
