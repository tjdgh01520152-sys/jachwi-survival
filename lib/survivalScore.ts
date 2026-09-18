// ⚠️ 데모용 내부 점수다. Kakao API는 평점을 제공하지 않고, 실제 사용자 리뷰 데이터도 아니다.
// place_name / 프랜차이즈 여부 / 카테고리 키워드만으로 만든 "자취생 관점 내부 신뢰도" 시드값이며,
// UI에는 절대 "카카오 평점"이나 "별점"처럼 노출하지 않는다 ("생존 적합도 N점" 같은 서비스 자체
// 용어로만 표시). 같은 상호명은 항상 같은 값이 나오도록 이름을 해시해서 구간 안에서 고른다.

export type SurvivalScoreSource = "eatout" | "convenience" | "cooking";

export interface SurvivalScoreResult {
  score: number; // 0~100
  labels: string[]; // "든든함" 같은 고정 라벨 (거리/예산처럼 그때그때 바뀌는 라벨은 별도로 합쳐진다)
}

function stableHash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(h, 31) + text.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** seedKey를 기준으로 [min, max] 구간 안의 정수 하나를 결정론적으로 고른다. */
function pickInRange(seedKey: string, min: number, max: number): number {
  if (max <= min) return min;
  return min + (stableHash(seedKey) % (max - min + 1));
}

const HEARTY_KEYWORDS = ["백반", "국밥", "덮밥", "도시락", "찌개", "정식", "비빔밥"];
// 카페/디저트/술집 계열은 이미 후보 풀 생성 단계에서 걸러지지만, 혹시 놓친 게 있을 때를 대비한
// 이중 안전장치로 여기서도 감점한다.
const CAFE_DESSERT_KEYWORDS = ["카페", "디저트", "베이커리", "케이크", "아이스크림", "빙수", "도넛"];
const BAR_KEYWORDS = ["술집", "호프", "이자카야", "포차", "주점", "요리주점"];

export function computeSurvivalScore(params: {
  categoryName: string;
  placeName: string;
  source: SurvivalScoreSource;
  isCurated: boolean; // 프랜차이즈 seed 매칭 여부
}): SurvivalScoreResult {
  const { categoryName, placeName, source, isCurated } = params;
  const text = `${categoryName} ${placeName}`;
  const labels: string[] = [];
  let score: number;

  if (source === "cooking") {
    score = pickInRange(`cook:${placeName}`, 85, 95);
    labels.push("직접 요리");
  } else if (source === "convenience") {
    score = pickInRange(`cvs:${placeName}`, 70, 82);
    labels.push("빠름");
  } else if (isCurated) {
    score = pickInRange(`brand:${placeName}`, 75, 90);
    labels.push("검증된 프랜차이즈");
  } else {
    score = pickInRange(`place:${placeName}`, 58, 78);
  }

  if (HEARTY_KEYWORDS.some((k) => text.includes(k))) {
    score = Math.min(96, score + 6);
    labels.push("든든함");
  }
  if (CAFE_DESSERT_KEYWORDS.some((k) => text.includes(k))) {
    score = Math.max(15, score - 30);
  }
  if (BAR_KEYWORDS.some((k) => text.includes(k))) {
    score = Math.max(15, score - 25);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, labels };
}
