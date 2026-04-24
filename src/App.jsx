import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const PLAYERS = [
  { name: "Red", color: "#ff453a", soft: "rgba(255,69,58,.18)" },
  { name: "Blue", color: "#0a84ff", soft: "rgba(10,132,255,.18)" },
  { name: "Green", color: "#30d158", soft: "rgba(48,209,88,.18)" },
  { name: "Amber", color: "#ff9f0a", soft: "rgba(255,159,10,.18)" },
];

const BOARD_SIZES = {
  compact: { label: "Small", rows: 6, cols: 5 },
  classic: { label: "Medium", rows: 8, cols: 6 },
  wide: { label: "Large", rows: 9, cols: 7 },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function capacityFor(row, col, rows, cols) {
  const verticalEdge = row === 0 || row === rows - 1;
  const horizontalEdge = col === 0 || col === cols - 1;
  if (verticalEdge && horizontalEdge) return 2;
  if (verticalEdge || horizontalEdge) return 3;
  return 4;
}

function makeBoard(rows, cols) {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      count: 0,
      owner: null,
      cap: capacityFor(r, c, rows, cols),
      pulse: 0,
    }))
  );
}

function cloneBoard(board) {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function getNeighbors(row, col, rows, cols) {
  return [
    [row - 1, col],
    [row + 1, col],
    [row, col - 1],
    [row, col + 1],
  ].filter(([r, c]) => r >= 0 && c >= 0 && r < rows && c < cols);
}

function activePlayersOnBoard(board) {
  const present = new Set();
  for (const row of board) {
    for (const cell of row) {
      if (cell.owner !== null && cell.count > 0) present.add(cell.owner);
    }
  }
  return present;
}

function totalOrbs(board, player) {
  let total = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell.owner === player) total += cell.count;
    }
  }
  return total;
}

function runLogicTests() {
  const results = [];
  const test = (name, assertion) => {
    try {
      assertion();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, error: error.message });
    }
  };
  const expect = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  test("corner capacity", () => {
    expect(capacityFor(0, 0, 8, 6) === 2, "corner should be 2");
    expect(capacityFor(7, 5, 8, 6) === 2, "corner should be 2");
  });
  test("edge capacity", () => {
    expect(capacityFor(0, 2, 8, 6) === 3, "edge should be 3");
    expect(capacityFor(4, 5, 8, 6) === 3, "edge should be 3");
  });
  test("center capacity", () => {
    expect(capacityFor(3, 3, 8, 6) === 4, "center should be 4");
  });
  test("neighbor counts", () => {
    expect(getNeighbors(0, 0, 8, 6).length === 2, "corner neighbors");
    expect(getNeighbors(0, 3, 8, 6).length === 3, "edge neighbors");
    expect(getNeighbors(3, 3, 8, 6).length === 4, "center neighbors");
  });
  test("board shape", () => {
    const board = makeBoard(8, 6);
    expect(board.length === 8, "rows");
    expect(board[0].length === 6, "cols");
    expect(board[0][0].cap === 2, "corner cap");
  });
  test("orb ownership totals", () => {
    const board = makeBoard(3, 3);
    board[0][0].owner = 0;
    board[0][0].count = 2;
    board[1][1].owner = 1;
    board[1][1].count = 1;
    expect(totalOrbs(board, 0) === 2, "player 0 total");
    expect(totalOrbs(board, 1) === 1, "player 1 total");
    expect(activePlayersOnBoard(board).size === 2, "active players");
  });
  test("board presets are valid", () => {
    for (const preset of Object.values(BOARD_SIZES)) {
      expect(preset.rows >= 6, "preset rows should be playable");
      expect(preset.cols >= 5, "preset cols should be playable");
    }
  });

  return results;
}

function OrbCluster({ count, color }) {
  if (!count) return null;
  const positions = {
    1: [[50, 50]],
    2: [[40, 50], [60, 50]],
    3: [[50, 39], [39, 60], [61, 60]],
    4: [[40, 40], [60, 40], [40, 60], [60, 60]],
  }[Math.min(count, 4)];

  return (
    <div className="absolute inset-0">
      {positions.map(([x, y], i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: "27%",
            aspectRatio: "1 / 1",
            translateX: "-50%",
            translateY: "-50%",
            background: color,
            boxShadow: `0 10px 28px ${color}44, inset 0 1px 2px rgba(255,255,255,.5)`,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 360, damping: 24, delay: i * 0.015 }}
        />
      ))}
    </div>
  );
}

function IconReset({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v6h6" />
    </svg>
  );
}

function AppShell({ children }) {
  return (
    <main className="min-h-screen overflow-hidden bg-[#050507] text-[#f5f5f7] antialiased">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_-14%,rgba(80,80,92,.42),rgba(5,5,7,.2)_38%,rgba(5,5,7,1)_74%)]" />
      <section className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 pb-5 pt-4">
        {children}
      </section>
    </main>
  );
}

function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`h-12 rounded-full bg-[#f5f5f7] px-6 text-[15px] font-semibold text-[#050507] transition active:scale-95 ${className}`}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`h-11 rounded-full bg-white/[.075] px-5 text-[14px] font-semibold text-[#f5f5f7] ring-1 ring-white/[.08] transition active:scale-95 ${className}`}
    >
      {children}
    </button>
  );
}

function WelcomeScreen({ onContinue }) {
  return (
    <AppShell>
      <div className="flex flex-1 flex-col justify-between py-8">
        <div className="pt-8">
          <p className="text-[13px] font-medium tracking-tight text-[#8e8e93]">A chain reaction strategy game</p>
          <h1 className="mt-2 text-[56px] font-semibold leading-[.9] tracking-[-.075em]">Chain<br />Reactor</h1>
        </div>

        <div className="relative mx-auto grid h-64 w-64 place-items-center">
          <motion.div
            className="absolute h-56 w-56 rounded-full bg-white/[.045] ring-1 ring-white/[.08]"
            animate={{ scale: [1, 1.06, 1], opacity: [.65, 1, .65] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <motion.div
            className="absolute h-36 w-36 rounded-full bg-[#0a84ff]/20 blur-xl"
            animate={{ x: [-20, 20, -20], y: [10, -8, 10] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />
          {PLAYERS.map((player, i) => (
            <motion.span
              key={player.name}
              className="absolute h-8 w-8 rounded-full"
              style={{ background: player.color, boxShadow: `0 16px 40px ${player.color}44` }}
              animate={{ rotate: 360 }}
              transition={{ duration: 9 + i, repeat: Infinity, ease: "linear" }}
            />
          ))}
          <div className="z-10 h-20 w-20 rounded-full bg-[#f5f5f7] shadow-[0_30px_80px_rgba(0,0,0,.35)]" />
        </div>

        <div className="space-y-4 pb-4">
          <p className="max-w-[300px] text-[17px] leading-6 tracking-[-.025em] text-[#c7c7cc]">
            Place orbs. Trigger explosions. Capture the board before your opponents do.
          </p>
          <PrimaryButton onClick={onContinue} className="w-full">Continue</PrimaryButton>
        </div>
      </div>
    </AppShell>
  );
}

function SetupScreen({ playerCount, setPlayerCount, mode, setMode, onStart, onBack }) {
  return (
    <AppShell>
      <header className="mb-8 flex items-center justify-between pt-2">
        <button onClick={onBack} className="text-[14px] font-semibold text-[#8e8e93] active:scale-95">Back</button>
        <p className="text-[13px] font-medium text-[#8e8e93]">Setup</p>
        <div className="w-9" />
      </header>

      <div className="flex flex-1 flex-col">
        <div className="mb-8">
          <h1 className="text-[42px] font-semibold tracking-[-.065em]">New Game</h1>
          <p className="mt-2 text-[16px] leading-6 text-[#8e8e93]">Choose players and board size.</p>
        </div>

        <div className="space-y-5">
          <div className="rounded-[2rem] bg-white/[.075] p-4 ring-1 ring-white/[.09] backdrop-blur-2xl">
            <p className="mb-3 text-[13px] font-semibold text-[#8e8e93]">Players</p>
            <div className="grid grid-cols-3 gap-2">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setPlayerCount(n)}
                  className={`h-12 rounded-full text-[15px] font-semibold transition active:scale-95 ${
                    playerCount === n ? "bg-[#f5f5f7] text-[#050507]" : "bg-white/[.065] text-[#8e8e93] ring-1 ring-white/[.08]"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] bg-white/[.075] p-4 ring-1 ring-white/[.09] backdrop-blur-2xl">
            <p className="mb-3 text-[13px] font-semibold text-[#8e8e93]">Board</p>
            <div className="space-y-2">
              {Object.entries(BOARD_SIZES).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setMode(key)}
                  className={`flex h-13 w-full items-center justify-between rounded-[1.35rem] px-4 py-3 text-left transition active:scale-[.99] ${
                    mode === key ? "bg-[#f5f5f7] text-[#050507]" : "bg-white/[.065] text-[#f5f5f7] ring-1 ring-white/[.08]"
                  }`}
                >
                  <span className="text-[15px] font-semibold">{value.label}</span>
                  <span className={mode === key ? "text-[13px] text-[#3a3a3c]" : "text-[13px] text-[#8e8e93]"}>
                    {value.rows} × {value.cols}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {PLAYERS.slice(0, playerCount).map((player) => (
              <div key={player.name} className="rounded-[1.35rem] bg-white/[.06] px-2 py-3 text-center ring-1 ring-white/[.08]">
                <div className="mx-auto mb-2 h-3 w-3 rounded-full" style={{ background: player.color }} />
                <p className="text-[11px] font-semibold text-[#c7c7cc]">{player.name}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto space-y-3 pb-4 pt-8">
          <PrimaryButton onClick={onStart} className="w-full">Start Game</PrimaryButton>
          <p className="text-center text-[11px] text-[#8e8e93]">Own or empty cells only. Critical mass explodes.</p>
        </div>
      </div>
    </AppShell>
  );
}

export default function ChainReactionGame() {
  const [screen, setScreen] = useState("welcome");
  const [mode, setMode] = useState("classic");
  const [playerCount, setPlayerCount] = useState(2);
  const [{ rows, cols }, setSize] = useState(BOARD_SIZES.classic);
  const [board, setBoard] = useState(() => makeBoard(BOARD_SIZES.classic.rows, BOARD_SIZES.classic.cols));
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [started, setStarted] = useState(false);
  const [alive, setAlive] = useState([0, 1]);
  const [winner, setWinner] = useState(null);
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState(0);
  const [message, setMessage] = useState("Tap any empty cell.");
  const [showTests, setShowTests] = useState(false);
  const [testResults] = useState(() => runLogicTests());
  const boardRef = useRef(board);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  const players = useMemo(() => PLAYERS.slice(0, playerCount), [playerCount]);
  const current = players[currentPlayer] || players[0];
  const testsPassed = testResults.every((result) => result.passed);

  function reset(newMode = mode, newCount = playerCount, nextScreen = "game") {
    const safeCount = Math.min(Math.max(newCount, 2), PLAYERS.length);
    const size = BOARD_SIZES[newMode] || BOARD_SIZES.classic;
    const fresh = makeBoard(size.rows, size.cols);
    setMode(newMode);
    setPlayerCount(safeCount);
    setSize(size);
    setBoard(fresh);
    boardRef.current = fresh;
    setCurrentPlayer(0);
    setStarted(false);
    setAlive(Array.from({ length: safeCount }, (_, i) => i));
    setWinner(null);
    setBusy(false);
    setTurns(0);
    setMessage("Tap any empty cell.");
    setScreen(nextScreen);
  }

  function startGame() {
    reset(mode, playerCount, "game");
  }

  function nextAlivePlayer(from, aliveList, playerTotal = playerCount) {
    for (let step = 1; step <= playerTotal; step += 1) {
      const next = (from + step) % playerTotal;
      if (aliveList.includes(next)) return next;
    }
    return from;
  }

  async function resolveReactions(startBoard, player, canEndGame = false) {
    let working = cloneBoard(startBoard);
    let guard = 0;

    while (guard < 1000) {
      guard += 1;
      const exploding = [];
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          if (working[r][c].count >= working[r][c].cap) exploding.push([r, c]);
        }
      }

      if (!exploding.length) break;
      setMessage("Chain reaction");

      for (const [r, c] of exploding) {
        working[r][c] = { ...working[r][c], pulse: working[r][c].pulse + 1 };
      }
      setBoard(cloneBoard(working));
      await sleep(115);

      for (const [r, c] of exploding) {
        if (working[r][c].count < working[r][c].cap) continue;
        working[r][c].count -= working[r][c].cap;
        if (working[r][c].count <= 0) {
          working[r][c].count = 0;
          working[r][c].owner = null;
        }
        for (const [nr, nc] of getNeighbors(r, c, rows, cols)) {
          working[nr][nc].count += 1;
          working[nr][nc].owner = player;
          working[nr][nc].pulse += 1;
        }
      }

      setBoard(cloneBoard(working));

      if (canEndGame) {
        const present = activePlayersOnBoard(working);
        if (present.size <= 1) {
          break;
        }
      }

      await sleep(145);
    }

    return working;
  }

  async function play(row, col) {
    if (busy || winner !== null) return;
    const cell = boardRef.current[row][col];
    if (cell.owner !== null && cell.owner !== currentPlayer) {
      setMessage("Pick your own cell or an empty one.");
      return;
    }

    setBusy(true);
    setStarted(true);
    

    const nextBoard = cloneBoard(boardRef.current);
    nextBoard[row][col].count += 1;
    nextBoard[row][col].owner = currentPlayer;
    nextBoard[row][col].pulse += 1;
    setBoard(nextBoard);
    await sleep(90);

    const settled = await resolveReactions(nextBoard, currentPlayer, turns + 1 >= players.length);
    boardRef.current = settled;
    setBoard(settled);

    const newTurns = turns + 1;
    setTurns(newTurns);

    let newAlive = Array.from({ length: players.length }, (_, i) => i);
    if (newTurns >= players.length) {
      const present = activePlayersOnBoard(settled);
      newAlive = newAlive.filter((p) => present.has(p));
    }
    setAlive(newAlive);

    const present = activePlayersOnBoard(settled);
    if ((started || newTurns >= players.length) && present.size === 1 && newTurns >= players.length) {
      const only = [...present][0];
      setWinner(only);
      setMessage(`${players[only].name} wins`);
      setBusy(false);
      return;
    }

    const next = nextAlivePlayer(currentPlayer, newAlive, players.length);
    setCurrentPlayer(next);
    setMessage(`${players[next].name}'s turn`);
    setBusy(false);
  }

  if (screen === "welcome") {
    return <WelcomeScreen onContinue={() => setScreen("setup")} />;
  }

  if (screen === "setup") {
    return (
      <SetupScreen
        playerCount={playerCount}
        setPlayerCount={setPlayerCount}
        mode={mode}
        setMode={setMode}
        onStart={startGame}
        onBack={() => setScreen("welcome")}
      />
    );
  }

  return (
    <AppShell>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-[12px] font-medium tracking-tight text-[#8e8e93]">Chain Reactor</p>
          <h1 className="text-[34px] font-semibold tracking-[-.055em] text-[#f5f5f7]">Game</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setScreen("setup")}
            className="h-10 rounded-full bg-white/[.09] px-4 text-[13px] font-semibold text-[#f5f5f7] ring-1 ring-white/[.10] backdrop-blur-xl active:scale-95"
          >
            Setup
          </button>
          <button
            onClick={() => reset()}
            className="grid h-10 w-10 place-items-center rounded-full bg-white/[.09] text-[#f5f5f7] shadow-[0_18px_50px_rgba(0,0,0,.35)] ring-1 ring-white/[.10] backdrop-blur-xl active:scale-95"
            aria-label="Reset game"
          >
            <IconReset className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="mb-4 rounded-[2rem] bg-white/[.075] p-3 shadow-[0_22px_70px_rgba(0,0,0,.42)] ring-1 ring-white/[.10] backdrop-blur-2xl">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: current.color }} />
              <p className="truncate text-[17px] font-semibold tracking-[-.025em]">
                {winner === null ? current.name : `${players[winner].name} wins`}
              </p>
            </div>
            <p className="mt-0.5 truncate text-[13px] text-[#8e8e93]">{message}</p>
          </div>
          <div className="rounded-full bg-white/[.08] px-3 py-1.5 text-[12px] font-semibold text-[#c7c7cc]">
            {alive.length}/{players.length}
          </div>
        </div>
      </div>

      <div className="mb-4 flex justify-center gap-2">
        {players.map((p, i) => (
          <div
            key={p.name}
            className={`flex items-center gap-2 rounded-full bg-white/[.065] px-3 py-2 ring-1 ring-white/[.08] transition ${
              alive.includes(i) ? "opacity-100" : "opacity-35 grayscale"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
            <span className="text-[12px] font-semibold text-[#c7c7cc]">{p.name}</span>
          </div>
        ))}
      </div>

      <div className="relative flex flex-1 items-center justify-center pb-3">
        <div
          className="grid w-full touch-manipulation select-none gap-[7px] rounded-[2.2rem] bg-white/[.075] p-[10px] shadow-[0_28px_90px_rgba(0,0,0,.48)] ring-1 ring-white/[.10] backdrop-blur-2xl"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => {
              const owner = cell.owner !== null ? players[cell.owner] : null;
              const nearCritical = cell.count === cell.cap - 1 && cell.count > 0;
              return (
                <motion.button
                  key={`${r}-${c}`}
                  onClick={() => play(r, c)}
                  disabled={busy || winner !== null}
                  aria-label={`Row ${r + 1}, column ${c + 1}, ${cell.count} of ${cell.cap} orbs`}
                  className="relative overflow-hidden rounded-[1.05rem] bg-[#111114] ring-1 ring-white/[.075] transition disabled:opacity-90 active:scale-[.96]"
                  style={{
                    aspectRatio: "1 / 1",
                    background: owner ? `linear-gradient(180deg, rgba(255,255,255,.09), ${owner.soft})` : "#111114",
                  }}
                  animate={nearCritical ? { y: [0, -1, 0], scale: [1, 1.015, 1] } : { y: 0, scale: 1 }}
                  transition={nearCritical ? { repeat: Infinity, duration: 1.2 } : { duration: 0.18 }}
                >
                  {owner && (
                    <motion.span
                      key={cell.pulse}
                      className="absolute inset-0 rounded-[1.05rem]"
                      initial={{ opacity: 0.24, scale: 0.5 }}
                      animate={{ opacity: 0, scale: 1.22 }}
                      transition={{ duration: 0.42 }}
                      style={{ background: owner.color }}
                    />
                  )}
                  <OrbCluster count={cell.count} color={owner?.color} />
                </motion.button>
              );
            })
          )}
        </div>

        <AnimatePresence>
          {winner !== null && (
            <motion.div
              className="absolute inset-x-5 top-1/2 rounded-[2.2rem] bg-[#1c1c1e]/90 p-6 text-center shadow-[0_30px_90px_rgba(0,0,0,.55)] ring-1 ring-white/[.10] backdrop-blur-2xl"
              initial={{ opacity: 0, scale: 0.96, y: "-43%" }}
              animate={{ opacity: 1, scale: 1, y: "-50%" }}
              exit={{ opacity: 0, scale: 0.96 }}
            >
              <div className="mx-auto mb-4 h-14 w-14 rounded-full" style={{ background: players[winner].color }} />
              <h2 className="text-[30px] font-semibold tracking-[-.05em]">{players[winner].name} wins</h2>
              <p className="mt-1 text-[14px] text-[#8e8e93]">Board captured.</p>
              <button
                onClick={() => reset()}
                className="mt-5 h-11 rounded-full bg-[#f5f5f7] px-6 text-[15px] font-semibold text-[#050507] active:scale-95"
              >
                New Game
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="text-center">
        <p className="text-[11px] text-[#8e8e93]">Own or empty cells only. Critical mass explodes.</p>
        <button
          onClick={() => setShowTests((value) => !value)}
          className="mt-2 rounded-full px-3 py-1 text-[10px] font-semibold text-[#8e8e93]"
        >
          Tests {testResults.filter((result) => result.passed).length}/{testResults.length} {testsPassed ? "passed" : "failed"}
        </button>
        {showTests && (
          <div className="mt-2 rounded-3xl bg-white/[.07] p-3 text-left text-[10px] text-[#c7c7cc] ring-1 ring-white/[.08]">
            {testResults.map((result) => (
              <div key={result.name} className="flex justify-between gap-3 py-0.5">
                <span>{result.name}</span>
                <span>{result.passed ? "pass" : result.error}</span>
              </div>
            ))}
          </div>
        )}
      </footer>
    </AppShell>
  );
}
