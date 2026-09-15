import Head from "next/head";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { INTRO, DOORS, FOOT_LINKS } from "../data/content";
import Seo from "../components/Seo";

// structured data for search engines
const PERSON = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Gent Yong",
  url: "https://gentyo.ng",
  jobTitle: "Undergraduate Researcher",
  affiliation: { "@type": "CollegeOrUniversity", name: "Brigham Young University" },
  email: "mailto:yonggh@byu.edu",
  sameAs: [
    "https://github.com/thatlittlechicken",
    "https://www.linkedin.com/in/gentyong/",
  ],
};

const FULL = INTRO.join("");

// module-level so the longer "revisit" typing delay applies on client-side
// navigation back to home, and the short one only on first load
let visited = false;

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// QWERTY neighbours for plausible typos
const NEIGHBOURS = {
  a: "sq", b: "vn", c: "xv", d: "sf", e: "wr", f: "dg", g: "fh", h: "gj",
  i: "uo", j: "hk", k: "jl", l: "k", m: "n", n: "bm", o: "ip", p: "o",
  q: "wa", r: "et", s: "ad", t: "ry", u: "yi", v: "cb", w: "qe", x: "zc",
  y: "tu", z: "x",
};

// Simulate a human typist: bell-curved key intervals, per-word tempo,
// pauses at word boundaries and after punctuation, micro-hesitations, and
// the occasional typo that gets noticed and backspaced. Returns a playback
// plan of { s: string to show, d: ms before the next step }.
function planTyping(full) {
  const rnd = Math.random;
  const bell = () => (rnd() + rnd() + rnd()) / 3;
  const plan = [];
  let out = "";
  let tempo = 1;
  let typos = 0;
  for (let i = 0; i < full.length; i++) {
    const ch = full[i];
    if (i === 0 || full[i - 1] === " ") tempo = 0.7 + rnd() * 0.7;
    let d = (10 + bell() * 26) * tempo;
    if (rnd() < 0.08) d += 40 + rnd() * 90;
    if (ch === " ") d += rnd() < 0.3 ? 40 + rnd() * 90 : 6;
    if (/[,.]/.test(full[i - 1] || "")) d += 160 + rnd() * 220;
    if (rnd() < 0.012) d += 300 + rnd() * 380;
    const wrongPool = NEIGHBOURS[ch.toLowerCase()];
    if (wrongPool && typos < 2 && i > 4 && rnd() < 0.015) {
      typos += 1;
      let wrong = wrongPool[Math.floor(rnd() * wrongPool.length)];
      if (ch === ch.toUpperCase()) wrong = wrong.toUpperCase();
      plan.push({ s: out + wrong, d: 180 + rnd() * 240 }); // notice the typo
      plan.push({ s: out, d: 110 + rnd() * 90 }); // backspace
      d = 60 + rnd() * 80; // resume a touch slower
    }
    out += ch;
    plan.push({ s: out, d });
  }
  return plan;
}

export default function Home({ loaderDone }) {
  const nameRef = useRef(null);
  const beforeRef = useRef(null);
  const boldRef = useRef(null);
  const afterRef = useRef(null);
  const caretRef = useRef(null);
  const dodge = useRef(null);

  // typewriter: plays the planned keystrokes straight into the DOM; caret is
  // solid while typing and resumes blinking when the typist "pauses"
  useEffect(() => {
    if (!loaderDone) return undefined;
    const delay = visited ? 1000 : 200;
    visited = true;
    const [a, b] = INTRO;
    const show = (s) => {
      if (!beforeRef.current) return;
      beforeRef.current.textContent = s.slice(0, a.length);
      boldRef.current.textContent = s.slice(a.length, a.length + b.length);
      afterRef.current.textContent = s.slice(a.length + b.length);
    };
    if (reducedMotion()) {
      show(FULL);
      if (caretRef.current) caretRef.current.style.opacity = 0;
      return undefined;
    }
    const plan = planTyping(FULL);
    let idx = 0;
    let timer;
    let idleTimer;
    const play = () => {
      const step = plan[idx];
      idx += 1;
      show(step.s);
      const caret = caretRef.current;
      if (caret) {
        if (idx >= plan.length) {
          caret.style.opacity = 0;
          return;
        }
        // solid caret while keys are landing, blink again when idle
        caret.style.animation = "none";
        caret.style.opacity = 1;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => { caret.style.animation = ""; }, 420);
      }
      timer = setTimeout(play, step.d);
    };
    timer = setTimeout(play, delay);
    return () => {
      clearTimeout(timer);
      clearTimeout(idleTimer);
    };
  }, [loaderDone]);

  // cursor dodge: letters within reach flee along the pointer→letter vector.
  // The pointer is tracked on the window, so letters start reacting as the
  // cursor approaches the name — not only once it's over the heading. A rAF
  // loop eases each letter toward its target; base positions are measured
  // when the loop wakes (and on scroll/resize), never from moved letters.
  useEffect(() => {
    if (reducedMotion()) return undefined;
    const st = { base: [], cur: [], mx: -1e4, my: -1e4, raf: 0 };
    dodge.current = st;

    const measure = () => {
      const el = nameRef.current;
      if (!el) return;
      st.base = Array.from(el.children).map((sp, i) => {
        const r = sp.getBoundingClientRect();
        const c = st.cur[i] || [0, 0, 0];
        return [r.left + r.width / 2 - c[0], r.top + r.height / 2 - c[1]];
      });
    };

    const R = 140;
    const F = 34;
    const settle = () => {
      const el = nameRef.current;
      if (!el) { st.raf = 0; return; }
      let moving = false;
      Array.from(el.children).forEach((sp, i) => {
        const [bx, by] = st.base[i] || [0, 0];
        let tx = 0;
        let ty = 0;
        let tr = 0;
        const dx = bx - st.mx;
        const dy = by - st.my;
        const dist = Math.hypot(dx, dy);
        if (dist < R && dist > 0.01) {
          const k = 1 - dist / R;
          const f = F * k * k;
          tx = (dx / dist) * f;
          ty = (dy / dist) * f;
          tr = (dx / dist) * 6 * k;
        }
        const c = st.cur[i] || (st.cur[i] = [0, 0, 0]);
        c[0] += (tx - c[0]) * 0.18;
        c[1] += (ty - c[1]) * 0.18;
        c[2] += (tr - c[2]) * 0.18;
        if (Math.abs(tx) + Math.abs(ty) > 0.01 || Math.abs(c[0]) + Math.abs(c[1]) + Math.abs(c[2]) > 0.05) moving = true;
        sp.style.transform = `translate(${c[0].toFixed(2)}px, ${c[1].toFixed(2)}px) rotate(${c[2].toFixed(2)}deg)`;
      });
      st.raf = moving ? requestAnimationFrame(settle) : 0;
      if (!moving) Array.from(el.children).forEach((sp) => { sp.style.transform = "none"; });
    };

    const onMove = (e) => {
      st.mx = e.clientX;
      st.my = e.clientY;
      if (!st.raf) {
        measure();
        st.raf = requestAnimationFrame(settle);
      }
    };
    const onShift = () => measure();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onShift, { passive: true });
    window.addEventListener("resize", onShift);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onShift);
      window.removeEventListener("resize", onShift);
      cancelAnimationFrame(st.raf);
    };
  }, []);

  return (
    <main className="page">
      <Seo
        title="Gent Yong"
        description="Personal website of Gent Yong, undergraduate researcher studying Computer Science at Brigham Young University."
        path="/"
      />
      <Head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(PERSON) }} />
      </Head>
      <div className="hero">
        <div className="hero-col">
          <h1 className="name" ref={nameRef}>
            {"Gent Yong".split("").map((ch, i) => (
              <span key={i}>{ch}</span>
            ))}
          </h1>
          <p className="intro">
            <span className="ghost" aria-hidden="true">
              {INTRO[0]}
              <b>{INTRO[1]}</b>
              {INTRO[2]}
            </span>
            <span className="typed">
              <span ref={beforeRef} />
              <b ref={boldRef} />
              <span ref={afterRef} />
              <span className="caret" ref={caretRef} />
            </span>
          </p>
        </div>
      </div>

      <div className="doors">
        {DOORS.map((d) => (
          <Link href={d.href} key={d.label}>
            <a className="door" data-track={`door:${d.label}`}>
              <div className="door-meta">
                <span>{d.index}</span>
                <span>{d.count}</span>
              </div>
              <div className="door-label">{d.label}</div>
              <div className="door-sub">{d.sub}</div>
            </a>
          </Link>
        ))}
      </div>

      <div className="foot-links">
        {FOOT_LINKS.map(([label, href]) => (
          <a
            href={href}
            key={label}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
          >
            {label}
          </a>
        ))}
      </div>
    </main>
  );
}
