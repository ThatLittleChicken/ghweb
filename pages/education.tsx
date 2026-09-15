import Seo from '../components/Seo'
import { COURSES, LANGUAGES, TECHNOLOGIES } from '../data/content'

export default function Education() {
  return (
    <main className="page">
      <Seo
        title="Education | Gent Yong"
        description="BS in Computer Science at Brigham Young University (Dec 2026) with a math minor — 3.98 GPA, honors, coursework and skills."
        path="/education/"
      />
      <h1 className="title">Studied<span className="acc">.</span></h1>
      <p className="lede">Brigham Young University, August 2022 to December 2026.</p>

      <div className="row" style={{ animationDelay: '0.15s' }}>
        <div className="meta">2022 – 2026</div>
        <div>
          <div className="edu-degree">Bachelor of Science in Computer Science</div>
          <div className="edu-school">Brigham Young University · Provo, UT · <i>Math minor</i></div>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">GPA</div>
              <div className="stat-big">3.98</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Honors</div>
              <div className="stat-text">
                {[
                  "Dean's List",
                  'Academic Scholarship',
                  'Google Endowed Mentorship Scholarship',
                  'Elva Clara Wunderli Richardson Memorial Scholarship',
                  'Larry R. and Janice K. White Scholarship',
                ].map((h, i) => (
                  <span key={h}>
                    <span className="term">{h}{i < 4 && ' · '}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row" style={{ animationDelay: '0.25s' }}>
        <div className="meta">Coursework</div>
        <div className="chips">
          {COURSES.map((c) => (
            <span className="chip" key={c}>{c}</span>
          ))}
        </div>
      </div>

      <div className="row" style={{ animationDelay: '0.35s' }}>
        <div className="meta">Skills</div>
        <div className="skills">
          <div>
            <span className="label">Languages</span>
            <br />
            {LANGUAGES}
          </div>
          <div>
            <span className="label">Technologies</span>
            <br />
            {TECHNOLOGIES}
          </div>
        </div>
      </div>
    </main>
  )
}
