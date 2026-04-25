import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const PLAYERS = [
  { name: "Red", color: "#ff4d6d" },
  { name: "Blue", color: "#3a86ff" },
  { name: "Green", color: "#06d6a0" },
  { name: "Yellow", color: "#ffd166" },
];

const BOARD_SIZES = {
  compact: { label: "Small", rows: 6, cols: 5 },
  classic: { label: "Medium", rows: 8, cols: 6 },
  wide: { label: "Large", rows: 9, cols: 7 },
};

function capacityFor(r, c, rows, cols) {
  const verticalEdge = r === 0 || r === rows - 1;
  const horizontalEdge = c === 0 || c === cols - 1;
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
    }))
  );
}

function cloneBoard(board) {
  return board.map((row) => row.map((cell) => ({ ...cell })));
}

function getNeighbors(r, c, rows, cols) {
  return [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ].filter(([rr, cc]) => rr >= 0 && cc >= 0 && rr < rows && cc < cols);
}

function activePlayersOnBoard(board) {
  const active = new Set();
  for (const row of board) {
    for (const cell of row) {
      if (cell.owner !== null && cell.count > 0) active.add(cell.owner);
    }
  }
  return active;
}

function resolveBoardAfterMove(startBoard, player, rows, cols) {
  const board = cloneBoard(startBoard);
  let guard = 0;

  while (guard < 1000) {
    guard += 1;
    const exploding = [];

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        if (board[r][c].count >= board[r][c].cap) exploding.push([r, c]);
      }
    }

    if (exploding.length === 0) break;

    for (const [r, c] of exploding) {
      if (board[r][c].count < board[r][c].cap) continue;
      const neighbors = getNeighbors(r, c, rows, cols);
      board[r][c].count -= board[r][c].cap;

      if (board[r][c].count <= 0) {
        board[r][c].count = 0;
        board[r][c].owner = null;
      }

      for (const [nr, nc] of neighbors) {
        board[nr][nc].count += 1;
        board[nr][nc].owner = player;
      }
    }
  }

  return board;
}

function runLogicTests() {
  const results = [];
  const test = (name, fn) => {
    try {
      fn();
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, error: error.message });
    }
  };
  const expect = (condition, message) => {
    if (!condition) throw new Error(message);
  };

  test("corner cells have capacity 2", () => {
    expect(capacityFor(0, 0, 8, 6) === 2, "top-left corner should be 2");
    expect(capacityFor(7, 5, 8, 6) === 2, "bottom-right corner should be 2");
  });

  test("edge cells have capacity 3", () => {
    expect(capacityFor(0, 2, 8, 6) === 3, "top edge should be 3");
    expect(capacityFor(4, 5, 8, 6) === 3, "right edge should be 3");
  });

  test("center cells have capacity 4", () => {
    expect(capacityFor(3, 3, 8, 6) === 4, "center should be 4");
  });

  test("board has correct dimensions", () => {
    const board = makeBoard(8, 6);
    expect(board.length === 8, "board should have 8 rows");
    expect(board[0].length === 6, "board should have 6 columns");
  });

  test("cloneBoard creates an independent copy", () => {
    const original = makeBoard(3, 3);
    const copy = cloneBoard(original);
    copy[0][0].count = 1;
    expect(original[0][0].count === 0, "original board should not mutate");
  });

  test("corner has two neighbors", () => {
    expect(getNeighbors(0, 0, 8, 6).length === 2, "corner should have 2 neighbors");
  });

  test("edge has three neighbors", () => {
    expect(getNeighbors(0, 2, 8, 6).length === 3, "edge should have 3 neighbors");
  });

  test("center has four neighbors", () => {
    expect(getNeighbors(3, 3, 8, 6).length === 4, "center should have 4 neighbors");
  });

  test("corner explosion splits into adjacent cells", () => {
    const board = makeBoard(3, 3);
    board[0][0].count = 2;
    board[0][0].owner = 0;
    const resolved = resolveBoardAfterMove(board, 0, 3, 3);
    expect(resolved[0][0].count === 0, "source corner should clear");
    expect(resolved[0][1].count === 1, "right neighbor should receive orb");
    expect(resolved[1][0].count === 1, "bottom neighbor should receive orb");
    expect(resolved[0][1].owner === 0, "neighbor should convert owner");
  });

  test("explosion converts opponent cells", () => {
    const board = makeBoard(3, 3);
    board[0][0].count = 2;
    board[0][0].owner = 0;
    board[0][1].count = 1;
    board[0][1].owner = 1;
    const resolved = resolveBoardAfterMove(board, 0, 3, 3);
    expect(resolved[0][1].owner === 0, "opponent neighbor should convert");
  });

  test("fresh board starts empty", () => {
    const fresh = makeBoard(4, 4);
    expect(fresh[0][0].count === 0, "fresh board should be empty");
    expect(fresh[0][0].owner === null, "fresh board should have no owner");
  });

  test("activePlayersOnBoard returns players with pieces", () => {
    const board = makeBoard(3, 3);
    board[1][1].count = 1;
    board[1][1].owner = 2;
    const active = activePlayersOnBoard(board);
    expect(active.has(2), "player 2 should be active");
    expect(active.size === 1, "only one player should be active");
  });

  test("chain reaction resolves without leaving critical cells", () => {
    const board = makeBoard(3, 3);
    board[0][0].count = 2;
    board[0][0].owner = 0;
    board[0][1].count = 2;
    board[0][1].owner = 1;
    const resolved = resolveBoardAfterMove(board, 0, 3, 3);
    const hasCritical = resolved.some((row) => row.some((cell) => cell.count >= cell.cap));
    expect(!hasCritical, "resolved board should not contain critical cells");
  });

  return results;
}

function getSystemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useResolvedTheme(themeMode) {
  const [systemTheme, setSystemTheme] = useState(() => getSystemTheme());

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemTheme(media.matches ? "dark" : "light");
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return themeMode === "system" ? systemTheme : themeMode;
}

function Orb({ count, color, cap }) {
  const offsets = useMemo(
    () =>
      Array.from({ length: Math.max(1, Math.min(count || 1, 4)) }, () => ({
        x: (Math.random() - 0.5) * 6,
        y: (Math.random() - 0.5) * 6,
      })),
    [count, color]
  );

  if (!count || !color) return null;

  const progress = Math.min(count / Math.max(cap - 1, 1), 1);
  const pulseScale = 1 + progress * 0.28;
  const bounce = 1 + progress * 4;
  const duration = Math.max(0.55, 1.55 - progress * 0.75);
  const glow = progress > 0.85 ? "dd" : progress > 0.55 ? "bb" : "88";
  const positionsByCount = {
    1: [[50, 50]],
    2: [
      [40, 50],
      [60, 50],
    ],
    3: [
      [50, 38],
      [38, 62],
      [62, 62],
    ],
    4: [
      [39, 39],
      [61, 39],
      [39, 61],
      [61, 61],
    ],
  };
  const positions = positionsByCount[Math.min(count, 4)];

  return (
    <div className="absolute inset-0">
      {positions.map(([x, y], i) => (
        <motion.span
          key={`${count}-${i}`}
          className="absolute rounded-full"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: 14,
            height: 14,
            translateX: "-50%",
            translateY: "-50%",
            background: color,
            boxShadow: `0 6px ${10 + progress * 14}px ${color}${glow}, inset 0 2px 3px rgba(255,255,255,.6)`,
          }}
          animate={{
            scale: [1, pulseScale, 1],
            y: count === 1 ? [0, offsets[i]?.y || 0, 0] : [0, -bounce, 0],
            x: count === 1 ? [0, offsets[i]?.x || 0, 0] : progress > 0.85 ? [0, i % 2 === 0 ? 2 : -2, 0] : [0, 0, 0],
          }}
          transition={{ duration, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }}
        />
      ))}
    </div>
  );
}

function CrownIcon({ color }) {
  return (
    <motion.div
      className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-white shadow-[0_5px_0_#e5e7eb]"
      initial={{ scale: 0.7, rotate: -8 }}
      animate={{ scale: [0.7, 1.14, 1], rotate: [-8, 5, 0] }}
      transition={{ type: "spring", stiffness: 420, damping: 16 }}
    >
      <svg width="34" height="34" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M10 23.5L22.5 35L32 16L41.5 35L54 23.5L49.5 48H14.5L10 23.5Z"
          fill={color}
          stroke="#1f2937"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <path
          d="M17 54H47"
          stroke="#1f2937"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx="32" cy="16" r="4" fill="#fff7ed" stroke="#1f2937" strokeWidth="3" />
        <circle cx="10" cy="23.5" r="4" fill="#fff7ed" stroke="#1f2937" strokeWidth="3" />
        <circle cx="54" cy="23.5" r="4" fill="#fff7ed" stroke="#1f2937" strokeWidth="3" />
      </svg>
    </motion.div>
  );
}

function ConfettiBurst() {
  const pieces = useMemo(() => {
    const colors = ["#ff4d6d", "#3a86ff", "#06d6a0", "#ffd166", "#58cc02", "#a855f7"];
    return Array.from({ length: 70 }, (_, i) => ({
      id: i,
      color: colors[i % colors.length],
      startX: Math.random() * 100,
      startY: 20 + Math.random() * 40,
      x: (Math.random() - 0.5) * 420,
      y: Math.random() * 520 - 280,
      rotate: Math.random() * 900 - 450,
      delay: Math.random() * 0.22,
      width: Math.random() > 0.5 ? 8 : 6,
      height: Math.random() > 0.5 ? 12 : 9,
    }));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          className="absolute rounded-sm"
          style={{
            left: `${piece.startX}%`,
            top: `${piece.startY}%`,
            width: piece.width,
            height: piece.height,
            background: piece.color,
          }}
          initial={{ x: (Math.random() - 0.5) * 40, y: (Math.random() - 0.5) * 40, rotate: 0, opacity: 1, scale: 0.8 }}
          animate={{
            x: piece.x,
            y: piece.y,
            rotate: piece.rotate,
            opacity: [1, 1, 0],
            scale: [1, 1.15, 0.9],
          }}
          transition={{ duration: 1.35, ease: "easeOut", delay: piece.delay }}
        />
      ))}
    </div>
  );
}

function AppShell({ children, theme = "light" }) {
  const isDark = theme === "dark";

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }, [isDark]);

  return (
    <main className={`min-h-screen flex items-center justify-center ${isDark ? "bg-[#111827]" : "bg-[#f7f7fb]"}`}>
      <div className="w-full max-w-[430px] min-h-screen p-4 flex flex-col">{children}</div>
    </main>
  );
}

function Button({ children, className = "", ...props }) {
  return (
    <motion.button
      {...props}
      className={`w-full h-14 rounded-2xl bg-[#58cc02] text-white font-bold text-[16px] shadow-[0_6px_0_#46a302] ${className}`}
      initial={{ scale: 0.96, y: 8 }}
      animate={{ scale: [0.96, 1.05, 1], y: [8, -4, 0] }}
      whileTap={{ scale: 0.94, y: 6, boxShadow: "0 0 0 #46a302" }}
      transition={{ type: "spring", stiffness: 520, damping: 18 }}
    >
      {children}
    </motion.button>
  );
}

function Card({ children, className = "", isDark = false }) {
  return (
    <div className={`${isDark ? "bg-[#1f2937] shadow-[0_8px_0_#0f172a]" : "bg-white shadow-[0_8px_0_#e5e7eb]"} rounded-3xl p-4 ${className}`}>
      {children}
    </div>
  );
}

function ThemeMenu({ themeMode, setThemeMode, isDark }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute right-4 top-4 z-20">
      <button
        onClick={() => setOpen((value) => !value)}
        aria-label="Theme options"
        className={`h-10 w-10 flex items-center justify-center rounded-2xl text-xs font-black shadow active:scale-95 ${
          isDark ? "bg-[#1f2937] text-white shadow-[0_4px_0_#0f172a]" : "bg-white text-[#1f2937] shadow-[0_4px_0_#e5e7eb]"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 12.79A9 9 0 1 1 11.21 3c0 .13 0 .26.01.39A7 7 0 0 0 21 12.79Z" fill="currentColor" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className={`absolute right-0 mt-2 w-36 rounded-3xl p-2 shadow-xl ${
              isDark ? "bg-[#1f2937] shadow-[0_6px_0_#0f172a]" : "bg-white shadow-[0_6px_0_#e5e7eb]"
            }`}
            initial={{ opacity: 0, scale: 0.92, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -6 }}
          >
            {["system", "light", "dark"].map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setThemeMode(mode);
                  setOpen(false);
                }}
                className={`mb-2 h-10 w-full rounded-2xl text-xs font-black capitalize last:mb-0 active:scale-95 ${
                  themeMode === mode
                    ? "bg-[#3a86ff] text-white shadow-[0_4px_0_#2563eb]"
                    : isDark
                      ? "bg-[#374151] text-[#d1d5db]"
                      : "bg-[#f3f4f6] text-[#6b7280]"
                }`}
              >
                {mode}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Welcome({ onNext, themeMode, setThemeMode, theme }) {
  const isDark = theme === "dark";

  return (
    <div className="relative flex min-h-screen flex-1 flex-col justify-between">
      <ThemeMenu themeMode={themeMode} setThemeMode={setThemeMode} isDark={isDark} />
      <div className="mt-8 text-center">
        <h1 className={`text-5xl font-extrabold leading-tight ${isDark ? "text-white" : "text-[#1f2937]"}`}>
          Chain
          <br />
          Reaction
        </h1>
      </div>

      <div className="flex justify-center gap-3">
        {PLAYERS.map((player, i) => (
          <motion.div
            key={player.name}
            className="w-6 h-6 rounded-full shadow-md"
            style={{ background: player.color }}
            animate={{ y: [0, -8, 0], scale: [1, 1.12, 1] }}
            transition={{ repeat: Infinity, duration: 1.05, delay: i * 0.08, ease: "easeInOut" }}
          />
        ))}
      </div>

      <div className="space-y-4">
        <Button onClick={onNext}>Play</Button>
      </div>
    </div>
  );
}

function Setup({ playerCount, setPlayerCount, sizeKey, setSizeKey, onBack, onStart, theme }) {
  const selectedSize = BOARD_SIZES[sizeKey];
  const isDark = theme === "dark";

  return (
    <div className="flex min-h-screen flex-1 flex-col gap-5">
      <button onClick={onBack} className={`self-start text-sm font-bold ${isDark ? "text-[#d1d5db]" : "text-[#6b7280]"}`}>
        Back
      </button>

      <div className="mt-2">
        <h1 className={`text-4xl font-extrabold leading-tight ${isDark ? "text-white" : "text-[#1f2937]"}`}>Game Setup</h1>
        <p className="mt-2 text-base font-semibold text-[#9ca3af]">Pick your players and board.</p>
      </div>

      <Card isDark={isDark}>
        <p className="mb-4 text-sm font-extrabold uppercase tracking-wide text-[#9ca3af]">Players</p>
        <div className="grid grid-cols-3 gap-3">
          {[2, 3, 4].map((n) => (
            <motion.button
              key={n}
              onClick={() => setPlayerCount(n)}
              className={`h-14 rounded-2xl text-lg font-black active:translate-y-[2px] active:shadow-none ${
                playerCount === n
                  ? "bg-[#58cc02] text-white shadow-[0_5px_0_#46a302]"
                  : isDark
                    ? "bg-[#374151] text-[#d1d5db] shadow-[0_5px_0_#111827]"
                    : "bg-[#f3f4f6] text-[#9ca3af] shadow-[0_5px_0_#e5e7eb]"
              }`}
              whileTap={{ scale: 0.92, y: 4 }}
            >
              {n}
            </motion.button>
          ))}
        </div>
      </Card>

      <Card isDark={isDark}>
        <p className="mb-4 text-sm font-extrabold uppercase tracking-wide text-[#9ca3af]">Board</p>
        <div className="grid gap-3">
          {Object.entries(BOARD_SIZES).map(([key, size]) => (
            <motion.button
              key={key}
              onClick={() => setSizeKey(key)}
              className={`flex items-center justify-between rounded-2xl px-4 py-4 font-black active:translate-y-[2px] active:shadow-none ${
                sizeKey === key
                  ? "bg-[#3a86ff] text-white shadow-[0_5px_0_#2563eb]"
                  : isDark
                    ? "bg-[#374151] text-[#d1d5db] shadow-[0_5px_0_#111827]"
                    : "bg-[#f3f4f6] text-[#6b7280] shadow-[0_5px_0_#e5e7eb]"
              }`}
              whileTap={{ scale: 0.94, y: 4 }}
            >
              <span>{size.label}</span>
              <span className="opacity-75">{size.rows} x {size.cols}</span>
            </motion.button>
          ))}
        </div>
      </Card>

      <Card isDark={isDark} className={isDark ? "bg-[#1f2937]" : "bg-[#fff7ed] shadow-[0_8px_0_#fed7aa]"}>
        <div className="flex justify-center gap-3">
          {PLAYERS.slice(0, playerCount).map((player) => (
            <div key={player.name} className="flex flex-col items-center gap-2">
              <div className="h-7 w-7 rounded-full shadow-md" style={{ background: player.color }} />
              <span className={`text-xs font-black ${isDark ? "text-[#d1d5db]" : "text-[#6b7280]"}`}>{player.name}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-auto pb-2">
        <Button onClick={onStart}>Start Game</Button>
        <p className="mt-3 text-center text-xs font-bold text-[#9ca3af]">
          {playerCount} players · {selectedSize.rows} x {selectedSize.cols}
        </p>
      </div>
    </div>
  );
}

function Game({ rows, cols, players, onBack, onRestart, onSetup, theme }) {
  const [board, setBoard] = useState(() => makeBoard(rows, cols));
  const [turn, setTurn] = useState(0);
  const [winner, setWinner] = useState(null);
  const [moves, setMoves] = useState(0);
  const isDark = theme === "dark";

  function nextActivePlayer(from, resolvedBoard, nextMoves) {
    if (nextMoves < players.length) return (from + 1) % players.length;
    const active = activePlayersOnBoard(resolvedBoard);
    for (let step = 1; step <= players.length; step += 1) {
      const candidate = (from + step) % players.length;
      if (active.has(candidate)) return candidate;
    }
    return from;
  }

  function play(r, c) {
    if (winner !== null) return;
    const cell = board[r][c];
    if (cell.owner !== null && cell.owner !== turn) return;

    const next = cloneBoard(board);
    next[r][c].count += 1;
    next[r][c].owner = turn;

    const resolved = resolveBoardAfterMove(next, turn, rows, cols);
    const nextMoves = moves + 1;
    const active = activePlayersOnBoard(resolved);

    setBoard(resolved);
    setMoves(nextMoves);

    if (nextMoves >= players.length && active.size === 1) {
      setWinner([...active][0]);
      return;
    }

    setTurn(nextActivePlayer(turn, resolved, nextMoves));
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col gap-4">
      <button onClick={onBack} className={`self-start text-sm font-bold ${isDark ? "text-[#d1d5db]" : "text-[#6b7280]"}`}>
        Back
      </button>

      <div className={`mx-auto w-full rounded-[2rem] p-3 ${isDark ? "bg-[#1f2937] shadow-[0_10px_0_#111827,0_18px_30px_rgba(0,0,0,.2)]" : "bg-[#eef2ff] shadow-[0_10px_0_#dbe4ff,0_18px_30px_rgba(31,41,55,.12)]"}`}>
        <div
          className="grid gap-2 w-full"
          style={{
            gridTemplateColumns: `repeat(${cols}, 1fr)`,
            aspectRatio: `${cols} / ${rows}`,
          }}
        >
          {board.map((row, r) =>
            row.map((cell, c) => (
              <motion.button
                key={`${r}-${c}`}
                onClick={() => play(r, c)}
                className={`relative rounded-[1.1rem] border-2 flex items-center justify-center aspect-square active:translate-y-[2px] ${
                  isDark
                    ? "bg-[#374151] border-[#4b5563] shadow-[0_4px_0_#111827,0_6px_12px_rgba(0,0,0,.18)]"
                    : "bg-white border-[#f8fafc] shadow-[0_4px_0_#dbe4ff,0_6px_12px_rgba(31,41,55,.08)]"
                }`}
                whileTap={{ scale: 0.88, y: 4 }}
              >
                <Orb count={cell.count} color={players[cell.owner]?.color} cap={cell.cap} />
              </motion.button>
            ))
          )}
        </div>
      </div>

      {winner !== null && (
        <>
          <ConfettiBurst />
          <motion.div
          className={`${isDark ? "bg-[#1f2937] shadow-[0_8px_0_#111827]" : "bg-white shadow-[0_8px_0_#e5e7eb]"} relative overflow-hidden rounded-3xl p-4 text-center space-y-3 w-full max-w-[360px] mx-auto`}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <CrownIcon color={players[winner].color} />
          <p className={`text-xl font-black ${isDark ? "text-white" : "text-[#1f2937]"}`}>{players[winner].name} wins!</p>

          <div className="flex gap-3">
            <button onClick={onRestart} className="flex-1 h-12 rounded-2xl bg-[#58cc02] text-white font-bold shadow-[0_5px_0_#46a302] active:translate-y-[2px]">
              Play Again
            </button>
            <button
              onClick={onSetup}
              className={`${isDark ? "bg-[#374151] text-white shadow-[0_5px_0_#111827]" : "bg-[#f3f4f6] text-[#1f2937] shadow-[0_5px_0_#e5e7eb]"} flex-1 h-12 rounded-2xl font-bold active:translate-y-[2px]`}
            >
              Game Setup
            </button>
          </div>
          </motion.div>
        </>
      )}

      <div className="mt-auto flex justify-center gap-2 pb-2">
        {players.map((player, i) => (
          <div
            key={player.name}
            className={`px-4 py-2 rounded-full text-sm font-bold shadow ${
              i === turn && winner === null ? "bg-[#1f2937] text-white" : isDark ? "bg-[#374151] text-[#d1d5db]" : "bg-white text-[#6b7280]"
            }`}
          >
            {player.name}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("welcome");
  const [playerCount, setPlayerCount] = useState(2);
  const [sizeKey, setSizeKey] = useState("classic");
  const [gameId, setGameId] = useState(0);
  const [themeMode, setThemeMode] = useState("system");
  const theme = useResolvedTheme(themeMode);
  const selectedSize = BOARD_SIZES[sizeKey] || BOARD_SIZES.classic;

  useEffect(() => {
    const failedTests = runLogicTests().filter((result) => !result.passed);
    if (failedTests.length) console.error("Chain Reaction logic tests failed", failedTests);
  }, []);

  let screenNode;

  if (screen === "welcome") {
    screenNode = <Welcome onNext={() => setScreen("setup")} themeMode={themeMode} setThemeMode={setThemeMode} theme={theme} />;
  } else if (screen === "setup") {
    screenNode = (
      <Setup
        playerCount={playerCount}
        setPlayerCount={setPlayerCount}
        sizeKey={sizeKey}
        setSizeKey={setSizeKey}
        onBack={() => setScreen("welcome")}
        onStart={() => {
          setGameId((id) => id + 1);
          setScreen("game");
        }}
        theme={theme}
      />
    );
  } else {
    screenNode = (
      <Game
        key={`game-${sizeKey}-${playerCount}-${gameId}`}
        rows={selectedSize.rows}
        cols={selectedSize.cols}
        players={PLAYERS.slice(0, playerCount)}
        onBack={() => setScreen("setup")}
        onRestart={() => setGameId((id) => id + 1)}
        onSetup={() => setScreen("setup")}
        theme={theme}
      />
    );
  }

  return (
    <AppShell theme={theme}>
      <AnimatePresence mode="wait">
        <motion.div
          key={screen}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="min-h-screen flex flex-col"
        >
          {screenNode}
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
