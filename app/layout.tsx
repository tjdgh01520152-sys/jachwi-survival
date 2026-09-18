import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "자취생 생존기 | 예산 기반 식사 생존 플래너",
  description:
    "남은 식비로 며칠을 버틸 수 있을지, 실제 주변 식당과 요리를 섞어 식사 플랜을 짜주는 자취생 전용 생존 플래너.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
