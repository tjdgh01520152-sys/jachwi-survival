const INK = "#12140F";

/** 홈 카드/로딩 화면에서 공용으로 쓰는 마스코트 SVG. */
export default function Mascot({ size = 108, pot = true }: { size?: number; pot?: boolean }) {
  return (
    <svg
      viewBox="0 0 120 140"
      width={size}
      height={size * 1.17}
      fill="none"
      stroke={INK}
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M36 132 L42 84 Q60 74 78 84 L84 132 Z" fill="#7FB8E8" />
      <circle cx="60" cy="48" r="30" fill="#FFE2C4" />
      <path
        d="M30 46 Q32 12 60 12 Q88 12 90 46 Q76 32 60 34 Q44 36 30 46 Z"
        fill={INK}
      />
      <circle cx="50" cy="50" r="3.6" fill={INK} stroke="none" className="animate-blink" />
      <circle cx="70" cy="50" r="3.6" fill={INK} stroke="none" className="animate-blink" />
      <path d="M44 40 L53 43" />
      <path d="M76 40 L67 43" />
      <path d="M51 63 q4.5 5 9 0 q4.5 -5 9 0" strokeWidth={4} />
      <path d="M42 96 L26 112" strokeWidth={5} />
      <path d="M78 96 L96 108" strokeWidth={5} />
      {pot && (
        <>
          <path d="M82 104 L110 104 L105 128 L87 128 Z" fill="#E5533D" />
          <path d="M82 110 L108 110" />
        </>
      )}
    </svg>
  );
}
