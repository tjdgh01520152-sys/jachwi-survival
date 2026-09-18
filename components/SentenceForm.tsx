"use client";

interface Props {
  location: string;
  budget: string;
  meals: string;
  onLocationChange: (v: string) => void;
  onBudgetChange: (v: string) => void;
  onMealsChange: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

function InlineInput({
  value,
  onChange,
  placeholder,
  width,
  suffix,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  width: string;
  suffix: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className={`${width} border-b-2 border-brand-400 bg-transparent px-1 py-0.5 text-center font-bold text-brand-700 outline-none focus:border-brand-600`}
      />
      <span className="text-neutral-500">{suffix}</span>
    </span>
  );
}

export default function SentenceForm({
  location,
  budget,
  meals,
  onLocationChange,
  onBudgetChange,
  onMealsChange,
  onSubmit,
  loading,
}: Props) {
  const budgetDisplay = budget ? Number(budget).toLocaleString("ko-KR") : "";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="card p-6 sm:p-8"
    >
      <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-3 text-xl leading-relaxed sm:text-2xl">
        <span>나는</span>
        <InlineInput
          value={location}
          onChange={onLocationChange}
          placeholder="안암역"
          width="w-28 sm:w-36"
          suffix="근처에서"
        />
        <InlineInput
          value={budgetDisplay}
          onChange={(v) => onBudgetChange(v.replace(/[^0-9]/g, ""))}
          placeholder="40,000"
          width="w-24 sm:w-28"
          inputMode="numeric"
          suffix="원으로"
        />
        <InlineInput
          value={meals}
          onChange={(v) => onMealsChange(v.replace(/[^0-9]/g, ""))}
          placeholder="8"
          width="w-12"
          inputMode="numeric"
          suffix="끼를"
        />
        <span>해결해야 한다</span>
      </p>

      <button
        type="submit"
        disabled={loading}
        className="mt-6 w-full rounded-xl bg-brand-600 px-6 py-3.5 text-lg font-bold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-neutral-300 sm:w-auto"
      >
        {loading ? "생존 전략 계산 중..." : "생존 플랜 보기"}
      </button>
    </form>
  );
}
