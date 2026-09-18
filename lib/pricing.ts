// 카카오 API는 실제 메뉴 가격을 제공하지 않으므로, 카테고리/상호명 키워드로 가격대를 추정한다.

interface PriceRule {
  keywords: string[];
  min: number;
  max: number;
  tags: string[];
}

const PRICE_RULES: PriceRule[] = [
  {
    keywords: ["김밥", "분식", "떡볶이", "컵밥"],
    min: 4500,
    max: 7500,
    tags: ["분식", "가벼움", "절약"],
  },
  {
    keywords: ["편의점", "도시락", "삼각김밥", "컵라면"],
    min: 4000,
    max: 7000,
    tags: ["편의점", "빠름", "절약"],
  },
  {
    // "한식"은 Kakao 카테고리에서 국수/고기/양식류에도 "음식점 > 한식 > ..." 형태로 흔히 붙는
    // 너무 넓은 상위 분류라 키워드에서 뺐다(태그로는 유지). 넣으면 더 구체적인 아래 규칙들을 가려버린다.
    keywords: ["백반", "찌개", "덮밥", "국밥", "정식"],
    min: 8500,
    max: 12000,
    tags: ["한식", "든든함"],
  },
  {
    // "쌀국수"는 "국수"의 부분 집합이라, 이 규칙을 아래 국수 규칙보다 먼저 검사해야
    // 쌀국수가 저가 국수 가격대로 잘못 분류되지 않는다.
    keywords: ["돈까스", "라멘", "카레", "쌀국수", "냉면"],
    min: 9000,
    max: 13500,
    tags: ["든든함", "외식"],
  },
  {
    keywords: ["국수", "칼국수", "우동", "짜장면"],
    min: 7000,
    max: 10000,
    tags: ["면", "가성비"],
  },
  {
    keywords: ["마라탕", "찜닭"],
    min: 10000,
    max: 18000,
    tags: ["나눠먹기", "매운맛"],
  },
  {
    // "버거 세트"는 "버거"의 부분 집합이라, 세트 규칙을 먼저 검사해야 세트가 단품으로 잘못 분류되지 않는다.
    keywords: ["버거 세트", "샌드위치 세트"],
    min: 7000,
    max: 12500,
    tags: ["세트", "든든함"],
  },
  {
    keywords: ["버거", "샌드위치"],
    min: 4000,
    max: 8500,
    tags: ["패스트푸드", "단품"],
  },
  {
    keywords: ["파스타", "피자", "양식"],
    min: 12000,
    max: 18000,
    tags: ["양식", "만족도"],
  },
  {
    keywords: ["고기", "삼겹살", "구이", "이자카야", "술집", "호프"],
    min: 15000,
    max: 25000,
    tags: ["고기", "회식", "고비용"],
  },
];

const DEFAULT_RULE = { min: 8000, max: 12000, tags: ["일반"] };

function matchRule(text: string): { min: number; max: number; tags: string[] } {
  for (const rule of PRICE_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) {
      return { min: rule.min, max: rule.max, tags: rule.tags };
    }
  }
  return DEFAULT_RULE;
}

/** 카테고리명 + 상호명을 바탕으로 가격 범위를 추정한다. */
export function estimatePrice(
  categoryName: string,
  placeName: string
): { min: number; max: number; tags: string[] } {
  const text = `${categoryName} ${placeName}`;
  return matchRule(text);
}

/** 가격 범위를 "예상 7,000원대" 형태의 라벨로 변환한다. */
export function toPriceLabel(min: number, max: number): string {
  // 대표값은 천 단위로 내림한 min 기준
  const bucket = Math.floor(min / 1000) * 1000;
  return `예상 ${bucket.toLocaleString("ko-KR")}원대`;
}

/**
 * 프랜차이즈 seed로 등록해둔 가격을 "프랜차이즈 기준가 9,900원" 형태의 라벨로 변환한다.
 * 확정 가격이 아니라 매장/배달/프로모션에 따라 달라질 수 있는 기준가라는 뉘앙스를 준다.
 */
export function toFranchiseBaseLabel(price: number): string {
  return `프랜차이즈 기준가 ${price.toLocaleString("ko-KR")}원`;
}

/** 계산에 사용할 대표 가격 (범위의 중간값을 1000원 단위로 반올림) */
export function representativePrice(min: number, max: number): number {
  const mid = (min + max) / 2;
  return Math.round(mid / 500) * 500;
}

/** 편의점 후보용 고정 가격 추정 (도시락/삼각김밥/컵라면 조합) */
export function convenienceEstimate(): { min: number; max: number; tags: string[] } {
  return { min: 4000, max: 6000, tags: ["편의점", "가벼움", "빠름"] };
}
