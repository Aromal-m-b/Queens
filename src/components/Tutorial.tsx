import { useState } from "react";
import { HelpCircle, X, Check, Eye } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Tutorial({ isOpen, onClose }: TutorialProps) {
  const [activeTab, setActiveTab] = useState<"objective" | "controls" | "adjacency">("objective");

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl shadow-xl border border-slate-100 max-w-md w-full overflow-hidden"
        >
          {/* Header */}
          <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                <span className="text-lg font-bold text-amber-400">♛</span>
              </div>
              <div>
                <h3 className="font-display font-medium text-lg leading-tight">How to Play Queens</h3>
                <p className="text-xs text-slate-400">A minimalist colored grid puzzle</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Nav Tabs */}
          <div className="flex border-b border-slate-100 bg-slate-50 p-1 gap-1">
            {(["objective", "controls", "adjacency"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg capitalize transition-all ${
                  activeTab === tab
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-6 h-[280px] overflow-y-auto">
            {activeTab === "objective" && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <p className="text-sm text-slate-600 leading-relaxed">
                  Your goal is to place **exactly 1 Queen** (♛) in:
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="w-5 h-5 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">✓</span>
                    <span>Every single **Row** on the grid.</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="w-5 h-5 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">✓</span>
                    <span>Every single **Column** on the grid.</span>
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="w-5 h-5 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">✓</span>
                    <span>Every contiguous **Color Region**.</span>
                  </li>
                </ul>
              </motion.div>
            )}

            {activeTab === "controls" && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <p className="text-sm text-slate-600 leading-relaxed">
                  Toggle cells using simple taps or mouse clicks:
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <kbd className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold shadow-sm">1 Tap</kbd>
                    <div className="text-sm text-slate-700">
                      Places a <span className="font-bold text-slate-500">Dot (.)</span> to eliminate columns/rows.
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <kbd className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold shadow-sm">2 Taps</kbd>
                    <div className="text-sm text-slate-700">
                      Places a <span className="font-bold text-amber-500">Queen (♛)</span>.
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                    <kbd className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold shadow-sm">Right-Click</kbd>
                    <div className="text-sm text-slate-700">
                      Instantly places/cycles a <span className="font-bold text-amber-500">Queen (♛)</span>!
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "adjacency" && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <div className="flex items-start gap-3 p-3 bg-rose-50 rounded-2xl border border-rose-100 text-rose-800">
                  <span className="text-xl font-bold">⚠️</span>
                  <div>
                    <h4 className="font-semibold text-sm">Adjacency Rule (No Touching)</h4>
                    <p className="text-xs text-rose-700 leading-relaxed mt-0.5">
                      No two queens can touch **horizontally, vertically, or diagonally**. They cannot occupy any of the 8 cells immediately surrounding another queen.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-tight">
                  If you violate this rule, both touching queens will turn **pulsing red** to alert you immediately. Simply remove or relocate one of them to clear the error!
                </p>
              </motion.div>
            )}
          </div>

          {/* Footer Button */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-sm hover:shadow transition-all"
            >
              Let&apos;s Play!
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
