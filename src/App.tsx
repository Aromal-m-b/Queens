import React, { useState, useEffect, useRef } from "react";
import {
  Trophy,
  Clock,
  RotateCcw,
  Menu,
  HelpCircle,
  X,
  ChevronLeft,
  Sparkles,
  Eye,
  EyeOff,
  CheckCircle2,
  Volume2,
  VolumeX,
  Star,
  Info,
  Trash2,
  RefreshCw,
  Lock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BOARDS, Board } from "./data/boards";
import { CellValue, GameStats } from "./types";
import Tutorial from "./components/Tutorial";
import SuccessCelebration from "./components/SuccessCelebration";
import BoardHUD from "./components/BoardHUD";
import AdminPortal from "./components/AdminPortal";

export default function App() {
  // Navigation states
  const [selectedDifficulty, setSelectedDifficulty] = useState<"easy" | "medium" | "hard" | null>(null);
  const [activeBoard, setActiveBoard] = useState<Board | null>(null);

  // Puzzle State
  // 2D grid holding CellValue
  const [gridState, setGridState] = useState<CellValue[][]>([]);
  const [history, setHistory] = useState<CellValue[][][]>([]);
  const [movesCount, setMovesCount] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  
  // Game Helpers Config
  const [showTutorial, setShowTutorial] = useState(false);
  const [showAutoShadows, setShowAutoShadows] = useState(true);
  const [remainingHints, setRemainingHints] = useState(3);
  const [activeHintCell, setActiveHintCell] = useState<{ r: number; c: number } | null>(null);
  const [blockedRows, setBlockedRows] = useState<number[]>([]);
  const [blockedCols, setBlockedCols] = useState<number[]>([]);

  // Timer reference state
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Solved Levels persistence
  const [solvedLevelIds, setSolvedLevelIds] = useState<string[]>([]);

  // Active Queen Placement cache for real-time validation
  interface QueenPos {
    r: number;
    c: number;
    color: number;
  }
  const [queens, setQueens] = useState<QueenPos[]>([]);

  // Dynamic Levels State
  const [allBoards, setAllBoards] = useState<Board[]>([]);
  const [showAdminPortal, setShowAdminPortal] = useState(false);

  // Client-side router for /admin path or #/admin hash
  useEffect(() => {
    const checkRoute = () => {
      const isPathAdmin = window.location.pathname === "/admin" || 
                          window.location.pathname.startsWith("/admin/") ||
                          window.location.hash === "#/admin" || 
                          window.location.hash === "#admin";
      setShowAdminPortal(isPathAdmin);
    };

    checkRoute();

    window.addEventListener("popstate", checkRoute);
    window.addEventListener("hashchange", checkRoute);

    return () => {
      window.removeEventListener("popstate", checkRoute);
      window.removeEventListener("hashchange", checkRoute);
    };
  }, []);

  const navigateToAdmin = () => {
    window.history.pushState({}, "", "/admin");
    setShowAdminPortal(true);
    playChime("click");
  };

  const navigateToHome = () => {
    window.history.pushState({}, "", "/");
    setShowAdminPortal(false);
    playChime("click");
  };

  // Load solved levels and levels count on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("queens-puzzle-solved-levels");
      if (saved) {
        setSolvedLevelIds(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load solved levels state", e);
    }

    try {
      const savedLevels = localStorage.getItem("queens-puzzle-all-boards-v1");
      if (savedLevels) {
        setAllBoards(JSON.parse(savedLevels));
      } else {
        setAllBoards(BOARDS);
      }
    } catch (e) {
      console.error("Failed to load custom levels", e);
      setAllBoards(BOARDS);
    }
  }, []);

  const saveBoardsState = (newBoards: Board[]) => {
    setAllBoards(newBoards);
    try {
      localStorage.setItem("queens-puzzle-all-boards-v1", JSON.stringify(newBoards));
    } catch (e) {
      console.error("Failed to save levels", e);
    }
  };

  // Save solved level when achieved
  const markLevelAsSolved = (id: string) => {
    if (solvedLevelIds.includes(id)) return;
    const newList = [...solvedLevelIds, id];
    setSolvedLevelIds(newList);
    try {
      localStorage.setItem("queens-puzzle-solved-levels", JSON.stringify(newList));
    } catch (e) {
      console.error("Failed to save solved level", e);
    }
  };

  // SOUND CHIME GENERATOR using Web Audio API
  const playChime = (type: "dot" | "queen" | "clear" | "win" | "hint" | "error" | "click") => {
    if (isMuted) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      if (type === "click" || type === "dot") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(450, ctx.currentTime);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === "queen") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(320, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(640, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      } else if (type === "clear") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.03, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      } else if (type === "error") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(140, ctx.currentTime);
        osc.frequency.setValueAtTime(110, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === "hint") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.exponentialRampToValueAtTime(783.99, ctx.currentTime + 0.2); // G5
        gain.gain.setValueAtTime(0.06, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === "win") {
        // Celestial chords (C Major)
        const freqs = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C4, E4, G4, C5, E5, G5, C6
        freqs.forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, ctx.currentTime + idx * 0.07);
          gain.gain.setValueAtTime(0.05, ctx.currentTime + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.07 + 0.7);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.07);
          osc.stop(ctx.currentTime + idx * 0.07 + 0.7);
        });
      }
    } catch (e) {
      // Audio context blocked / unavailable
    }
  };

  // Timer control loop
  useEffect(() => {
    if (activeBoard && !isCompleted) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [activeBoard, isCompleted]);

  // Push snapshot to undo history
  const pushHistory = (stateToPush: CellValue[][]) => {
    setHistory((prev) => [...prev, stateToPush.map((row) => [...row])]);
  };

  // Undo last board action
  const handleUndo = () => {
    if (history.length === 0 || isCompleted || !activeBoard) return;
    const previous = history[history.length - 1];
    setGridState(previous);
    setHistory((prev) => prev.slice(0, -1));
    setMovesCount((prev) => Math.max(0, prev - 1));
    playChime("click");
  };

  // Load a developer-provided board
  const loadBoard = (board: Board) => {
    setActiveBoard(board);
    setGridState(Array(board.size).fill(null).map(() => Array(board.size).fill("")));
    setHistory([]); // clear undo history
    setMovesCount(0);
    setElapsedSeconds(0);
    setIsCompleted(false);
    setRemainingHints(3);
    setActiveHintCell(null);
    playChime("click");
  };

  // Back to levels drawer
  const resetToLevelsList = () => {
    setActiveBoard(null);
    setGridState([]);
    setHistory([]);
    setIsCompleted(false);
    playChime("click");
  };

  // Complete return to home
  const resetToMainMenu = () => {
    setSelectedDifficulty(null);
    setActiveBoard(null);
    setGridState([]);
    setHistory([]);
    setIsCompleted(false);
    playChime("clear");
  };

  // RE-EVALUATE QUEENS REACTIVELY ON GRID STATE CHANGE
  useEffect(() => {
    if (!activeBoard) return;
    const foundQueens: QueenPos[] = [];
    for (let r = 0; r < activeBoard.size; r++) {
      for (let c = 0; c < activeBoard.size; c++) {
        if (gridState[r]?.[c] === "Q") {
          foundQueens.push({ r, c, color: activeBoard.grid[r][c] });
        }
      }
    }
    setQueens(foundQueens);
  }, [gridState, activeBoard]);

  // DERIVED STATS & ERROR CALCULATIONS
  const detectConflictsAndCompleteness = () => {
    if (!activeBoard) {
      return {
        touchingQueensSet: new Set<string>(),
        rowStatus: [],
        colStatus: [],
        colorStatus: [],
        allValidAndSolved: false,
      };
    }
    const size = activeBoard.size;

    // 1. Row counts
    const rowCounts = Array(size).fill(0);
    // 2. Col counts
    const colCounts = Array(size).fill(0);
    // 3. Color region counts
    const colorCounts = Array(size).fill(0);

    // Track conflict locations (row/col/color duplications or adjacency touches): "r,c" format
    const touchingQueensSet = new Set<string>();

    queens.forEach((q1, idx1) => {
      rowCounts[q1.r]++;
      colCounts[q1.c]++;
      colorCounts[q1.color]++;

      queens.forEach((q2, idx2) => {
        if (idx1 === idx2) return;
        
        // 1. Orthogonal or diagonal touch (distance <= 1)
        const dr = Math.abs(q1.r - q2.r);
        const dc = Math.abs(q1.c - q2.c);
        const isTouchViolation = dr <= 1 && dc <= 1;

        // 2. Overlapping row
        const isRowViolation = q1.r === q2.r;

        // 3. Overlapping column
        const isColViolation = q1.c === q2.c;

        // 4. Overlapping color region
        const isColorViolation = q1.color === q2.color;

        if (isTouchViolation || isRowViolation || isColViolation || isColorViolation) {
          touchingQueensSet.add(`${q1.r},${q1.c}`);
          touchingQueensSet.add(`${q2.r},${q2.c}`);
        }
      });
    });

    // Build Row Status
    const rowStatus = Array.from({ length: size }, (_, i) => ({
      index: i,
      label: `Row ${i + 1}`,
      queensCount: rowCounts[i],
    }));

    // Build Column Status (Letters)
    const colStatus = Array.from({ length: size }, (_, i) => ({
      index: i,
      label: String.fromCharCode(65 + i), // A, B, C...
      queensCount: colCounts[i],
    }));

    // Build Color Status
    const colorStatus = Array.from({ length: size }, (_, i) => ({
      index: i,
      label: `Color ${i + 1}`,
      queensCount: colorCounts[i],
    }));

    // Touch conflict exists if we have entries in touchingQueensSet
    const hasTouchError = touchingQueensSet.size > 0;

    // Check duplicate warnings
    const hasRowDuplicate = rowCounts.some((count) => count > 1);
    const hasColDuplicate = colCounts.some((count) => count > 1);
    const hasColorDuplicate = colorCounts.some((count) => count > 1);

    // Is perfectly complete & correct?
    // Must have exactly size queens, and each row, col, color must have exactly 1 queen, and no touch errors!
    const allValidAndSolved =
      queens.length === size &&
      !hasTouchError &&
      !hasRowDuplicate &&
      !hasColDuplicate &&
      !hasColorDuplicate &&
      rowCounts.every((c) => c === 1) &&
      colCounts.every((c) => c === 1) &&
      colorCounts.every((c) => c === 1);

    return {
      touchingQueensSet,
      rowStatus,
      colStatus,
      colorStatus,
      allValidAndSolved,
    };
  };

  const {
    touchingQueensSet,
    rowStatus,
    colStatus,
    colorStatus,
    allValidAndSolved,
  } = detectConflictsAndCompleteness();

  // Handle Win Action
  useEffect(() => {
    if (activeBoard && allValidAndSolved && !isCompleted) {
      setIsCompleted(true);
      markLevelAsSolved(activeBoard.id);
      playChime("win");
    }
  }, [allValidAndSolved, activeBoard, isCompleted]);

  // Check if any row or column is fully filled with dots, with a short 1-second grace period
  useEffect(() => {
    if (!activeBoard || isCompleted) {
      setBlockedRows([]);
      setBlockedCols([]);
      return;
    }

    const size = activeBoard.size;
    const currentBlockedRows: number[] = [];
    const currentBlockedCols: number[] = [];

    // Check rows
    for (let r = 0; r < size; r++) {
      const rowCells = gridState[r];
      if (rowCells && rowCells.length === size && rowCells.every((cell) => cell === ".")) {
        currentBlockedRows.push(r);
      }
    }

    // Check columns
    for (let c = 0; c < size; c++) {
      const colCells = gridState.map((row) => row[c]);
      if (colCells && colCells.length === size && colCells.every((cell) => cell === ".")) {
        currentBlockedCols.push(c);
      }
    }

    if (currentBlockedRows.length > 0 || currentBlockedCols.length > 0) {
      const timer = setTimeout(() => {
        setBlockedRows(currentBlockedRows);
        setBlockedCols(currentBlockedCols);
        playChime("error");
      }, 1000); // 1.0s grace period/wait time as requested!

      return () => clearTimeout(timer);
    } else {
      setBlockedRows([]);
      setBlockedCols([]);
    }
  }, [gridState, activeBoard, isCompleted]);

  // Handle Level Navigation Next
  const handleNextLevel = () => {
    if (!activeBoard) return;
    const currentIdx = allBoards.findIndex((b) => b.id === activeBoard.id);
    const nextIdx = currentIdx + 1;
    if (nextIdx < allBoards.length && allBoards[nextIdx].difficulty === selectedDifficulty) {
      loadBoard(allBoards[nextIdx]);
    } else {
      resetToLevelsList();
    }
  };

  // Helper arrays for calculating shadow lines of sight (Queens auto visual helper)
  const computeShadowedCells = () => {
    const shadowed = new Set<string>();
    if (!activeBoard || !showAutoShadows) return shadowed;

    queens.forEach((q) => {
      // Mark entire row & col as blocked
      for (let i = 0; i < activeBoard.size; i++) {
        if (i !== q.c) shadowed.add(`${q.r},${i}`);
        if (i !== q.r) shadowed.add(`${i},${q.c}`);
      }

      // Mark entire color region as blocked
      for (let r = 0; r < activeBoard.size; r++) {
        for (let c = 0; c < activeBoard.size; c++) {
          if (activeBoard.grid[r][c] === q.color && (r !== q.r || c !== q.c)) {
            shadowed.add(`${r},${c}`);
          }
        }
      }

      // Mark 8-neighbors around queen
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = q.r + dr;
          const nc = q.c + dc;
          if (nr >= 0 && nr < activeBoard.size && nc >= 0 && nc < activeBoard.size) {
            shadowed.add(`${nr},${nc}`);
          }
        }
      }
    });

    return shadowed;
  };

  const shadowedCells = computeShadowedCells();

  // Left click or direct tap handler - cycles: Empty -> Dot -> Queen -> Empty
  const handleCellLeftClick = (r: number, c: number) => {
    if (isCompleted || !activeBoard) return;

    // Reset any active hint indicators
    if (activeHintCell && activeHintCell.r === r && activeHintCell.c === c) {
      setActiveHintCell(null);
    }

    pushHistory(gridState);

    setGridState((prev) => {
      const copy = prev.map((row) => [...row]);
      const current = copy[r][c];
      let nextState: CellValue = "";

      if (current === "") {
        nextState = ".";
        playChime("dot");
      } else if (current === ".") {
        nextState = "Q";
        // Check if placing Queen creates an immediate adjacent, row, col, or color conflict
        const willConflict = queens.some((q) => {
          const isTouch = Math.abs(q.r - r) <= 1 && Math.abs(q.c - c) <= 1;
          const isRow = q.r === r;
          const isCol = q.c === c;
          const isColor = q.color === activeBoard.grid[r][c];
          return isTouch || isRow || isCol || isColor;
        });
        if (willConflict) {
          playChime("error");
        } else {
          playChime("queen");
        }
      } else if (current === "Q") {
        nextState = "";
        playChime("clear");
      }

      copy[r][c] = nextState;
      return copy;
    });

    setMovesCount((prev) => prev + 1);
  };

  // Right-click context menu cycle: Empty -> Queen -> Dot -> Empty
  const handleCellRightClick = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault(); // prevent native menu
    if (isCompleted || !activeBoard) return;

    if (activeHintCell && activeHintCell.r === r && activeHintCell.c === c) {
      setActiveHintCell(null);
    }

    pushHistory(gridState);

    setGridState((prev) => {
      const copy = prev.map((row) => [...row]);
      const current = copy[r][c];
      let nextState: CellValue = "";

      if (current === "") {
        nextState = "Q";
        // Check if placing Queen creates an immediate adjacent, row, col, or color conflict
        const willConflict = queens.some((q) => {
          const isTouch = Math.abs(q.r - r) <= 1 && Math.abs(q.c - c) <= 1;
          const isRow = q.r === r;
          const isCol = q.c === c;
          const isColor = q.color === activeBoard.grid[r][c];
          return isTouch || isRow || isCol || isColor;
        });
        if (willConflict) {
          playChime("error");
        } else {
          playChime("queen");
        }
      } else if (current === "Q") {
        nextState = ".";
        playChime("dot");
      } else if (current === ".") {
        nextState = "";
        playChime("clear");
      }

      copy[r][c] = nextState;
      return copy;
    });

    setMovesCount((prev) => prev + 1);
  };

  // Restart the active board completely
  const handleRestartBoard = () => {
    if (!activeBoard) return;
    setGridState(Array(activeBoard.size).fill(null).map(() => Array(activeBoard.size).fill("")));
    setHistory([]);
    setMovesCount(0);
    setElapsedSeconds(0);
    setIsCompleted(false);
    setRemainingHints(3);
    setActiveHintCell(null);
    playChime("clear");
  };

  // Visual Assist: Solves a stuck board by providing a pulsing hint overlay
  const handleGetHint = () => {
    if (!activeBoard || remainingHints <= 0 || isCompleted) return;

    // Find a coordinate in correct solution that doesn't have a Queen currently in it
    const missingQueens = activeBoard.solution.filter(
      (sol) => gridState[sol.r]?.[sol.c] !== "Q"
    );

    if (missingQueens.length > 0) {
      // Pick a random missing index
      const randomIndex = Math.floor(Math.random() * missingQueens.length);
      const chosen = missingQueens[randomIndex];
      setActiveHintCell(chosen);
      setRemainingHints((prev) => prev - 1);
      playChime("hint");

      // Auto clear hint from screen after 3.5 seconds
      setTimeout(() => {
        setActiveHintCell((prev) => {
          if (prev && prev.r === chosen.r && prev.c === chosen.c) {
            return null;
          }
          return prev;
        });
      }, 3500);
    }
  };

  // Safe checks if a neighbor belongs to a different colored region
  const isDifferentRegion = (r1: number, c1: number, r2: number, c2: number) => {
    if (!activeBoard) return true;
    const size = activeBoard.size;
    if (r2 < 0 || r2 >= size || c2 < 0 || c2 >= size) return true;
    return activeBoard.grid[r1][c1] !== activeBoard.grid[r2][c2];
  };

  // Color Mapping definitions for Region backgrounds
  const getPastelBgForRegion = (idx: number) => {
    const palette = [
      "bg-teal-100/80 text-teal-950",
      "bg-rose-100/80 text-rose-950",
      "bg-emerald-100/80 text-emerald-950",
      "bg-violet-100/80 text-violet-950",
      "bg-amber-100/80 text-amber-950",
      "bg-sky-100/80 text-sky-950",
      "bg-pink-100/80 text-pink-950",
      "bg-yellow-105/90 text-yellow-950",
      "bg-lime-100/80 text-lime-950",
      "bg-orange-100/80 text-orange-950",
    ];
    return palette[idx % palette.length];
  };

  // Format Elapsed Timer to MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Count total solved levels across all difficulties
  const totalSolvedCount = allBoards.filter((b) => solvedLevelIds.includes(b.id)).length;

  const easyBoards = allBoards.filter((b) => b.difficulty === "easy");
  const mediumBoards = allBoards.filter((b) => b.difficulty === "medium");
  const hardBoards = allBoards.filter((b) => b.difficulty === "hard");

  const easySolvedCount = easyBoards.filter((b) => solvedLevelIds.includes(b.id)).length;
  const mediumSolvedCount = mediumBoards.filter((b) => solvedLevelIds.includes(b.id)).length;
  const hardSolvedCount = hardBoards.filter((b) => solvedLevelIds.includes(b.id)).length;

  return (
    <div className={`bg-[#fdfcf0] text-[#2d3436] flex flex-col items-center select-none font-sans relative transition-all ${
      (!selectedDifficulty && !showAdminPortal) 
        ? "h-screen w-screen overflow-hidden" 
        : "min-h-screen w-full pb-12 overflow-y-auto"
    }`}>
      {/* Dynamic Header */}
      <header className={`w-full px-6 flex items-center justify-between border-b-4 border-[#e2e2cc] bg-white shrink-0 transition-all ${activeBoard ? "py-2" : "py-5"}`}>
        <div className="flex items-center gap-3">
          <button
            onClick={resetToMainMenu}
            className="flex items-center gap-2 group focus:outline-none"
            id="header-logo-btn"
          >
            <div className={`rounded-xl bg-[#ff7675] flex items-center justify-center text-white font-black border-b-4 border-[#d63031] shadow group-hover:bg-[#ff7675]/90 transition-colors ${activeBoard ? "w-8 h-8 text-sm" : "w-10 h-10"}`}>
              ♕
            </div>
            <div className="text-left">
              <h1 className={`font-display font-black text-[#ff7675] tracking-tight leading-tight transition-all ${activeBoard ? "text-xl" : "text-2xl"}`}>
                QUEENS
              </h1>
              <p className="text-[9px] text-[#b2bec3] font-bold tracking-widest uppercase leading-none mt-0.5">
                Puzzle Challenge
              </p>
            </div>
          </button>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-2">
          {/* Global statistics pill */}
          <div className="px-3.5 py-1.5 bg-[#f1f2f6] rounded-xl border-2 border-[#dfe6e9] flex items-center gap-1.5 text-xs text-[#2d3436] font-bold shadow-sm">
            <Trophy className="w-3.5 h-3.5 text-[#fdcb6e] fill-[#fdcb6e]/10" />
            <span>Solved: {totalSolvedCount} / {allBoards.length}</span>
          </div>

          <button
            onClick={() => {
              if (showAdminPortal) {
                navigateToHome();
              } else {
                navigateToAdmin();
              }
            }}
            className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-[#2d3436] transition-all shadow-sm focus:outline-none cursor-pointer ${
              showAdminPortal 
                ? "bg-[#6c5ce7] border-[#6c5ce7] text-white" 
                : "bg-white hover:bg-[#ffeaa7]/50 border-[#dfe6e9]"
            }`}
            title="Admin Portal"
            id="admin-portal-toggle-btn"
          >
            <Lock className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowTutorial(true)}
            className="w-10 h-10 rounded-xl bg-white hover:bg-[#ffeaa7]/50 border-2 border-[#dfe6e9] flex items-center justify-center text-[#2d3436] transition-colors shadow-sm focus:outline-none cursor-pointer"
            title="How To Play"
            id="tutorial-btn"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          <button
            onClick={() => {
              setIsMuted(!isMuted);
              playChime("click");
            }}
            className="w-10 h-10 rounded-xl bg-white hover:bg-[#ffeaa7]/50 border-2 border-[#dfe6e9] flex items-center justify-center text-[#2d3436] transition-colors shadow-sm focus:outline-none cursor-pointer"
            title={isMuted ? "Unmute sounds" : "Mute sounds"}
            id="mute-btn"
          >
            {isMuted ? <VolumeX className="w-5 h-5 text-[#ff7675]" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className={`w-full px-6 flex-grow flex flex-col items-center transition-all ${
        showAdminPortal 
          ? "justify-start py-4 sm:py-10" 
          : (activeBoard ? "py-1 sm:py-2 justify-center" : !selectedDifficulty ? "py-2 sm:py-4 justify-center" : "py-6 justify-center")
      }`}>
        
        {showAdminPortal ? (
          <AdminPortal
            onClose={navigateToHome}
            allBoards={allBoards}
            onSaveBoards={saveBoardsState}
            playChime={playChime}
          />
        ) : (
          <>
        {/* ======================================================== */}
        {/* VIEW 1: MINIMALIST DIFFICULTY SELECTION (ROOT)           */}
        {/* ======================================================== */}
        {!selectedDifficulty && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-lg w-full py-2 sm:py-6"
            id="root-selection-view"
          >
            {/* Elegant Branding Hero */}
            <div className="mb-10 text-center relative">
              <span className="text-6xl select-none mb-4 inline-block animate-pulse-slow">♕</span>
              <h1 className="font-display font-black text-5xl text-[#ff7675] tracking-tight mb-2">QUEENS</h1>
              <p className="text-xs font-black text-[#b2bec3] uppercase tracking-widest">Puzzle Challenge</p>
            </div>

            {/* MINIMALIST LEVELS SELECTION BUTTONS */}
            <div className="space-y-4 max-w-sm mx-auto px-4">
              {/* EASY BUTTON */}
              <button
                onClick={() => {
                  setSelectedDifficulty("easy");
                  playChime("click");
                }}
                className="w-full text-left py-4 px-6 rounded-2xl bg-[#55efc4] text-[#00b894] font-bold border-b-4 border-[#00b894] hover:translate-y-[-2px] active:translate-y-[2px] transition-all cursor-pointer focus:outline-none"
                id="difficulty-easy-btn"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="text-left pr-4">
                    <span className="block leading-tight text-white font-black text-xl">Easy Mode</span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="bg-white/35 text-white px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider leading-none">
                      {easySolvedCount}/{easyBoards.length} Solved
                    </span>
                    <span className="bg-white/20 text-white px-2 py-0.5 rounded-lg text-xs font-black leading-none">6×6</span>
                  </div>
                </div>
              </button>

              {/* MEDIUM BUTTON */}
              <button
                onClick={() => {
                  setSelectedDifficulty("medium");
                  playChime("click");
                }}
                className="w-full text-left py-4 px-6 rounded-2xl bg-[#74b9ff] text-white font-bold border-b-4 border-[#0984e3] shadow-lg ring-4 ring-[#74b9ff]/30 hover:translate-y-[-2px] active:translate-y-[2px] transition-all cursor-pointer focus:outline-none"
                id="difficulty-medium-btn"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="text-left pr-4">
                    <span className="block leading-tight text-white font-black text-xl">Medium Mode</span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="bg-white/35 text-white px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider leading-none">
                      {mediumSolvedCount}/{mediumBoards.length} Solved
                    </span>
                    <span className="bg-[#0984e3]/30 text-white px-2 py-0.5 rounded-lg text-xs font-black leading-none">8×8</span>
                  </div>
                </div>
              </button>

              {/* HARD BUTTON */}
              <button
                onClick={() => {
                  setSelectedDifficulty("hard");
                  playChime("click");
                }}
                className="w-full text-left py-4 px-6 rounded-2xl bg-[#a29bfe] text-[#6c5ce7] font-bold border-b-4 border-[#6c5ce7] hover:translate-y-[-2px] active:translate-y-[2px] transition-all cursor-pointer focus:outline-none"
                id="difficulty-hard-btn"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="text-left pr-4">
                    <span className="block leading-tight text-white font-black text-xl">Hard Mode</span>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <span className="bg-white/35 text-white px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider leading-none">
                      {hardSolvedCount}/{hardBoards.length} Solved
                    </span>
                    <span className="bg-white/20 text-white px-2 py-0.5 rounded-lg text-xs font-black leading-none">10×10</span>
                  </div>
                </div>
              </button>
            </div>
          </motion.div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: LEVELS SECTOR SUB-VIEW OF SELECTED DIFFICULTY   */}
        {/* ======================================================== */}
        {selectedDifficulty && !activeBoard && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl py-6"
            id="levels-grid-view"
          >
            {/* Navigation Back */}
            <button
              onClick={() => {
                setSelectedDifficulty(null);
                playChime("click");
              }}
              className="flex items-center gap-1.5 text-xs text-[#636e72] font-black hover:text-[#2d3436] transition-colors uppercase tracking-wider font-mono mb-6 focus:outline-none cursor-pointer"
              id="back-to-diff-btn"
            >
              <ChevronLeft className="w-4 h-4 text-[#b2bec3]" />
              Back to Difficulties
            </button>

            {/* Difficulty Title */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b-2 border-[#dfe6e9]">
              <div>
                <h2 className="font-display font-black text-3xl capitalize text-[#2d3436]">
                  {selectedDifficulty} Boards
                </h2>
              </div>

              <div className="px-3.5 py-1.5 bg-[#ff7675] text-white font-black rounded-xl text-xs uppercase shadow-sm border-b-2 border-[#d63031]">
                {selectedDifficulty === "easy" && "6 × 6 Grid"}
                {selectedDifficulty === "medium" && "8 × 8 Grid"}
                {selectedDifficulty === "hard" && "10 × 10 Grid"}
              </div>
            </div>

            {/* Level Cards Compact Grid */}
            <div className="flex flex-wrap items-center justify-center gap-4 max-w-xl mx-auto py-8">
              {allBoards.filter((board) => board.difficulty === selectedDifficulty).map((board, index) => {
                const isSolved = solvedLevelIds.includes(board.id);
                return (
                  <button
                    key={board.id}
                    onClick={() => loadBoard(board)}
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex flex-col items-center justify-center font-display font-black text-xl transition-all relative border-2 focus:outline-none cursor-pointer ${
                      isSolved
                        ? "bg-[#55efc4] text-[#00b894] border-[#00b894] shadow-[4px_4px_0px_#00b894] hover:scale-105 active:scale-95"
                        : "bg-white text-[#2d3436] border-[#dfe6e9] shadow-[4px_4px_0px_#dfe6e9] opacity-65 hover:opacity-100 hover:scale-105 active:scale-95"
                    }`}
                    id={`level-card-${board.id}`}
                    title={`Play Board ${index + 1}`}
                  >
                    <span>{index + 1}</span>
                    {isSolved && (
                      <span className="absolute bottom-1 text-[8px] font-mono leading-none uppercase font-black tracking-wider text-[#00b894]">
                        ✓ Solved
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: LIVE ACTIVE PLAYING GAMEBOARD VIEW                */}
        {/* ======================================================== */}
        {activeBoard && (
          <div className="w-full max-w-xl mx-auto flex flex-col items-center py-2" id="active-gameplay-view">
            
            {/* 1. Sleek, ultra-compact header above the board */}
            <div className="mb-3 text-center flex items-center justify-between px-2 font-mono font-black text-[13px] text-[#2d3436] max-w-sm" style={{ width: "min(94vw, 440px, 58vh)" }}>
              <span className="bg-[#2d3436] text-[#fdfcf0] px-2 py-0.5 rounded-lg text-[10px] tracking-wide uppercase font-black">
                {activeBoard.difficulty} Mode
              </span>
              <div className="flex items-center gap-1.5 bg-[#ffeaa7]/50 px-2.5 py-1 rounded-xl border-2 border-[#2d3436] shadow-[2px_2px_0px_#2d3436] font-mono leading-none">
                <Clock className="w-3.5 h-3.5 text-[#ff7675]" />
                <span className="tracking-tight text-xs font-black">{formatTime(elapsedSeconds)}</span>
              </div>
              <span className="text-[#636e72] text-[11px] uppercase tracking-wider font-extrabold flex items-center gap-1">
                ♕ {queens.length}/{activeBoard.size}
              </span>
            </div>



            {/* 2. Grid Box - Enlarged layout using optimal screen space */}
            <div 
              className="aspect-square border-4 border-[#2d3436] rounded-xl overflow-hidden bg-white shadow-[6px_6px_0px_#2d3436] flex items-center justify-center relative overscroll-none mx-auto"
              style={{
                width: "min(94vw, 440px, 58vh)",
                height: "min(94vw, 440px, 58vh)"
              }}
            >
              <div
                className="grid w-full h-full"
                style={{ gridTemplateColumns: `repeat(${activeBoard.size}, minmax(0, 1fr))` }}
                id="queens-playing-grid"
              >
                {gridState.map((rowArr, r) =>
                  rowArr.map((cellValue, c) => {
                    const regionId = activeBoard.grid[r][c];
                    const customBgStyle = activeBoard.colors ? { backgroundColor: activeBoard.colors[regionId % activeBoard.colors.length] } : {};
                    const pastelBg = activeBoard.colors ? "" : getPastelBgForRegion(regionId);
                    
                    // Calculate borders dynamically to make distinct thick divider lines
                    const hasTopBorder = r === 0 || activeBoard.grid[r][c] !== activeBoard.grid[r - 1][c];
                    const hasBottomBorder = r === activeBoard.size - 1 || activeBoard.grid[r][c] !== activeBoard.grid[r + 1][c];
                    const hasLeftBorder = c === 0 || activeBoard.grid[r][c] !== activeBoard.grid[r][c - 1];
                    const hasRightBorder = c === activeBoard.size - 1 || activeBoard.grid[r][c] !== activeBoard.grid[r][c + 1];

                    // Is this specific cell under conflict (touch violation)?
                    const isTouchingConflict = touchingQueensSet.has(`${r},${c}`);

                    // Is this cell in the same row or column as any conflicted queen in touchingQueensSet?
                    const underQueenRowColConflict = Array.from(touchingQueensSet).some((key) => {
                      const [qr, qc] = key.split(",").map(Number);
                      return r === qr || c === qc;
                    });

                    // Is this cell in a row or column that is fully filled with dots (all-dots blockage conflict)?
                    const isRowColBlockedConflict = blockedRows.includes(r) || blockedCols.includes(c);

                    // Combined red pulsing warning state for this cell
                    const isCellInConflictState = underQueenRowColConflict || isRowColBlockedConflict;

                    // Is shadowed (dimmed/excluded) by placed queens?
                    const isBlockedShadow = shadowedCells.has(`${r},${c}`);

                    // Is active hint target?
                    const isHintTarget = activeHintCell && activeHintCell.r === r && activeHintCell.c === c;

                    return (
                      <div
                        key={`${r}-${c}`}
                        className={`aspect-square relative cursor-pointer select-none flex items-center justify-center transition-all ${pastelBg}`}
                        style={{
                          ...customBgStyle,
                          borderTopWidth: hasTopBorder ? "3px" : "0.5px",
                          borderBottomWidth: hasBottomBorder ? "3px" : "0.5px",
                          borderLeftWidth: hasLeftBorder ? "3px" : "0.5px",
                          borderRightWidth: hasRightBorder ? "3px" : "0.5px",
                          borderTopColor: hasTopBorder ? "#ffffff" : "rgba(45, 52, 54, 0.12)",
                          borderBottomColor: hasBottomBorder ? "#ffffff" : "rgba(45, 52, 54, 0.12)",
                          borderLeftColor: hasLeftBorder ? "#ffffff" : "rgba(45, 52, 54, 0.12)",
                          borderRightColor: hasRightBorder ? "#ffffff" : "rgba(45, 52, 54, 0.12)",
                        }}
                        onClick={() => handleCellLeftClick(r, c)}
                        onContextMenu={(e) => handleCellRightClick(e, r, c)}
                        id={`cell-${r}-${c}`}
                      >
                        {/* Blocked Shadow Background dimming */}
                        {isBlockedShadow && cellValue === "" && (
                          <div className="absolute inset-0 bg-[#2d3436]/[0.055] pointer-events-none flex items-center justify-center">
                            {/* Under Vibrant Palette style, dimmed blocked cells display a clean center dot */}
                            <span className="text-xl text-[#2d3436]/15 scale-90 select-none">·</span>
                          </div>
                        )}

                        {/* Vibrant Pulse Error Overlay when cell is under row/col blockage or queen overlap conflict */}
                        {isCellInConflictState && (
                          <div className="absolute inset-0 bg-[#ff7675]/10 border-2 border-dashed border-[#ff7675]/45 animate-pulse pointer-events-none z-10" />
                        )}

                        {/* RENDERING DYNAMIC STATE CONTENT */}
                        {cellValue === "." && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ 
                              scale: 1,
                              x: isCellInConflictState ? [0, -3, 3, -3, 3, 0] : 0
                            }}
                            transition={{ 
                              scale: { duration: 0.1 },
                              x: { repeat: isCellInConflictState ? Infinity : 0, duration: 0.4 }
                            }}
                            className={`w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 rounded-full shadow-inner ${
                              isCellInConflictState ? "bg-[#ff7675]" : "bg-[#2d3436]/75"
                            }`}
                          />
                        )}

                        {cellValue === "Q" && (
                          <motion.div
                            initial={{ scale: 0.2, rotate: -30 }}
                            animate={{ 
                              scale: 1, 
                              rotate: 0,
                              transform: isTouchingConflict ? ["scale(1) translateY(0px)", "scale(1.05) translateY(-2px)", "scale(1) translateY(0px)"] : "scale(1)"
                            }}
                            transition={{ 
                              scale: { type: "spring", stiffness: 220, damping: 15 },
                              transform: { repeat: isTouchingConflict ? Infinity : 0, duration: 0.4 }
                            }}
                            className={`relative w-full h-full flex items-center justify-center ${
                              isTouchingConflict 
                                ? "bg-[#ff7675]/15 animate-pulse" 
                                : ""
                            }`}
                          >
                            <span 
                              className={`text-xl sm:text-2xl font-black select-none leading-none ${
                                isTouchingConflict ? "text-[#ff7675]" : "text-[#2d3436]"
                              }`}
                            >
                              ♕
                            </span>

                            {/* Alert Ring for touching queens */}
                            {isTouchingConflict && (
                              <span className="absolute inset-1 border-2 border-[#ff7675] rounded-full animate-ping pointer-events-none" />
                            )}
                          </motion.div>
                        )}

                        {/* Pulsing Hint Target overlay */}
                        {isHintTarget && (
                          <div className="absolute inset-0.5 border-2 border-dashed border-[#ff7675] rounded bg-[#ff7675]/10 flex items-center justify-center animate-pulse-ring pointer-events-none z-10">
                            <span className="text-xl text-[#ff7675] font-black leading-none origin-center scale-110">?</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 3. Bottom Action Controls row directly underneath the board (with Hint, Undo, Restart) */}
            <div className="w-full mt-6 grid grid-cols-3 items-center px-3" style={{ width: "min(94vw, 440px, 58vh)" }}>
              {/* Back to list - Col 1: Left */}
              <div className="justify-self-start">
                <button
                  onClick={resetToLevelsList}
                  className="w-12 h-12 rounded-full bg-white border-4 border-[#2d3436] flex items-center justify-center text-[#2d3436] hover:bg-[#dfe6e9]/40 shadow-[3px_3px_0px_#2d3436] hover:translate-y-[-2px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#2d3436] transition-all cursor-pointer focus:outline-none"
                  title="Back to Levels list"
                  id="level-back-to-list-btn"
                >
                  <ChevronLeft className="w-6 h-6 stroke-[3]" />
                </button>
              </div>

              {/* Game Actions Group - Col 2: Center */}
              <div className="justify-self-center flex items-center gap-4">
                {/* Undo Button */}
                <button
                  onClick={handleUndo}
                  disabled={history.length === 0 || isCompleted}
                  className={`w-12 h-12 rounded-full border-2 sm:border-4 border-[#2d3436] flex items-center justify-center transition-all focus:outline-none relative ${
                    history.length > 0 && !isCompleted
                      ? "bg-[#74b9ff] text-[#2d3436] hover:bg-[#74b9ff]/80 shadow-[3px_3px_0px_#2d3436] hover:scale-105 hover:translate-y-[-2px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#2d3436] cursor-pointer"
                      : "bg-[#74b9ff]/10 text-[#2d3436]/20 border-[#2d3436]/15 cursor-not-allowed"
                  }`}
                  title="Undo last action"
                  id="undo-btn"
                >
                  <RotateCcw className="w-6 h-6 -scale-x-100 stroke-[3]" />
                </button>

                {/* Hint Button */}
                <button
                  onClick={handleGetHint}
                  disabled={remainingHints <= 0 || isCompleted}
                  className={`w-12 h-12 rounded-full border-2 sm:border-4 border-[#2d3436] flex items-center justify-center transition-all focus:outline-none relative ${
                    remainingHints > 0 && !isCompleted
                      ? "bg-[#fdcb6e] text-[#2d3436] hover:bg-[#fdcb6e]/80 shadow-[3px_3px_0px_#2d3436] hover:scale-105 hover:translate-y-[-2px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#2d3436] cursor-pointer animate-pulse"
                      : "bg-[#fdcb6e]/10 text-[#2d3436]/20 border-[#2d3436]/15 cursor-not-allowed"
                  }`}
                  title={`Get placement hint (${remainingHints} left)`}
                  id="hint-board-btn"
                >
                  <Sparkles className="w-6 h-6 stroke-[2.5]" />
                  {/* Badge representing hints count */}
                  {remainingHints > 0 && !isCompleted && (
                    <span className="absolute -top-1.5 -right-1.5 bg-[#ff7675] text-[#2d3436] text-[10px] font-mono font-black w-5 h-5 rounded-full border-2 border-[#2d3436] flex items-center justify-center shadow-md">
                      {remainingHints}
                    </span>
                  )}
                </button>

                {/* Restart Button */}
                <button
                  onClick={handleRestartBoard}
                  className="w-12 h-12 rounded-full bg-[#ff7675] border-2 sm:border-4 border-[#2d3436] flex items-center justify-center text-[#2d3436] hover:bg-[#ff7675]/80 shadow-[3px_3px_0px_#2d3436] hover:scale-105 hover:translate-y-[-2px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#2d3436] transition-all focus:outline-none cursor-pointer group"
                  title="Restart this board completely"
                  id="restart-board-btn"
                >
                  <RefreshCw className="w-6 h-6 stroke-[2.5] group-hover:rotate-180 transition-transform duration-500" />
                </button>
              </div>

              {/* Symmetrical Spacer - Col 3: Right */}
              <div className="w-12 h-12 justify-self-end invisible" />
            </div>

          </div>
        )}
          </>
        )}

      </main>

      {/* FOOTER */}
      {!selectedDifficulty}

      {selectedDifficulty && !activeBoard}

      {/* ======================================================== */}
      {/* GLOBAL OVERLAYS: TUTORIAL & SUCCESS POPUPS               */}
      {/* ======================================================== */}
      <Tutorial isOpen={showTutorial} onClose={() => setShowTutorial(false)} />

      {activeBoard && isCompleted && (
        <SuccessCelebration
          elapsedSeconds={elapsedSeconds}
          movesCount={movesCount}
          levelName={`Board ${activeBoard.id.replace("-", " ")}`}
          hasWithNextLevel={
            allBoards.findIndex((b) => b.id === activeBoard.id) + 1 < allBoards.length &&
            allBoards[allBoards.findIndex((b) => b.id === activeBoard.id) + 1].difficulty === selectedDifficulty
          }
          onNextLevel={handleNextLevel}
          onRestart={handleRestartBoard}
          onMenu={resetToLevelsList}
        />
      )}
    </div>
  );
}
