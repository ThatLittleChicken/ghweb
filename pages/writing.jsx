import Head from 'next/head'
import { WRITING, stagger } from '../data/content'

export default function Writing() {
  return (
    <main className="page">
      <Head>
        <title>Writing — Gent Yong</title>
      </Head>
      <h1 className="title">Wrote<span className="acc">.</span></h1>
      <p className="lede">Papers and talks so far. Blog posts land here too.</p>
      <div className="rows">
        {WRITING.map((w, i) => (
          <a className="writing-row" href={w.href} key={w.title} style={{ animationDelay: stagger(i) }}>
            <div className="meta">{w.meta}</div>
            <div>
              <div className="writing-title">{w.title}</div>
              <div className="writing-sub">{w.sub}</div>
            </div>
          </a>
        ))}
        <div className="writing-row writing-end">
          <div className="meta">Blog</div>
          <div className="writing-note">
            First post coming soon. Posts will list here with date, title and a one-line summary, same layout as above.
          </div>
        </div>
      </div>
    </main>
  )
}
