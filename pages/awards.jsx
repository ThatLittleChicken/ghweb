import Seo from '../components/Seo'
import { AWARD_YEARS, stagger } from '../data/content'

export default function Awards() {
  return (
    <main className="page">
      <Seo
        title="Awards | Gent Yong"
        description="22 awards from science fairs and competitions, from ASEAN science projects to the Malaysian Computing Challenge, 2016–2021."
        path="/awards/"
      />
      <h1 className="title">Won<span className="acc">.</span></h1>
      <p className="lede lede-wide">
        Awards archived from school and mostly external competitions <b><u>before starting university</u></b>.
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
