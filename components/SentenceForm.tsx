"use client";

interface Props {
  location: string;
  budget: string;
  meals: string;
  onLocationChange: (v: string) => void;
  onBudgetChange: (v: string) => void;
  onMealsChange: (v: string) => void;
}

function MissionInput({
  value,
  onChange,
  placeholder,
  width,
  inputMode,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  width: string;
  inputMode?: "numeric" | "text";
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className={`${width} border-0 border-b-[3px] border-ink bg-coin px-1.5 py-0.5 text-center font-black text-ink outline-none placeholder:text-ink/40`}
      style={{ fontSize: "19px" }}
    />
  );
}

export default function SentenceForm({
  location,
  budget,
  meals,
  onLocationChange,
  onBudgetChange,
  onMealsChange,
}: Props) {
  const budgetDisplay = budget ? Number(budget).toLocaleString("ko-KR") : "";

  return (
    <div className="panel flex flex-col gap-3.5 p-4">
      <div className="flex items-center gap-2">
        <span className="h-[9px] w-[9px] shrink-0 rounded-full bg-ramen" />
        <span className="text-xs font-black tracking-[0.12em] text-ink">MISSION 입력</span>
      </div>

      <p className="font-extrabold leading-[2.1] text-ink" style={{ fontSize: "19px" }}>
        나는{" "}
        <MissionInput
          value={location}
          onChange={onLocationChange}
          placeholder="안암역"
          width="w-[5.6em]"
        />{" "}
        근처에서{" "}
        <MissionInput
          value={budgetDisplay}
          onChange={(v) => onBudgetChange(v.replace(/[^0-9]/g, ""))}
          placeholder="40,000"
          width="w-[4.6em]"
          inputMode="numeric"
        />
        원 으로{" "}
        <MissionInput
          value={meals}
          onChange={(v) => onMealsChange(v.replace(/[^0-9]/g, ""))}
          placeholder="8"
          width="w-[2.2em]"
          inputMode="numeric"
        />
        끼 를 버텨야 한다
      </p>
    </div>
  );
}
