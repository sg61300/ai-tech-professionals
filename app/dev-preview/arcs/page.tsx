"use client";

/**
 * Throwaway visual picker for the electric-arc style (dev-preview only, delete
 * before prod). Renders every candidate arc between two nodes so the style can
 * be chosen by eye. Open /dev-preview/arcs.
 */

type P = { x: number; y: number };
const A: P = { x: 70, y: 34 };
const B: P = { x: 150, y: 150 };
const f = (p: P) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
const STRAIGHT = `M${f(A)} L${f(B)}`;

function smooth(a: P, b: P): string {
  const my = (a.y + b.y) / 2;
  return `M${f(a)} C${a.x},${my} ${b.x},${my} ${b.x},${b.y}`;
}
function zigzag(a: P, b: P, amp: number, kinks: number): string {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len, pts: P[] = [a];
  for (let k = 1; k < kinks; k++) {
    const t = k / kinks, s = (k % 2 === 0 ? 1 : -1) * amp;
    pts.push({ x: a.x + dx * t + px * s, y: a.y + dy * t + py * s });
  }
  pts.push(b);
  return "M" + pts.map(f).join(" L");
}
function forked(a: P, b: P): string {
  let d = zigzag(a, b, 7, 8);
  const dx = b.x - a.x, dy = b.y - a.y;
  for (const t of [0.4, 0.68]) {
    const o = { x: a.x + dx * t, y: a.y + dy * t }, dir = t < 0.5 ? 1 : -1;
    const s1 = { x: o.x + dir * 16, y: o.y + 12 }, s2 = { x: s1.x + dir * 7, y: s1.y + 14 };
    d += ` M${f(o)} L${f(s1)} L${f(s2)}`;
  }
  return d;
}
function circuit(a: P, b: P): string {
  const my = (a.y + b.y) / 2;
  return `M${f(a)} L${a.x},${my} L${b.x},${my} L${f(b)}`;
}
function sinePts(a: P, b: P, amp: number, cycles: number, phase = 0): P[] {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len, N = 44, pts: P[] = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N, o = amp * Math.sin(t * Math.PI * cycles * 2 + phase);
    pts.push({ x: a.x + dx * t + px * o, y: a.y + dy * t + py * o });
  }
  return pts;
}
function sine(a: P, b: P, amp: number, cycles: number, phase = 0): string {
  return "M" + sinePts(a, b, amp, cycles, phase).map(f).join(" L");
}
function spurEnds(a: P, b: P): P[] {
  const dx = b.x - a.x, dy = b.y - a.y;
  return [0.4, 0.68].map((t, i) => ({ x: a.x + dx * t + (i ? -18 : 18), y: a.y + dy * t + 20 }));
}

// Deterministic pseudo-random in [-1,1] (so SSR and client agree — no Math.random).
function rnd(i: number, seed: number): number {
  return Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453 % 1;
}
/** A bowed "arc" of N points that curves out to one side (bell-shaped bulge). */
function arcPts(a: P, b: P, bow: number, N = 40): P[] {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len, pts: P[] = [];
  for (let k = 0; k <= N; k++) {
    const t = k / N, bell = Math.sin(t * Math.PI) * bow;
    pts.push({ x: a.x + dx * t + px * bell, y: a.y + dy * t + py * bell });
  }
  return pts;
}
/** Add jagged electric jitter perpendicular to the local direction of a polyline. */
function roughen(pts: P[], amp: number, seed = 0): P[] {
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p;
    const a = pts[i - 1], c = pts[i + 1];
    const dx = c.x - a.x, dy = c.y - a.y, l = Math.hypot(dx, dy) || 1;
    const px = -dy / l, py = dx / l;
    const o = rnd(i, seed) * amp;
    return { x: p.x + px * o, y: p.y + py * o };
  });
}
const toPath = (pts: P[]) => "M" + pts.map(f).join(" L");
function chainKinks(a: P, b: P, amp: number, kinks: number): P[] {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len, pts: P[] = [a];
  for (let k = 1; k < kinks; k++) {
    const t = k / kinks, s = (k % 2 === 0 ? 1 : -1) * amp * (0.6 + Math.abs(rnd(k, 3)) * 0.7);
    pts.push({ x: a.x + dx * t + px * s, y: a.y + dy * t + py * s });
  }
  pts.push(b);
  return pts;
}

const CARDS: { key: string; label: string; desc: string }[] = [
  { key: "zig", label: "1 · Subtle zig-zag bolt", desc: "Clean low-amplitude lightning, glowing, flicker pulse." },
  { key: "smooth", label: "2 · Smooth glowing pulse", desc: "Curved connector, blue glow that flickers." },
  { key: "fork", label: "3 · Forked lightning", desc: "Branched bolt with spurs." },
  { key: "dots", label: "4 · Traveling energy dots", desc: "Glowing particles stream node → node." },
  { key: "circuit", label: "5 · Circuit trace", desc: "Right-angle PCB trace + traveling pulse — matches the circuit background." },
  { key: "neural", label: "6 · Neural synapse", desc: "Connector with dendrite spurs ending in glowing synapse dots." },
  { key: "stream", label: "7 · Data stream", desc: "Marching dashes of light flowing along the path." },
  { key: "comet", label: "8 · Comet trail", desc: "A bright head with a fading tail runs the path." },
  { key: "sine", label: "9 · Signal wave", desc: "A smooth animated sine — reads as a live signal." },
  { key: "tube", label: "10 · 3D glass tube", desc: "Cylindrical shading (dark edges → bright core highlight) for a glossy 3D pipe, with a sheen running through it." },
  { key: "raised", label: "11 · 3D raised bolt", desc: "An embossed bolt: a soft drop-shadow underside makes it sit up off the surface." },
  { key: "helix", label: "12 · 3D helix coil", desc: "Two phase-offset strands with connecting rungs — a rotating-coil illusion of depth." },
  { key: "earc", label: "13 · Electric arc (curved)", desc: "A bowed, jittered discharge with a bright white core + blue aura — a true arc shape that flickers." },
  { key: "crackle", label: "14 · Twin crackle", desc: "Two offset jagged bolts flickering alternately — restless electricity." },
  { key: "plasma", label: "15 · Plasma arc (Tesla)", desc: "Bright white filament core over a wide blue glow over a jagged bolt — a hot plasma arc." },
  { key: "forkheavy", label: "16 · Forked lightning", desc: "A dramatic main bolt with several branching spurs, like real lightning." },
  { key: "chain", label: "17 · Chain lightning", desc: "Sharp high-amplitude zig-zag with hot glowing nodes at each kink." },
  { key: "sparks", label: "18 · Arc + sparks", desc: "A jagged bolt with small spark particles jumping off along its length." },
];

function ArcSvg({ kind }: { kind: string }) {
  const spurs = spurEnds(A, B);
  return (
    <svg viewBox="0 0 220 190" width="100%" height="190" aria-hidden>
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#17b5a6" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
      </defs>

      {kind === "smooth" && (<><path className="pa" d={smooth(A, B)} /><path className="pa flow" d={smooth(A, B)} /></>)}
      {kind === "zig" && (<><path className="pa" d={zigzag(A, B, 6, 6)} /><path className="pa flow" d={zigzag(A, B, 6, 6)} /></>)}
      {kind === "fork" && (<><path className="pa" d={forked(A, B)} /><path className="pa flow" d={forked(A, B)} /></>)}
      {kind === "sine" && (<><path className="pa" d={sine(A, B, 9, 2.5)} /><path className="pa flow" d={sine(A, B, 9, 2.5)} /></>)}
      {kind === "circuit" && (
        <>
          <path className="pa" d={circuit(A, B)} strokeLinejoin="round" />
          <path className="pa march" d={circuit(A, B)} strokeLinejoin="round" />
        </>
      )}
      {kind === "stream" && (<><path className="pa dim" d={smooth(A, B)} /><path className="pa march" d={smooth(A, B)} /></>)}
      {kind === "neural" && (
        <>
          <path className="pa flow" d={smooth(A, B)} />
          {spurs.map((s, i) => {
            const dx = B.x - A.x, dy = B.y - A.y, t = i ? 0.68 : 0.4;
            const o = { x: A.x + dx * t, y: A.y + dy * t };
            return (
              <g key={i}>
                <path className="pa" d={`M${f(o)} L${f(s)}`} />
                <circle cx={s.x} cy={s.y} r="4" className="syn" />
              </g>
            );
          })}
        </>
      )}
      {kind === "dots" && (
        <>
          <path className="pa dim" d={STRAIGHT} />
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} r="3.5" fill="#3b82f6" className="glow">
              <animateMotion dur="1.6s" begin={`${i * 0.3}s`} repeatCount="indefinite" path={STRAIGHT} />
            </circle>
          ))}
        </>
      )}
      {kind === "comet" && (
        <>
          <path className="pa dim" d={STRAIGHT} />
          {[{ r: 4.5, o: 1 }, { r: 3.2, o: 0.55 }, { r: 2.2, o: 0.3 }].map((c, i) => (
            <circle key={i} r={c.r} fill="#60a5fa" opacity={c.o} className="glow">
              <animateMotion dur="1.5s" begin={`${i * 0.09}s`} repeatCount="indefinite" path={STRAIGHT} />
            </circle>
          ))}
        </>
      )}

      {kind === "tube" && (
        <>
          <path d={smooth(A, B)} fill="none" stroke="#1e3a8a" strokeWidth="9" strokeLinecap="round" opacity="0.9" />
          <path d={smooth(A, B)} fill="none" stroke="#3b82f6" strokeWidth="6" strokeLinecap="round" />
          <path d={smooth(A, B)} fill="none" stroke="#dbeafe" strokeWidth="2.4" strokeLinecap="round" opacity="0.95" />
          <path className="sheen" d={smooth(A, B)} fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" />
        </>
      )}
      {kind === "raised" && (
        <>
          <path d={zigzag(A, B, 6, 6)} fill="none" stroke="#0b1e5b" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" transform="translate(2.2,3)" style={{ filter: "blur(1.6px)" }} />
          <path className="pa flow" d={zigzag(A, B, 6, 6)} />
          <path d={zigzag(A, B, 6, 6)} fill="none" stroke="#eaf2ff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
        </>
      )}
      {kind === "helix" && (
        (() => {
          const front = sinePts(A, B, 10, 2.5, 0);
          const back = sinePts(A, B, 10, 2.5, Math.PI);
          const dF = "M" + front.map(f).join(" L");
          const dB = "M" + back.map(f).join(" L");
          const rungs = front.filter((_, i) => i % 4 === 0 && i > 0 && i < front.length - 1);
          return (
            <>
              {rungs.map((p, i) => {
                const j = front.indexOf(p);
                return <line key={i} x1={p.x} y1={p.y} x2={back[j].x} y2={back[j].y} stroke="#60a5fa" strokeWidth="1.4" opacity="0.4" />;
              })}
              <path d={dB} fill="none" stroke="#1e40af" strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
              <path className="pa flow" d={dF} />
            </>
          );
        })()
      )}

      {kind === "earc" && (() => {
        const d = toPath(roughen(arcPts(A, B, 22), 4, 1));
        return (
          <>
            <path d={d} fill="none" stroke="#1e3a8a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" style={{ filter: "blur(2px)" }} />
            <path className="pa flow" d={d} style={{ strokeWidth: 4, stroke: "#3b82f6" }} />
            <path d={d} fill="none" stroke="#eaf2ff" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
          </>
        );
      })()}
      {kind === "crackle" && (() => {
        const d1 = toPath(roughen(arcPts(A, B, 8), 5, 2));
        const d2 = toPath(roughen(arcPts(A, B, -6), 5, 9));
        return (
          <>
            <path className="pa flow" d={d1} />
            <path className="pa flow2" d={d2} style={{ stroke: "#93c5fd" }} />
          </>
        );
      })()}
      {kind === "plasma" && (() => {
        const d = toPath(roughen(arcPts(A, B, 14), 5, 4));
        return (
          <>
            <path d={d} fill="none" stroke="#2563eb" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" opacity="0.28" style={{ filter: "blur(3px)" }} />
            <path className="pa flow" d={d} style={{ strokeWidth: 5, stroke: "#60a5fa" }} />
            <path d={d} fill="none" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.98" style={{ filter: "drop-shadow(0 0 2px #fff)" }} />
          </>
        );
      })()}
      {kind === "forkheavy" && (() => {
        const main = roughen(arcPts(A, B, 6, 20), 6, 5);
        const d = toPath(main);
        const spurs = [0.3, 0.52, 0.74].map((t, i) => {
          const idx = Math.round(main.length * t);
          const o = main[idx];
          const dir = i % 2 === 0 ? 1 : -1;
          const s1 = { x: o.x + dir * 16, y: o.y + 13 };
          const s2 = { x: s1.x + dir * 8, y: s1.y + 15 };
          return `M${f(o)} L${f(s1)} L${f(s2)}`;
        }).join(" ");
        return (
          <>
            <path d={d + " " + spurs} fill="none" stroke="#1e3a8a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" style={{ filter: "blur(1.6px)" }} />
            <path className="pa flow" d={d + " " + spurs} />
            <path d={d + " " + spurs} fill="none" stroke="#eaf2ff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
          </>
        );
      })()}
      {kind === "chain" && (() => {
        const kinks = chainKinks(A, B, 12, 7);
        const d = toPath(kinks);
        const hot = kinks.slice(1, -1);
        return (
          <>
            <path d={d} fill="none" stroke="#1e40af" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" style={{ filter: "blur(1.6px)" }} />
            <path className="pa flow" d={d} style={{ strokeWidth: 3 }} />
            <path d={d} fill="none" stroke="#eaf2ff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
            {hot.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="2.6" className="syn" />
            ))}
          </>
        );
      })()}
      {kind === "sparks" && (() => {
        const bolt = roughen(arcPts(A, B, 7, 22), 6, 7);
        const d = toPath(bolt);
        const sparks = [0.25, 0.45, 0.6, 0.8].map((t, i) => {
          const idx = Math.round(bolt.length * t);
          const o = bolt[idx];
          const dir = i % 2 === 0 ? 1 : -1;
          return { x: o.x + dir * 9, y: o.y + (i % 2 ? 8 : -6) };
        });
        return (
          <>
            <path className="pa flow" d={d} />
            <path d={d} fill="none" stroke="#eaf2ff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
            {sparks.map((s, i) => (
              <circle key={i} r={2.2 - i * 0.2} fill="#bae6fd" className="spark" style={{ animationDelay: `${i * 0.28}s`, transformBox: "fill-box", transformOrigin: "center" }} cx={s.x} cy={s.y} />
            ))}
          </>
        );
      })()}

      {/* nodes on top */}
      <circle cx={A.x} cy={A.y} r="17" fill="url(#g)" />
      <text x={A.x} y={A.y + 5} textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">8</text>
      <circle cx={B.x} cy={B.y} r="20" fill="#eef1f4" stroke="#d7dee4" strokeWidth="2" />
      <text x={B.x} y={B.y + 5} textAnchor="middle" fontSize="14" fontWeight="800" fill="#334">9</text>
    </svg>
  );
}

export default function ArcPreview() {
  return (
    <div style={{ minHeight: "100dvh", background: "#f4f7f6", padding: "20px 16px 60px" }}>
      <style>{`
        .pa { fill:none; stroke:#1d4ed8; stroke-width:2.4; stroke-linecap:round; stroke-linejoin:round; opacity:.85; filter:drop-shadow(0 0 2px rgba(37,99,235,.5)); }
        .pa.flow { stroke:#3b82f6; stroke-width:3.4; opacity:.5; filter:drop-shadow(0 0 3px #60a5fa) drop-shadow(0 0 8px rgba(37,99,235,.8)); animation:boltP 1.6s ease-in-out infinite; }
        .pa.flow2 { stroke:#93c5fd; stroke-width:3; opacity:.5; filter:drop-shadow(0 0 3px #93c5fd) drop-shadow(0 0 8px rgba(59,130,246,.7)); animation:boltP 1.6s ease-in-out infinite; animation-delay:.8s; }
        .spark { fill:#bae6fd; filter:drop-shadow(0 0 4px #93c5fd); animation:spark 1.4s ease-in-out infinite; }
        @keyframes spark { 0%,100%{opacity:0; transform:scale(.4);} 12%{opacity:1; transform:scale(1.2);} 40%{opacity:.2; transform:scale(.7);} }
        .pa.dim { stroke:#c7d2e0; stroke-width:2; opacity:.7; }
        .pa.march { stroke:#3b82f6; stroke-width:3.2; opacity:.9; stroke-dasharray:10 12; filter:drop-shadow(0 0 4px #60a5fa); animation:march 0.9s linear infinite; }
        .glow { filter:drop-shadow(0 0 4px #60a5fa); }
        .syn { fill:#60a5fa; filter:drop-shadow(0 0 5px #93c5fd); animation:boltP 1.6s ease-in-out infinite; }
        @keyframes boltP { 0%{opacity:.25} 8%{opacity:1} 16%{opacity:.45} 26%{opacity:.95} 55%{opacity:.3} 100%{opacity:.25} }
        @keyframes march { to { stroke-dashoffset:-22; } }
        .sheen { stroke-dasharray:8 130; stroke-dashoffset:138; opacity:.9; filter:drop-shadow(0 0 3px #fff); animation:sheen 1.9s linear infinite; }
        @keyframes sheen { to { stroke-dashoffset:0; } }
        .arc-card { background:#fff; border:1px solid #e3e9ee; border-radius:16px; padding:12px 14px 4px; margin:0 auto 16px; max-width:360px; box-shadow:0 4px 14px rgba(20,40,50,.06); }
        .arc-lab { font-weight:800; font-size:15px; color:#152; }
        .arc-desc { font-size:12.5px; color:#678; margin:2px 0 6px; }
      `}</style>
      <h1 style={{ textAlign: "center", fontWeight: 800, fontSize: 18, marginBottom: 16, color: "#123" }}>
        Electric-arc options — pick one
      </h1>
      {CARDS.map((c) => (
        <div key={c.key} className="arc-card">
          <div className="arc-lab">{c.label}</div>
          <div className="arc-desc">{c.desc}</div>
          <ArcSvg kind={c.key} />
        </div>
      ))}
    </div>
  );
}
