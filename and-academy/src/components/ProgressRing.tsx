export default function ProgressRing({
  percentage,
  size = "md",
}: {
  percentage: number;
  size?: "sm" | "md" | "lg";
}) {
  const value = Math.min(100, Math.max(0, Math.round(percentage)));
  const dimensions = {
    sm: "h-16 w-16",
    md: "h-24 w-24",
    lg: "h-32 w-32",
  };
  const innerDimensions = {
    sm: "inset-[6px]",
    md: "inset-2",
    lg: "inset-[10px]",
  };
  const textSize = {
    sm: "text-sm",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <div
      role="progressbar"
      aria-label={`学習進捗 ${value}%`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className={`relative shrink-0 rounded-full ${dimensions[size]}`}
      style={{
        background: `conic-gradient(var(--color-brand) ${value}%, #e2e8f0 ${value}% 100%)`,
      }}
    >
      <div
        className={`absolute flex items-center justify-center rounded-full bg-white ${innerDimensions[size]}`}
      >
        <span className={`font-bold text-slate-900 ${textSize[size]}`}>
          {value}%
        </span>
      </div>
    </div>
  );
}
