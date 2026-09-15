// Mask over the 3D office scene: a radial clear zone behind the hero text
// (X anchored to the centred 1180px content column) intersected with a
// vertical fade. Parameter sets per theme, from the design handoff.
const LIGHT = { fadeWidth: 75, fadeHeight: 50, fadeX: 18, fadeY: 57, centerFeather: 62, centerDrop: 58, fadeFeather: 57, fadeDrop: 46 }
const DARK = { ...LIGHT }

export function sceneMask(dark: boolean): string {
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
  // each stop's alpha is scaled by --cut (0 = fully opaque mask, i.e. no
  // cutout; 1 = the designed cutout) so CSS can cross-fade the clear zone
  const fade = (a: number) => `rgba(0,0,0,calc(1 - ${(1 - a).toFixed(2)} * var(--cut, 1)))`
  const ca = 0.35 * cf * (1 - cd)
  return `radial-gradient(ellipse var(--fade-w, ${w}%) var(--fade-h, ${ht}%) at ${x} var(--fade-y, ${y}%), ${fade(0)} 0%, ${fade(0)} ${c0}%, ${fade(ca)} ${cmid}%, ${fade(0.35 * cf)} ${solid}%, ${fade(0.7 * (1 - k) + 0.15)} ${mid}%, black 100%),linear-gradient(180deg, black 0%, black 70%, transparent 100%)`
}
