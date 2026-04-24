import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const PLAYER_PALETTE = [
  { name: "Neon Rose", bg: "bg-rose-500", text: "text-rose-400", hex: "#f43f5e" },
  { name: "Sky Pulse", bg: "bg-sky-500", text: "text-sky-400", hex: "#0ea5e9" },
  { name: "Lime Volt", bg: "bg-lime-500", text: "text-lime-400", hex: "#84cc16" },
  { name: "Amber Core", bg: "bg-amber-500", text: "text-amber-400", hex: "#f59e0b" },
  { name: "Violet Nova", bg: "bg-violet-500", text: "text-violet-400", hex: "#8b5cf6" },
  { name: "Cyan Flux", bg: "bg-cyan-500", text: "text-cyan-400", hex: "#06b6d4" },
  { name: "Pink Comet", bg: "bg-pink-500", text: "text-pink-400", hex: "#ec4899" },
  { name: "Emerald Ion", bg: "bg-emerald-500", text: "text-emerald-400", hex: "#10b981" },
];

const DEFAULT_ROWS = 9;
const DEFAULT_COLS = 6;
const MAX_PLAYERS = 8;
const TRAVEL_MS = 220;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function Button({ children, className = "", variant = "primary", size = "md", ...props }) {
  const base = "inline-flex items-center justify-center rounded-xl font-bold transition disabled:cursor-not-allowed disabled:opacity-50 active:scale-95";
  const variants = {
    primary: "bg-white text-slate-950 hover:bg-white/90",
    secondary: "border border-white/10 bg-white/10 text-white hover:bg-white/15",
  };
  const sizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-sm" };
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>{children}</button>;
}

function Card({ children, className = "" }) {
  return <div className={`rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur ${className}`}>{children}</div>;
}

function CardContent({ children, className = "" }) {
  return <div className={className}>{children}</div>;
}

function createBoard(rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ owner: null, count: 0 })));
}

function cloneBoard(board) {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function neighborsOf(r, c, rows, cols) {
  const spots = [];
  if (r > 0) spots.push([r - 1, c]);
  if (r < rows - 1) spots.push([r + 1, c]);
  if (c > 0) spots.push([r, c - 1]);
  if (c < cols - 1) spots.push([r, c + 1]);
  return spots;
}

function criticalMass(r, c, rows, cols) {
  return neighborsOf(r, c, rows, cols).length;
}

function boardStats(board, playerCount) {
  const counts = Array(playerCount).fill(0);
  let occupied = 0;
  board.forEach((row) => row.forEach((cell) => {
    if (cell.owner !== null && cell.count > 0) {
      counts[cell.owner] += cell.count;
      occupied += 1;
    }
  }));
  return { counts, occupied };
}

function applyBurstStep(board, bursting, owner, rows, cols) {
  const next = cloneBoard(board);
  bursting.forEach(([r, c]) => {
    const neighbors = neighborsOf(r, c, rows, cols);
    next[r][c] = { owner: null, count: 0 };
    neighbors.forEach(([nr, nc]) => {
      next[nr][nc].owner = owner;
      next[nr][nc].count += 1;
    });
  });
  return next;
}

function findBurstingCells(board, rows, cols) {
  const bursting = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (board[r][c].count >= criticalMass(r, c, rows, cols)) bursting.push([r, c]);
    }
  }
  return bursting;
}

function Icon({ type, className = "h-4 w-4" }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (type === "play") return <svg {...common}><path d="M8 5v14l11-7z" /></svg>;
  if (type === "back") return <svg {...common}><path d="M15 18l-6-6 6-6" /></svg>;
  if (type === "reset") return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v6h6" /></svg>;
  if (type === "phone") return <svg {...common}><rect x="7" y="2.8" width="10" height="18.4" rx="2" /><path d="M11 18h2" /></svg>;
  if (type === "users") return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
  if (type === "crown") return <svg {...common}><path d="M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z" /><path d="M5 19h14" /></svg>;
  return null;
}

function OrbCluster({ color, total, instability, cellSize }) {
  const groupSize = Math.min(total, 3);
  const spinDuration = instability > 0.85 ? 1.6 : instability > 0.45 ? 2.2 : 3.2;

  // True percentage-based sizing: the visible cluster targets ~40% of the actual cell size.
  const safeCellSize = cellSize || 48;
  const clusterTarget = safeCellSize * 0.4;
  const orbSize = groupSize === 1 ? clusterTarget : clusterTarget * 0.72;
  const radius = groupSize === 1 ? 0 : groupSize === 2 ? clusterTarget * 0.18 : clusterTarget * 0.24;
  const isUnstable = instability > 0.6;
  const isCritical = instability > 0.85;
  const points = Array.from({ length: groupSize }).map((_, index) => {
    const angle = groupSize === 1 ? 0 : groupSize === 2 ? index * Math.PI : index * ((Math.PI * 2) / 3) - Math.PI / 2;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
  return (
    <motion.span className="absolute left-1/2 top-1/2 h-0 w-0" animate={{ rotate: 360 }} transition={{ duration: spinDuration, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "0 0" }}>
      {points.map((point, index) => (
        <motion.span key={index} className="absolute rounded-full shadow-[0_0_14px_rgba(255,255,255,.25)]" style={{ width: orbSize, height: orbSize, left: point.x, top: point.y, marginLeft: -orbSize / 2, marginTop: -orbSize / 2, background: color }} initial={{ scale: 1, x: 0, y: 0 }} animate={{ scale: isCritical ? [1, 1.08, 0.96, 1.05, 1] : isUnstable ? [1, 1.04, 0.98, 1] : 1, x: isCritical ? [0, -1.5, 1.5, -1, 0] : isUnstable ? [0, -0.8, 0.8, 0] : 0, y: isCritical ? [0, 1.5, -1.5, 1, 0] : isUnstable ? [0, 0.8, -0.8, 0] : 0 }} transition={{ duration: isCritical ? 0.4 : isUnstable ? 0.7 : 1.2, repeat: Infinity, ease: "easeInOut", delay: index * 0.05 }} />
      ))}
    </motion.span>
  );
}

function Cell({ cell, row, col, rows, cols, activePlayer, onTap, disabled, cellSize }) {
  const owner = cell.owner !== null ? PLAYER_PALETTE[cell.owner] : null;
  const mass = criticalMass(row, col, rows, cols);
  const isPlayable = !disabled && (cell.owner === null || cell.owner === activePlayer);
  const instability = cell.count > 0 ? Math.min(1, cell.count / Math.max(1, mass - 1)) : 0;
  return (
    <motion.button type="button" aria-label={`Cell ${row + 1}, ${col + 1}`} onClick={onTap} disabled={!isPlayable} whileTap={isPlayable ? { scale: 0.97 } : undefined} className={`relative aspect-square rounded-xl border border-white/10 bg-slate-950/70 shadow-inner transition ${isPlayable ? "hover:border-white/25 active:scale-95" : "cursor-not-allowed opacity-50"}`}>
      <span className="absolute inset-1 rounded-lg border border-white/5" />
      <AnimatePresence>{owner && cell.count > 0 && <OrbCluster key={`${row}-${col}-${cell.owner}-${cell.count}`} color={owner.hex} total={cell.count} instability={instability} cellSize={cellSize} />}</AnimatePresence>
    </motion.button>
  );
}

function FlyingOrb({ orb, rows, cols, cellSize }) {
  const fromLeft = `${((orb.from.c + 0.5) / cols) * 100}%`;
  const fromTop = `${((orb.from.r + 0.5) / rows) * 100}%`;
  const toLeft = `${((orb.to.c + 0.5) / cols) * 100}%`;
  const toTop = `${((orb.to.r + 0.5) / rows) * 100}%`;
  const orbSize = (cellSize || 48) * 0.28;

  return (
    <motion.span
      className="pointer-events-none absolute z-20 rounded-full shadow-[0_0_14px_rgba(255,255,255,.25)]"
      style={{
        background: orb.color,
        width: orbSize,
        height: orbSize,
        left: fromLeft,
        top: fromTop,
        marginLeft: -orbSize / 2,
        marginTop: -orbSize / 2,
      }}
      initial={{ left: fromLeft, top: fromTop, opacity: 1, scale: 1 }}
      animate={{ left: toLeft, top: toTop, opacity: 1, scale: [1, 1.08, 1] }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: TRAVEL_MS / 1000, ease: "easeInOut" }}
    />
  );
}

function StepperButton({ label, onClick }) {
  return <Button type="button" size="sm" variant="secondary" className="h-11 w-11 rounded-xl p-0 text-2xl font-black leading-none" onClick={onClick} aria-label={label}>{label === "decrease" ? "-" : "+"}</Button>;
}

export default function ChainReactorModern() {
  React.useEffect(() => {
    const ensureMeta = (selector, attrs) => {
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement("meta");
        document.head.appendChild(el);
      }
      Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
      return el;
    };

    ensureMeta("meta[name='viewport']", {
      name: "viewport",
      content: "width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no",
    });
    ensureMeta("meta[name='theme-color']", { name: "theme-color", content: "#020617" });
    ensureMeta("meta[name='apple-mobile-web-app-capable']", {
      name: "apple-mobile-web-app-capable",
      content: "yes",
    });
    ensureMeta("meta[name='apple-mobile-web-app-status-bar-style']", {
      name: "apple-mobile-web-app-status-bar-style",
      content: "black-translucent",
    });
    ensureMeta("meta[name='mobile-web-app-capable']", {
      name: "mobile-web-app-capable",
      content: "yes",
    });

    const styleId = "chain-reaction-pwa-safe-area-style";
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      :root {
        background-color: #020617;
        background-image:
          radial-gradient(circle at top left, rgba(14,165,233,.22), transparent 38%),
          radial-gradient(circle at bottom right, rgba(244,63,94,.18), transparent 42%);
        background-attachment: fixed;
      }

      html,
      body,
      #root {
        width: 100%;
        height: 100%;
        margin: 0;
        overflow: hidden;
        overscroll-behavior: none;
        touch-action: manipulation;
        background-color: #020617;
        background-image:
          radial-gradient(circle at top left, rgba(14,165,233,.22), transparent 38%),
          radial-gradient(circle at bottom right, rgba(244,63,94,.18), transparent 42%);
        background-attachment: fixed;
      }

      body {
        width: 100vw;
        min-height: 100vh;
        min-height: 100dvh;
      }

      #root {
        width: 100vw;
        min-height: 100dvh;
      }

      main {
        width: 100vw;
        min-height: 100dvh;
        overflow: hidden;
        background: transparent !important;
      }

      main.setup-scroll {
        overflow-y: auto !important;
        overflow-x: hidden !important;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior-y: contain;
      }

      @supports (height: 100svh) {
        body,
        #root,
        main {
          min-height: 100svh;
        }
      }

      @supports (-webkit-touch-callout: none) {
        html,
        body,
        #root {
          background-color: #020617;
          background-image:
            radial-gradient(circle at top left, rgba(14,165,233,.22), transparent 38%),
            radial-gradient(circle at bottom right, rgba(244,63,94,.18), transparent 42%);
          background-attachment: fixed;
        }
      }
    `;

    document.title = "Chain Reaction";
  }, []);

  const [screen, setScreen] = useState("welcome");
  const [rows, setRows] = useState(DEFAULT_ROWS);
  const [cols, setCols] = useState(DEFAULT_COLS);
  const [playerCount, setPlayerCount] = useState(2);
  const [playerNames, setPlayerNames] = useState(() => PLAYER_PALETTE.map((_, i) => `Player ${i + 1}`));
  const [board, setBoard] = useState(() => createBoard(DEFAULT_ROWS, DEFAULT_COLS));
  const [activePlayer, setActivePlayer] = useState(0);
  const [turnsTaken, setTurnsTaken] = useState(Array(MAX_PLAYERS).fill(0));
  const [busy, setBusy] = useState(false);
  const [winner, setWinner] = useState(null);
  const [showRules, setShowRules] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [flyingOrbs, setFlyingOrbs] = useState([]);
  const [cellSize, setCellSize] = useState(48);
  const boardRef = useRef(null);
  const gameOverRef = useRef(false);

  useEffect(() => {
    if (!boardRef.current) return;

    const updateCellSize = () => {
      const firstCell = boardRef.current?.querySelector("button[aria-label^='Cell']");
      if (!firstCell) return;
      const rect = firstCell.getBoundingClientRect();
      if (rect.width > 0) setCellSize(rect.width);
    };

    updateCellSize();

    const observer = new ResizeObserver(updateCellSize);
    observer.observe(boardRef.current);
    window.addEventListener("resize", updateCellSize);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateCellSize);
    };
  }, [rows, cols, screen]);

  const players = useMemo(() => PLAYER_PALETTE.slice(0, playerCount).map((player, index) => ({ ...player, displayName: playerNames[index]?.trim() || `Player ${index + 1}` })), [playerCount, playerNames]);

  function resetMatch(nextRows = rows, nextCols = cols, nextPlayers = playerCount) {
    setRows(nextRows);
    setCols(nextCols);
    setPlayerCount(nextPlayers);
    setBoard(createBoard(nextRows, nextCols));
    setActivePlayer(0);
    setTurnsTaken(Array(MAX_PLAYERS).fill(0));
    setBusy(false);
    gameOverRef.current = false;
    setWinner(null);
    setFlyingOrbs([]);
  }

  function updatePlayerName(index, value) {
    const next = [...playerNames];
    next[index] = value;
    setPlayerNames(next);
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function changeRows(delta) { resetMatch(clamp(rows + delta, 5, 14), cols, playerCount); }
  function changeCols(delta) { resetMatch(rows, clamp(cols + delta, 4, 10), playerCount); }
  function changePlayers(delta) { resetMatch(rows, cols, clamp(playerCount + delta, 2, 8)); }
  function startGame() { resetMatch(rows, cols, playerCount); setScreen("game"); }

  function nextLivingPlayer(fromPlayer, nextBoard, nextTurns) {
    const counts = boardStats(nextBoard, playerCount).counts;
    for (let step = 1; step <= playerCount; step += 1) {
      const candidate = (fromPlayer + step) % playerCount;
      if (!(nextTurns[candidate] > 0 && counts[candidate] === 0)) return candidate;
    }
    return fromPlayer;
  }

  function getWinnerFromBoard(nextBoard, nextTurns) {
    const stats = boardStats(nextBoard, playerCount);
    const living = players.map((_, i) => i).filter((i) => nextTurns[i] === 0 || stats.counts[i] > 0);
    const playersWhoHaveAppeared = nextTurns.slice(0, playerCount).filter((t) => t > 0).length;
    return playersWhoHaveAppeared === playerCount && living.length === 1 ? living[0] : null;
  }

  async function resolveChain(startBoard, owner, nextTurns) {
    let current = cloneBoard(startBoard);
    let safety = 0;
    while (safety < 10000) {
      const earlyWinner = getWinnerFromBoard(current, nextTurns);
      if (earlyWinner !== null) {
        gameOverRef.current = true;
        setWinner(earlyWinner);
        setFlyingOrbs([]);
        return current;
      }
      safety += 1;
      const bursting = findBurstingCells(current, rows, cols);
      if (bursting.length === 0) break;
      const traveling = [];
      bursting.forEach(([r, c]) => neighborsOf(r, c, rows, cols).forEach(([nr, nc], index) => traveling.push({ id: `${safety}-${r}-${c}-${nr}-${nc}-${index}`, color: PLAYER_PALETTE[owner].hex, from: { r, c }, to: { r: nr, c: nc } })));
      setFlyingOrbs(traveling);
      await sleep(TRAVEL_MS);
      if (gameOverRef.current) return current;
      current = applyBurstStep(current, bursting, owner, rows, cols);
      setFlyingOrbs([]);
      setBoard(cloneBoard(current));
      const chainWinner = getWinnerFromBoard(current, nextTurns);
      if (chainWinner !== null) {
        gameOverRef.current = true;
        setWinner(chainWinner);
        setFlyingOrbs([]);
        return current;
      }
      await sleep(70);
      if (gameOverRef.current) return current;
    }
    return current;
  }

  async function placeOrb(r, c) {
    if (busy || winner !== null) return;
    const target = board[r][c];
    if (target.owner !== null && target.owner !== activePlayer) return;
    setBusy(true);
    gameOverRef.current = false;
    const nextTurns = [...turnsTaken];
    nextTurns[activePlayer] += 1;
    setTurnsTaken(nextTurns);
    const next = cloneBoard(board);
    next[r][c].owner = activePlayer;
    next[r][c].count += 1;
    setBoard(next);
    const resolved = await resolveChain(next, activePlayer, nextTurns);
    if (gameOverRef.current) { setBusy(false); return; }
    const finalWinner = getWinnerFromBoard(resolved, nextTurns);
    if (finalWinner !== null) {
      gameOverRef.current = true;
      setWinner(finalWinner);
      setBusy(false);
      setFlyingOrbs([]);
      return;
    }
    setActivePlayer(nextLivingPlayer(activePlayer, resolved, nextTurns));
    setBusy(false);
  }

  if (screen === "welcome") {
    return (
      <main className="setup-scroll min-h-[100dvh] overflow-y-auto overflow-x-hidden bg-slate-950 px-4 text-white sm:px-6" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)", paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)", WebkitOverflowScrolling: "touch" }}>
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,.18),transparent_42%)]" />
        <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-xl items-center justify-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="w-full text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-black/30">
              <div className="relative h-8 w-8"><span className="absolute left-1 top-3 h-3 w-3 rounded-full bg-rose-500" /><span className="absolute right-1 top-2 h-3 w-3 rounded-full bg-sky-500" /><span className="absolute bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-lime-500" /></div>
            </div>
            <h1 className="text-5xl font-black tracking-tight sm:text-6xl">Chain Reaction</h1>
            <motion.button type="button" onClick={() => setScreen("setup")} whileTap={{ scale: 0.96 }} className="mx-auto mt-8 flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-6 py-3 text-sm font-black uppercase tracking-[0.18em] text-white backdrop-blur transition hover:bg-white/15">Continue<span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-950"><Icon type="play" className="h-4 w-4" /></span></motion.button>
          </motion.div>
        </div>
      </main>
    );
  }

  if (screen === "setup") {
    return (
      <main className="setup-scroll min-h-[100dvh] overflow-y-auto overflow-x-hidden bg-slate-950 px-4 text-white sm:px-6" style={{ paddingTop: "calc(env(safe-area-inset-top) + 1rem)", paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)", WebkitOverflowScrolling: "touch" }}>
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,.18),transparent_42%)]" />
        <div className="relative mx-auto flex max-w-5xl flex-col gap-5">
          <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <Card className="text-white"><CardContent className="space-y-5 p-5">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-xl font-black"><Icon type="users" className="h-5 w-5" /> Game options</div><Button size="sm" variant="secondary" onClick={() => setShowRules(!showRules)}>Rules</Button></div>
              <div className="space-y-2 text-white/60"><div className="text-xs font-semibold uppercase tracking-widest text-white/50">Players</div><div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-2"><StepperButton label="decrease" onClick={() => changePlayers(-1)} /><div className="min-w-10 text-center text-2xl font-black text-white">{playerCount}</div><StepperButton label="increase" onClick={() => changePlayers(1)} /></div></div>
              <div className="grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => resetMatch(9, 6, playerCount)}><Icon type="phone" className="mr-2 h-4 w-4" /> Phone 9 x 6</Button><Button variant="secondary" onClick={() => resetMatch(10, 8, playerCount)}>Tablet 10 x 8</Button></div>
              <Button type="button" variant="secondary" className="w-full rounded-2xl" onClick={() => setShowAdvanced(!showAdvanced)}>{showAdvanced ? "Hide advanced" : "Advanced"}</Button>
              <AnimatePresence>{showAdvanced && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden"><div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2"><div className="space-y-2 text-white/60"><div>Rows</div><div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-2"><StepperButton label="decrease" onClick={() => changeRows(-1)} /><div className="min-w-10 text-center text-2xl font-black text-white">{rows}</div><StepperButton label="increase" onClick={() => changeRows(1)} /></div></div><div className="space-y-2 text-white/60"><div>Columns</div><div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-2"><StepperButton label="decrease" onClick={() => changeCols(-1)} /><div className="min-w-10 text-center text-2xl font-black text-white">{cols}</div><StepperButton label="increase" onClick={() => changeCols(1)} /></div></div></div></motion.div>}</AnimatePresence>
              <div className="grid grid-cols-3 gap-2 rounded-3xl border border-white/10 bg-black/20 p-3 text-center text-xs text-white/60"><div><div className="text-xl font-black text-white">{rows} x {cols}</div>Grid</div><div><div className="text-xl font-black text-white">{rows * cols}</div>Cells</div><div><div className="text-xl font-black text-white">2-4</div>Critical mass</div></div>
              <AnimatePresence>{showRules && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm leading-relaxed text-white/70">Place orbs in empty cells or cells you own. Corners explode at 2 orbs, edges at 3, and inner cells at 4. Explosions send one orb to every neighbor, claim those cells, and can trigger chain reactions. Last player with orbs wins.</motion.div>}</AnimatePresence>
              <Button className="h-12 w-full rounded-2xl text-base font-black" onClick={startGame}><Icon type="play" className="mr-2 h-5 w-5" /> Start game</Button>
            </CardContent></Card>
            <Card className="text-white"><CardContent className="space-y-4 p-5"><div className="text-xl font-black">Player names</div><div className="grid gap-3">{players.map((player, index) => <label key={index} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"><span className={`h-4 w-4 shrink-0 rounded-full ${player.bg}`} /><input className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/30" value={playerNames[index]} maxLength={18} placeholder={`Player ${index + 1}`} onChange={(e) => updatePlayerName(index, e.target.value)} /></label>)}</div></CardContent></Card>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-slate-950 px-2 text-white sm:px-4" style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)", paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,.15),transparent_40%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-4xl flex-col gap-3">
        <header className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-3 py-2 shadow-2xl backdrop-blur sm:px-4">
          <Button size="sm" variant="secondary" onClick={() => setScreen("setup")} disabled={busy}>
            <Icon type="back" className="mr-1 h-4 w-4" /> Setup
          </Button>

          <div />

          <Button size="sm" variant="secondary" onClick={() => resetMatch()} disabled={busy} aria-label="Reset game">
            <Icon type="reset" className="h-4 w-4" />
          </Button>
        </header>

        <div className="mt-2 text-center">
          <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">Turn</div>
          <div className={`text-xl font-black sm:text-2xl ${players[activePlayer].text}`}>
            {players[activePlayer].displayName}
          </div>
        </div>
        <section className="flex flex-1 items-center justify-center"><div ref={boardRef} className="relative grid w-full max-w-[min(96vw,680px)] gap-1.5 rounded-3xl border border-white/10 bg-slate-900/70 p-2 shadow-2xl backdrop-blur sm:gap-2 sm:p-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>{board.map((row, r) => row.map((cell, c) => <Cell key={`${r}-${c}`} cell={cell} row={r} col={c} rows={rows} cols={cols} activePlayer={activePlayer} disabled={busy || winner !== null} onTap={() => placeOrb(r, c)} cellSize={cellSize} />))}<AnimatePresence>{flyingOrbs.map((orb) => <FlyingOrb key={orb.id} orb={orb} rows={rows} cols={cols} cellSize={cellSize} />)}</AnimatePresence></div></section>
        <AnimatePresence>{winner !== null && <motion.div initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.95 }} className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-sm -translate-y-1/2 rounded-3xl border border-white/10 bg-slate-950/90 p-5 text-center shadow-2xl backdrop-blur"><Icon type="crown" className={`mx-auto mb-2 h-9 w-9 ${players[winner].text}`} /><div className="text-xs uppercase tracking-widest text-white/50">Winner</div><div className={`text-3xl font-black ${players[winner].text}`}>{players[winner].displayName}</div><div className="mt-4 grid grid-cols-2 gap-2"><Button variant="secondary" onClick={() => setScreen("setup")}>Setup</Button><Button onClick={() => resetMatch()}>Play again</Button></div></motion.div>}</AnimatePresence>
      </div>
    </main>
  );
}
