import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Upload,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Hourglass,
  Sliders,
  BarChart4,
  Clock,
  Search,
  ChevronLeft,
  ChevronRight,
  Activity
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface BoardRecord {
  id: string;
  size: number;
  grid: string; // "0,0,1,1;2,0,1,3..."
  solution: string; // "0-2;1-4..."
}

interface PlacementStat {
  placementIdx: number;
  placement: number[];
  explored: number;
  accepted: number;
  rejectedMultiSolution: number;
  rejectedDuplicate: number;
  exhausted: boolean;
  targetReached: boolean;
}

interface GeneratorState {
  N: number;
  placements: number[][];
  placementIdx: number;
  cellsToAssign: { r: number; c: number }[];
  cellIdx: number;
  grid: number[][];
  triedRegionsStack: number[][];
  boardsChecked: number;
  validBoardsFound: number;
  uniqueCanonicalGrids: string[];
  uniqueCanonicalGridsSet?: Set<string>;
  generatedBoards: BoardRecord[];
  lastFoundUniqueGrid?: number[][];
  lastFoundUniquePlacement?: number[];
  hasNewUniqueFound?: boolean;
  generationMode?: "single" | "all";
  placementStats?: PlacementStat[];
  isFirstStepInPlacement?: boolean;
}

const PALETTE = [
  "#26de81", "#fc5c65", "#45aaf2", "#a55eea", "#f7b731",
  "#fd79a8", "#2bcbba", "#ffeaa7", "#a4b0be", "#fa8231",
  "#4b7bec", "#2d98da", "#a55eea", "#f7b731", "#fc5c65"
];

// Pre-allocated typed arrays to prevent garbage collection and memory leak crashes
const visitedArr = new Uint8Array(121); // Max size 10x10 is 100, 121 is safe
const queueR = new Int32Array(121);
const queueC = new Int32Array(121);

// Helper to check partial reachability for pruning
function checkPartialReachability(grid: number[][], placement: number[]): boolean {
  const N = grid.length;
  
  for (let k = 0; k < N; k++) {
    const seedR = k;
    const seedC = placement[k];
    
    let assignedCount = 0;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (grid[r][c] === k) assignedCount++;
      }
    }
    
    if (assignedCount === 1) continue; // Just the seed
    
    // Clear visited state for N*N cells
    const cellCount = N * N;
    for (let i = 0; i < cellCount; i++) {
      visitedArr[i] = 0;
    }
    
    visitedArr[seedR * N + seedC] = 1;
    queueR[0] = seedR;
    queueC[0] = seedC;
    let visitedAssignedCount = 1;
    
    let head = 0;
    let tail = 1;
    
    while (head < tail) {
      const r = queueR[head];
      const c = queueC[head];
      head++;
      
      // Checking 4-neighbors manually for ultimate performance and zero arrays allocation
      // Up
      if (r > 0) {
        const nr = r - 1;
        const idx = nr * N + c;
        if (visitedArr[idx] === 0) {
          const val = grid[nr][c];
          if (val === k || val === -1) {
            visitedArr[idx] = 1;
            queueR[tail] = nr;
            queueC[tail] = c;
            tail++;
            if (val === k) visitedAssignedCount++;
          }
        }
      }
      // Down
      if (r < N - 1) {
        const nr = r + 1;
        const idx = nr * N + c;
        if (visitedArr[idx] === 0) {
          const val = grid[nr][c];
          if (val === k || val === -1) {
            visitedArr[idx] = 1;
            queueR[tail] = nr;
            queueC[tail] = c;
            tail++;
            if (val === k) visitedAssignedCount++;
          }
        }
      }
      // Left
      if (c > 0) {
        const nc = c - 1;
        const idx = r * N + nc;
        if (visitedArr[idx] === 0) {
          const val = grid[r][nc];
          if (val === k || val === -1) {
            visitedArr[idx] = 1;
            queueR[tail] = r;
            queueC[tail] = nc;
            tail++;
            if (val === k) visitedAssignedCount++;
          }
        }
      }
      // Right
      if (c < N - 1) {
        const nc = c + 1;
        const idx = r * N + nc;
        if (visitedArr[idx] === 0) {
          const val = grid[r][nc];
          if (val === k || val === -1) {
            visitedArr[idx] = 1;
            queueR[tail] = r;
            queueC[tail] = nc;
            tail++;
            if (val === k) visitedAssignedCount++;
          }
        }
      }
    }
    
    if (visitedAssignedCount < assignedCount) {
      return false;
    }
  }
  
  return true;
}

// Backtracking solver to verify unique solution
function isUniqueSolution(grid: number[][]): boolean {
  const N = grid.length;
  let solutionsCount = 0;
  
  const colOccupied = Array(N).fill(false);
  const regionOccupied = Array(N).fill(false);
  const queenCols = Array(N).fill(-1);
  
  function solve(r: number) {
    if (solutionsCount > 1) return;
    
    if (r === N) {
      solutionsCount++;
      return;
    }
    
    for (let c = 0; c < N; c++) {
      if (colOccupied[c]) continue;
      const reg = grid[r][c];
      if (regionOccupied[reg]) continue;
      
      let adjacent = false;
      for (let prevR = 0; prevR < r; prevR++) {
        const prevC = queenCols[prevR];
        if (Math.abs(prevR - r) <= 1 && Math.abs(prevC - c) <= 1) {
          adjacent = true;
          break;
        }
      }
      if (adjacent) continue;
      
      colOccupied[c] = true;
      regionOccupied[reg] = true;
      queenCols[r] = c;
      
      solve(r + 1);
      
      colOccupied[c] = false;
      regionOccupied[reg] = false;
      queenCols[r] = -1;
    }
  }
  
  solve(0);
  return solutionsCount === 1;
}

// Canonical representation up to 8 symmetries and region renaming
function canonicalize(grid: number[][]): string {
  const N = grid.length;
  const mapping = new Map<number, number>();
  let nextId = 0;
  const canonical: number[] = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const val = grid[r][c];
      if (!mapping.has(val)) {
        mapping.set(val, nextId++);
      }
      canonical.push(mapping.get(val)!);
    }
  }
  return canonical.join(",");
}

function getUniqueRepresentative(grid: number[][]): string {
  // To allow each level (queen placement option) to have its own unique set of boards (e.g. 100 each),
  // and prevent cross-level duplication from discarding valid levels due to rotations/reflections
  // (which are distinct playable levels in the game with completely different queen solutions),
  // we define uniqueness based on the exact shape layout in its current orientation.
  return canonicalize(grid);
}

function generateQueenPlacements(N: number): number[][] {
  const placements: number[][] = [];
  const colOccupied = Array(N).fill(false);
  const current: number[] = [];
  
  function backtrack(r: number) {
    if (r === N) {
      placements.push([...current]);
      return;
    }
    for (let c = 0; c < N; c++) {
      if (colOccupied[c]) continue;
      if (r > 0 && Math.abs(current[r - 1] - c) <= 1) continue;
      
      colOccupied[c] = true;
      current.push(c);
      backtrack(r + 1);
      current.pop();
      colOccupied[c] = false;
    }
  }
  backtrack(0);
  return placements;
}

// Highly detailed state validation function to periodically or continuously verify backtracking invariants
function validateState(state: GeneratorState): void {
  if (!state) {
    throw new Error("Generator state is null or undefined.");
  }
  const N = state.N;
  if (typeof N !== "number" || N < 5 || N > 10) {
    throw new Error(`Invalid board size N: ${N}`);
  }
  if (!Array.isArray(state.placements) || state.placements.length === 0) {
    throw new Error("state.placements is empty or not an array.");
  }
  if (state.placementIdx >= state.placements.length) {
    // Terminal state: the search has completed successfully
    return;
  }
  if (state.placementIdx < 0) {
    throw new Error(`placementIdx out of bounds: ${state.placementIdx}`);
  }
  const placement = state.placements[state.placementIdx];
  if (!Array.isArray(placement) || placement.length !== N) {
    throw new Error(`Invalid placement at index ${state.placementIdx}`);
  }
  const cells = state.cellsToAssign;
  if (!Array.isArray(cells)) {
    throw new Error("state.cellsToAssign is not an array.");
  }
  const cellIdx = state.cellIdx;
  if (cellIdx === -1) {
    // Legitimate backtracking state when transitioning between placements
    return;
  }
  if (typeof cellIdx !== "number" || cellIdx < 0 || cellIdx > cells.length) {
    throw new Error(`cellIdx out of bounds: cellIdx = ${cellIdx}, cellsToAssign.length = ${cells.length}`);
  }
  if (!Array.isArray(state.grid) || state.grid.length !== N) {
    throw new Error(`Invalid grid row count: ${state.grid?.length}, expected ${N}`);
  }
  for (let r = 0; r < N; r++) {
    const row = state.grid[r];
    if (!Array.isArray(row) || row.length !== N) {
      throw new Error(`Invalid grid column count at row ${r}: ${row?.length}, expected ${N}`);
    }
    for (let c = 0; c < N; c++) {
      const val = row[c];
      if (typeof val !== "number" || val < -1 || val >= N) {
        throw new Error(`Invalid grid value at [${r}, ${c}]: ${val}`);
      }
    }
  }
  if (!Array.isArray(state.triedRegionsStack)) {
    throw new Error("triedRegionsStack is not an array.");
  }

  // Backtracking State Invariant 1: Any cells strictly after state.cellIdx must be unassigned (-1) in the grid
  for (let i = cellIdx + 1; i < cells.length; i++) {
    const cell = cells[i];
    if (state.grid[cell.r][cell.c] !== -1) {
      throw new Error(`Inconsistent backtracking state: cell at index ${i} (${cell.r}, ${cell.c}) has value ${state.grid[cell.r][cell.c]}, but expected -1 because cellIdx is currently ${cellIdx}`);
    }
  }

  // Backtracking State Invariant 2: triedRegionsStack entries strictly after state.cellIdx must be empty or undefined
  for (let i = cellIdx + 1; i < state.triedRegionsStack.length; i++) {
    const tried = state.triedRegionsStack[i];
    if (tried && tried.length > 0) {
      throw new Error(`Inconsistent triedRegionsStack: tried stack at index ${i} has length ${tried.length}, but expected empty because cellIdx is currently ${cellIdx}`);
    }
  }
}

export default function GeneratorPortal() {
  const [boardSize, setBoardSize] = useState<number>(6);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [status, setStatus] = useState<"idle" | "running" | "paused" | "completed">("idle");
  const [generationSpeed, setGenerationSpeed] = useState<number>(350); // Steps per tick
  const [alertMsg, setAlertMsg] = useState<{ text: string; type: "success" | "error" | "info" | null }>({ text: "", type: null });

  // Limit of unique boards per level
  const [boardsLimit, setBoardsLimit] = useState<number>(100);
  const boardsLimitRef = useRef<number>(100);
  useEffect(() => {
    boardsLimitRef.current = boardsLimit;
  }, [boardsLimit]);

  // Live Stats
  const [boardsChecked, setBoardsChecked] = useState<number>(0);
  const [validBoardsCount, setValidBoardsCount] = useState<number>(0);
  const [currentPlacementIdx, setCurrentPlacementIdx] = useState<number>(0);
  const [totalPlacements, setTotalPlacements] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [stepsPerSec, setStepsPerSec] = useState<number>(0);

  // Performance timings (last second averages in ms)
  const [stepDuration, setStepDuration] = useState<number>(0);
  const [reachabilityDuration, setReachabilityDuration] = useState<number>(0);
  const [uniquenessDuration, setUniquenessDuration] = useState<number>(0);

  // Live Grid & Active Solution representation
  const [liveGrid, setLiveGrid] = useState<number[][]>([]);
  const [activeSolution, setActiveSolution] = useState<number[]>([]);
  const [recentBoards, setRecentBoards] = useState<BoardRecord[]>([]);
  const [selectedPlacementIdx, setSelectedPlacementIdx] = useState<number>(0);
  const [generationMode, setGenerationMode] = useState<"single" | "all">("all");
  const [allGeneratedBoards, setAllGeneratedBoards] = useState<BoardRecord[]>([]);
  const [livePlacementStats, setLivePlacementStats] = useState<PlacementStat[]>([]);
  const [diagnosticsPage, setDiagnosticsPage] = useState<number>(0);
  const [diagnosticsSearch, setDiagnosticsSearch] = useState<string>("");

  // Generator internal state reference
  const genStateRef = useRef<GeneratorState | null>(null);
  const isRunningRef = useRef<boolean>(false);
  const stepCountRef = useRef<number>(0);
  const lastSecRef = useRef<number>(Date.now());
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUiUpdateRef = useRef<number>(0);

  // High-performance timer accumulators
  const timePerformStepRef = useRef<number>(0);
  const timeReachabilityRef = useRef<number>(0);
  const timeUniquenessRef = useRef<number>(0);
  const countPerformStepRef = useRef<number>(0);
  const countReachabilityRef = useRef<number>(0);
  const countUniquenessRef = useRef<number>(0);

  // Reusable Single AudioContext instance to prevent audio resource leaks
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Sound generator
  const playPulseSound = (freq = 600) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.015, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      // AudioContext blocked or not supported
    }
  };

  // Run the elapsed timer when running
  useEffect(() => {
    if (isRunning) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
        
        // Calculate steps per second
        const now = Date.now();
        const delta = (now - lastSecRef.current) / 1000;
        if (delta > 0) {
          setStepsPerSec(Math.round(stepCountRef.current / delta));
        }
        stepCountRef.current = 0;
        lastSecRef.current = now;

        // Compute performance averages over the last second
        if (countPerformStepRef.current > 0) {
          setStepDuration(timePerformStepRef.current / countPerformStepRef.current);
        } else {
          setStepDuration(0);
        }
        if (countReachabilityRef.current > 0) {
          setReachabilityDuration(timeReachabilityRef.current / countReachabilityRef.current);
        } else {
          setReachabilityDuration(0);
        }
        if (countUniquenessRef.current > 0) {
          setUniquenessDuration(timeUniquenessRef.current / countUniquenessRef.current);
        } else {
          setUniquenessDuration(0);
        }

        // Reset accumulators
        timePerformStepRef.current = 0;
        timeReachabilityRef.current = 0;
        timeUniquenessRef.current = 0;
        countPerformStepRef.current = 0;
        countReachabilityRef.current = 0;
        countUniquenessRef.current = 0;
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRunning]);

  // Pre-initialize generator state on mount so the user can interact with the level picker and see live grids instantly
  useEffect(() => {
    initializeState(boardSize, 0, generationMode);
  }, []);

  // Clean initialization of generator state
  const initializeState = (N: number, targetPlacementIdx?: number, targetMode?: "single" | "all") => {
    const placements = generateQueenPlacements(N);
    if (placements.length === 0) {
       showAlert(`No valid Queen placements found for size ${N}!`, "error");
       return null;
    }

    const mode = targetMode !== undefined ? targetMode : generationMode;
    const pIdx = targetPlacementIdx !== undefined ? targetPlacementIdx : selectedPlacementIdx;
    const safeIdx = pIdx >= 0 && pIdx < placements.length ? pIdx : 0;

    const state: GeneratorState = {
      N,
      placements,
      placementIdx: safeIdx,
      cellsToAssign: [],
      cellIdx: 0,
      grid: [],
      triedRegionsStack: [],
      boardsChecked: 0,
      validBoardsFound: 0,
      uniqueCanonicalGrids: [],
      uniqueCanonicalGridsSet: new Set<string>(),
      generatedBoards: [],
      generationMode: mode,
      placementStats: placements.map((p, idx) => ({
        placementIdx: idx,
        placement: p,
        explored: 0,
        accepted: 0,
        rejectedMultiSolution: 0,
        rejectedDuplicate: 0,
        exhausted: false,
        targetReached: false
      }))
    };

    // Populate initial configuration for safeIdx placement
    initializePlacementState(state);
    
    genStateRef.current = state;
    setBoardsChecked(0);
    setValidBoardsCount(0);
    setCurrentPlacementIdx(safeIdx);
    setTotalPlacements(placements.length);
    setLiveGrid(state.grid.map(row => [...row]));
    setActiveSolution(placements[safeIdx]);
    setRecentBoards([]);
    setAllGeneratedBoards([]);
    setLivePlacementStats(state.placementStats || []);
    setElapsedSeconds(0);
    setStepsPerSec(0);
    setStepDuration(0);
    setReachabilityDuration(0);
    setUniquenessDuration(0);
    stepCountRef.current = 0;
    lastSecRef.current = Date.now();

    return state;
  };

  const initializePlacementState = (state: GeneratorState) => {
    const N = state.N;
    const placement = state.placements[state.placementIdx];
    
    state.grid = Array(N).fill(null).map(() => Array(N).fill(-1));
    for (let k = 0; k < N; k++) {
      state.grid[k][placement[k]] = k;
    }
    
    // BFS-based ordering of cells to assign starting from the queen seeds.
    // This guarantees that every cell is adjacent to either a seed or a cell that
    // appeared earlier in the cellsToAssign array, completely preventing immediate
    // "Exhausted" terminations due to isolated cell assignments in static row-major order.
    state.cellsToAssign = [];
    const visited = Array(N).fill(null).map(() => Array(N).fill(false));
    const queue: { r: number; c: number }[] = [];
    
    // Mark all queen seeds as visited
    for (let k = 0; k < N; k++) {
      const r = k;
      const c = placement[k];
      visited[r][c] = true;
      queue.push({ r, c });
    }
    
    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      const r = curr.r;
      const c = curr.c;
      
      const neighbors = [
        { r: r - 1, c },
        { r: r + 1, c },
        { r, c: c - 1 },
        { r, c: c + 1 }
      ];
      
      for (const nb of neighbors) {
        if (nb.r >= 0 && nb.r < N && nb.c >= 0 && nb.c < N) {
          if (!visited[nb.r][nb.c]) {
            visited[nb.r][nb.c] = true;
            state.cellsToAssign.push({ r: nb.r, c: nb.c });
            queue.push({ r: nb.r, c: nb.c });
          }
        }
      }
    }
    
    state.cellIdx = 0;
    state.triedRegionsStack = [];
    state.triedRegionsStack[0] = [];
    state.isFirstStepInPlacement = true;

    // Output starting level diagnostics log
    const patternStr = placement.map((col, r) => `(${r},${col})`).join(" ");
    console.log(`Starting Level ${state.placementIdx + 1}`);
    console.log(`Placement: ${patternStr}`);
    console.log(`cellIdx = 0`);
    console.log(`cellsToAssign =`, state.cellsToAssign.map(cell => `(${cell.r},${cell.c})`).join(" "));
  };

  const showAlert = (text: string, type: "success" | "error" | "info") => {
    setAlertMsg({ text, type });
    setTimeout(() => {
      setAlertMsg({ text: "", type: null });
    }, 4000);
  };

  const getBoardsCountForPlacement = (state: GeneratorState, placementIdx: number): number => {
    const placement = state.placements[placementIdx];
    if (!placement) return 0;
    const solStr = placement.map((col, r) => `${r}-${col}`).join(";");
    return state.generatedBoards.filter(b => b.solution === solStr).length;
  };

  // Perform back-track step inside active loop
  const performStep = (state: GeneratorState): boolean => {
    try {
      if (state.placementIdx >= state.placements.length) {
        return false; // Done!
      }

      validateState(state);

      if (state.isFirstStepInPlacement) {
        console.log(`First call of performStep() for Level ${state.placementIdx + 1}`);
        state.isFirstStepInPlacement = false;
      }

      const N = state.N;
      const placement = state.placements[state.placementIdx];
      const cells = state.cellsToAssign;
      const cellIdx = state.cellIdx;

      stepCountRef.current++;

      // Completed region partition!
      if (cellIdx === cells.length) {
        state.boardsChecked = (state.boardsChecked || 0) + 1;

        const stat = state.placementStats ? state.placementStats[state.placementIdx] : null;
        if (stat) {
          stat.explored++;
        }
        
        // Solver verify uniqueness
        const uniqStart = performance.now();
        const isUnique = isUniqueSolution(state.grid);
        timeUniquenessRef.current += performance.now() - uniqStart;
        countUniquenessRef.current++;

        if (isUnique) {
          const canonical = getUniqueRepresentative(state.grid);
          if (!state.uniqueCanonicalGridsSet) {
            state.uniqueCanonicalGridsSet = new Set<string>(state.uniqueCanonicalGrids);
          }
          if (!state.uniqueCanonicalGridsSet.has(canonical)) {
            state.uniqueCanonicalGridsSet.add(canonical);
            state.uniqueCanonicalGrids.push(canonical);
            state.validBoardsFound = (state.validBoardsFound || 0) + 1;

            if (stat) {
              stat.accepted++;
            }
            
            const boardId = `gen-${N}-${state.validBoardsFound}`;
            const gridStr = state.grid.map(row => row.join(",")).join(";");
            const solutionStr = placement.map((col, r) => `${r}-${col}`).join(";");
            
            const newRecord: BoardRecord = {
              id: boardId,
              size: N,
              grid: gridStr,
              solution: solutionStr
            };
            
            state.generatedBoards.unshift(newRecord); // insert at start for recent view
            
            // Track unique board for high-performance direct paint
            state.lastFoundUniqueGrid = state.grid.map(row => [...row]);
            state.lastFoundUniquePlacement = [...placement];
            state.hasNewUniqueFound = true;
            
            // Trigger win sound
            playPulseSound(1100);

            // Check if we reached the target limit of unique boards for the current level (placement)
            const countForCurrent = getBoardsCountForPlacement(state, state.placementIdx);
            if (countForCurrent >= boardsLimitRef.current) {
              if (stat) {
                stat.targetReached = true;
              }
              if (state.generationMode === "all") {
                // Move to next placement
                state.placementIdx++;
                if (state.placementIdx < state.placements.length) {
                  initializePlacementState(state);
                  return true; // continue on new placement
                } else {
                  return false; // Done all levels!
                }
              } else {
                return false; // Done single level!
              }
            }
          } else {
            if (stat) {
              stat.rejectedDuplicate++;
            }
          }
        } else {
          if (stat) {
            stat.rejectedMultiSolution++;
          }
        }
        
        state.cellIdx = cellIdx - 1;
        return true;
      }

      const cell = cells[cellIdx];
      const r = cell.r;
      const c = cell.c;

      if (!state.triedRegionsStack[cellIdx]) {
        state.triedRegionsStack[cellIdx] = [];
      }

      const tried = state.triedRegionsStack[cellIdx];
      let nextRegion = -1;

      for (let k = 0; k < N; k++) {
        if (tried.includes(k)) continue;

        let isAdjacent = false;
        const seedC = placement[k];
        const seedR = k;
        
        if (Math.abs(seedR - r) + Math.abs(seedC - c) === 1) {
          isAdjacent = true;
        } else {
          const neighbors = [
            { r: r - 1, c },
            { r: r + 1, c },
            { r, c: c - 1 },
            { r, c: c + 1 }
          ];
          for (const nb of neighbors) {
            if (nb.r >= 0 && nb.r < N && nb.c >= 0 && nb.c < N) {
              if (state.grid[nb.r][nb.c] === k) {
                isAdjacent = true;
                break;
              }
            }
          }
        }

        if (isAdjacent) {
          nextRegion = k;
          break;
        }
      }

      if (nextRegion !== -1) {
        tried.push(nextRegion);
        state.grid[r][c] = nextRegion;

        // Partial reachability pruning check
        const reachStart = performance.now();
        const isReachable = checkPartialReachability(state.grid, placement);
        timeReachabilityRef.current += performance.now() - reachStart;
        countReachabilityRef.current++;

        if (isReachable) {
          state.cellIdx = cellIdx + 1;
          state.triedRegionsStack[state.cellIdx] = [];
        } else {
          state.grid[r][c] = -1; // invalid path, prune instantly
        }
      } else {
        state.grid[r][c] = -1;
        state.triedRegionsStack[cellIdx] = [];
        state.cellIdx = cellIdx - 1;

        if (state.cellIdx < 0) {
          const stat = state.placementStats ? state.placementStats[state.placementIdx] : null;
          if (stat) {
            stat.exhausted = true;
          }
          if (state.generationMode === "single") {
            return false; // Done with this specific level!
          }
          state.placementIdx++;
          if (state.placementIdx < state.placements.length) {
            initializePlacementState(state);
          }
        }
      }

      return true;
    } catch (error: any) {
      console.error("CRITICAL EXCEPTION IN QUEENS BACKTRACKING GENERATOR DETECTED!");
      console.error("Error Message:", error.message || error);
      console.error("Generator State Dump at point of failure:", {
        N: state.N,
        placementIdx: state.placementIdx,
        cellIdx: state.cellIdx,
        grid: state.grid ? state.grid.map(row => [...row]) : null,
        triedRegionsStack: state.triedRegionsStack ? state.triedRegionsStack.map(arr => arr ? [...arr] : []) : null,
        boardsChecked: state.boardsChecked,
        validBoardsFound: state.validBoardsFound,
        uniqueCanonicalGridsCount: state.uniqueCanonicalGrids?.length
      });

      // Stop the generator loop in the UI
      setIsRunning(false);
      isRunningRef.current = false;
      setStatus("paused");
      showAlert(`Generator Error: ${error.message || "Unknown error"}. Check DevTools Console.`, "error");

      // Developer debugging statement - will pause the browser developer tools execution
      debugger;

      // Rethrow to let the user's "Pause on uncaught exceptions" settings in Chrome trigger
      throw error;
    }
  };

  // Execution Loop logic
  const generatorLoop = () => {
    if (!isRunningRef.current || !genStateRef.current) return;

    const state = genStateRef.current;
    let hasMore = true;

    // Perform multiple steps in a single loop tick for performance, but cap it to 8ms to prevent UI frame-drops!
    const startTime = performance.now();
    try {
      for (let s = 0; s < generationSpeed; s++) {
        const stepStart = performance.now();
        hasMore = performStep(state);
        timePerformStepRef.current += performance.now() - stepStart;
        countPerformStepRef.current++;

        if (!hasMore) break;

        // Yield back to the browser's main thread if we exceed our 8ms frame budget
        if (performance.now() - startTime > 8) {
          break;
        }
      }
    } catch (err) {
      // Gracefully exit the loop when an exception/validation error occurs.
      // High-level state teardown, status update, and alert are already managed in the catch block of performStep.
      return;
    }

    // Refresh UI parameters - Throttled to prevent React re-render flooding crashes
    const now = Date.now();
    const shouldForceUpdate = !hasMore || state.hasNewUniqueFound;
    if (now - lastUiUpdateRef.current > 150 || shouldForceUpdate) {
      lastUiUpdateRef.current = now;
      setBoardsChecked(state.boardsChecked);
      setValidBoardsCount(state.validBoardsFound);
      setCurrentPlacementIdx(state.placementIdx);
      
      // Update the visual grid only when a unique puzzle is discovered OR upon completion,
      // which completely eliminates rendering lag and provides a satisfying reveal!
      if (state.lastFoundUniqueGrid) {
        setLiveGrid(state.lastFoundUniqueGrid.map(row => [...row]));
        if (state.lastFoundUniquePlacement) {
          setActiveSolution([...state.lastFoundUniquePlacement]);
        }
        state.hasNewUniqueFound = false; // reset flag
      } else if (!hasMore) {
        setLiveGrid(state.grid.map(row => [...row]));
        setActiveSolution(state.placements[state.placementIdx] || []);
      }
      
      setRecentBoards([...state.generatedBoards.slice(0, 8)]);
      setAllGeneratedBoards([...state.generatedBoards]);
      if (state.placementStats) {
        setLivePlacementStats([...state.placementStats]);
      }
    }

    if (hasMore) {
      requestAnimationFrame(generatorLoop);
    } else {
      setIsRunning(false);
      isRunningRef.current = false;
      setStatus("completed");
      if (state.generationMode === "single") {
        showAlert(`Completed generating boards for Level ${state.placementIdx + 1}!`, "success");
      } else {
        showAlert("Puzzle Generation Completed! All configurations successfully exhausted.", "success");
      }
      playPulseSound(1500);
    }
  };

  const handleStart = () => {
    let state = genStateRef.current;
    if (!state) {
      state = initializeState(boardSize, selectedPlacementIdx, generationMode);
    } else {
      state.generationMode = generationMode;
    }
    if (!state) return;

    // Check if the current level or subsequent levels have already reached the limit, and skip them if we are in "all" mode
    if (state.generationMode === "all") {
      let skippedCount = 0;
      while (state.placementIdx < state.placements.length && getBoardsCountForPlacement(state, state.placementIdx) >= boardsLimitRef.current) {
        const stat = state.placementStats ? state.placementStats[state.placementIdx] : null;
        if (stat) {
          stat.targetReached = true;
        }
        state.placementIdx++;
        skippedCount++;
        if (state.placementIdx < state.placements.length) {
          initializePlacementState(state);
        }
      }
      if (state.placementIdx >= state.placements.length) {
        showAlert("All levels have already reached the target unique boards limit!", "success");
        setStatus("completed");
        return;
      } else if (skippedCount > 0) {
        showAlert(`Skipped ${skippedCount} level(s) that already reached the limit of ${boardsLimitRef.current} boards.`, "info");
      }
    } else {
      // Single mode: check if current level reached limit
      if (getBoardsCountForPlacement(state, state.placementIdx) >= boardsLimitRef.current) {
        showAlert(`Selected Level ${state.placementIdx + 1} has already reached the target limit of ${boardsLimitRef.current} boards!`, "info");
        return;
      }
    }

    setIsRunning(true);
    isRunningRef.current = true;
    setStatus("running");
    showAlert("Generator started!", "success");
    playPulseSound(800);
    requestAnimationFrame(generatorLoop);
  };

  const handleStop = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    setStatus("paused");
    
    // Show current search path state immediately on stop
    const state = genStateRef.current;
    if (state) {
      setLiveGrid(state.grid.map(row => [...row]));
      setActiveSolution(state.placements[state.placementIdx] || []);
    }
    
    showAlert("Generator stopped. Current search path preserved.", "info");
    playPulseSound(500);
  };

  const handleReset = () => {
    setIsRunning(false);
    isRunningRef.current = false;
    setStatus("idle");
    initializeState(boardSize, selectedPlacementIdx, generationMode);
    showAlert("Generator reset.", "info");
  };

  const handleSizeChange = (newSize: number) => {
    if (isRunning) return;
    setBoardSize(newSize);
    setSelectedPlacementIdx(0);
    initializeState(newSize, 0, generationMode);
    showAlert(`Board size set to ${newSize}x${newSize}`, "info");
  };

  const handleSelectLevel = (idx: number) => {
    if (isRunning) {
      showAlert("Stop the generator before changing levels!", "error");
      return;
    }
    setSelectedPlacementIdx(idx);
    initializeState(boardSize, idx, generationMode);
    showAlert(`Selected Level ${idx + 1} for board size ${boardSize}x${boardSize}`, "info");
  };

  const handleSetGenerationMode = (mode: "single" | "all") => {
    if (isRunning) return;
    setGenerationMode(mode);
    const state = genStateRef.current;
    if (state) {
      state.generationMode = mode;
    }
  };

  // Export functions
  const handleDownloadCSV = () => {
    const state = genStateRef.current;
    if (!state || state.generatedBoards.length === 0) {
      showAlert("No boards generated yet! Start the generator first.", "error");
      return;
    }

    let csvContentText = "id,size,grid,solution\n";
    state.generatedBoards.forEach(b => {
      // Escape strings in double quotes
      csvContentText += `${b.id},${b.size},"${b.grid}","${b.solution}"\n`;
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvContentText;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const filename = `queens_puzzles_n${boardSize}.csv`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Save to server assets folder automatically
    fetch("/api/save-asset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, content: csvContentText })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showAlert(`CSV downloaded locally & saved to assets: ${filename}`, "success");
      } else {
        showAlert("CSV downloaded locally.", "success");
      }
    })
    .catch(err => {
      console.error("Failed to save asset:", err);
      showAlert("CSV downloaded locally.", "success");
    });
  };

  const handleDownloadResumeFile = () => {
    const state = genStateRef.current;
    if (!state) {
      showAlert("No generator state available.", "error");
      return;
    }

    const payload = JSON.stringify({
      N: state.N,
      placementIdx: state.placementIdx,
      cellIdx: state.cellIdx,
      grid: state.grid,
      triedRegionsStack: state.triedRegionsStack,
      boardsChecked: state.boardsChecked,
      validBoardsFound: state.validBoardsFound,
      uniqueCanonicalGrids: state.uniqueCanonicalGrids,
      generatedBoards: state.generatedBoards,
      boardsLimit, // Save current limit in checkpoint file
      elapsedSeconds,
      placementStats: state.placementStats
    }, null, 2);

    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const filename = `queens_resume_n${boardSize}_step_${state.boardsChecked}.json`;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Save to server assets folder automatically
    fetch("/api/save-asset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, content: payload })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        showAlert(`Resume file JSON saved to assets: ${filename}`, "success");
      } else {
        showAlert("Resume file JSON saved locally!", "success");
      }
    })
    .catch(err => {
      console.error("Failed to save resume asset:", err);
      showAlert("Resume file JSON saved locally!", "success");
    });
  };

  // Helper to parse CSV strings with double-quoted values (handles embedded commas and semicolons)
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentVal = "";

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        row.push(currentVal.trim());
        currentVal = "";
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // skip \n
        }
        row.push(currentVal.trim());
        if (row.length > 0 && row.some(cell => cell !== "")) {
          lines.push(row);
        }
        row = [];
        currentVal = "";
      } else {
        currentVal += char;
      }
    }
    if (currentVal !== "" || row.length > 0) {
      row.push(currentVal.trim());
      lines.push(row);
    }
    return lines;
  };

  // Import / Resume logic
  const handleUploadResumeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.N || typeof data.placementIdx !== "number" || !Array.isArray(data.generatedBoards)) {
          throw new Error("Invalid format. Missing crucial state variables.");
        }

        // Recreate placement arrays
        const placements = generateQueenPlacements(data.N);
        
        const state: GeneratorState = {
          N: data.N,
          placements,
          placementIdx: data.placementIdx,
          cellsToAssign: [], // will calculate below
          cellIdx: data.cellIdx,
          grid: data.grid,
          triedRegionsStack: data.triedRegionsStack,
          boardsChecked: data.boardsChecked || 0,
          validBoardsFound: data.validBoardsFound || 0,
          uniqueCanonicalGrids: data.uniqueCanonicalGrids || [],
          uniqueCanonicalGridsSet: new Set<string>(data.uniqueCanonicalGrids || []),
          generatedBoards: data.generatedBoards,
          placementStats: data.placementStats || placements.map((p, idx) => {
            const solStr = p.map((col, r) => `${r}-${col}`).join(";");
            const acceptedCount = data.generatedBoards.filter((b: any) => b.solution === solStr).length;
            return {
              placementIdx: idx,
              placement: p,
              explored: acceptedCount > 0 ? acceptedCount : 0,
              accepted: acceptedCount,
              rejectedMultiSolution: 0,
              rejectedDuplicate: 0,
              exhausted: false,
              targetReached: acceptedCount >= (data.boardsLimit || 100)
            };
          })
        };

        // Recalculate cells to assign
        const placement = placements[data.placementIdx];
        state.cellsToAssign = [];
        for (let r = 0; r < data.N; r++) {
          for (let c = 0; c < data.N; c++) {
            if (c !== placement[r]) {
              state.cellsToAssign.push({ r, c });
            }
          }
        }

        // Apply state
        genStateRef.current = state;
        setBoardSize(data.N);
        if (data.boardsLimit) {
          setBoardsLimit(data.boardsLimit);
        }
        setBoardsChecked(state.boardsChecked);
        setValidBoardsCount(state.validBoardsFound);
        setCurrentPlacementIdx(state.placementIdx);
        setTotalPlacements(placements.length);
        setLiveGrid(state.grid.map(row => [...row]));
        setActiveSolution(placements[state.placementIdx] || []);
        setRecentBoards([...state.generatedBoards.slice(0, 8)]);
        setAllGeneratedBoards([...state.generatedBoards]);
        setLivePlacementStats(state.placementStats || []);
        setElapsedSeconds(data.elapsedSeconds || 0);
        setStatus("paused");

        showAlert(`Successfully loaded state! Ready to resume at step ${state.boardsChecked}.`, "success");
        playPulseSound(1000);
      } catch (err: any) {
        showAlert(`Failed to load file: ${err.message}`, "error");
      }
    };
    reader.readAsText(file);
  };

  // Upload/merge existing CSV boards for unique checks & persistence
  const handleUploadCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvText = event.target?.result as string;
        const rows = parseCSV(csvText);
        if (rows.length < 2) {
          throw new Error("CSV file is empty or invalid.");
        }

        // Check header (lowercase to make robust)
        const header = rows[0].map(h => h.toLowerCase().trim());
        const idIdx = header.indexOf("id");
        const sizeIdx = header.indexOf("size");
        const gridIdx = header.indexOf("grid");
        const solutionIdx = header.indexOf("solution");

        if (idIdx === -1 || sizeIdx === -1 || gridIdx === -1 || solutionIdx === -1) {
          throw new Error("Missing required CSV columns (id, size, grid, solution).");
        }

        let state = genStateRef.current;
        if (!state) {
          const firstDataRow = rows[1];
          const initialSize = Number(firstDataRow[sizeIdx]) || boardSize;
          state = initializeState(initialSize, 0, generationMode);
        }
        if (!state) return;

        let importedCount = 0;
        let duplicateCount = 0;

        // Ensure unique set is ready
        if (!state.uniqueCanonicalGridsSet) {
          state.uniqueCanonicalGridsSet = new Set<string>(state.uniqueCanonicalGrids);
        }

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row.length < 4) continue;

          const id = row[idIdx];
          const size = Number(row[sizeIdx]);
          const gridStr = row[gridIdx];
          const solutionStr = row[solutionIdx];

          if (isNaN(size) || !gridStr || !solutionStr) continue;

          // Only import boards matching the current board size to avoid state pollution
          if (size !== state.N) {
            continue;
          }

          // Compute canonical form for uniqueness verification
          const gridRows = gridStr.split(";").map(r => r.split(",").map(Number));
          const canonical = getUniqueRepresentative(gridRows);

          if (state.uniqueCanonicalGridsSet.has(canonical)) {
            duplicateCount++;
            // Still ensure it is present in generatedBoards if it is not already
            const exists = state.generatedBoards.some(b => b.grid === gridStr);
            if (!exists) {
              state.generatedBoards.push({ id, size, grid: gridStr, solution: solutionStr });
            }
            continue;
          }

          state.uniqueCanonicalGridsSet.add(canonical);
          state.uniqueCanonicalGrids.push(canonical);
          state.generatedBoards.push({ id, size, grid: gridStr, solution: solutionStr });
          importedCount++;
        }

        state.validBoardsFound = state.uniqueCanonicalGrids.length;

        // Apply updated values to state and React states
        setBoardSize(state.N);
        setBoardsChecked(state.boardsChecked);
        setValidBoardsCount(state.validBoardsFound);
        setRecentBoards([...state.generatedBoards.slice(0, 8)]);
        setAllGeneratedBoards([...state.generatedBoards]);

        showAlert(`Successfully loaded CSV! Imported ${importedCount} new unique boards (${duplicateCount} duplicates skipped).`, "success");
        playPulseSound(1000);
      } catch (err: any) {
        showAlert(`Failed to parse CSV: ${err.message}`, "error");
      }
    };
    reader.readAsText(file);
  };

  const placements = React.useMemo(() => generateQueenPlacements(boardSize), [boardSize]);

  const levelBoardCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    allGeneratedBoards.forEach(b => {
      counts[b.solution] = (counts[b.solution] || 0) + 1;
    });
    return counts;
  }, [allGeneratedBoards]);

  // Diagnostics filtering and pagination
  const filteredStats = React.useMemo(() => {
    return livePlacementStats.filter(stat => {
      if (!diagnosticsSearch) return true;
      const searchLower = diagnosticsSearch.toLowerCase();
      const patternStr = stat.placement.map((col, r) => `(${r},${col})`).join(" ");
      const lvlNum = (stat.placementIdx + 1).toString();
      return patternStr.includes(searchLower) || lvlNum.includes(searchLower);
    });
  }, [livePlacementStats, diagnosticsSearch]);

  const DIAG_PAGE_SIZE = 6;
  const diagMaxPage = React.useMemo(() => {
    return Math.max(0, Math.ceil(filteredStats.length / DIAG_PAGE_SIZE) - 1);
  }, [filteredStats.length]);

  const paginatedStats = React.useMemo(() => {
    return filteredStats.slice(
      diagnosticsPage * DIAG_PAGE_SIZE,
      (diagnosticsPage + 1) * DIAG_PAGE_SIZE
    );
  }, [filteredStats, diagnosticsPage]);

  // Safe page navigation
  React.useEffect(() => {
    if (diagnosticsPage > diagMaxPage) {
      setDiagnosticsPage(Math.max(0, diagMaxPage));
    }
  }, [filteredStats.length, diagnosticsPage, diagMaxPage]);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-stretch gap-6 select-none text-[#2d3436]">
      
      {/* Alert Banner */}
      <AnimatePresence>
        {alertMsg.text && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`p-4 border-4 border-[#2d3436] rounded-2xl font-bold flex items-center gap-2.5 shadow-[4px_4px_0px_#2d3436] ${
              alertMsg.type === "success"
                ? "bg-[#55efc4]/20 text-[#00b894]"
                : alertMsg.type === "error"
                ? "bg-[#ff7675]/20 text-[#d63031]"
                : "bg-[#74b9ff]/20 text-[#0984e3]"
            }`}
          >
            {alertMsg.type === "success" ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
            <span className="text-sm font-semibold">{alertMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left column: Setup & Stats */}
        <div className="lg:col-span-4 bg-white border-4 border-[#2d3436] rounded-3xl p-5 shadow-[6px_6px_0px_#2d3436] flex flex-col gap-6">
          <div>
            <h3 className="font-display font-black text-xl tracking-tight mb-1 flex items-center gap-1.5 text-[#2d3436]">
              <Sliders className="w-5 h-5 text-[#6c5ce7]" />
              SETUP
            </h3>
            <p className="text-xs text-[#b2bec3] font-bold uppercase tracking-wider">Configure Constraints</p>
          </div>

          {/* Size Picker */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#636e72] mb-2 font-mono">
              Dimension (N Queens)
            </label>
            <div className="grid grid-cols-6 gap-1.5 bg-[#f1f2f6] p-1.5 border-2 border-[#2d3436] rounded-xl">
              {[5, 6, 7, 8, 9, 10].map(size => {
                const active = boardSize === size;
                return (
                  <button
                    key={size}
                    onClick={() => handleSizeChange(size)}
                    disabled={isRunning}
                    className={`py-2 text-xs font-black rounded-lg transition-all border-2 ${
                      active
                        ? "bg-[#6c5ce7] text-white border-[#2d3436] shadow-sm"
                        : "bg-white text-[#2d3436] border-transparent hover:border-[#b2bec3]/40 disabled:opacity-40"
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Speed slider */}
          <div>
            <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-[#636e72] mb-1 font-mono">
              <span>Backtrack Speed</span>
              <span className="text-[#6c5ce7]">{generationSpeed} steps/frame</span>
            </div>
            <input
              type="range"
              min="5"
              max="2000"
              step="5"
              value={generationSpeed}
              onChange={e => setGenerationSpeed(parseInt(e.target.value))}
              className="w-full accent-[#6c5ce7] cursor-pointer"
            />
          </div>

          {/* Target Boards Limit */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#636e72] mb-2 font-mono">
              Target Unique Boards Per Level
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="1"
                max="10000"
                disabled={isRunning}
                value={boardsLimit}
                onChange={e => {
                  const val = Math.max(1, parseInt(e.target.value) || 100);
                  setBoardsLimit(val);
                }}
                className="w-full bg-[#f1f2f6] border-2 border-[#2d3436] rounded-xl px-3 py-2 font-mono text-xs font-black focus:outline-none"
              />
              <span className="text-[10px] text-[#b2bec3] font-bold uppercase shrink-0">Boards</span>
            </div>
            <p className="text-[9px] text-[#b2bec3] font-semibold mt-1 uppercase">Limits generation per queen level to prevent exponential explosion</p>
          </div>

          {/* Core Status Block */}
          <div className="border-t-4 border-dashed border-[#f1f2f6] pt-4 mt-2 flex flex-col gap-3">
            <div>
              <h4 className="font-display font-black text-sm text-[#2d3436] flex items-center gap-1.5">
                <BarChart4 className="w-4 h-4 text-[#0984e3]" />
                GENERATOR STATS
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="bg-[#f1f2f6] p-2.5 rounded-xl border-2 border-[#2d3436]">
                <span className="text-[9px] font-black uppercase text-[#636e72] block">Status</span>
                <span className={`text-xs font-black uppercase block ${
                  status === "running" ? "text-emerald-500 animate-pulse" : status === "paused" ? "text-amber-500" : "text-[#2d3436]"
                }`}>
                  {status}
                </span>
              </div>

              <div className="bg-[#f1f2f6] p-2.5 rounded-xl border-2 border-[#2d3436] flex flex-col">
                <span className="text-[9px] font-black uppercase text-[#636e72] block">Time Spent</span>
                <span className="text-xs font-black text-[#2d3436] flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[#b2bec3]" />
                  {Math.floor(elapsedSeconds / 60)}m {elapsedSeconds % 60}s
                </span>
              </div>

              <div className="bg-[#f1f2f6] p-2.5 rounded-xl border-2 border-[#2d3436] col-span-2">
                <span className="text-[9px] font-black uppercase text-[#636e72] block">Valid Boards Found</span>
                <span className="text-xl font-black text-[#00b894]">
                  {validBoardsCount} <span className="text-xs font-normal text-[#b2bec3]">(unique)</span>
                </span>
              </div>

              <div className="bg-[#f1f2f6] p-2.5 rounded-xl border-2 border-[#2d3436] col-span-2">
                <span className="text-[9px] font-black uppercase text-[#636e72] block">Current Queen Placement</span>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-xs font-black text-[#6c5ce7]">
                    Perm {currentPlacementIdx + 1} / {totalPlacements}
                  </span>
                  <span className="text-[10px] font-black bg-[#6c5ce7]/10 text-[#6c5ce7] px-1.5 py-0.5 rounded-md">
                    {totalPlacements > 0 ? Math.round(((currentPlacementIdx + 1) / totalPlacements) * 100) : 0}%
                  </span>
                </div>
              </div>

              <div className="bg-[#f1f2f6] p-2.5 rounded-xl border-2 border-[#2d3436] col-span-2">
                <span className="text-[9px] font-black uppercase text-[#636e72] block">Search Progress Rate</span>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-xs font-black text-[#2d3436]">
                    {boardsChecked.toLocaleString()} partitions
                  </span>
                  <span className="text-[10px] font-black text-[#0984e3]">
                    {stepsPerSec.toLocaleString()} steps/s
                  </span>
                </div>
              </div>

              <div className="bg-[#f1f2f6] p-2.5 rounded-xl border-2 border-[#2d3436] col-span-2">
                <span className="text-[9px] font-black uppercase text-[#636e72] block">Profiler Timings (Last Sec Avg)</span>
                <div className="flex flex-col gap-1 mt-1 text-[10px]">
                  <div className="flex justify-between items-center">
                    <span className="text-[#636e72] font-semibold">performStep():</span>
                    <span className="font-bold text-[#2d3436]">{stepDuration > 0 ? `${stepDuration.toFixed(4)} ms` : "0.0000 ms"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#636e72] font-semibold">reachabilityPrune():</span>
                    <span className="font-bold text-[#2d3436]">{reachabilityDuration > 0 ? `${reachabilityDuration.toFixed(4)} ms` : "0.0000 ms"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#636e72] font-semibold">isUniqueSolution():</span>
                    <span className="font-bold text-[#2d3436]">{uniquenessDuration > 0 ? `${uniquenessDuration.toFixed(4)} ms` : "0.0000 ms"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center column: Live Lab Visualizer */}
        <div className="lg:col-span-5 bg-white border-4 border-[#2d3436] rounded-3xl p-5 shadow-[6px_6px_0px_#2d3436] flex flex-col items-center justify-between gap-6">
          <div className="w-full">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-display font-black text-xl tracking-tight mb-1 flex items-center gap-1.5 text-[#2d3436]">
                  <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                  LIVE GRAPH VISUALIZER
                </h3>
                <p className="text-xs text-[#b2bec3] font-bold uppercase tracking-wider">Partition Growth & Solver State</p>
              </div>
              {isRunning && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping mt-1" />
              )}
            </div>
          </div>

          {/* Interactive N x N Grid Preview */}
          <div className="w-full max-w-[320px] aspect-square border-4 border-[#2d3436] bg-[#2d3436] p-1.5 rounded-2xl shadow-sm relative">
            {liveGrid.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-[#b2bec3]">
                <Hourglass className="w-10 h-10 animate-spin text-[#6c5ce7] mb-2" />
                <span className="font-bold text-sm">Awaiting Start...</span>
              </div>
            ) : (
              <div
                className="grid gap-1 bg-[#2d3436] w-full h-full"
                style={{
                  gridTemplateColumns: `repeat(${boardSize}, minmax(0, 1fr))`
                }}
              >
                {liveGrid.map((rowArr, rIdx) => {
                  return rowArr.map((val, cIdx) => {
                    const isQueen = activeSolution[rIdx] === cIdx;
                    const regionColor = val !== -1 ? PALETTE[val % PALETTE.length] : "#ffffff";
                    return (
                      <div
                        key={`${rIdx}-${cIdx}`}
                        className="relative aspect-square rounded-lg flex items-center justify-center transition-all duration-150"
                        style={{
                          backgroundColor: regionColor
                        }}
                      >
                        {/* Custom inner layout border for partitions */}
                        <div className="absolute inset-[1px] bg-white/10 rounded-md pointer-events-none" />

                        {/* Partition border lines */}
                        {rIdx > 0 && liveGrid[rIdx - 1]?.[cIdx] !== val && (
                          <div className="absolute top-0 left-0 right-0 h-1 bg-black/30 pointer-events-none" />
                        )}
                        {cIdx > 0 && liveGrid[rIdx]?.[cIdx - 1] !== val && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-black/30 pointer-events-none" />
                        )}
                        {rIdx < boardSize - 1 && liveGrid[rIdx + 1]?.[cIdx] !== val && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/30 pointer-events-none" />
                        )}
                        {cIdx < boardSize - 1 && liveGrid[rIdx]?.[cIdx + 1] !== val && (
                          <div className="absolute right-0 top-0 bottom-0 w-1 bg-black/30 pointer-events-none" />
                        )}

                        {isQueen && (
                          <span className="text-base sm:text-lg font-black drop-shadow-md select-none animate-[bounce_1.5s_infinite]">
                            👑
                          </span>
                        )}
                      </div>
                    );
                  });
                })}
              </div>
            )}
          </div>

          {/* Controller buttons */}
          <div className="w-full flex flex-wrap gap-2 justify-center">
            {isRunning ? (
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-4 py-2 bg-[#ff7675] text-white border-2 border-[#2d3436] rounded-xl font-bold text-xs shadow-[2px_2px_0px_#2d3436] hover:translate-y-[-1px] transition-all cursor-pointer focus:outline-none"
              >
                <Pause className="w-4 h-4" />
                Stop
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-4 py-2 bg-[#00b894] text-white border-2 border-[#2d3436] rounded-xl font-bold text-xs shadow-[2px_2px_0px_#2d3436] hover:translate-y-[-1px] transition-all cursor-pointer focus:outline-none"
              >
                <Play className="w-4 h-4" />
                Start Generator
              </button>
            )}

            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-white text-[#2d3436] border-2 border-[#2d3436] rounded-xl font-bold text-xs shadow-[2px_2px_0px_#2d3436] hover:translate-y-[-1px] transition-all cursor-pointer focus:outline-none"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
          </div>
        </div>

        {/* Right column: Levels & Files */}
        <div className="lg:col-span-3 bg-white border-4 border-[#2d3436] rounded-3xl p-5 shadow-[6px_6px_0px_#2d3436] flex flex-col gap-5">
          {/* Queen Levels Panel */}
          <div className="pb-4 border-b-2 border-[#f1f2f6]">
            <h3 className="font-display font-black text-lg tracking-tight mb-1 flex items-center gap-1.5 text-[#2d3436]">
              👑 QUEEN LEVELS ({placements.length})
            </h3>
            <p className="text-[10px] text-[#b2bec3] font-bold uppercase tracking-wider mb-3">Unique Solutions as Levels</p>

            {/* Mode Selector Pill Toggle */}
            <div className="grid grid-cols-2 gap-1 bg-[#f1f2f6] p-1 border-2 border-[#2d3436] rounded-xl mb-3">
              <button
                disabled={isRunning}
                onClick={() => handleSetGenerationMode("single")}
                className={`py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all border ${
                  generationMode === "single"
                    ? "bg-[#6c5ce7] text-white border-[#2d3436]"
                    : "bg-white text-[#2d3436] border-transparent hover:border-[#b2bec3]/40 disabled:opacity-50 cursor-pointer"
                }`}
              >
                Single Level
              </button>
              <button
                disabled={isRunning}
                onClick={() => handleSetGenerationMode("all")}
                className={`py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all border ${
                  generationMode === "all"
                    ? "bg-[#6c5ce7] text-white border-[#2d3436]"
                    : "bg-white text-[#2d3436] border-transparent hover:border-[#b2bec3]/40 disabled:opacity-50 cursor-pointer"
                }`}
              >
                All Levels
              </button>
            </div>

            {/* Scrollable Levels Grid */}
            <div className="border-2 border-[#2d3436] rounded-xl bg-[#f1f2f6] p-1.5 max-h-[170px] overflow-y-auto pr-1.5">
              <div className="grid grid-cols-4 gap-1">
                {placements.map((p, idx) => {
                  const active = selectedPlacementIdx === idx;
                  const solStr = p.map((col, r) => `${r}-${col}`).join(";");
                  const count = levelBoardCounts[solStr] || 0;
                  
                  return (
                    <button
                      key={idx}
                      disabled={isRunning}
                      onClick={() => handleSelectLevel(idx)}
                      className={`relative aspect-square flex flex-col items-center justify-center rounded-lg border-2 text-[10px] font-mono font-black transition-all ${
                        active
                          ? "bg-[#6c5ce7] text-white border-[#2d3436] shadow-sm scale-95"
                          : "bg-white text-[#2d3436] border-transparent hover:border-[#b2bec3]/40 disabled:opacity-50 cursor-pointer"
                      }`}
                      title={`Placement: ${p.map((c, r) => `(${r},${c})`).join(" ")}`}
                    >
                      <span className="text-[8px] uppercase tracking-tighter">Lvl</span>
                      <span className="text-xs leading-none">{idx + 1}</span>

                      {/* Boards Count Badge if any generated */}
                      {count > 0 && (
                        <span className="absolute top-[-3px] right-[-3px] bg-[#00b894] text-white text-[8px] font-sans font-extrabold px-1 min-w-[12px] h-[12px] flex items-center justify-center rounded-full border border-white">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Level Info */}
            <div className="mt-3 bg-[#f1f2f6] border-2 border-[#2d3436] p-2 rounded-xl font-mono text-[9px] text-[#2d3436]">
              <span className="block font-black text-[10px] text-[#6c5ce7] mb-0.5">
                Selected: Level {selectedPlacementIdx + 1}
              </span>
              <span className="block text-[#636e72] break-all leading-tight">
                Queens: {placements[selectedPlacementIdx]?.map((col, r) => `(${r},${col})`).join(" ")}
              </span>
            </div>
          </div>

          {/* Files section */}
          <div>
            <h3 className="font-display font-black text-base tracking-tight mb-1 flex items-center gap-1.5 text-[#2d3436]">
              <Download className="w-4 h-4 text-[#00b894]" />
              FILES & RECON
            </h3>
            <p className="text-[10px] text-[#b2bec3] font-bold uppercase tracking-wider mb-3">Save, Restore & Export</p>

            {/* Action cards to download csv & resume file */}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDownloadCSV}
                disabled={validBoardsCount === 0}
                className="w-full flex items-center justify-between p-2.5 border-2 border-[#2d3436] rounded-xl bg-[#55efc4]/10 text-[#00b894] font-black hover:bg-[#55efc4]/20 transition-all shadow-[2px_2px_0px_#2d3436] hover:translate-y-[-1px] disabled:opacity-40 disabled:cursor-not-allowed text-[10px] focus:outline-none cursor-pointer"
              >
                <div className="flex items-center gap-2 text-left">
                  <Download className="w-3.5 h-3.5" />
                  <div>
                    <span className="block font-bold">Download Generated CSV</span>
                    <span className="block text-[8px] text-[#b2bec3] font-semibold">Puzzles ready to import</span>
                  </div>
                </div>
              </button>

              <button
                onClick={handleDownloadResumeFile}
                disabled={boardsChecked === 0}
                className="w-full flex items-center justify-between p-2.5 border-2 border-[#2d3436] rounded-xl bg-[#74b9ff]/10 text-[#0984e3] font-black hover:bg-[#74b9ff]/20 transition-all shadow-[2px_2px_0px_#2d3436] hover:translate-y-[-1px] disabled:opacity-40 disabled:cursor-not-allowed text-[10px] focus:outline-none cursor-pointer"
              >
                <div className="flex items-center gap-2 text-left">
                  <Download className="w-3.5 h-3.5" />
                  <div>
                    <span className="block font-bold">Download Resume State</span>
                    <span className="block text-[8px] text-[#b2bec3] font-semibold">Checkpoint .JSON file</span>
                  </div>
                </div>
              </button>
            </div>

            {/* Upload card */}
            <div className="border-t-2 border-[#f1f2f6] pt-3 mt-3 flex flex-col gap-2">
              <span className="block text-[9px] font-mono font-black text-[#636e72] uppercase tracking-wider mb-0.5">
                Restore / Resume session
              </span>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col items-center justify-center p-2 border-2 border-dashed border-[#b2bec3] hover:border-[#2d3436] bg-[#f1f2f6]/40 rounded-xl cursor-pointer transition-all min-h-[72px]">
                  <Upload className="w-3.5 h-3.5 text-[#6c5ce7] mb-0.5" />
                  <span className="text-[9px] font-black text-[#636e72] text-center">Resume State</span>
                  <span className="text-[7px] text-[#b2bec3] font-bold mt-0.5">(.JSON)</span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleUploadResumeFile}
                    className="hidden"
                  />
                </label>

                <label className="flex flex-col items-center justify-center p-2 border-2 border-dashed border-[#b2bec3] hover:border-[#2d3436] bg-[#f1f2f6]/40 rounded-xl cursor-pointer transition-all min-h-[72px]">
                  <Upload className="w-3.5 h-3.5 text-[#00b894] mb-0.5" />
                  <span className="text-[9px] font-black text-[#636e72] text-center">Previous CSV</span>
                  <span className="text-[7px] text-[#b2bec3] font-bold mt-0.5">(.CSV)</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleUploadCSVFile}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-[8px] text-[#b2bec3] font-bold uppercase leading-tight text-center">Upload CSV to merge historical boards and maintain unique constraints</p>
            </div>
          </div>
        </div>

      </div>

      {/* Diagnostics panel */}
      <div className="bg-white border-4 border-[#2d3436] rounded-3xl p-5 shadow-[6px_6px_0px_#2d3436] mt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-display font-black text-lg tracking-tight mb-1 flex items-center gap-1.5 text-[#2d3436]">
              <Activity className="w-5 h-5 text-[#6c5ce7]" />
              BACKTRACKING LEVEL DIAGNOSTICS & STATS MONITOR
            </h3>
            <p className="text-xs text-[#b2bec3] font-bold uppercase tracking-wider">Per-Level Space Diagnostics, Exhaustion Rates & Cache Rejections</p>
          </div>

          {/* Search bar */}
          <div className="relative max-w-xs w-full">
            <input
              type="text"
              placeholder="Search lvl or pattern (e.g. (0,2))..."
              value={diagnosticsSearch}
              onChange={e => {
                setDiagnosticsSearch(e.target.value);
                setDiagnosticsPage(0);
              }}
              className="w-full bg-[#f1f2f6] border-2 border-[#2d3436] rounded-xl pl-9 pr-3 py-1.5 text-xs font-bold font-mono text-[#2d3436] focus:outline-none placeholder:text-[#b2bec3]"
            />
            <Search className="w-4 h-4 text-[#b2bec3] absolute left-3 top-2.5" />
          </div>
        </div>

        {/* Diagnostics stats grid / table */}
        {livePlacementStats.length === 0 ? (
          <div className="py-8 text-center border-2 border-dashed border-[#f1f2f6] rounded-2xl text-[#b2bec3] font-bold text-xs">
            No active diagnostics found. Initialize or start the generator to load metrics!
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto border-2 border-[#2d3436] rounded-2xl">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="bg-[#f1f2f6] border-b-2 border-[#2d3436] text-[#636e72] font-black uppercase">
                    <th className="py-2.5 px-3">Lvl</th>
                    <th className="py-2.5 px-3">Queen Placements</th>
                    <th className="py-2.5 px-3 text-right">Explored</th>
                    <th className="py-2.5 px-3 text-right text-emerald-600">Accepted</th>
                    <th className="py-2.5 px-3 text-right text-amber-600">Multi-Sol</th>
                    <th className="py-2.5 px-3 text-right text-red-500">Duplicates</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStats.map(stat => {
                    const isCurrent = currentPlacementIdx === stat.placementIdx && status === "running";
                    const pattern = stat.placement.map((col, r) => `(${r},${col})`).join(" ");
                    
                    let statusLabel = "Pending";
                    let statusStyle = "bg-gray-100 text-gray-500 border-gray-300";
                    
                    if (stat.targetReached) {
                      statusLabel = "Target Reached";
                      statusStyle = "bg-emerald-50 text-emerald-600 border-emerald-300";
                    } else if (stat.exhausted) {
                      statusLabel = "Exhausted";
                      statusStyle = "bg-amber-50 text-amber-600 border-amber-300";
                    } else if (isCurrent) {
                      statusLabel = "Active";
                      statusStyle = "bg-indigo-50 text-indigo-600 border-indigo-300 animate-pulse font-extrabold";
                    } else if (stat.explored > 0) {
                      statusLabel = "Partially Run";
                      statusStyle = "bg-blue-50 text-blue-600 border-blue-300";
                    }

                    return (
                      <tr
                        key={stat.placementIdx}
                        className={`border-b border-[#f1f2f6] hover:bg-[#f1f2f6]/30 transition-all ${
                          isCurrent ? "bg-indigo-50/20 font-bold" : ""
                        }`}
                      >
                        <td className="py-2.5 px-3 font-black text-[#2d3436]">
                          {stat.placementIdx + 1}
                        </td>
                        <td className="py-2.5 px-3 text-[#2d3436] max-w-[200px] truncate" title={pattern}>
                          {pattern}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#2d3436] font-bold">
                          {stat.explored.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-600 font-extrabold">
                          {stat.accepted.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right text-amber-600 font-bold">
                          {stat.rejectedMultiSolution.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-right text-red-500 font-semibold">
                          {stat.rejectedDuplicate.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${statusStyle}`}>
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {diagMaxPage > 0 && (
              <div className="flex items-center justify-between gap-2 mt-1">
                <span className="text-[10px] text-[#b2bec3] font-bold uppercase tracking-wider">
                  Page {diagnosticsPage + 1} of {diagMaxPage + 1} ({filteredStats.length} Levels)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    disabled={diagnosticsPage === 0}
                    onClick={() => setDiagnosticsPage(prev => Math.max(0, prev - 1))}
                    className="p-1 border-2 border-[#2d3436] rounded-lg bg-white text-[#2d3436] hover:bg-[#f1f2f6] disabled:opacity-40 transition-all cursor-pointer shrink-0 animate-none flex items-center justify-center"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    disabled={diagnosticsPage >= diagMaxPage}
                    onClick={() => setDiagnosticsPage(prev => Math.min(diagMaxPage, prev + 1))}
                    className="p-1 border-2 border-[#2d3436] rounded-lg bg-white text-[#2d3436] hover:bg-[#f1f2f6] disabled:opacity-40 transition-all cursor-pointer shrink-0 animate-none flex items-center justify-center"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom area: Recent puzzles gallery list */}
      <div className="bg-white border-4 border-[#2d3436] rounded-3xl p-5 shadow-[6px_6px_0px_#2d3436] mt-2">
        <h3 className="font-display font-black text-lg tracking-tight mb-4 flex items-center gap-2 text-[#2d3436]">
          ♕ RECENTLY GENERATED VALID BOARDS (UP TO 8)
        </h3>
        
        {recentBoards.length === 0 ? (
          <div className="py-8 text-center border-2 border-dashed border-[#f1f2f6] rounded-2xl text-[#b2bec3] font-bold text-xs">
            No valid boards generated in this session yet. Start the algorithm to populate!
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {recentBoards.map((board: BoardRecord) => {
              // Parse layout
              const gridRows = board.grid.split(";").map((row: string) => row.split(",").map(Number));
              const solParts = board.solution.split(";").map((p: string) => {
                const [r, c] = p.split("-").map(Number);
                return { r, c };
              });
              
              return (
                <div
                  key={board.id}
                  className="bg-[#f1f2f6] border-2 border-[#2d3436] p-2.5 rounded-2xl shadow-[2px_2px_0px_#2d3436] flex flex-col items-center gap-2"
                >
                  <span className="font-mono text-[10px] font-black text-[#6c5ce7] uppercase tracking-wider bg-[#6c5ce7]/10 px-2 py-0.5 rounded-lg">
                    {board.id}
                  </span>

                  {/* Micro grid representation */}
                  <div
                    className="grid gap-0.5 w-full aspect-square border border-[#2d3436] bg-[#2d3436] rounded-md p-0.5"
                    style={{
                      gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))`
                    }}
                  >
                    {gridRows.map((rowArr: number[], rIdx: number) => {
                      return rowArr.map((val: number, cIdx: number) => {
                        const isQueen = solParts.some((q: { r: number; c: number }) => q.r === rIdx && q.c === cIdx);
                        const rColor = val !== -1 ? PALETTE[val % PALETTE.length] : "#fff";
                        return (
                          <div
                            key={`${rIdx}-${cIdx}`}
                            className="aspect-square flex items-center justify-center text-[7px]"
                            style={{
                              backgroundColor: rColor
                            }}
                          >
                            {isQueen && "♕"}
                          </div>
                        );
                      });
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
