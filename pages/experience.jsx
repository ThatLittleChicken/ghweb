import Head from 'next/head'
import { JOBS, stagger } from '../data/content'

export default function Experience() {
  return (
    <main className="page">
      <Head>
        <title>Experience | Gent Yong</title>
      </Head>
      <h1 className="title">Work<span className="acc">.</span></h1>
      <p className="lede">Research and web work at BYU, plus a summer in industry. Most recent first.</p>
      <div className="rows">
        {JOBS.map((j, i) => (
          <div className="row" key={j.title} style={{ animationDelay: stagger(i) }}>
            <div className="meta meta-8">{j.when}</div>
            <div>
              <div className="job-head">
                <span className="job-title">{j.title}</span>
                <span className="job-org">{j.org}</span>
              </div>
              <ul className="job-points">
                {j.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
