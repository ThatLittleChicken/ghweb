import { useEffect, useRef, useState } from "react";

const TILTS = [-3, 2.5, -1.5, 4, -4.5, 1.5, -2.5, 3.5];

// A pile of tilted photo cards; clicking sends the top one to the back.
export default function PhotoStack({ photos }) {
  const [top, setTop] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef();
  const n = photos.length;

  useEffect(() => () => clearTimeout(timer.current), []);

  const advance = () => {
    if (leaving || n < 2) return;
    setLeaving(true);
    timer.current = setTimeout(() => {
      setTop((t) => (t + 1) % n);
      setLeaving(false);
    }, 300);
  };

  return (
    <div className="stack-wrap">
      <button className="stack" onClick={advance} aria-label="Next photo">
        {photos.map((p, i) => {
          const pos = (i - top + n) % n;
          const isTop = pos === 0;
          const style = {
            zIndex: n - pos,
            transform:
              isTop && leaving
                ? "translate(65%, -4%) rotate(9deg)"
                : `translate(${pos * 7}px, ${pos * -6}px) rotate(${
                    isTop ? TILTS[i % TILTS.length] * 0.3 : TILTS[i % TILTS.length]
                  }deg) scale(${1 - pos * 0.03})`,
          };
          return (
            <figure className="photo" key={p.src} style={style}>
              <img src={p.src} alt={p.caption} draggable="false" />
              <figcaption>{p.caption}</figcaption>
            </figure>
          );
        })}
      </button>
      <div className="stack-count">
        {top + 1} / {n}
      </div>
    </div>
  );
}
