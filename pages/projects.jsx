import Head from 'next/head'
import { PROJECTS, WRITING, stagger } from '../data/content'

export default function Projects() {
  return (
    <main className="page">
      <Head>
        <title>Projects | Gent Yong</title>
      </Head>
      <h1 className="title">Built<span className="acc">.</span></h1>
      <p className="lede">Personal projects with the stack on each. Research papers and presentations below.</p>
      <div className="rows">
        {PROJECTS.map((p, i) => (
          <div className="row" key={p.title} style={{ animationDelay: stagger(i) }}>
            <div className="meta">{String(i + 1).padStart(2, '0')}</div>
            <div>
              <div className="job-title">{p.title}</div>
              <div className="writing-sub">{p.desc}</div>
              <div className="tags">
                {p.tags.map((t) => (
                  <span className="tag" key={t}>{t}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="section-h" style={{ animationDelay: stagger(PROJECTS.length) }}>
        Wrote<span className="acc">.</span>
      </h2>
      <div className="rows">
        {WRITING.map((w, i) => (
          <div className="writing-row" key={w.title} style={{ animationDelay: stagger(PROJECTS.length + 1 + i) }}>
            <div className="meta">{w.meta}</div>
            <div>
              <div className="writing-title">{w.title}</div>
              <div className="writing-sub">{w.sub}</div>
            </div>
          </div>
        ))}
        <div className="writing-end"/>
        {/* <div className="writing-row writing-end">
          <div className="meta">Blog</div>
          <div className="writing-note">
            First post coming soon. Posts will list here with date, title and a one-line summary, same layout as above.
          </div>
        </div> */}
      </div>
    </main>
  )
}
