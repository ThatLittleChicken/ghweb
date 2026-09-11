// Mask over the 3D office scene: a radial clear zone behind the hero text
// (X anchored to the centred 1180px content column) intersected with a
// vertical fade. Parameter sets per theme, from the design handoff.
const LIGHT = { fadeWidth: 75, fadeHeight: 50, fadeX: 18, fadeY: 57, centerFeather: 62, centerDrop: 58, fadeFeather: 57, fadeDrop: 46 }
const DARK = { ...LIGHT }

export function sceneMask(dark) {
  const P = dark ? DARK : LIGHT
  const { fadeWidth: w, fadeHeight: ht, fadeFeather: f, fadeY: y } = P
  // emitted through var() so media queries can override any parameter
  // (e.g. .scene-wrap sets --fade-x/-w/-h/-y on mobile) without touching JS
  const x = `var(--fade-x, calc(max(0px, (100% - 1180px) / 2) + ${P.fadeX}%))`
  const solid = Math.max(0, 100 - f)
  const k = P.fadeDrop / 100
  const mid = solid + (100 - solid) * k
  const cf = P.centerFeather / 100
  const cd = P.centerDrop / 100
  const c0 = solid * (1 - cf)
  const cmid = c0 + (solid - c0) * cd
  const ca = (0.35 * cf * (1 - cd)).toFixed(2)
  return `radial-gradient(ellipse var(--fade-w, ${w}%) var(--fade-h, ${ht}%) at ${x} var(--fade-y, ${y}%), transparent 0%, transparent ${c0}%, rgba(0,0,0,${ca}) ${cmid}%, rgba(0,0,0,${(0.35 * cf).toFixed(2)}) ${solid}%, rgba(0,0,0,${(0.7 * (1 - k) + 0.15).toFixed(2)}) ${mid}%, black 100%),linear-gradient(180deg, black 0%, black 70%, transparent 100%)`
}
