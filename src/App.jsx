import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = [
  { name: "Neon Rose", hex: "#fb3b65", text: "text-rose-300" },
  { name: "Sky Pulse", hex: "#24b6ff", text: "text-sky-300" },
  { name: "Lime Volt", hex: "#9bef36", text: "text-lime-300" },
  { name: "Amber Core", hex: "#ffb020", text: "text-amber-300" },
  { name: "Violet Nova", hex: "#a78bfa", text: "text-violet-300" },
  { name: "Cyan Flux", hex: "#22d3ee", text: "text-cyan-300" },
  { name: "Pink Comet", hex: "#f472b6", text: "text-pink-300" },
  { name: "Emerald Ion", hex: "#34d399", text: "text-emerald-300" },
];

const DEFAULT_ROWS = 9;
const DEFAULT_COLS = 6;
const TRAVEL_MS = 170;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function makeBoard(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ owner: null, count: 0 }))
  );
}

function copyBoard(board) {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function neighbors(r, c, rows, cols) {
  const out = [];
  if (r > 0) out.push([r - 1, c]);
  if (r < rows - 1) out.push([r + 1, c]);
  if (c > 0) out.push([r, c - 1]);
  if (c < cols - 1) out.push([r, c + 1]);
  return out;
}

function capacity(r, c, rows, cols) {
  return neighbors(r, c, rows, cols).length;
}

function playerMass(board, playerCount) {
  const counts = Array(playerCount).fill(0);
  for (const row of board) {
    for (const cell of row) {
      if (cell.owner !== null && cell.count > 0) counts[cell.owner] += cell.count;
    }
  }
  return counts;
}

function findCritical(board, rows, cols) {
  const list = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (board[r][c].count >= capacity(r, c, rows, cols)) list.push([r, c]);
    }
  }
  return list;
}

function explode(board, critical, owner, rows, cols) {
  const next = copyBoard(board);
  for (const [r, c] of critical) {
    next[r][c] = { owner: null, count: 0 };
    for (const [nr, nc] of neighbors(r, c, rows, cols)) {
      next[nr][nc].owner = owner;
      next[nr][nc].count += 1;
    }
  }
  return next;
}

function Button({ children, className = "", kind = "primary", ...props }) {
  const styles =
    kind === "primary"
      ? "bg-white text-slate-950 shadow-white/10 hover:bg-white/90"
      : kind === "ghost"
      ? "bg-transparent text-white/70 hover:bg-white/10 hover:text-white"
      : "border border-white/10 bg-white/10 text-white hover:bg-white/15";

  return (
    <button
      className={`touch-manipulation select-none rounded-2xl px-4 py-3 text-sm font-black shadow-lg transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 ${styles} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function OrbCluster({ color, count, fullness, cellSize }) {
  const visible = Math.min(count, 3);
  const base = Math.max(18, cellSize * 0.4);
  const orb = visible === 1 ? base : base * 0.66;
  const radius = visible === 1 ? 0 : visible === 2 ? base * 0.22 : base * 0.3;
  const duration = fullness > 0.85 ? 1.05 : fullness > 0.55 ? 1.65 : 2.5;

  return (
    <motion.span
      className="absolute left-1/2 top-1/2 h-0 w-0"
      animate={{ rotate: 360 }}
      transition={{ duration, repeat: Infinity, ease: "linear" }}
      style={{ transformOrigin: "0 0" }}
    >
      {Array.from({ length: visible }).map((_, i) => {
        const angle = visible === 1 ? 0 : visible === 2 ? i * Math.PI : i * ((Math.PI * 2) / 3) - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <motion.span
            key={i}
            className="absolute rounded-full shadow-[0_0_18px_rgba(255,255,255,.25)]"
            style={{
              width: orb,
              height: orb,
              left: x,
              top: y,
              marginLeft: -orb / 2,
              marginTop: -orb / 2,
              background: color,
            }}
            animate={{
              x: fullness > 0.8 ? [0, -1.8, 1.8, 0] : [0, -0.5, 0.5, 0],
              y: fullness > 0.8 ? [0, 1.8, -1.8, 0] : [0, 0.5, -0.5, 0],
              scale: fullness > 0.8 ? [1, 1.05, 0.97, 1] : 1,
            }}
            transition={{ duration: fullness > 0.8 ? 0.34 : 0.95, repeat: Infinity, ease: "easeInOut", delay: i * 0.05 }}
          />
        );
      })}
    </motion.span>
  );
}

function Cell({ cell, r, c, rows, cols, activePlayer, disabled, onTap, cellSize }) {
  const owned = cell.owner !== null;
  const canTap = !disabled && (!owned || cell.owner === activePlayer);
  const cap = capacity(r, c, rows, cols);
  const fullness = cell.count > 0 ? Math.min(1, cell.count / Math.max(1, cap - 1)) : 0;
  const color = owned ? COLORS[cell.owner].hex : "transparent";

  return (
    <motion.button
      aria-label={`row ${r + 1}, column ${c + 1}`}
      disabled={!canTap}
      onClick={onTap}
      whileTap={canTap ? { scale: 0.92 } : undefined}
      className={`relative aspect-square overflow-hidden rounded-[1rem] border bg-slate-950/80 shadow-inner transition ${
        canTap ? "border-white/12 active:border-white/50" : "border-white/5 opacity-45"
      }`}
    >
      <span className="absolute inset-1 rounded-xl bg-gradient-to-br from-white/[0.055] to-transparent" />
      {owned && cell.count > 0 && <OrbCluster color={color} count={cell.count} fullness={fullness} cellSize={cellSize} />}
    </motion.button>
  );
}

function FlyingOrb({ orb, rows, cols, cellSize }) {
  const fromLeft = `${((orb.from.c + 0.5) / cols) * 100}%`;
  const fromTop = `${((orb.from.r + 0.5) / rows) * 100}%`;
  const toLeft = `${((orb.to.c + 0.5) / cols) * 100}%`;
  const toTop = `${((orb.to.r + 0.5) / rows) * 100}%`;
  const size = Math.max(12, cellSize * 0.27);

  return (
    <motion.span
      className="pointer-events-none absolute z-20 rounded-full shadow-[0_0_16px_rgba(255,255,255,.3)]"
      style={{ background: orb.color, width: size, height: size, left: fromLeft, top: fromTop, marginLeft: -size / 2, marginTop: -size / 2 }}
      initial={{ left: fromLeft, top: fromTop, opacity: 1, scale: 1 }}
      animate={{ left: toLeft, top: toTop, opacity: 1, scale: [1, 1.12, 1] }}
      exit={{ opacity: 0, scale: 0.75 }}
      transition={{ duration: TRAVEL_MS / 1000, ease: "easeInOut" }}
    />
  );
}

function Stepper({ label, value, min, max, onChange }) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-black/25 p-3">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-white/45">{label}</div>
      <div className="flex items-center justify-between">
        <Button kind="secondary" className="h-11 w-11 rounded-2xl p-0 text-2xl" disabled={value <= min} onClick={() => onChange(value - 1)}>
          −
        </Button>
        <div className="text-3xl font-black">{value}</div>
        <Button kind="secondary" className="h-11 w-11 rounded-2xl p-0 text-2xl" disabled={value >= max} onClick={() => onChange(value + 1)}>
          +
        </Button>
      </div>
    </div>
  );
}

export default function ChainReactorIPhoneApp() {
  const [screen, setScreen] = useState("home");
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [playerCount, setPlayerCount] = useState(2);
  const [board, setBoard] = useState(() => makeBoard(DEFAULT_ROWS, DEFAULT_COLS));
  const [activePlayer, setActivePlayer] = useState(0);
  const [turns, setTurns] = useState(Array(8).fill(0));
  const [busy, setBusy] = useState(false);
  const [winner, setWinner] = useState(null);
  const [flying, setFlying] = useState([]);
  const [cellSize, setCellSize] = useState(48);
  const boardRef = useRef(null);
  const stopped = useRef(false);

  useEffect(() => {
    const addMeta = (selector, attrs) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        document.head.appendChild(el);
      }
      Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    };

    addMeta("meta[name='viewport']", {
      name: "viewport",
      content: "width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no, interactive-widget=resizes-content",
    });
    addMeta("meta[name='theme-color']", { name: "theme-color", content: "#020617" });
    addMeta("meta[name='apple-mobile-web-app-capable']", { name: "apple-mobile-web-app-capable", content: "yes" });
    addMeta("meta[name='apple-mobile-web-app-title']", { name: "apple-mobile-web-app-title", content: "Chain Reactor" });
    addMeta("meta[name='apple-mobile-web-app-status-bar-style']", { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" });

    document.title = "Chain Reactor";

    const style = document.createElement("style");
    style.textContent = `
      :root { color-scheme: dark; background: #020617; }
      html, body, #root { margin: 0; width: 100%; min-height: 100%; background: #020617; overflow: hidden; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; }
      body { min-height: 100dvh; }
      button { font: inherit; }
      @supports (height: 100svh) { body, #root { min-height: 100svh; } }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    const update = () => {
      const first = boardRef.current?.querySelector("button[aria-label^='row']");
      if (first) setCellSize(first.getBoundingClientRect().width || 48);
    };
    update();
    window.addEventListener("resize", update);
    const observer = boardRef.current ? new ResizeObserver(update) : null;
    if (boardRef.current && observer) observer.observe(boardRef.current);
    return () => {
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [rows, cols, screen]);

  const players = useMemo(
    () => COLORS.slice(0, playerCount).map((p, i) => ({ ...p, label: `Player ${i + 1}` })),
    [playerCount]
  );

  function reset(nextRows = rows, nextCols = cols, nextPlayers = playerCount) {
    setRows(nextRows);
    setCols(nextCols);
    setPlayerCount(nextPlayers);
    setBoard(makeBoard(nextRows, nextCols));
    setActivePlayer(0);
    setTurns(Array(8).fill(0));
    setWinner(null);
    setFlying([]);
    setBusy(false);
    stopped.current = false;
  }

  function winnerFor(nextBoard, nextTurns) {
    const mass = playerMass(nextBoard, playerCount);
    const allPlayed = nextTurns.slice(0, playerCount).every((t) => t > 0);
    if (!allPlayed) return null;
    const alive = mass.map((m, i) => ({ m, i })).filter((x) => x.m > 0);
    return alive.length === 1 ? alive[0].i : null;
  }

  function nextPlayer(from, nextBoard, nextTurns) {
    const mass = playerMass(nextBoard, playerCount);
    for (let step = 1; step <= playerCount; step += 1) {
      const candidate = (from + step) % playerCount;
      if (!(nextTurns[candidate] > 0 && mass[candidate] === 0)) return candidate;
    }
    return from;
  }

  async function resolve(startBoard, owner, nextTurns) {
    let current = copyBoard(startBoard);
    for (let loop = 0; loop < 8000; loop += 1) {
      const w = winnerFor(current, nextTurns);
      if (w !== null) {
        stopped.current = true;
        setWinner(w);
        setFlying([]);
        return current;
      }

      const critical = findCritical(current, rows, cols);
      if (critical.length === 0) return current;

      const movers = [];
      for (const [r, c] of critical) {
        neighbors(r, c, rows, cols).forEach(([nr, nc], i) => {
          movers.push({ id: `${loop}-${r}-${c}-${nr}-${nc}-${i}`, color: COLORS[owner].hex, from: { r, c }, to: { r: nr, c: nc } });
        });
      }

      setFlying(movers);
      await wait(TRAVEL_MS);
      if (stopped.current) return current;
      current = explode(current, critical, owner, rows, cols);
      setFlying([]);
      setBoard(copyBoard(current));
      await wait(35);
    }
    return current;
  }

  async function play(r, c) {
    if (busy || winner !== null) return;
    const cell = board[r][c];
    if (cell.owner !== null && cell.owner !== activePlayer) return;

    setBusy(true);
    stopped.current = false;
    const nextTurns = [...turns];
    nextTurns[activePlayer] += 1;
    setTurns(nextTurns);

    const next = copyBoard(board);
    next[r][c] = { owner: activePlayer, count: next[r][c].count + 1 };
    setBoard(next);

    const resolved = await resolve(next, activePlayer, nextTurns);
    if (!stopped.current) {
      const w = winnerFor(resolved, nextTurns);
      if (w !== null) setWinner(w);
      else setActivePlayer(nextPlayer(activePlayer, resolved, nextTurns));
    }
    setBusy(false);
  }

  const mass = playerMass(board, playerCount);

  if (screen !== "game") {
    return (
      <main
        className="min-h-[100dvh] overflow-y-auto bg-slate-950 px-4 text-white"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 18px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)" }}
      >
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(14,165,233,.26),transparent_34%),radial-gradient(circle_at_90%_90%,rgba(244,63,94,.22),transparent_40%)]" />
        <section className="relative mx-auto flex min-h-[calc(100dvh-36px)] max-w-md flex-col justify-center gap-4">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[2rem] border border-white/10 bg-white/10 shadow-2xl backdrop-blur-xl">
              <div className="relative h-11 w-11">
                <span className="absolute left-0 top-4 h-4 w-4 rounded-full bg-rose-500 shadow-[0_0_18px_rgba(251,59,101,.9)]" />
                <span className="absolute right-0 top-1 h-4 w-4 rounded-full bg-sky-400 shadow-[0_0_18px_rgba(36,182,255,.9)]" />
                <span className="absolute bottom-1 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-lime-400 shadow-[0_0_18px_rgba(155,239,54,.9)]" />
              </div>
            </div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-white/40">iPhone Web App</p>
            <h1 className="mt-2 text-5xl font-black tracking-tight">Chain Reactor</h1>
            <p className="mx-auto mt-4 max-w-xs text-sm leading-6 text-white/60">Local multiplayer strategy with exploding atoms, fast chain reactions, and big touch targets.</p>
          </motion.div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-4 shadow-2xl backdrop-blur-xl">
            <div className="grid gap-3">
              <Stepper label="Players" value={playerCount} min={2} max={8} onChange={(v) => reset(rows, cols, v)} />
              <div className="grid grid-cols-2 gap-3">
                <Button kind="secondary" onClick={() => reset(9, 6, playerCount)}>iPhone grid</Button>
                <Button kind="secondary" onClick={() => reset(10, 8, playerCount)}>Bigger grid</Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stepper label="Rows" value={rows} min={5} max={14} onChange={(v) => reset(v, cols, playerCount)} />
                <Stepper label="Columns" value={cols} min={4} max={10} onChange={(v) => reset(rows, v, playerCount)} />
              </div>
              <div className="rounded-[1.6rem] border border-white/10 bg-black/20 p-4 text-sm leading-6 text-white/65">
                Place orbs in empty cells or cells you own. Corners burst at 2, edges at 3, and middle cells at 4. Bursts capture neighbors. Last player standing wins.
              </div>
              <Button className="h-14 text-base" onClick={() => { reset(rows, cols, playerCount); setScreen("game"); }}>
                Start Game
              </Button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main
      className="min-h-[100dvh] overflow-hidden bg-slate-950 px-2 text-white"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 8px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
    >
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(14,165,233,.2),transparent_34%),radial-gradient(circle_at_90%_92%,rgba(244,63,94,.18),transparent_42%)]" />
      <div className="relative mx-auto flex h-[calc(100dvh-16px)] max-w-md flex-col gap-2">
        <header className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-[1.45rem] border border-white/10 bg-white/[0.07] p-2 shadow-2xl backdrop-blur-xl">
          <Button kind="secondary" className="px-3 py-2" disabled={busy} onClick={() => setScreen("home")}>Setup</Button>
          <div className="min-w-0 text-center">
            <div className="text-[9px] font-black uppercase tracking-[0.22em] text-white/35">Current turn</div>
            <div className="truncate text-lg font-black" style={{ color: players[activePlayer].hex }}>{players[activePlayer].label}</div>
          </div>
          <Button kind="secondary" className="h-10 w-10 px-0 py-0" disabled={busy} onClick={() => reset()}>↻</Button>
        </header>

        <section className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <div
            ref={boardRef}
            className="relative grid shrink-0 gap-1.5 rounded-[1.65rem] border border-white/10 bg-slate-900/75 p-2 shadow-2xl backdrop-blur-xl"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
              width: `min(96vw, 430px, calc((100dvh - 7.5rem) * ${cols} / ${rows}))`,
            }}
          >
            {board.map((row, r) =>
              row.map((cell, c) => (
                <Cell
                  key={`${r}-${c}`}
                  cell={cell}
                  r={r}
                  c={c}
                  rows={rows}
                  cols={cols}
                  activePlayer={activePlayer}
                  disabled={busy || winner !== null}
                  onTap={() => play(r, c)}
                  cellSize={cellSize}
                />
              ))
            )}
            <AnimatePresence>{flying.map((orb) => <FlyingOrb key={orb.id} orb={orb} rows={rows} cols={cols} cellSize={cellSize} />)}</AnimatePresence>
          </div>
        </section>

        <footer className="grid grid-cols-4 gap-1.5 rounded-[1.45rem] border border-white/10 bg-white/[0.06] p-2 backdrop-blur-xl">
          {players.slice(0, Math.min(4, playerCount)).map((p, i) => (
            <div key={p.name} className="rounded-2xl bg-black/20 p-2 text-center">
              <div className="mx-auto mb-1 h-2 w-8 rounded-full" style={{ background: p.hex }} />
              <div className="text-[10px] font-black text-white/45">P{i + 1}</div>
              <div className="text-sm font-black">{mass[i]}</div>
            </div>
          ))}
        </footer>

        <AnimatePresence>
          {winner !== null && (
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-[2rem] border border-white/10 bg-slate-950/92 p-5 text-center shadow-2xl backdrop-blur-xl"
            >
              <div className="text-4xl">👑</div>
              <div className="mt-2 text-xs font-black uppercase tracking-[0.25em] text-white/45">Winner</div>
              <div className="mt-1 text-3xl font-black" style={{ color: players[winner].hex }}>{players[winner].label}</div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button kind="secondary" onClick={() => setScreen("home")}>Setup</Button>
                <Button onClick={() => reset()}>Play again</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
