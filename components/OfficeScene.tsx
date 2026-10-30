import '../lib/office-scene'
import type { DetailedHTMLProps, HTMLAttributes } from 'react'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'office-scene': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & { dark?: string; framing?: string }
    }
  }
}

// Renders the <office-scene> web component (a home office seen from inside
// the room, see lib/office-scene.js). `dark` re-lights it from afternoon sun
// to night; the element sets data-rendered once its first frame is drawn.
export default function OfficeScene({ dark }: { dark: boolean }) {
  return <office-scene dark={dark ? '1' : '0'} style={{ display: 'block', width: '100%', height: '100%' }} />
}
