import Head from 'next/head'
import { PROJECTS, stagger } from '../data/content'

export default function Projects() {
  return (
    <main className="page">
      <Head>
        <title>Projects — Gent Yong</title>
      </Head>
      <h1 className="title">Built<span className="acc">.</span></h1>
      <p className="lede">Projects and research, with the stack on each.</p>
      <div className="proj-grid">
        {PROJECTS.map((p, i) => (
          <a className="proj-card" href={p.href} key={p.title} style={{ animationDelay: stagger(i) }}>
            <div className="tags">
              {p.tags.map((t) => (
                <span className="tag" key={t}>{t}</span>
              ))}
            </div>
            <div className="proj-title">{p.title}</div>
            <div className="proj-desc">{p.desc}</div>
            <div className="proj-cta">{p.cta} →</div>
          </a>
        ))}
      </div>
    </main>
  )
}
