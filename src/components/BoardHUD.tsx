import { Check, AlertTriangle, Circle, ShieldAlert } from "lucide-react";

interface ConstraintStatus {
  index: number;
  label: string;
  queensCount: number;
  colorHex?: string; // only for color regions
  colorName?: string;
}

interface BoardHUDProps {
  size: number;
  rowStatus: ConstraintStatus[];
  colStatus: ConstraintStatus[];
  colorStatus: ConstraintStatus[];
  hasTouchingConflict: boolean;
}

export default function BoardHUD({
  size,
  rowStatus,
  colStatus,
  colorStatus,
  hasTouchingConflict,
}: BoardHUDProps) {

  // Map region ID to an explicit hex color for the status pill inside HUD
  const getHexForRegion = (idx: number) => {
    // 10 premium pastel colors matching the Vibrant Palette exactly
    const palette = [
      "#ffeaa7",
      "#fab1a0",
      "#81ecec",
      "#fd79a8",
      "#a29bfe",
      "#55efc4",
      "#74b9ff",
      "#ffe0e6",
      "#e2e2cc",
      "#fdcb6e",
    ];
    return palette[idx % palette.length];
  };

  const renderStatusIcon = (count: number) => {
    if (count === 1) {
      return (
        <span className="w-5 h-5 rounded-full bg-[#55efc4] flex items-center justify-center text-[#00b894] font-black text-xs">
          ✓
        </span>
      );
    } else if (count > 1) {
      return (
        <span className="w-5 h-5 rounded-full bg-[#ff7675] flex items-center justify-center text-white font-black text-xs animate-pulse">
          !
        </span>
      );
    } else {
      return (
        <span className="text-xs text-[#b2bec3] font-bold">·</span>
      );
    }
  };

  return (
    <div className="bg-white rounded-3xl border-2 border-[#dfe6e9] p-5 shadow-sm space-y-5">
      <div className="flex items-center justify-between border-b-2 border-[#f1f2f6] pb-3">
        <h4 className="font-display font-black text-[#2d3436] text-sm">
          Active Constraints
        </h4>
        <div className="text-[10px] uppercase tracking-wider text-[#b2bec3] font-black font-mono">
          Real-Time Check
        </div>
      </div>

      {/* Touch Alert Banner */}
      {hasTouchingConflict && (
        <div className="p-3 bg-[#ff7675]/10 border-2 border-[#ff7675] rounded-2xl flex items-start gap-2.5 text-xs text-[#2d3436] font-bold">
          <AlertTriangle className="w-4 h-4 text-[#ff7675] mt-0.5 shrink-0" />
          <div>
            <span className="font-extrabold text-[#ff7675]">Queen touching conflict!</span> Two queens cannot touch each other (not even diagonally).
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {/* Rows HUD */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase font-black tracking-wider text-[#b2bec3]">Rows</div>
          <div className="space-y-1.5 h-[200px] overflow-y-auto pr-1">
            {rowStatus.map((row) => (
              <div
                key={row.index}
                className={`flex items-center justify-between p-1.5 rounded-xl border-2 text-xs leading-none transition-all ${
                  row.queensCount === 1
                    ? "bg-[#55efc4]/20 border-[#00b894] text-[#00b894] font-bold"
                    : row.queensCount > 1
                    ? "bg-[#ff7675]/20 border-[#ff7675] text-[#2d3436] font-extrabold"
                    : "bg-[#f1f2f6] border-[#dfe6e9] text-[#b2bec3]"
                }`}
              >
                <span className="font-mono font-bold">{row.label}</span>
                {renderStatusIcon(row.queensCount)}
              </div>
            ))}
          </div>
        </div>

        {/* Columns HUD */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase font-black tracking-wider text-[#b2bec3]">Columns</div>
          <div className="space-y-1.5 h-[200px] overflow-y-auto pr-1">
            {colStatus.map((col) => (
              <div
                key={col.index}
                className={`flex items-center justify-between p-1.5 rounded-xl border-2 text-xs leading-none transition-all ${
                  col.queensCount === 1
                    ? "bg-[#55efc4]/20 border-[#00b894] text-[#00b894] font-bold"
                    : col.queensCount > 1
                    ? "bg-[#ff7675]/20 border-[#ff7675] text-[#2d3436] font-extrabold"
                    : "bg-[#f1f2f6] border-[#dfe6e9] text-[#b2bec3]"
                }`}
              >
                <span className="font-mono font-bold">{col.label}</span>
                {renderStatusIcon(col.queensCount)}
              </div>
            ))}
          </div>
        </div>

        {/* Colors HUD */}
        <div className="space-y-2">
          <div className="text-[10px] uppercase font-black tracking-wider text-[#b2bec3]">Colors</div>
          <div className="space-y-1.5 h-[200px] overflow-y-auto pr-1">
            {colorStatus.map((color) => {
              const hex = getHexForRegion(color.index);
              return (
                <div
                  key={color.index}
                  className={`flex items-center justify-between p-1.5 rounded-xl border-2 text-xs leading-none transition-all ${
                    color.queensCount === 1
                      ? "bg-[#55efc4]/20 border-[#00b894] text-[#00b894] font-bold"
                      : color.queensCount > 1
                      ? "bg-[#ff7675]/20 border-[#ff7675] text-[#2d3436] font-extrabold"
                      : "bg-[#f1f2f6] border-[#dfe6e9] text-[#b2bec3]"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0 animate-pulse"
                      style={{ backgroundColor: hex }}
                    />
                    <span className="text-[11px] scale-95 origin-left font-black capitalize max-w-[28px] truncate text-[#2d3436]">
                      #{color.index + 1}
                    </span>
                  </div>
                  {renderStatusIcon(color.queensCount)}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="text-center pt-2 border-t-2 border-[#f1f2f6]">
        <p className="text-[10px] text-[#636e72] font-semibold leading-relaxed">
          Note: You must have exactly 1 Queen per Row, Column, and Color region without touching!
        </p>
      </div>
    </div>
  );
}
