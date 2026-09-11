import Head from 'next/head'
import { INTEREST_PHOTOS, INTERESTS, stagger } from '../data/content'
import PhotoStack from '../components/PhotoStack'

export default function Interests() {
  return (
    <main className="page">
      <Head>
        <title>Interests | Gent Yong</title>
      </Head>
      <h1 className="title">Enjoys<span className="acc">.</span></h1>
      <p className="lede">Life beyond a computer screen. Click the stack to flip through.</p>

      <div className="album" style={{ animationDelay: stagger(0) }}>
        <PhotoStack photos={INTEREST_PHOTOS} />
      </div>

      {INTERESTS.length > 0 && (
        <div className="chips chips-center" style={{ animation: `rise 0.7s ${stagger(1)} both` }}>
          {INTERESTS.map((it) => (
            <span className="chip" key={it}>{it}</span>
          ))}
        </div>
      )}
    </main>
  )
}
