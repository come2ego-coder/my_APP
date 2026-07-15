const STEPS: { n: 1 | 2 | 3; label: string }[] = [
  { n: 1, label: "ジャンル入力" },
  { n: 2, label: "型のリサーチ" },
  { n: 3, label: "記事完成" },
];

export default function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-4">
      {STEPS.map((s, i) => {
        const active = s.n === step;
        const done = s.n < step;
        return (
          <div key={s.n} className="flex items-center gap-2 sm:gap-4">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full font-mincho text-sm font-bold transition ${
                  active
                    ? "bg-indigo text-washi shadow-washi"
                    : done
                      ? "bg-wakatake/80 text-washi"
                      : "bg-white text-sumi/40 border border-sumi/15"
                }`}
              >
                {String(s.n).padStart(2, "0")}
              </div>
              <span
                className={`hidden text-[11px] sm:block ${
                  active ? "font-bold text-indigo" : "text-sumi/50"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-[2px] w-6 sm:w-12 rounded-full ${
                  done ? "bg-wakatake/70" : "bg-sumi/15"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
