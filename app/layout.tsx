import type { Metadata } from "next";
import { Black_Han_Sans, Gothic_A1 } from "next/font/google";
import "./globals.css";

// 두 폰트 모두 next/font 메타데이터상 "latin" 서브셋 하나만 제공한다(한글 자체가 그 안에 포함됨).
const blackHanSans = Black_Han_Sans({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-black-han-sans",
  display: "swap",
});

const gothicA1 = Gothic_A1({
  weight: ["400", "500", "700", "800", "900"],
  subsets: ["latin"],
  variable: "--font-gothic-a1",
  display: "swap",
});

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
    <html lang="ko" className={`${blackHanSans.variable} ${gothicA1.variable}`}>
      <body>{children}</body>
    </html>
  );
}
