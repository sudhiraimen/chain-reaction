import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const PLAYERS = [
  { name: "Red", color: "#ff453a", soft: "rgba(255,69,58,.08)" },
  { name: "Blue", color: "#0a84ff", soft: "rgba(10,132,255,.08)" },
  { name: "Green", color: "#30d158", soft: "rgba(48,209,88,.08)" },
  { name: "Amber", color: "#ff9f0a", soft: "rgba(255,159,10,.08)" },
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

  test("empty board has no active players", () => {
    expect(activePlayersOnBoard(makeBoard(4, 4)).size === 0, "empty board should have no active players");
  });

  test("cloneBoard does not mutate original", () => {
    const original = makeBoard(3, 3);
    const copy = cloneBoard(original);
    copy[0][0].count = 1;
    copy[0][0].owner = 0;
    expect(original[0][0].count === 0, "original count should remain unchanged");
    expect(original[0][0].owner === null, "original owner should remain unchanged");
  });

  test("player set supports two to four players", () => {
    expect(PLAYERS.length >= 4, "four local players should be available");
  });

  test("classic board state exposes rows and cols", () => {
    const { rows, cols } = BOARD_SIZES.classic;
    expect(rows === 8, "classic rows should be initialized");
    expect(cols === 6, "classic cols should be initialized");
  });

  return results;
}

function OrbCluster({ count, color, cap }) {
  if (!count) return null;

  let instability = Math.min(count / Math.max(cap - 1, 1), 1);
  if (count === 2) instability = Math.max(instability, 0.45);

  const duration = Math.max(0.55, 1.8 - instability * 1.05);
  const movement = instability * 3.6;
  const glow = 0.18 + instability * 0.34;
  const isCritical = count >= cap - 1;
  const positions = {
    1: [[50, 50]],
    2: [
      [40, 50],
      [60, 50],
    ],
    3: [
      [50, 39],
      [39, 60],
      [61, 60],
    ],
    4: [
      [40, 40],
      [60, 40],
      [40, 60],
      [60, 60],
    ],
  }[Math.min(count, 4)];

  return (
    <motion.div
      className="absolute inset-0"
      animate={
        isCritical
          ? { rotate: [-0.6, 0.7, -0.5], scale: [1, 1.025, 1] }
          : { scale: [1, 1 + instability * 0.012, 1] }
      }
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    >
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
            boxShadow: `0 10px ${18 + instability * 22}px rgba(255,255,255,${glow * 0.08}), 0 0 ${14 + instability * 28}px ${color}${isCritical ? "88" : "44"}, inset 0 1px 2px rgba(255,255,255,.5)`,
          }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{
            scale: isCritical ? [1, 1.13, 0.96, 1.08, 1] : [1, 1 + instability * 0.14, 1],
            opacity: 1,
            x: isCritical ? [0, movement, -movement * 0.7, movement * 0.35, 0] : [0, movement * 0.5, 0],
            y: isCritical ? [0, -movement * 0.6, movement * 0.7, -movement * 0.25, 0] : [0, -movement * 0.45, 0],
          }}
          transition={{
            scale: { duration, repeat: Infinity, ease: "easeInOut", delay: i * 0.05 },
            x: { duration: duration * 0.78, repeat: Infinity, ease: "easeInOut", delay: i * 0.07 },
            y: { duration: duration * 0.9, repeat: Infinity, ease: "easeInOut", delay: i * 0.06 },
            opacity: { type: "spring", stiffness: 360, damping: 24, delay: i * 0.015 },
          }}
        />
      ))}
    </motion.div>
  );
}

function IconReset({ className = "" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v6h6" />
    </svg>
  );
}

function AppShell({ children }) {
  useEffect(() => {
    const upsertMeta = (selector, attrs) => {
      let tag = document.querySelector(selector);
      if (!tag) {
        tag = document.createElement("meta");
        document.head.appendChild(tag);
      }
      Object.entries(attrs).forEach(([key, value]) => tag.setAttribute(key, value));
    };

    upsertMeta('meta[name="viewport"]', {
      name: "viewport",
      content: "width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no",
    });
    upsertMeta('meta[name="theme-color"]', { name: "theme-color", content: "#050507" });
    upsertMeta('meta[name="apple-mobile-web-app-capable"]', {
      name: "apple-mobile-web-app-capable",
      content: "yes",
    });
    upsertMeta('meta[name="mobile-web-app-capable"]', { name: "mobile-web-app-capable", content: "yes" });
    upsertMeta('meta[name="apple-mobile-web-app-status-bar-style"]', {
      name: "apple-mobile-web-app-status-bar-style",
      content: "black-translucent",
    });
  }, []);

  return (
    <>
      <style>{`
        html, body, #root {
          margin: 0;
          min-height: 100%;
          width: 100%;
          background: #050507;
          overscroll-behavior: none;
        }
        html {
          min-height: 100vh;
          min-height: 100dvh;
        }
        body {
          padding: 0;
          min-height: 100vh;
          min-height: 100dvh;
          overflow: hidden;
        }
        @supports (height: 100dvh) {
          .app-shell-min-height {
            min-height: 100dvh;
          }
        }
      `}</style>
      <main
        className="app-shell-min-height min-h-screen overflow-hidden bg-[#050507] text-[#f5f5f7] antialiased"
        style={{
          fontFamily:
            '"Inter Tight", "SF Pro Display", "Satoshi", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        }}
      >
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-14%,rgba(80,80,92,.42),rgba(5,5,7,.2)_38%,rgba(5,5,7,1)_74%)]" />
        <div className="fixed left-0 right-0 top-0 -z-10 h-[calc(env(safe-area-inset-top)+120px)] bg-[radial-gradient(circle_at_50%_0%,rgba(80,80,92,.42),rgba(5,5,7,.72)_70%,rgba(5,5,7,1)_100%)]" />
        <section className="relative mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
          {children}
        </section>
      </main>
    </>
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

function ReactorLogo() {
  return (
    <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
      <div className="absolute inset-0 rounded-2xl bg-[#111114] ring-1 ring-white/[.08]" />
      <div className="absolute inset-2 rounded-xl bg-white/[.03]" />
      <div className="relative flex h-full w-full items-center justify-center">
        <span className="absolute left-[35%] top-[40%] h-3 w-3 rounded-full bg-[#0a84ff]" />
        <span className="absolute right-[35%] top-[40%] h-3 w-3 rounded-full bg-[#ff453a]" />
        <span className="absolute bottom-[32%] left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[#30d158]" />
      </div>
      <div className="absolute inset-0 rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.03)]" />
    </div>
  );
}

function WelcomeOrbShowcase() {
  return (
    <div className="relative mx-auto grid h-72 w-72 place-items-center">
      <motion.div
        className="absolute h-64 w-64 rounded-full bg-white/[.035] ring-1 ring-white/[.07]"
        animate={{ scale: [0.96, 1.08, 0.96], opacity: [0.45, 0.95, 0.45] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute h-48 w-48 rounded-full bg-[#0a84ff]/20 blur-2xl"
        animate={{ scale: [0.85, 1.28, 0.85], opacity: [0.25, 0.8, 0.25] }}
        transition={{ duration: 2.1, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute h-36 w-36 rounded-full bg-[#ff453a]/10 blur-2xl"
        animate={{ scale: [1.2, 0.88, 1.2], x: [-14, 14, -14], opacity: [0.28, 0.7, 0.28] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />
      {[0, 1, 2, 3, 4].map((i) => {
        const player = PLAYERS[i % PLAYERS.length];
        const size = i === 0 ? 30 : 22;
        return (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{
              width: size,
              height: size,
              background: player.color,
              boxShadow: `0 0 34px ${player.color}99, inset 0 1px 2px rgba(255,255,255,.55)`,
            }}
            animate={{
              x: [0, Math.cos(i * 1.4) * 54, Math.cos(i * 1.4 + 1.4) * 38, 0],
              y: [0, Math.sin(i * 1.4) * 54, Math.sin(i * 1.4 + 1.4) * 38, 0],
              scale: [1, 1.28, 0.94, 1.16, 1],
              opacity: [0.86, 1, 0.9, 1, 0.86],
            }}
            transition={{ duration: 2.2 + i * 0.12, repeat: Infinity, ease: "easeInOut", delay: i * 0.08 }}
          />
        );
      })}
      <motion.div
        className="z-10 h-24 w-24 rounded-full bg-[#f5f5f7] shadow-[0_0_50px_rgba(255,255,255,.35),0_30px_90px_rgba(0,0,0,.55)]"
        animate={{ scale: [1, 1.16, 0.96, 1.09, 1] }}
        transition={{ duration: 1.45, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute z-0 h-28 w-28 rounded-full border border-white/[.16]"
        animate={{ scale: [0.92, 1.45], opacity: [0.8, 0] }}
        transition={{ duration: 1.45, repeat: Infinity, ease: "easeOut" }}
      />
      <motion.div
        className="absolute z-0 h-28 w-28 rounded-full border border-white/[.10]"
        animate={{ scale: [0.92, 1.72], opacity: [0.65, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.25 }}
      />
    </div>
  );
}

function WelcomeScreen({ onContinue }) {
  return (
    <AppShell>
      <div className="flex flex-1 flex-col justify-between py-8">
        <div className="flex flex-col items-center pt-8 text-center">
          <ReactorLogo />
          <h1 className="mt-7 text-[54px] font-semibold leading-[.92] tracking-[-0.065em]">
            Chain
            <br />
            Reaction
          </h1>
        </div>
        <WelcomeOrbShowcase />
        <div className="space-y-4 pb-4">
          <PrimaryButton onClick={onContinue} className="w-full">
            Continue
          </PrimaryButton>
        </div>
      </div>
    </AppShell>
  );
}

function SetupScreen({ playerCount, setPlayerCount, mode, setMode, onStart, onBack }) {
  return (
    <AppShell>
      <header className="mb-8 flex items-center justify-between pt-2">
        <button onClick={onBack} className="text-[14px] font-semibold text-[#8e8e93] active:scale-95">
          Back
        </button>
        <div className="w-9" />
      </header>

      <div className="flex flex-1 flex-col">
        <div className="mb-8">
          <h1 className="text-[42px] font-semibold tracking-[-0.045em]">New Game</h1>
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
                    playerCount === n
                      ? "bg-[#f5f5f7] text-[#050507]"
                      : "bg-white/[.065] text-[#8e8e93] ring-1 ring-white/[.08]"
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
                  className={`flex w-full items-center justify-between rounded-[1.35rem] px-4 py-3 text-left transition active:scale-[.99] ${
                    mode === key
                      ? "bg-[#f5f5f7] text-[#050507]"
                      : "bg-white/[.065] text-[#f5f5f7] ring-1 ring-white/[.08]"
                  }`}
                >
                  <span className="text-[15px] font-semibold">{value.label}</span>
                  <span className={mode === key ? "text-[13px] text-[#3a3a3c]" : "text-[13px] text-[#8e8e93]"}>
                    {value.rows} x {value.cols}
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

        <div className="mt-auto pb-4 pt-8">
          <PrimaryButton onClick={onStart} className="w-full">
            Start Game
          </PrimaryButton>
        </div>
      </div>
    </AppShell>
  );
}

function GameScreen({
  board,
  rows,
  cols,
  players,
  current,
  currentPlayer,
  alive,
  winner,
  busy,
  message,
  onBack,
  onPlay,
  onReset,
}) {
  return (
    <AppShell>
      <header className="mb-3 flex items-center justify-between">
        <button
          onClick={onBack}
          className="h-10 rounded-full bg-white/[.09] px-4 text-[13px] font-semibold text-[#f5f5f7] ring-1 ring-white/[.10] backdrop-blur-xl active:scale-95"
        >
          Back
        </button>
        <div />
      </header>

      <div className="relative w-full pb-3">
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
                  onClick={() => onPlay(r, c)}
                  disabled={busy || winner !== null}
                  aria-label={`Row ${r + 1}, column ${c + 1}, ${cell.count} of ${cell.cap} orbs`}
                  className="relative overflow-hidden rounded-[1.05rem] bg-[#111114] ring-1 ring-white/[.075] transition disabled:opacity-90 active:scale-[.96]"
                  style={{
                    aspectRatio: "1 / 1",
                    background: owner ? owner.soft : "#111114",
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
                      style={{ background: owner.color, opacity: 0.12 }}
                    />
                  )}
                  <OrbCluster count={cell.count} color={owner?.color} cap={cell.cap} />
                </motion.button>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-auto space-y-3 pb-2">
        <div className="rounded-[2rem] bg-white/[.075] p-3 shadow-[0_22px_70px_rgba(0,0,0,.42)] ring-1 ring-white/[.10] backdrop-blur-2xl">
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

        <div className="flex justify-center gap-2">
          {players.map((p, i) => (
            <div
              key={p.name}
              className={`flex items-center gap-2 rounded-full px-3 py-2 ring-1 transition ${
                i === currentPlayer
                  ? "bg-white/[.14] ring-white/[.25] scale-[1.05]"
                  : "bg-white/[.065] ring-white/[.08]"
              } ${alive.includes(i) ? "opacity-100" : "opacity-35 grayscale"}`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
              <span className="text-[12px] font-semibold text-[#c7c7cc]">{p.name}</span>
            </div>
          ))}
        </div>
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
              onClick={onReset}
              className="mt-5 h-11 rounded-full bg-[#f5f5f7] px-6 text-[15px] font-semibold text-[#050507] active:scale-95"
            >
              New Game
            </button>
          </motion.div>
        )}
      </AnimatePresence>
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
  const boardRef = useRef(board);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    const failedTests = runLogicTests().filter((result) => !result.passed);
    if (failedTests.length) {
      console.error("Chain Reaction logic tests failed", failedTests);
    }
  }, []);

  const players = useMemo(() => PLAYERS.slice(0, playerCount), [playerCount]);
  const current = players[currentPlayer] || players[0];

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
      if (canEndGame && activePlayersOnBoard(working).size <= 1) break;
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

    const newTurns = turns + 1;
    const settled = await resolveReactions(nextBoard, currentPlayer, newTurns >= players.length);
    boardRef.current = settled;
    setBoard(settled);
    setTurns(newTurns);

    let newAlive = Array.from({ length: players.length }, (_, i) => i);
    if (newTurns >= players.length) {
      const present = activePlayersOnBoard(settled);
      newAlive = newAlive.filter((p) => present.has(p));
    }
    setAlive(newAlive);

    const present = activePlayersOnBoard(settled);
    if (present.size === 1 && newTurns >= players.length) {
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
    <GameScreen
      board={board}
      rows={rows}
      cols={cols}
      players={players}
      current={current}
      currentPlayer={currentPlayer}
      alive={alive}
      winner={winner}
      busy={busy}
      message={message}
      onBack={() => setScreen("setup")}
      onPlay={play}
      onReset={() => reset()}
    />
  );
}
