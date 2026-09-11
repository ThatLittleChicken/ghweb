import '../lib/office-scene'

// Renders the <office-scene> web component. Client-only: import via
// next/dynamic with ssr:false.
export default function OfficeScene({ dark }) {
  return (
    <office-scene
      dark={dark ? '1' : '0'}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
    />
  )
}
