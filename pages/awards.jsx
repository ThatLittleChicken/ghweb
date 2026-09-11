import Head from 'next/head'
import { AWARD_YEARS, stagger } from '../data/content'

export default function Awards() {
  return (
    <main className="page">
      <Head>
        <title>Awards — Gent Yong</title>
      </Head>
      <h1 className="title">Won<span className="acc">.</span></h1>
      <p className="lede lede-wide">
        Awards from school and mostly external competitions during high school, through hard work and determination.
      </p>
      <div className="award-rows">
        {AWARD_YEARS.map((y, i) => (
          <div className="award-row" key={y.year} style={{ animationDelay: stagger(i) }}>
            <div className="award-year">{y.year}</div>
            <div className="award-items">
              {y.items.map(([name, prize]) => (
                <div className="award-item" key={name}>
                  <span className="award-name">{name}</span>
                  <span className="award-prize">{prize}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
