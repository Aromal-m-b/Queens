import { Trophy, Clock, RotateCcw, ArrowRight, Menu } from "lucide-react";
import { motion } from "motion/react";

interface SuccessCelebrationProps {
  elapsedSeconds: number;
  movesCount: number;
  levelName: string;
  hasWithNextLevel: boolean;
  onNextLevel: () => void;
  onRestart: () => void;
  onMenu: () => void;
}

export default function SuccessCelebration({
  elapsedSeconds,
  movesCount,
  levelName,
  hasWithNextLevel,
  onNextLevel,
  onRestart,
  onMenu,
}: SuccessCelebrationProps) {
  // Format elapsed seconds as MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-40">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full border border-slate-100/50 text-center"
      >
        {/* Animated Trophy Icon */}
        <motion.div
          initial={{ rotate: -20, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", delay: 0.1, stiffness: 120 }}
          className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center border border-amber-500/20 mx-auto mb-5"
        >
          <Trophy className="w-10 h-10 text-amber-500" />
        </motion.div>

        {/* Title */}
        <h2 className="font-display font-bold text-3xl text-slate-900 tracking-tight">
          Superb!
        </h2>
        <p className="text-sm text-slate-500 mt-2 mb-6">
          You solved <span className="font-semibold text-slate-800">{levelName}</span> flawlessly!
        </p>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 flex flex-col items-center">
            <Clock className="w-5 h-5 text-indigo-500 mb-1" />
            <span className="text-xs text-slate-400 font-medium">Time Taken</span>
            <span className="font-mono text-lg font-bold text-slate-800 mt-0.5">
              {formatTime(elapsedSeconds)}
            </span>
          </div>

          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-100 flex flex-col items-center">
            <RotateCcw className="w-5 h-5 text-emerald-500 mb-1" />
            <span className="text-xs text-slate-400 font-medium font-sans">Total Actions</span>
            <span className="font-mono text-lg font-bold text-slate-800 mt-0.5">
              {movesCount}
            </span>
          </div>
        </div>

        {/* Buttons Stack */}
        <div className="space-y-3">
          {hasWithNextLevel ? (
            <button
              onClick={onNextLevel}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold flex items-center justify-center gap-2 group shadow-lg hover:shadow transition-all"
            >
              Play Next Level
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          ) : (
            <div className="text-sm font-semibold text-slate-500 bg-amber-50 p-3 rounded-2xl border border-amber-100/50 mb-3">
              🎉 Wow, you completed the final level of this difficulty!
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onRestart}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              Replay Layout
            </button>

            <button
              onClick={onMenu}
              className="py-3 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all text-sm"
            >
              <Menu className="w-4 h-4" />
              Main Menu
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
