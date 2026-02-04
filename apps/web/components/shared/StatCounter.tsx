interface StatCounterProps {
  value: string;
  label: string;
}

export default function StatCounter({ value, label }: StatCounterProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-2xl sm:text-3xl font-display font-bold neon-text">
        {value}
      </span>
      <span className="text-xs sm:text-sm text-white/50 font-medium uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}
