import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Crown, Play, RotateCcw, Smartphone, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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

function createBoard(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ owner: null, count: 0 }))
  );
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

  board.forEach((row) => {
    row.forEach((cell) => {
      if (cell.owner !== null && cell.count > 0) {
        counts[cell.owner] += cell.count;
        occupied += 1;
      }
    });
  });

  return { counts, occupied };
}

function assertGameRule(condition, message) {
  if (!condition) throw new Error(`Orb Reactor self-test failed: ${message}`);
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

function runSelfTests() {
  const board = createBoard(3, 3);
  board[0][0] = { owner: 0, count: 2 };
  board[1][1] = { owner: 1, count: 3 };

  assertGameRule(criticalMass(0, 0, 3, 3) === 2, "corner critical mass should be 2");
  assertGameRule(criticalMass(0, 1, 3, 3) === 3, "edge critical mass should be 3");
  assertGameRule(criticalMass(1, 1, 3, 3) === 4, "middle critical mass should be 4");
  assertGameRule(neighborsOf(1, 1, 3, 3).length === 4, "middle cell should have 4 neighbors");
  assertGameRule(neighborsOf(0, 0, 3, 3).length === 2, "corner cell should have 2 neighbors");

  const stats = boardStats(board, 2);
  assertGameRule(stats.counts[0] === 2, "player 1 orb count should be tracked");
  assertGameRule(stats.counts[1] === 3, "player 2 orb count should be tracked");
  assertGameRule(stats.occupied === 2, "occupied cells should be tracked");

  const burstBoard = createBoard(3, 3);
  burstBoard[0][0] = { owner: 0, count: 2 };
  const afterBurst = applyBurstStep(burstBoard, [[0, 0]], 0, 3, 3);
  assertGameRule(afterBurst[0][0].owner === null && afterBurst[0][0].count === 0, "burst source should empty");
  assertGameRule(afterBurst[0][1].owner === 0 && afterBurst[0][1].count === 1, "burst should send orb right");
  assertGameRule(afterBurst[1][0].owner === 0 && afterBurst[1][0].count === 1, "burst should send orb down");

  const smallBoard = createBoard(2, 2);
  assertGameRule(criticalMass(1, 1, 2, 2) === 2, "2x2 grid cells should all be corners");
}

if (typeof window !== "undefined" && !window.__ORB_REACTOR_TESTED__) {
  window.__ORB_REACTOR_TESTED__ = true;
  runSelfTests();
}

function OrbCluster({ color, total, instability }) {
  const groupSize = Math.min(total, 3);
  const spinDuration = instability > 0.85 ? 1.6 : instability > 0.45 ? 2.2 : 3.2;
  const radius = groupSize === 1 ? 0 : groupSize === 2 ? 6 : 8;
  const orbSize = groupSize === 1 ? 14 : 11;
  const isUnstable = instability > 0.6;
  const isCritical = instability > 0.85;

  const points = Array.from({ length: groupSize }).map((_, index) => {
    const angle =
      groupSize === 1
        ? 0
        : groupSize === 2
          ? index * Math.PI
          : index * ((Math.PI * 2) / 3) - Math.PI / 2;

    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    };
  });

  return (
    <motion.span
      className="absolute left-1/2 top-1/2 h-0 w-0"
      animate={{ rotate: 360 }}
      transition={{ duration: spinDuration, repeat: Infinity, ease: "linear" }}
      style={{ transformOrigin: "0 0" }}
    >
      {points.map((point, index) => (
        <motion.span
          key={index}
          className="absolute rounded-full"
          style={{
            width: orbSize,
            height: orbSize,
            left: point.x,
            top: point.y,
            marginLeft: -orbSize / 2,
            marginTop: -orbSize / 2,
            background: color,
          }}
          initial={{ scale: 1, x: 0, y: 0 }}
          animate={{
            scale: isCritical ? [1, 1.08, 0.96, 1.05, 1] : isUnstable ? [1, 1.04, 0.98, 1] : 1,
            x: isCritical ? [0, -1.5, 1.5, -1, 0] : isUnstable ? [0, -0.8, 0.8, 0] : 0,
            y: isCritical ? [0, 1.5, -1.5, 1, 0] : isUnstable ? [0, 0.8, -0.8, 0] : 0,
          }}
          transition={{
            duration: isCritical ? 0.4 : isUnstable ? 0.7 : 1.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: index * 0.05,
          }}
        />
      ))}
    </motion.span>
  );
}

function Cell({ cell, row, col, rows, cols, activePlayer, onTap, disabled }) {
  const owner = cell.owner !== null ? PLAYER_PALETTE[cell.owner] : null;
  const mass = criticalMass(row, col, rows, cols);
  const isPlayable = !disabled && (cell.owner === null || cell.owner === activePlayer);
  const instability = cell.count > 0 ? Math.min(1, cell.count / Math.max(1, mass - 1)) : 0;

  return (
    <motion.button
      type="button"
      aria-label={`Cell ${row + 1}, ${col + 1}`}
      onClick={onTap}
      disabled={!isPlayable}
      whileTap={isPlayable ? { scale: 0.97 } : undefined}
      className={`relative aspect-square rounded-xl border border-white/10 bg-slate-950/70 shadow-inner transition ${
        isPlayable ? "hover:border-white/25 active:scale-95" : "cursor-not-allowed opacity-50"
      }`}
    >
      <span className="absolute inset-1 rounded-lg border border-white/5" />
      <AnimatePresence>
        {owner && cell.count > 0 && (
          <OrbCluster
            key={`${row}-${col}-${cell.owner}-${cell.count}`}
            color={owner.hex}
            total={cell.count}
            instability={instability}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function FlyingOrb({ orb, rows, cols }) {
  const fromLeft = `${((orb.from.c + 0.5) / cols) * 100}%`;
  const fromTop = `${((orb.from.r + 0.5) / rows) * 100}%`;
  const toLeft = `${((orb.to.c + 0.5) / cols) * 100}%`;
  const toTop = `${((orb.to.r + 0.5) / rows) * 100}%`;

  return (
    <motion.span
      className="pointer-events-none absolute z-20 h-3 w-3 rounded-full sm:h-3.5 sm:w-3.5"
      style={{ background: orb.color, left: fromLeft, top: fromTop, marginLeft: -6, marginTop: -6 }}
      initial={{ left: fromLeft, top: fromTop, opacity: 1 }}
      animate={{ left: toLeft, top: toTop, opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: TRAVEL_MS / 1000, ease: "easeInOut" }}
    />
  );
}

function StepperButton({ label, onClick }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="h-11 w-11 rounded-xl p-0 text-2xl font-black leading-none"
      onClick={onClick}
      aria-label={label}
    >
      {label === "decrease" ? "−" : "+"}
    </Button>
  );
}

export default function ChainReactorModern() {
  // set favicon + iOS icon dynamically
  React.useEffect(() => {
    const svgIcon = `data:image/svg+xml,
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
        <rect width='64' height='64' rx='14' fill='#0f172a'/>
        <circle cx='20' cy='34' r='6' fill='#f43f5e'/>
        <circle cx='44' cy='26' r='6' fill='#0ea5e9'/>
        <circle cx='32' cy='46' r='6' fill='#84cc16'/>
      </svg>`;

    const link = document.querySelector("link[rel='icon']") || document.createElement("link");
    link.rel = "icon";
    link.href = svgIcon;
    document.head.appendChild(link);

    const apple = document.querySelector("link[rel='apple-touch-icon']") || document.createElement("link");
    apple.rel = "apple-touch-icon";
    apple.href = svgIcon;
    document.head.appendChild(apple);

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

  const players = useMemo(
    () =>
      PLAYER_PALETTE.slice(0, playerCount).map((player, index) => ({
        ...player,
        displayName: playerNames[index]?.trim() || `Player ${index + 1}`,
      })),
    [playerCount, playerNames]
  );

  function resetMatch(nextRows = rows, nextCols = cols, nextPlayers = playerCount) {
    setRows(nextRows);
    setCols(nextCols);
    setPlayerCount(nextPlayers);
    setBoard(createBoard(nextRows, nextCols));
    setActivePlayer(0);
    setTurnsTaken(Array(MAX_PLAYERS).fill(0));
    setBusy(false);
    setWinner(null);
    setFlyingOrbs([]);
  }

  function updatePlayerCount(count) {
    resetMatch(rows, cols, Number(count));
  }

  function updatePlayerName(index, value) {
    const next = [...playerNames];
    next[index] = value;
    setPlayerNames(next);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function changeRows(delta) {
    resetMatch(clamp(rows + delta, 5, 14), cols, playerCount);
  }

  function changeCols(delta) {
    resetMatch(rows, clamp(cols + delta, 4, 10), playerCount);
  }

  function changePlayers(delta) {
    resetMatch(rows, cols, clamp(playerCount + delta, 2, 8));
  }

  function startGame() {
    resetMatch(rows, cols, playerCount);
    setScreen("game");
  }

  if (screen === "welcome") {
    return (
      <main className="min-h-screen overflow-hidden bg-slate-950 px-4 py-5 text-white sm:px-6">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,.18),transparent_42%)]" />
        <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-xl items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full text-center"
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-black/30">
              <div className="relative h-8 w-8">
                <span className="absolute left-1 top-3 h-3 w-3 rounded-full bg-rose-500" />
                <span className="absolute right-1 top-2 h-3 w-3 rounded-full bg-sky-500" />
                <span className="absolute bottom-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-lime-500" />
              </div>
            </div>
            <h1 className="text-5xl font-black tracking-tight sm:text-6xl">Chain Reaction</h1>
            <Button className="mt-7 h-12 w-full rounded-2xl text-base font-black" onClick={() => setScreen("setup")}>
              <Play className="mr-2 h-5 w-5" /> Continue
            </Button>
          </motion.div>
        </div>
      </main>
    );
  }

  function nextLivingPlayer(fromPlayer, nextBoard, nextTurns) {
    const counts = boardStats(nextBoard, playerCount).counts;

    for (let step = 1; step <= playerCount; step += 1) {
      const candidate = (fromPlayer + step) % playerCount;
      if (!(nextTurns[candidate] > 0 && counts[candidate] === 0)) return candidate;
    }

    return fromPlayer;
  }

  async function resolveChain(startBoard, owner) {
    let current = cloneBoard(startBoard);
    let safety = 0;

    while (safety < 10000) {
      safety += 1;
      const bursting = [];

      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          if (current[r][c].count >= criticalMass(r, c, rows, cols)) bursting.push([r, c]);
        }
      }

      if (bursting.length === 0) break;

      const traveling = [];
      bursting.forEach(([r, c]) => {
        neighborsOf(r, c, rows, cols).forEach(([nr, nc], index) => {
          traveling.push({
            id: `${safety}-${r}-${c}-${nr}-${nc}-${index}`,
            color: PLAYER_PALETTE[owner].hex,
            from: { r, c },
            to: { r: nr, c: nc },
          });
        });
      });

      setFlyingOrbs(traveling);
      await sleep(TRAVEL_MS);

      current = applyBurstStep(current, bursting, owner, rows, cols);
      setFlyingOrbs([]);
      setBoard(cloneBoard(current));
      await sleep(70);
    }

    return current;
  }

  async function placeOrb(r, c) {
    if (busy || winner !== null) return;

    const target = board[r][c];
    if (target.owner !== null && target.owner !== activePlayer) return;

    setBusy(true);

    const nextTurns = [...turnsTaken];
    nextTurns[activePlayer] += 1;
    setTurnsTaken(nextTurns);

    const next = cloneBoard(board);
    next[r][c].owner = activePlayer;
    next[r][c].count += 1;
    setBoard(next);

    const resolved = await resolveChain(next, activePlayer);
    const finalStats = boardStats(resolved, playerCount);
    const living = players.map((_, i) => i).filter((i) => nextTurns[i] === 0 || finalStats.counts[i] > 0);
    const playersWhoHaveAppeared = nextTurns.slice(0, playerCount).filter((t) => t > 0).length;

    if (playersWhoHaveAppeared === playerCount && living.length === 1) {
      setWinner(living[0]);
      setBusy(false);
      return;
    }

    setActivePlayer(nextLivingPlayer(activePlayer, resolved, nextTurns));
    setBusy(false);
  }

  if (screen === "setup") {
    return (
      <main className="min-h-screen overflow-hidden bg-slate-950 px-4 py-5 text-white sm:px-6">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,.18),transparent_42%)]" />
        <div className="relative mx-auto flex max-w-5xl flex-col gap-5">
          <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <Card className="border-white/10 bg-white/5 text-white shadow-2xl backdrop-blur">
              <CardContent className="space-y-5 p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xl font-black">
                    <Users className="h-5 w-5" /> Game options
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => setShowRules(!showRules)}>
                    Rules
                  </Button>
                </div>

                <div className="space-y-2 text-white/60">
                  <div className="text-xs font-semibold uppercase tracking-widest text-white/50">Players</div>
                  <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-2">
                    <StepperButton label="decrease" onClick={() => changePlayers(-1)} />
                    <div className="min-w-10 text-center text-2xl font-black text-white">{playerCount}</div>
                    <StepperButton label="increase" onClick={() => changePlayers(1)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => resetMatch(9, 6, playerCount)}>
                    <Smartphone className="mr-2 h-4 w-4" /> Phone 9 x 6
                  </Button>
                  <Button variant="secondary" onClick={() => resetMatch(10, 8, playerCount)}>
                    Tablet 10 x 8
                  </Button>
                </div>

                <Button type="button" variant="secondary" className="w-full rounded-2xl" onClick={() => setShowAdvanced(!showAdvanced)}>
                  {showAdvanced ? "Hide advanced" : "Advanced"}
                </Button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                        <div className="space-y-2 text-white/60">
                          <div>Rows</div>
                          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-2">
                            <StepperButton label="decrease" onClick={() => changeRows(-1)} />
                            <div className="min-w-10 text-center text-2xl font-black text-white">{rows}</div>
                            <StepperButton label="increase" onClick={() => changeRows(1)} />
                          </div>
                        </div>
                        <div className="space-y-2 text-white/60">
                          <div>Columns</div>
                          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 p-2">
                            <StepperButton label="decrease" onClick={() => changeCols(-1)} />
                            <div className="min-w-10 text-center text-2xl font-black text-white">{cols}</div>
                            <StepperButton label="increase" onClick={() => changeCols(1)} />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-3 gap-2 rounded-3xl border border-white/10 bg-black/20 p-3 text-center text-xs text-white/60">
                  <div>
                    <div className="text-xl font-black text-white">{rows} x {cols}</div>
                    Grid
                  </div>
                  <div>
                    <div className="text-xl font-black text-white">{rows * cols}</div>
                    Cells
                  </div>
                  <div>
                    <div className="text-xl font-black text-white">2-4</div>
                    Critical mass
                  </div>
                </div>

                <AnimatePresence>
                  {showRules && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm leading-relaxed text-white/70"
                    >
                      Place orbs in empty cells or cells you own. Corners explode at 2 orbs, edges at 3, and inner cells at 4. Explosions send one orb to every neighbor, claim those cells, and can trigger chain reactions. Last player with orbs wins.
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button className="h-12 w-full rounded-2xl text-base font-black" onClick={startGame}>
                  <Play className="mr-2 h-5 w-5" /> Start game
                </Button>
              </CardContent>
            </Card>

            <Card className="border-white/10 bg-white/5 text-white shadow-2xl backdrop-blur">
              <CardContent className="space-y-4 p-5">
                <div className="text-xl font-black">Player names</div>
                <div className="grid gap-3">
                  {players.map((player, index) => (
                    <label key={index} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                      <span className={`h-4 w-4 shrink-0 rounded-full ${player.bg}`} />
                      <input
                        className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none placeholder:text-white/30"
                        value={playerNames[index]}
                        maxLength={18}
                        placeholder={`Player ${index + 1}`}
                        onChange={(e) => updatePlayerName(index, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 px-2 py-3 text-white sm:px-4">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(244,63,94,.15),transparent_40%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-4xl flex-col gap-3">
        <header className="flex items-center justify-between rounded-3xl border border-white/10 bg-white/5 px-3 py-2 shadow-2xl backdrop-blur sm:px-4">
          <Button size="sm" variant="secondary" onClick={() => setScreen("setup")} disabled={busy}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Setup
          </Button>
          <div className="text-center">
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/40">Turn</div>
            <div className={`text-lg font-black sm:text-2xl ${players[activePlayer].text}`}>{players[activePlayer].displayName}</div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => resetMatch()} disabled={busy}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </header>

        <section className="flex flex-1 items-center justify-center">
          <div
            className="relative grid w-full max-w-[min(96vw,680px)] gap-1.5 rounded-3xl border border-white/10 bg-slate-900/70 p-2 shadow-2xl backdrop-blur sm:gap-2 sm:p-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {board.map((row, r) =>
              row.map((cell, c) => (
                <Cell
                  key={`${r}-${c}`}
                  cell={cell}
                  row={r}
                  col={c}
                  rows={rows}
                  cols={cols}
                  activePlayer={activePlayer}
                  disabled={busy || winner !== null}
                  onTap={() => placeOrb(r, c)}
                />
              ))
            )}
            <AnimatePresence>
              {flyingOrbs.map((orb) => (
                <FlyingOrb key={orb.id} orb={orb} rows={rows} cols={cols} />
              ))}
            </AnimatePresence>
          </div>
        </section>

        <AnimatePresence>
          {winner !== null && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/10 bg-slate-950/90 p-5 text-center shadow-2xl backdrop-blur"
            >
              <Crown className={`mx-auto mb-2 h-9 w-9 ${players[winner].text}`} />
              <div className="text-xs uppercase tracking-widest text-white/50">Winner</div>
              <div className={`text-3xl font-black ${players[winner].text}`}>{players[winner].displayName}</div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setScreen("setup")}>Setup</Button>
                <Button onClick={() => resetMatch()}>Play again</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
