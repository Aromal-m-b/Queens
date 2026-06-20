import React, { useState, useEffect, useRef } from "react";
import {
  X,
  ChevronLeft,
  Plus,
  Palette,
  Grid,
  Save,
  Lock,
  Unlock,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Edit2,
  Trash2,
  Sliders,
  CheckCircle2,
  Home
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Board } from "../data/boards";

interface AdminPortalProps {
  onClose: () => void;
  allBoards: Board[];
  onSaveBoards: (boards: Board[]) => void;
  playChime: (type: "dot" | "queen" | "clear" | "win" | "hint" | "error" | "click") => void;
}

const DEFAULT_PALETTES: { [key: number]: string[] } = {
  5: ["#26de81", "#fc5c65", "#45aaf2", "#a55eea", "#f7b731"],
  6: ["#26de81", "#fc5c65", "#45aaf2", "#a55eea", "#f7b731", "#fd79a8"],
  8: ["#26de81", "#fc5c65", "#45aaf2", "#a55eea", "#f7b731", "#fd79a8", "#2bcbba", "#ffeaa7"],
  10: ["#26de81", "#fc5c65", "#45aaf2", "#a55eea", "#f7b731", "#fd79a8", "#2bcbba", "#ffeaa7", "#a4b0be", "#fa8231"],
};

const ABSOLUTE_COLORS = [
  "#26de81", "#fc5c65", "#45aaf2", "#a55eea", "#f7b731", 
  "#fd79a8", "#2bcbba", "#ffeaa7", "#a4b0be", "#fa8231"
];

export default function AdminPortal({ onClose, allBoards, onSaveBoards, playChime }: AdminPortalProps) {
  // Login State
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Dashboard / Editor state
  const [adminDifficulty, setAdminDifficulty] = useState<"easy" | "medium" | "hard" | null>(null);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Editor Workspace states
  const [boardSize, setBoardSize] = useState<number>(6);
  const [grid, setGrid] = useState<number[][]>([]);
  const [solutionQueens, setSolutionQueens] = useState<{ r: number; c: number }[]>([]);
  const [paletteColors, setPaletteColors] = useState<string[]>([]);
  
  const [brushColorIdx, setBrushColorIdx] = useState<number>(0);
  const [editorMode, setEditorMode] = useState<"paint" | "queen">("paint");
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Shaking key on login error
  const [shakeKey, setShakeKey] = useState(0);

  // Restore session if previously logged in
  useEffect(() => {
    const sessionToken = sessionStorage.getItem("queens-admin-session");
    if (sessionToken === "authenticated-secure") {
      setIsLoggedIn(true);
    }
  }, []);

  // Handle Admin login credentials
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const envUser = (import.meta as any).env?.VITE_ADMIN_USERNAME || "admin";
    const envPass = (import.meta as any).env?.VITE_ADMIN_PASSWORD || "1234";
    if (username === envUser && password === envPass) {
      setIsLoggedIn(true);
      setLoginError(false);
      sessionStorage.setItem("queens-admin-session", "authenticated-secure");
      playChime("win");
    } else {
      setLoginError(true);
      setShakeKey(prev => prev + 1);
      playChime("error");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    sessionStorage.removeItem("queens-admin-session");
    setUsername("");
    setPassword("");
    setAdminDifficulty(null);
    setEditingBoard(null);
    playChime("clear");
  };

  // Setup workspace when adding/editing level
  const startNewBoard = (difficulty: "easy" | "medium" | "hard") => {
    const defaultSize = difficulty === "easy" ? 6 : difficulty === "medium" ? 8 : 10;
    setBoardSize(defaultSize);
    setIsCreatingNew(true);
    
    // Create uncolored grid (-1 means uncolored)
    const emptyGrid = Array(defaultSize).fill(null).map(() => Array(defaultSize).fill(-1));
    setGrid(emptyGrid);
    setSolutionQueens([]);
    
    // Initialize palette preset
    const presetColors = [...(DEFAULT_PALETTES[defaultSize] || ABSOLUTE_COLORS.slice(0, defaultSize))];
    setPaletteColors(presetColors);
    
    setBrushColorIdx(0);
    setEditorMode("paint");
    
    // Create new Board instance with next level number logic
    const nextNum = getNextLevelNumber(difficulty);
    const newBoard: Board = {
      id: `${difficulty}-${nextNum}`,
      difficulty,
      size: defaultSize,
      grid: emptyGrid,
      solution: [],
    };
    
    setEditingBoard(newBoard);
    playChime("click");
  };

  const startEditBoard = (board: Board) => {
    setIsCreatingNew(false);
    setBoardSize(board.size);
    
    // Copy grid and solution deeply
    setGrid(board.grid.map(row => [...row]));
    setSolutionQueens(board.solution.map(pt => ({ r: pt.r, c: pt.c })));
    
    // Palette setup
    const size = board.size;
    const currentColors = board.colors || DEFAULT_PALETTES[size] || ABSOLUTE_COLORS.slice(0, size);
    setPaletteColors([...currentColors]);
    
    setBrushColorIdx(0);
    setEditorMode("paint");
    setEditingBoard(board);
    playChime("click");
  };

  const deleteBoard = (targetBoard: Board) => {
    const remaining = allBoards.filter(b => b.id !== targetBoard.id);
    // Re-index remaining board IDs so they are sequential for play level numbers! This is exceptional care!
    const indexed = reIndexBoards(remaining, targetBoard.difficulty);
    onSaveBoards(indexed);
    playChime("clear");
  };

  const reIndexBoards = (boards: Board[], difficulty: "easy" | "medium" | "hard") => {
    let index = 1;
    return boards.map(b => {
      if (b.difficulty === difficulty) {
        const updated = {
          ...b,
          id: `${difficulty}-${index}`
        };
        index++;
        return updated;
      }
      return b;
    });
  };

  const getNextLevelNumber = (difficulty: "easy" | "medium" | "hard") => {
    const maxNum = allBoards
      .filter(b => b.difficulty === difficulty)
      .reduce((max, b) => {
        const parts = b.id.split("-");
        const val = parseInt(parts[parts.length - 1], 10);
        return isNaN(val) ? max : Math.max(max, val);
      }, 0);
    return maxNum + 1;
  };

  // When board size changes dynamically inside the editor
  const handleBoardSizeChange = (newSize: number) => {
    if (newSize < 5 || newSize > 10) return;
    setBoardSize(newSize);
    
    // Resize grid smoothly and keep center elements or create new filled/uncolored grid
    const emptyGrid = Array(newSize).fill(null).map(() => Array(newSize).fill(-1));
    setGrid(emptyGrid);
    setSolutionQueens([]);
    
    // Resize palette colors
    let nextPaletteColors = [...paletteColors];
    if (nextPaletteColors.length < newSize) {
      // Add standard default color items
      const defaultSample = DEFAULT_PALETTES[newSize] || ABSOLUTE_COLORS;
      for (let i = nextPaletteColors.length; i < newSize; i++) {
        nextPaletteColors.push(defaultSample[i % defaultSample.length]);
      }
    } else if (nextPaletteColors.length > newSize) {
      // Trim
      nextPaletteColors = nextPaletteColors.slice(0, newSize);
    }
    setPaletteColors(nextPaletteColors);
    
    if (brushColorIdx >= newSize) {
      setBrushColorIdx(0);
    }
    
    playChime("click");
  };

  // Color selection and customization
  const updatePaletteColor = (index: number, newHex: string) => {
    const copy = [...paletteColors];
    copy[index] = newHex;
    setPaletteColors(copy);
  };

  // Painting cells on grid
  const handleCellPaintOrQueen = (r: number, c: number) => {
    if (!editingBoard) return;
    
    if (editorMode === "paint") {
      const updated = grid.map((rowArr, ri) => 
        rowArr.map((val, ci) => (ri === r && ci === c ? brushColorIdx : val))
      );
      setGrid(updated);
      
      // If cell had a Queen, and color region changes, let's keep the queen but we must re-evaluate.
      // We can play a subtle click sound
      playChime("dot");
    } else {
      // Toggle solution Queen coordinates on this cell
      const existsIdx = solutionQueens.findIndex(q => q.r === r && q.c === c);
      if (existsIdx >= 0) {
        const updatedQueens = solutionQueens.filter((_, i) => i !== existsIdx);
        setSolutionQueens(updatedQueens);
        playChime("clear");
      } else {
        // Queens can only be toggled on if there are less than boardSize or toggled normally
        const updatedQueens = [...solutionQueens, { r, c }];
        setSolutionQueens(updatedQueens);
        playChime("queen");
      }
    }
  };

  // Drag to paint mouse handers
  const handleCellMouseEnter = (r: number, c: number) => {
    if (isMouseDown && editorMode === "paint") {
      const updated = grid.map((rowArr, ri) => 
        rowArr.map((val, ci) => (ri === r && ci === c ? brushColorIdx : val))
      );
      setGrid(updated);
    }
  };

  // Connection/contiguity BFS validator logic
  const checkRegionContiguity = (gridCopy: number[][], size: number): { [key: number]: boolean } => {
    const result: { [key: number]: boolean } = {};
    for (let cIdx = 0; cIdx < size; cIdx++) {
      const cells: { r: number; c: number }[] = [];
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (gridCopy[r]?.[c] === cIdx) {
            cells.push({ r, c });
          }
        }
      }
      
      if (cells.length === 0) {
        result[cIdx] = false;
        continue;
      }
      
      // BFS traversal of color node index components
      const visited = new Set<string>();
      const queue: { r: number; c: number }[] = [cells[0]];
      visited.add(`${cells[0].r},${cells[0].c}`);
      
      while (queue.length > 0) {
        const curr = queue.shift()!;
        const neighbors = [
          { r: curr.r - 1, c: curr.c },
          { r: curr.r + 1, c: curr.c },
          { r: curr.r, c: curr.c - 1 },
          { r: curr.r, c: curr.c + 1 },
        ];
        
        for (const n of neighbors) {
          if (n.r >= 0 && n.r < size && n.c >= 0 && n.c < size) {
            if (gridCopy[n.r]?.[n.c] === cIdx) {
              const key = `${n.r},${n.c}`;
              if (!visited.has(key)) {
                visited.add(key);
                queue.push(n);
              }
            }
          }
        }
      }
      
      result[cIdx] = visited.size === cells.length;
    }
    return result;
  };

  // Perform full Queens puzzle validations
  const validateLevel = () => {
    if (!editingBoard) {
      return {
        uncoloredCount: 0,
        contiguityMap: {},
        allContiguous: false,
        numQueens: 0,
        isCorrectNumQueens: false,
        rowQueenCounts: [],
        isExactlyOnePerRow: false,
        colQueenCounts: [],
        isExactlyOnePerCol: false,
        colorQueenCounts: [],
        isExactlyOnePerRegion: false,
        hasAdjacencyViolation: false,
        isValid: false
      };
    }

    let uncoloredCount = 0;
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        if (grid[r]?.[c] === -1 || grid[r]?.[c] === undefined) {
          uncoloredCount++;
        }
      }
    }

    const contiguityMap = checkRegionContiguity(grid, boardSize);
    const allContiguous = Object.values(contiguityMap).every(v => v) && Object.keys(contiguityMap).length === boardSize;

    const numQueens = solutionQueens.length;
    const isCorrectNumQueens = numQueens === boardSize;

    const rowQueenCounts = Array(boardSize).fill(0);
    const colQueenCounts = Array(boardSize).fill(0);
    const colorQueenCounts = Array(boardSize).fill(0);
    let hasAdjacencyViolation = false;

    solutionQueens.forEach((q1, i1) => {
      if (q1.r >= 0 && q1.r < boardSize) rowQueenCounts[q1.r]++;
      if (q1.c >= 0 && q1.c < boardSize) colQueenCounts[q1.c]++;
      
      const colId = grid[q1.r]?.[q1.c];
      if (colId !== undefined && colId >= 0 && colId < boardSize) {
        colorQueenCounts[colId]++;
      }

      solutionQueens.forEach((q2, i2) => {
        if (i1 === i2) return;
        const dr = Math.abs(q1.r - q2.r);
        const dc = Math.abs(q1.c - q2.c);
        if (dr <= 1 && dc <= 1) {
          hasAdjacencyViolation = true;
        }
      });
    });

    const isExactlyOnePerRow = rowQueenCounts.every(cnt => cnt === 1);
    const isExactlyOnePerCol = colQueenCounts.every(cnt => cnt === 1);
    const isExactlyOnePerRegion = colorQueenCounts.every(cnt => cnt === 1);

    const isValid = 
      uncoloredCount === 0 && 
      allContiguous && 
      isCorrectNumQueens && 
      isExactlyOnePerRow && 
      isExactlyOnePerCol && 
      isExactlyOnePerRegion && 
      !hasAdjacencyViolation;

    return {
      uncoloredCount,
      contiguityMap,
      allContiguous,
      numQueens,
      isCorrectNumQueens,
      rowQueenCounts,
      isExactlyOnePerRow,
      colQueenCounts,
      isExactlyOnePerCol,
      colorQueenCounts,
      isExactlyOnePerRegion,
      hasAdjacencyViolation,
      isValid
    };
  };

  const validationResult = validateLevel();

  // Save changes and return to admin levels
  const handleSaveLevel = () => {
    if (!editingBoard || !validationResult.isValid) return;

    const updatedBoard: Board = {
      ...editingBoard,
      size: boardSize,
      grid: grid.map(r => [...r]),
      solution: solutionQueens.map(pt => ({ r: pt.r, c: pt.c })),
      colors: paletteColors,
    };

    let nextBoards: Board[] = [];
    if (isCreatingNew) {
      // Append the new board to the current boards
      nextBoards = [...allBoards, updatedBoard];
    } else {
      // Replace existing board
      nextBoards = allBoards.map(b => b.id === updatedBoard.id ? updatedBoard : b);
    }

    onSaveBoards(nextBoards);
    playChime("win");
    setEditingBoard(null);
  };

  // Preset grids clearing
  const handleClearGrid = () => {
    const emptyGrid = Array(boardSize).fill(null).map(() => Array(boardSize).fill(-1));
    setGrid(emptyGrid);
    setSolutionQueens([]);
    playChime("clear");
  };

  // Color presets fill helper (for quick level designs!)
  const handleAutoFillRegions = () => {
    // Fill row-by-row or checker patterns to start them off or fill empty cells quickly
    const updatedGrid = grid.map((r, ri) => 
      r.map((cVal, ci) => {
        // Quick rows layout default
        return ri % boardSize;
      })
    );
    setGrid(updatedGrid);
    playChime("click");
  };

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center p-2 sm:p-4 text-[#2d3436]">
      
      {/* ======================================================== */}
      {/* FORM 1: ADMIN LOGIN PAGE                                 */}
      {/* ======================================================== */}
      {!isLoggedIn && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm mt-8 bg-white border-4 border-[#2d3436] rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_#2d3436]"
          id="admin-login-view"
        >
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-[#6c5ce7]/15 flex items-center justify-center mx-auto text-[#6c5ce7] font-black border-4 border-[#2d3436] shadow-sm mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="font-display font-black text-2xl text-[#2d3436]">Admin Portal</h2>
            <p className="text-xs text-[#b2bec3] font-bold tracking-widest uppercase mt-1">Authorized Access Only</p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-[#636e72] mb-1.5 font-mono">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full px-4 py-3 border-2 border-[#2d3436] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#6c5ce7]/20 font-bold transition-all"
                id="admin-user-input"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-[#636e72] mb-1.5 font-mono">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter 4-digit code"
                className="w-full px-4 py-3 border-2 border-[#2d3436] rounded-xl focus:outline-none focus:ring-4 focus:ring-[#6c5ce7]/20 font-bold transition-all tracking-widest text-[#2d3436]"
                id="admin-pass-input"
                required
              />
            </div>

            {/* Error shaker */}
            <AnimatePresence>
              {loginError && (
                <motion.div
                  key={shakeKey}
                  initial={{ x: -10 }}
                  animate={{ x: [0, -10, 10, -10, 10, 0] }}
                  transition={{ duration: 0.3 }}
                  className="bg-rose-50 border-2 border-[#ff7675] text-[#d63031] text-xs font-bold p-3 rounded-xl flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 text-[#ff7675]" />
                  <span>Invalid admin username or password!</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              className="w-full mt-4 py-3 bg-[#6c5ce7] text-white font-black border-2 border-[#2d3436] rounded-2xl shadow-[4px_4px_0px_#2d3436] hover:translate-y-[-2px] active:translate-y-[2px] active:shadow-[1px_1px_0px_#2d3436] transition-all cursor-pointer text-center focus:outline-none"
            >
              Sign In
            </button>
          </form>

          <button
            onClick={onClose}
            className="w-full mt-3 py-2.5 bg-white text-[#636e72] font-black border-2 border-[#dfe6e9] rounded-2xl hover:bg-gray-100 transition-all cursor-pointer text-sm text-center focus:outline-none"
          >
            Cancel and Return
          </button>
        </motion.div>
      )}

      {/* ======================================================== */}
      {/* VIEW 2: ADMIN LANDING DASHBOARD                          */}
      {/* ======================================================== */}
      {isLoggedIn && !editingBoard && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-2xl text-center py-4"
          id="admin-dashboard-view"
        >
          {/* Admin Header row */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-white border-4 border-[#2d3436] rounded-2xl p-4 shadow-[4px_4px_0px_#2d3436] text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#6c5ce7] flex items-center justify-center text-white font-black">
                ♕
              </div>
              <div>
                <h3 className="font-display font-black text-lg text-[#2d3436]">Welcome, Level Designer</h3>
                <p className="text-[10px] text-[#b2bec3] font-bold tracking-widest uppercase font-mono">Current system: localStorage Live Engine</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-white border-2 border-[#2d3436] rounded-xl hover:bg-gray-100 font-bold text-xs transition-all cursor-pointer focus:outline-none"
              >
                Exit Portal
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-1.5 bg-[#ff7675] text-white border-2 border-[#2d3436] rounded-xl font-bold text-xs shadow-[2px_2px_0px_#2d3436] hover:translate-y-[-1px] transition-all cursor-pointer focus:outline-none"
              >
                Log Out
              </button>
            </div>
          </div>

          {!adminDifficulty && (
            <div className="bg-white border-4 border-[#2d3436] rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_#2d3436] mb-6">
              <span className="text-5xl select-none mb-3 inline-block">🛠️</span>
              <h2 className="font-display font-black text-3xl text-[#2d3436] mb-1">Select Difficulty to Build</h2>
              <p className="text-sm font-semibold text-[#b2bec3] mb-6">Select a category below to list, edit, or add levels.</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* EASY VIEW CARRIER */}
                <button
                  onClick={() => { setAdminDifficulty("easy"); playChime("click"); }}
                  className="p-5 rounded-2xl bg-[#55efc4]/20 text-[#00b894] border-4 border-[#00b894] flex flex-col items-center justify-center hover:translate-y-[-3px] hover:bg-[#55efc4]/35 transition-all cursor-pointer"
                >
                  <span className="text-3xl mb-1">🌱</span>
                  <span className="font-display font-black text-xl text-[#00b894]">Easy Portal</span>
                  <span className="text-[10px] font-mono font-black mt-2 bg-[#00b894]/20 px-2 py-0.5 rounded-lg">
                    {allBoards.filter(b => b.difficulty === "easy").length} active
                  </span>
                </button>

                {/* MEDIUM VIEW CARRIER */}
                <button
                  onClick={() => { setAdminDifficulty("medium"); playChime("click"); }}
                  className="p-5 rounded-2xl bg-[#74b9ff]/20 text-[#0984e3] border-4 border-[#0984e3] flex flex-col items-center justify-center hover:translate-y-[-3px] hover:bg-[#74b9ff]/35 transition-all cursor-pointer"
                >
                  <span className="text-3xl mb-1">⚡</span>
                  <span className="font-display font-black text-xl text-[#0984e3]">Medium Portal</span>
                  <span className="text-[10px] font-mono font-black mt-2 bg-[#0984e3]/20 px-2 py-0.5 rounded-lg">
                    {allBoards.filter(b => b.difficulty === "medium").length} active
                  </span>
                </button>

                {/* HARD VIEW CARRIER */}
                <button
                  onClick={() => { setAdminDifficulty("hard"); playChime("click"); }}
                  className="p-5 rounded-2xl bg-[#a29bfe]/20 text-[#6c5ce7] border-4 border-[#6c5ce7] flex flex-col items-center justify-center hover:translate-y-[-3px] hover:bg-[#a29bfe]/35 transition-all cursor-pointer"
                >
                  <span className="text-3xl mb-1">🔥</span>
                  <span className="font-display font-black text-xl text-[#6c5ce7]">Hard Portal</span>
                  <span className="text-[10px] font-mono font-black mt-2 bg-[#6c5ce7]/20 px-2 py-0.5 rounded-lg">
                    {allBoards.filter(b => b.difficulty === "hard").length} active
                  </span>
                </button>
              </div>
            </div>
          )}

          {adminDifficulty && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border-4 border-[#2d3436] rounded-3xl p-6 shadow-[6px_6px_0px_#2d3436] text-left"
              id="admin-levels-list-view"
            >
              {/* Back to admin select */}
              <button
                onClick={() => { setAdminDifficulty(null); playChime("click"); }}
                className="flex items-center gap-1.5 text-xs text-[#636e72] font-black hover:text-[#2d3436] transition-colors uppercase tracking-wider mb-4 focus:outline-none cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Admin Difficulties
              </button>

              <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-gray-100">
                <div>
                  <h2 className="font-display font-black text-2xl capitalize text-[#2d3436]">
                    🛠️ {adminDifficulty} Level Packs
                  </h2>
                  <p className="text-xs text-[#b2bec3] font-bold">Edit defaults or add infinitely. Level lists auto-indexes orderly.</p>
                </div>

                <button
                  onClick={() => startNewBoard(adminDifficulty)}
                  className="px-4 py-2.5 bg-[#55efc4] text-[#00b894] font-black border-2 border-[#2d3436] rounded-xl flex items-center gap-2 shadow-[2px_2px_0px_#2d3436] hover:translate-y-[-1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#2d3436] transition-all cursor-pointer text-sm focus:outline-none"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  Add New Level
                </button>
              </div>

              {/* Levels cards grid for admin */}
              <div className="space-y-3">
                {allBoards.filter(b => b.difficulty === adminDifficulty).map((board, index) => {
                  return (
                    <div
                      key={board.id}
                      className="flex items-center justify-between border-2 border-[#dfe6e9] hover:border-[#2d3436] rounded-2xl p-4 bg-[#fdfcf0]/30 hover:bg-white transition-all shadow-sm"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[#2d3436] text-[#55efc4] font-display font-black text-lg flex items-center justify-center">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-sm font-black text-[#2d3436]">Level ID: {board.id}</div>
                          <div className="text-[10px] font-mono font-bold text-[#b2bec3] uppercase tracking-wider mt-0.5 flex gap-3 text-left">
                            <span>Grid size: {board.size}×{board.size}</span>
                            <span>Regions: {board.size}</span>
                            <span>Queens: {board.solution.length}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {deleteConfirmId === board.id ? (
                          <div className="flex items-center gap-1.5 animate-bounce-short">
                            <span className="text-[10px] font-black text-rose-500 mr-1 uppercase">Confirm?</span>
                            <button
                              onClick={() => {
                                deleteBoard(board);
                                setDeleteConfirmId(null);
                              }}
                              className="px-2.5 py-1.5 bg-[#ff7675] text-white border-2 border-[#2d3436] font-black rounded-lg text-[10px] tracking-wider uppercase transition-all shadow-[1px_1px_0px_#2d3436] hover:-translate-y-0.5 cursor-pointer focus:outline-none"
                            >
                              Yes, Delete
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-2.5 py-1.5 bg-white border-2 border-slate-300 text-slate-600 font-bold rounded-lg text-[10px] uppercase transition-all hover:bg-slate-50 cursor-pointer focus:outline-none"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditBoard(board)}
                              className="px-3.5 py-2.5 bg-white border-2 border-[#2d3436] hover:bg-gray-100 font-black rounded-lg text-xs tracking-wider uppercase transition-all flex items-center gap-1.5 cursor-pointer focus:outline-none"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#6c5ce7]" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => {
                                setDeleteConfirmId(board.id);
                                playChime("error");
                              }}
                              className="p-2.5 bg-rose-50 border-2 border-[#dfe6e9] hover:border-[#2d3436] hover:bg-[#ff7675]/10 font-bold rounded-lg transition-all cursor-pointer focus:outline-none"
                              title="Delete card"
                            >
                              <Trash2 className="w-4 h-4 text-[#ff7675]" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {allBoards.filter(b => b.difficulty === adminDifficulty).length === 0 && (
                  <div className="text-center py-10 bg-[#fbfcfc] border-2 border-dashed border-[#dfe6e9] rounded-2xl text-[#b2bec3] font-bold text-sm">
                    No levels exist in this group yet. Click Add New Level to build the first one!
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* ======================================================== */}
      {/* VIEW 3: RICH INTERACTIVE LEVEL BUILDER                   */}
      {/* ======================================================== */}
      {isLoggedIn && editingBoard && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full"
          id="admin-level-editor"
        >
          {/* Editor Header Grid */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-4 border-b-4 border-[#2d3436]">
            <div>
              <div className="flex items-center gap-2 text-xs text-[#b2bec3] font-black uppercase tracking-wider font-mono">
                <span>Admin Level Tool</span>
                <span>•</span>
                <span className="capitalize">{editingBoard.difficulty} Category</span>
              </div>
              <h2 className="font-display font-black text-3xl text-[#2d3436] mt-0.5 flex items-center gap-2 uppercase tracking-tight">
                {isCreatingNew ? `Add New Level ` : `Editing Level `}
                <span className="text-[#6c5ce7] font-mono">
                  ({isCreatingNew ? `${editingBoard.difficulty}-${getNextLevelNumber(editingBoard.difficulty)}` : editingBoard.id})
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAutoFillRegions}
                className="px-3.5 py-2.5 bg-[#74b9ff]/10 text-[#0984e3] hover:bg-[#74b9ff]/25 border-2 border-[#0984e3] font-bold rounded-xl text-xs transition-colors cursor-pointer"
                title="Quickly fill color regions row by row to ease the build"
              >
                ⚡ Fill Default Rows
              </button>
              <button
                onClick={() => handleClearGrid()}
                className="px-3.5 py-2.5 bg-slate-50 border-2 border-[#dfe6e9] hover:border-[#2d3436] font-bold rounded-xl text-xs transition-colors cursor-pointer"
                title="Reset/Uncolor all cells"
              >
                Clear Grid
              </button>
              <button
                onClick={() => setEditingBoard(null)}
                className="px-4 py-2.5 bg-white border-2 border-[#2d3436] font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                Discard & Back
              </button>
            </div>
          </div>

          {/* Builder Layout Workspace */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start w-full max-w-6xl mx-auto">
            
            {/* Sidebar Column 1: Tools (Paint/Queens) & Colors */}
            <div className="lg:col-span-3 bg-white border-4 border-[#2d3436] rounded-2xl p-4 shadow-[4px_4px_0px_#2d3436] flex flex-col justify-between">
              <div className="w-full">
                <div className="pb-3 border-b-2 border-[#dfe6e9] w-full mb-3">
                  <h4 className="font-black text-sm uppercase tracking-wider text-[#2d3436] flex items-center gap-1.5">
                    <Palette className="w-4 h-4 text-[#ff7675]" />
                    <span>Color Palette</span>
                  </h4>
                  <p className="text-[10px] text-[#b2bec3] font-bold tracking-widest uppercase mt-0.5">{boardSize} Regions configured</p>
                </div>

                {/* Palette Paint-Pot List displayed as a sleek vertical bar/rack */}
                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {paletteColors.slice(0, boardSize).map((hexValue, idx) => {
                    const isSelected = brushColorIdx === idx && editorMode === "paint";
                    return (
                      <div
                        key={idx}
                        onClick={() => { 
                          setBrushColorIdx(idx); 
                          setEditorMode("paint"); 
                          playChime("click"); 
                        }}
                        className={`p-2 rounded-xl border-2 transition-all flex items-center justify-between gap-2.5 cursor-pointer ${
                          isSelected
                            ? "bg-[#6c5ce7]/10 border-[#6c5ce7] shadow-[2px_2px_0px_#6c5ce7] -translate-y-0.5"
                            : "border-[#dfe6e9] hover:border-[#2d3436]"
                        }`}
                        title={`Select Region ${idx + 1} Color`}
                      >
                        <div className="flex items-center gap-2.5">
                          {/* Circular paint swatch button */}
                          <div
                            style={{ backgroundColor: hexValue }}
                            className="w-8 h-8 rounded-full border-2 border-[#2d3436] flex items-center justify-center text-white font-black text-xs shadow-inner"
                          >
                            {idx + 1}
                          </div>

                          <span className="font-bold text-xs text-[#2d3436]">Region {idx + 1}</span>
                        </div>

                        {/* Interactive custom color picker */}
                        <div className="relative w-7 h-7 bg-white border-2 border-[#2d3436] rounded-lg flex items-center justify-center overflow-hidden hover:scale-110 shadow-sm cursor-pointer transition-transform" title="Customize color hex">
                          <span className="text-xs select-none pointer-events-none">🎨</span>
                          <input
                            type="color"
                            value={hexValue}
                            onChange={(e) => updatePaletteColor(idx, e.target.value)}
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setBrushColorIdx(idx); 
                              setEditorMode("paint");
                            }}
                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mode Selection Tabs (Paint vs Queens Placing) */}
              <div className="pt-4 border-t-2 border-[#dfe6e9] flex flex-col gap-2 w-full mt-4">
                <button
                  onClick={() => { setEditorMode("paint"); playChime("click"); }}
                  className={`w-full py-2.5 px-3 rounded-xl border-2 border-[#2d3436] text-xs font-black tracking-wider uppercase transition-all cursor-pointer ${
                    editorMode === "paint"
                      ? "bg-[#2bcbba] text-white shadow-[2px_2px_0px_#2d3436]"
                      : "bg-[#fdfcf0]/40 text-[#2d3436] hover:bg-slate-50"
                  }`}
                >
                  🎨 Paint Regions
                </button>
                <button
                  onClick={() => { setEditorMode("queen"); playChime("click"); }}
                  className={`w-full py-2.5 px-3 rounded-xl border-2 border-[#2d3436] text-xs font-black tracking-wider uppercase transition-all cursor-pointer ${
                    editorMode === "queen"
                      ? "bg-[#fd79a8] text-white shadow-[2px_2px_0px_#2d3436]"
                      : "bg-[#fdfcf0]/40 text-[#2d3436] hover:bg-slate-50"
                  }`}
                >
                  ♕ Queens ({solutionQueens.length}/{boardSize})
                </button>
              </div>
            </div>

            {/* Sidebar Column 2: The Grid Workspace Canvas */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center">
              <div className="text-center font-bold font-mono text-[10px] text-[#b2bec3] uppercase tracking-wider mb-2">
                {editorMode === "paint" 
                  ? "🎨 Drag mouse / tap to paint region colors" 
                  : "👑 Tap cells to place exactly one queen per details"}
              </div>

              {/* Grid Box */}
              <div 
                className="aspect-square border-4 border-[#2d3436] rounded-2xl overflow-hidden bg-[#fafafa] shadow-[6px_6px_0px_#2d3436] flex items-center justify-center relative overscroll-none"
                style={{
                  width: "min(94vw, 400px, 52vh)",
                  height: "min(94vw, 400px, 52vh)"
                }}
                onMouseDown={() => setIsMouseDown(true)}
                onMouseUp={() => setIsMouseDown(false)}
                onMouseLeave={() => setIsMouseDown(false)}
                onTouchStart={() => setIsMouseDown(true)}
                onTouchEnd={() => setIsMouseDown(false)}
              >
                <div
                  className="grid w-full h-full"
                  style={{ gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))` }}
                  id="designer-grid"
                >
                  {grid.map((rowArr, r) =>
                    rowArr.map((colorId, c) => {
                      const isPainted = colorId !== -1;
                      const hasQueen = solutionQueens.some(q => q.r === r && q.c === c);
                      
                      // Calculate custom hex background from state
                      const hexColor = isPainted ? paletteColors[colorId % paletteColors.length] : "";
                      
                      // Border calculations to show regions nicely during edits
                      const hasTopBorder = r === 0 || grid[r][c] !== grid[r - 1][c];
                      const hasBottomBorder = r === boardSize - 1 || grid[r][c] !== grid[r + 1][c];
                      const hasLeftBorder = c === 0 || grid[r][c] !== grid[r][c - 1];
                      const hasRightBorder = c === boardSize - 1 || grid[r][c] !== grid[r][c + 1];

                      return (
                        <div
                          key={`${r}-${c}`}
                          className="aspect-square relative cursor-pointer select-none flex items-center justify-center transition-all"
                          style={{
                            backgroundColor: hexColor || "transparent",
                            borderWidth: "1px",
                            borderStyle: "solid",
                            borderColor: "rgba(45, 52, 54, 0.12)",
                            // Highlight regions dynamically
                            borderTopWidth: hasTopBorder ? "3px" : "1px",
                            borderBottomWidth: hasBottomBorder ? "3px" : "1px",
                            borderLeftWidth: hasLeftBorder ? "3px" : "1px",
                            borderRightWidth: hasRightBorder ? "3px" : "1px",
                            borderTopColor: hasTopBorder ? "#ffffff" : "rgba(45, 52, 54, 0.1)",
                            borderBottomColor: hasBottomBorder ? "#ffffff" : "rgba(45, 52, 54, 0.1)",
                            borderLeftColor: hasLeftBorder ? "#ffffff" : "rgba(45, 52, 54, 0.1)",
                            borderRightColor: hasRightBorder ? "#ffffff" : "rgba(45, 52, 54, 0.1)",
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleCellPaintOrQueen(r, c);
                          }}
                          onMouseEnter={() => handleCellMouseEnter(r, c)}
                          onTouchStart={() => handleCellPaintOrQueen(r, c)}
                        >
                          {/* Dotted uncoloured center helper */}
                          {!isPainted && !hasQueen && (
                            <span className="text-[#dfe6e9] text-sm">•</span>
                          )}

                          {/* Queen crown */}
                          {hasQueen && (
                            <motion.span
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="text-lg sm:text-xl font-black text-white drop-shadow-[1px_1.5px_0px_rgba(45,52,54,0.95)]"
                            >
                              ♕
                            </motion.span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Sidebar Column 3: Rules Validation & Action items */}
            <div className="lg:col-span-4 bg-white border-4 border-[#2d3436] rounded-2xl p-5 shadow-[4px_4px_0px_#2d3436] space-y-4 text-left">
              <div className="pb-3 border-b border-gray-100">
                <h4 className="font-black text-sm uppercase tracking-wider text-[#2d3436]">
                  📋 Live Level Verification
                </h4>
                <p className="text-[10px] text-[#b2bec3] font-bold tracking-widest uppercase mt-0.5">Solve constraints checklist</p>
              </div>

              {/* Specific constraints checkmarks */}
              <div className="space-y-3">
                {/* 1. Fully colored */}
                <div className="flex items-start gap-2.5 text-xs">
                  <div className="mt-0.5">
                    {validationResult.uncoloredCount === 0 ? (
                      <span className="text-emerald-500 font-bold">✔️</span>
                    ) : (
                      <span className="text-rose-500 font-bold">❌</span>
                    )
                    }
                  </div>
                  <div>
                    <div className="font-bold text-[#2d3436]">All Cells Colored</div>
                    <p className="text-[10px] text-[#a4b0be] font-bold transition-all mt-0.5">
                      {validationResult.uncoloredCount === 0 
                        ? "Every grid cell is successfully mapped to a region color" 
                        : `${validationResult.uncoloredCount} cells are still uncolored (white)`}
                    </p>
                  </div>
                </div>

                {/* 2. Connected/Contiguous Regions */}
                <div className="flex items-start gap-2.5 text-xs">
                  <div className="mt-0.5">
                    {validationResult.allContiguous ? (
                      <span className="text-emerald-500 font-bold">✔️</span>
                    ) : (
                      <span className="text-rose-500 font-bold">❌</span>
                    )
                    }
                  </div>
                  <div>
                    <div className="font-bold text-[#2d3436]">Regions Contiguous (Connected)</div>
                    <p className="text-[10px] text-[#a4b0be] font-bold transition-all mt-0.5">
                      {validationResult.allContiguous 
                        ? "Each region forms a single orthogonally contiguous component" 
                        : "One or more colors are split into disconnected islands!"}
                    </p>
                  </div>
                </div>

                {/* 3. Exactly N Queens */}
                <div className="flex items-start gap-2.5 text-xs">
                  <div className="mt-0.5">
                    {validationResult.isCorrectNumQueens ? (
                      <span className="text-emerald-500 font-bold">✔️</span>
                    ) : (
                      <span className="text-rose-500 font-bold">❌</span>
                    )
                    }
                  </div>
                  <div>
                    <div className="font-bold text-[#2d3436]">Placed Queens count matches Sizing</div>
                    <p className="text-[10px] text-[#a4b0be] font-bold transition-all mt-0.5">
                      {validationResult.isCorrectNumQueens 
                        ? `Loaded exactly ${boardSize}/${boardSize} Queens` 
                        : `Placed coordinates count counts: ${validationResult.numQueens}/${boardSize}`}
                    </p>
                  </div>
                </div>

                {/* 4. Orthogonal/Diagonal touches */}
                <div className="flex items-start gap-2.5 text-xs">
                  <div className="mt-0.5">
                    {!validationResult.hasAdjacencyViolation ? (
                      <span className="text-emerald-500 font-bold">✔️</span>
                    ) : (
                      <span className="text-rose-500 font-bold">❌</span>
                    )
                    }
                  </div>
                  <div>
                    <div className="font-bold text-[#2d3436]">No Adjacent Queen Touching</div>
                    <p className="text-[10px] text-[#a4b0be] font-bold transition-all mt-0.5">
                      {!validationResult.hasAdjacencyViolation 
                        ? "No two solution queens touch orthogonally or diagonally" 
                        : "Violations spotted: 2 or more solution queens are side by side!"}
                    </p>
                  </div>
                </div>

                {/* 5. Row + Col + Color constraints */}
                <div className="flex items-start gap-2.5 text-xs">
                  <div className="mt-0.5">
                    {(validationResult.isExactlyOnePerRow && validationResult.isExactlyOnePerCol && validationResult.isExactlyOnePerRegion) ? (
                      <span className="text-emerald-500 font-bold">✔️</span>
                    ) : (
                      <span className="text-rose-500 font-bold">❌</span>
                    )
                    }
                  </div>
                  <div>
                    <div className="font-bold text-[#2d3436]">Exactly 1 Queen per Row, Col & Region</div>
                    <p className="text-[10px] text-[#a4b0be] font-bold transition-all mt-0.5">
                      Row check: {validationResult.isExactlyOnePerRow ? "OK" : "Error"} • Col check: {validationResult.isExactlyOnePerCol ? "OK" : "Error"} • Color region check: {validationResult.isExactlyOnePerRegion ? "OK" : "Error"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status and Actions Panel */}
              <div className="pt-4 border-t border-gray-100 flex flex-col gap-2.5">
                <button
                  onClick={handleSaveLevel}
                  disabled={!validationResult.isValid}
                  className={`w-full py-3 rounded-2xl font-black border-2 border-[#2d3436] transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none ${
                    validationResult.isValid
                      ? "bg-[#55efc4] text-[#00b894] shadow-[4px_4px_0px_#2d3436] hover:translate-y-[-2px] hover:shadow-[5px_5px_0px_#2d3436] active:translate-y-[1px] active:shadow-[1px_1px_0px_#2d3436]"
                      : "bg-[#f1f2f6] text-[#b2bec3] border-[#dfe6e9] opacity-60 cursor-not-allowed"
                  }`}
                  id="editor-save-btn"
                >
                  <Save className="w-5 h-5" />
                  <span>{isCreatingNew ? "Save & Create Level" : "Save Changes"}</span>
                </button>

                {!validationResult.isValid && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold rounded-lg flex items-start gap-1.5 leading-normal">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <span>Before you can publish your level, the puzzle must pass all verification tests. Design color regions and place valid solution queens.</span>
                  </div>
                )}

                {validationResult.isValid && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold rounded-lg flex items-center gap-1.5 leading-none">
                    <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Excellent! The board configuration is fully solved and ready to publish.</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        </motion.div>
      )}

    </div>
  );
}
