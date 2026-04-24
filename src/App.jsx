import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = [
  { name: "Rose", hex: "#ff4f73" },
  { name: "Blue", hex: "#4db8ff" },
  { name: "Green", hex: "#9be564" },
  { name: "Gold", hex: "#ffc65c" },
  { name: "Violet", hex: "#a990ff" },
  { name: "Cyan", hex: "#58d7ee" },
  { name: "Pink", hex: "#f783c7" },
  { name: "Mint", hex: "#63ddb1" },
];

const UI = {
  page: "#05060a",
  pageTop: "#070911",
  panel: "#0b0f18",
  panelSoft: "#0c0f17",
  tile: "#11141d",
  tileActive: "#1a2030",
  button: "#121620",
  text: "rgba(255,255,255,0.94)",
  muted: "rgba(255,255,255,0.38)",
  ring: "rgba(255,255,255,0.05)",
};

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

function canPlayCell(cell, activePlayer, disabled) {
  return !disabled && (cell.owner === null || cell.owner === activePlayer);
}

function runLogicTests() {
  const errors = [];
  const assert = (condition, message) => {
    if (!condition) errors.push(message);
  };

  const board = makeBoard(3, 3);
  assert(board.length === 3, "makeBoard creates the right row count");
  assert(board[0].length === 3, "makeBoard creates the right column count");
  assert(capacity(0, 0, 3, 3) === 2, "corner capacity is 2");
  assert(capacity(0, 1, 3, 3) === 3, "edge capacity is 3");
  assert(capacity(1, 1, 3, 3) === 4, "center capacity is 4");

  board[0][0] = { owner: 0, count: 2 };
  const critical = findCritical(board, 3, 3);
  assert(critical.length === 1 && critical[0][0] === 0 && critical[0][1] === 0, "critical corner is detected");

  const exploded = explode(board, critical, 0, 3, 3);
  assert(exploded[0][0].owner === null && exploded[0][0].count === 0, "exploded source clears");
  assert(exploded[1][0].owner === 0 && exploded[1][0].count === 1, "explosion sends orb down");
  assert(exploded[0][1].owner === 0 && exploded[0][1].count === 1, "explosion sends orb right");

  const mass = playerMass(exploded, 2);
  assert(mass[0] === 2 && mass[1] === 0, "playerMass counts exploded orbs correctly");

  const centerBoard = makeBoard(3, 3);
  centerBoard[1][1] = { owner: 1, count: 4 };
  const centerExploded = explode(centerBoard, [[1, 1]], 1, 3, 3);
  assert(playerMass(centerExploded, 2)[1] === 4, "center explosion sends four orbs correctly");

  assert(canPlayCell({ owner: null, count: 0 }, 0, false), "empty cells are playable");
  assert(canPlayCell({ owner: 0, count: 1 }, 0, false), "owned cells are playable");
  assert(!canPlayCell({ owner: 1, count: 1 }, 0, false), "opponent cells are not playable");
  assert(!canPlayCell({ owner: null, count: 0 }, 0, true), "disabled board blocks play");

  if (errors.length) console.error("Chain Reactor logic tests failed:", errors);
  else console.info("Chain Reactor logic tests passed");
}

function SvgIcon({ type, size = 24 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.6,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  if (type === "plus") {
    return (
      <svg {...common}>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    );
  }

  if (type === "minus") {
    return (
      <svg {...common}>
        <path d="M5 12h14" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function Button({ children, className = "", kind = "primary", style, ...props }) {
  const baseStyle = {
    color: kind === "primary" ? UI.page : "rgba(255,255,255,0.9)",
    background: kind === "primary" ? "rgba(255,255,255,0.9)" : kind === "ghost" ? "transparent" : UI.button,
    boxShadow: "none",
    border: kind === "primary" ? "none" : `1px solid ${UI.ring}`,
    ...style,
  };

  return (
    <button
      className={`touch-manipulation select-none rounded-full px-4 py-3 text-sm font-medium tracking-[-0.015em] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35 ${className}`}
      style={baseStyle}
      {...props}
    >
      {children}
    </button>
  );
}

function OrbCluster({ color, count, fullness, cellSize }) {
  const visible = Math.min(count, 3);
  const base = Math.max(12, cellSize * 0.22);
  const orb = base;
  const radius = visible === 1 ? 0 : visible === 2 ? base * 0.5 : base * 0.58;
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
            className="absolute rounded-full"
            style={{
              width: orb,
              height: orb,
              left: x,
              top: y,
              marginLeft: -orb / 2,
              marginTop: -orb / 2,
              background: color,
              boxShadow: "0 0 10px rgba(255,255,255,0.18)",
            }}
            animate={{
              x: fullness > 0.8 ? [0, -1.8, 1.8, 0] : [0, -0.5, 0.5, 0],
              y: fullness > 0.8 ? [0, 1.8, -1.8, 0] : [0, 0.5, -0.5, 0],
              scale: fullness > 0.8 ? [1, 1.02, 0.98, 1] : 1,
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
  const canTap = canPlayCell(cell, activePlayer, disabled);
  const cap = capacity(r, c, rows, cols);
  const fullness = cell.count > 0 ? Math.min(1, cell.count / Math.max(1, cap - 1)) : 0;
  const color = owned ? COLORS[cell.owner].hex : "transparent";

  return (
    <motion.button
      aria-label={`row ${r + 1}, column ${c + 1}`}
      disabled={!canTap}
      onClick={onTap}
      whileTap={canTap ? { scale: 0.94 } : undefined}
      className="relative flex aspect-square items-center justify-center rounded-[0.9rem] transition disabled:opacity-35"
      style={{
        background: UI.tile,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
      }}
    >
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
      className="pointer-events-none absolute z-20 rounded-full"
      style={{
        background: orb.color,
        width: size,
        height: size,
        left: fromLeft,
        top: fromTop,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        boxShadow: "0 0 10px rgba(255,255,255,0.22)",
      }}
      initial={{ left: fromLeft, top: fromTop, opacity: 1, scale: 1 }}
      animate={{ left: toLeft, top: toTop, opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1 }}
      transition={{ duration: TRAVEL_MS / 1000, ease: "easeInOut" }}
    />
  );
}

function Stepper({ label, value, min, max, onChange }) {
  return (
    <div className="rounded-[1.5rem] p-3" style={{ background: UI.tile, border: `1px solid ${UI.ring}` }}>
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: UI.muted }}>{label}</div>
      <div className="flex items-center justify-between">
        <Button
          kind="ghost"
          className="flex h-12 w-12 items-center justify-center rounded-full p-0"
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${UI.ring}` }}
        >
          <SvgIcon type="minus" size={24} />
        </Button>
        <div className="text-2xl font-semibold tracking-[-0.035em]" style={{ color: "rgba(255,255,255,0.9)" }}>{value}</div>
        <Button
          kind="ghost"
          className="flex h-12 w-12 items-center justify-center rounded-full p-0"
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${UI.ring}` }}
        >
          <SvgIcon type="plus" size={24} />
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
    runLogicTests();

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
    addMeta("meta[name='theme-color']", { name: "theme-color", content: UI.page });
    addMeta("meta[name='apple-mobile-web-app-capable']", { name: "apple-mobile-web-app-capable", content: "yes" });
    addMeta("meta[name='apple-mobile-web-app-title']", { name: "apple-mobile-web-app-title", content: "Chain Reactor" });
    addMeta("meta[name='apple-mobile-web-app-status-bar-style']", { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" });

    document.title = "Chain Reactor";

    const style = document.createElement("style");
    style.textContent = `
      :root { color-scheme: dark; background: ${UI.page}; font-family: "Manrope", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
      * { box-sizing: border-box; }
      html, body, #root { margin: 0; width: 100%; height: 100%; min-height: 100%; background: ${UI.page}; overflow: hidden; overscroll-behavior: none; -webkit-tap-highlight-color: transparent; -webkit-touch-callout: none; }
      html, body { position: relative; touch-action: manipulation; }
      body { min-height: 100dvh; height: 100dvh; }
      button { font: inherit; }
      h1, h2, h3 { font-family: "Space Grotesk", "Manrope", "Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif; letter-spacing: -0.025em; }
      @supports (height: 100svh) { body, #root { min-height: 100svh; height: 100svh; } }
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
    if (!canPlayCell(cell, activePlayer, false)) return;

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

  const pageBackground = {
    backgroundColor: UI.page,
    backgroundImage: `radial-gradient(circle at 50% -10%, rgba(120,140,255,0.12), transparent 36%), linear-gradient(180deg, ${UI.pageTop} 0%, ${UI.page} 60%, #04050a 100%)`,
  };

  if (screen !== "game") {
    return (
      <main
        className="relative h-[100svh] w-screen overflow-hidden px-5 text-white"
        style={{ ...pageBackground, paddingTop: "calc(env(safe-area-inset-top) + 18px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 18px)" }}
      >
        <section className="relative mx-auto flex h-full max-w-md flex-col justify-center gap-6">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-[1.2rem]" style={{ background: "#0f1420", boxShadow: "0 16px 36px rgba(0,0,0,0.4)", border: `1px solid ${UI.ring}` }}>
              <div className="relative h-11 w-11">
                <span className="absolute left-0 top-4 h-4 w-4 rounded-full" style={{ background: COLORS[0].hex, boxShadow: "0 0 12px rgba(255,79,115,0.45)" }} />
                <span className="absolute right-0 top-1 h-4 w-4 rounded-full" style={{ background: COLORS[1].hex, boxShadow: "0 0 12px rgba(77,184,255,0.45)" }} />
                <span className="absolute bottom-1 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full" style={{ background: COLORS[2].hex, boxShadow: "0 0 12px rgba(155,229,100,0.45)" }} />
              </div>
            </div>
            <h1 className="mt-2 text-4xl font-bold tracking-[-0.035em]" style={{ color: UI.text, fontFamily: '"Space Grotesk", "Manrope", "Inter", -apple-system, system-ui, sans-serif' }}>Chain Reactor</h1>
          </motion.div>

          <div className="rounded-[1.6rem] p-4" style={{ background: UI.panel, boxShadow: "0 18px 40px rgba(0,0,0,0.5)", border: `1px solid ${UI.ring}` }}>
            <div className="grid gap-3">
              <Stepper label="Players" value={playerCount} min={2} max={8} onChange={(v) => reset(rows, cols, v)} />
              <div className="grid grid-cols-2 gap-3">
                <Button kind="secondary" onClick={() => reset(9, 6, playerCount)}>Phone</Button>
                <Button kind="secondary" onClick={() => reset(10, 8, playerCount)}>Tablet</Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stepper label="Rows" value={rows} min={5} max={14} onChange={(v) => reset(v, cols, playerCount)} />
                <Stepper label="Columns" value={cols} min={4} max={10} onChange={(v) => reset(rows, v, playerCount)} />
              </div>
              <Button className="h-14 text-base font-semibold" onClick={() => { reset(rows, cols, playerCount); setScreen("game"); }}>
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
      className="relative h-[100svh] w-screen overflow-hidden px-3 text-white"
      style={{ ...pageBackground, paddingTop: "calc(env(safe-area-inset-top) + 8px)", paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
    >
      <div className="relative mx-auto flex h-full max-w-md flex-col gap-3">
        <header className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-full p-2" style={{ background: "rgba(12,15,23,0.9)", boxShadow: "0 10px 26px rgba(0,0,0,0.4)", border: `1px solid ${UI.ring}` }}>
          <Button kind="secondary" className="px-3 py-2" disabled={busy} onClick={() => setScreen("home")}>Setup</Button>
          <div className="min-w-0 text-center">
            <div className="text-[9px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.25)" }}>Turn</div>
            <div className="truncate text-lg font-semibold tracking-[-0.035em]" style={{ color: players[activePlayer].hex }}>{players[activePlayer].label}</div>
          </div>
          <Button
            kind="ghost"
            className="flex h-12 w-12 items-center justify-center rounded-full p-0"
            disabled={busy}
            onClick={() => reset()}
            aria-label="Reset game"
            style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${UI.ring}` }}
          >
            <SvgIcon type="refresh" size={24} />
          </Button>
        </header>

        <section className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
          <div
            ref={boardRef}
            className="relative grid gap-2.5 rounded-[1.4rem] p-2.5"
            style={{
              background: UI.panel,
              boxShadow: "0 18px 40px rgba(0,0,0,0.5)",
              border: `1px solid ${UI.ring}`,
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
            <AnimatePresence>
              {flying.map((orb) => (
                <FlyingOrb key={orb.id} orb={orb} rows={rows} cols={cols} cellSize={cellSize} />
              ))}
            </AnimatePresence>
          </div>
        </section>

        <AnimatePresence>
          {winner !== null && (
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.95 }}
              className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-[1.6rem] p-5 text-center backdrop-blur-xl"
              style={{ background: UI.panel, boxShadow: "0 18px 40px rgba(0,0,0,0.55)", border: `1px solid ${UI.ring}` }}
            >
              <div className="text-4xl">👑</div>
              <div className="mt-2 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: UI.muted }}>Winner</div>
              <div className="mt-1 text-2xl font-semibold tracking-[-0.035em]" style={{ color: players[winner].hex }}>{players[winner].label}</div>
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
