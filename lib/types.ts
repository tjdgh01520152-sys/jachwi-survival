// 공용 타입 정의

export type MealSourceType = "eatout" | "cooking" | "convenience";

// 끼니를 "무엇을 먹는지"가 아니라 "어떻게 해결하는지"로 구분하는 축.
// single/set은 외식(프랜차이즈) 후보에, share는 나눠먹기 후보에, cooking/convenience는 각 소스 전용.
export type MealMode = "single" | "set" | "share" | "cooking" | "convenience";

export interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  address_name: string;
  road_address_name: string;
  x: string; // longitude
  y: string; // latitude
  distance: string; // meters, as string from Kakao
  place_url: string;
}

export interface PricedCandidate extends KakaoPlace {
  sourceType: "eatout" | "convenience";
  priceMin: number;
  priceMax: number;
  priceLabel: string; // 예: "예상 7,000원대" (프랜차이즈 seed 매칭은 recommend.ts에서 처리)
  tags: string[];
  distanceMeters: number;
  // 안암/안암역 데모용으로 사용자가 직접 조사해 제공한 참고 데이터가 있을 때만 채워진다
  // (lib/curatedAnam.ts). "rating"은 생존 적합도 점수 산출에만 쓰이고, UI에는 절대
  // 카카오 평점이나 별점처럼 노출하지 않는다.
  curated?: {
    rating: number; // 0~5
    type: "single" | "share" | "both";
    representativePrice: number; // 1인당 계산에 쓰는 대표가
    shareTotalPrice?: number; // "share"/"both"일 때 전체 가격 대표값
  };
}

export interface CookingItem {
  id: string;
  type: "cooking";
  menuName: string;
  totalCost: number;
  meals: number; // 총 몇 끼 해결 가능한지
  pricePerMeal: number;
  category: string;
  tags: string[];
  repeatable: number;
}

export interface CandidatePool {
  center: { x: number; y: number } | null;
  restaurants: PricedCandidate[];
  convenience: PricedCandidate[];
  cooking: CookingItem[];
  isFallback: boolean;
  fallbackReason?: string;
}

export type OptionKey =
  | "closeFirst" // 가까운 곳 우선
  | "balanced" // 균형
  | "valueOverDistance" // 멀어도 가성비
  | "mixCooking" // 요리 섞기
  | "convenienceOk" // 편의점 OK
  | "hearty" // 든든하게
  | "varietySeeking" // 다양하게 먹기
  | "mildRepeatOk" // 적당히 반복 가능
  | "cheapRepeatOk" // 싸면 반복 OK
  | "shareableOk" // 나눠먹기 가능
  | "styleCheapest" // 최대한 싸게 (단품 우선)
  | "styleBalanced" // 적당히 든든하게 (단품/세트 균형)
  | "styleSetOk" // 세트/사이드도 OK
  // 좋아하는 취향
  | "likeSpicy" // 매운 음식
  | "likeMild" // 담백한 음식
  | "likeSoup" // 국물 메뉴
  | "likeCrispyFried" // 바삭한/튀김류
  | "likeMeat" // 고기
  | "likeCheeseCream" // 치즈/크림
  | "likeRice" // 밥 메뉴
  | "likeNoodle" // 면 메뉴
  | "likeBunsik" // 분식
  | "likeFastfoodOk" // 패스트푸드 OK
  | "likeKorean" // 한식 선호
  | "likeNewMenu" // 새로운 메뉴 도전
  // 피하고 싶은 것
  | "avoidSpicy" // 매운 음식 피하기
  | "avoidNoodle" // 면 피하기
  | "avoidFried" // 튀김 피하기
  | "avoidMeat" // 고기 피하기
  | "avoidSeafood" // 해산물 피하기
  | "avoidGreasy" // 느끼한 음식 피하기
  | "avoidFlour" // 밀가루 줄이기
  | "avoidSmallPortion"; // 양 적은 메뉴 피하기

export interface UserPreferences {
  distanceSensitivity: number; // 0~1, 높을수록 거리에 민감
  priceSensitivity: number; // 0~1, 높을수록 가격에 민감
  likedTags: Record<string, number>;
  dislikedTags: Record<string, number>;
  cookingAffinity: number; // 0~1
  excludedPlaceIds: string[];
  lastInput?: {
    location: string;
    budget: number;
    meals: number;
  };
  lastOptions?: OptionKey[];
}

export interface MealPlanItem {
  mealIndex: number; // 몇 번째 끼니
  source: MealSourceType;
  mealMode: MealMode;
  menuName: string;
  placeName: string; // 요리인 경우 "직접 요리"
  priceLabel: string;
  priceValue: number; // 계산에 사용하는 대표 가격 (share는 1인당 부담금)
  distanceMeters: number | null;
  category: string;
  placeUrl: string | null;
  placeId: string | null; // kakao 실제 매장 id 또는 cooking id (메뉴 변형과 무관하게 동일 매장이면 같은 값)
  franchiseBrand?: string; // isCurated일 때 프랜차이즈 브랜드명 (연속 배치 검사용)
  reason: string;
  tags: string[];
  isCurated: boolean;
  shareInfo?: { totalPrice: number; servings: number }; // mealMode가 "share"일 때만
  cookingInfo?: { totalCost: number; mealsCovered: number }; // source가 "cooking"일 때만 — 장보기 총액 · 해결되는 끼니 수
  sideSuggestion?: { menuName: string; price: number }; // "추가하면 좋은 사이드" 보조 제안
  isEmpty?: boolean; // 예산 초부족으로 이 끼니는 해결하지 못했음을 나타냄
  // 데모용 내부 점수. 카카오 평점이 아니며 실제 리뷰 데이터도 아니다 (lib/survivalScore.ts 참고).
  survivalScore?: number; // 0~100
  survivalLabels?: string[]; // 예: ["가까움", "예산 적합", "든든함"]
  // 결과 지도(안암 생존 지도) 표시용 좌표. 직접요리처럼 물리적 위치가 없으면 null/undefined.
  lat?: number | null;
  lng?: number | null;
}

export interface MinimalSurvivalResult {
  isSevereShortfall: boolean;
  mealsRequested: number;
  affordableCount: number; // 예산 안에서 해결 가능한 끼니 수
  shortfallCount: number; // 해결하지 못하는 끼니 수
  avgMinPrice: number; // 최저 생존 메뉴 평균가
  totalMinCost: number; // 요청한 끼니 수를 전부 최저가로 채웠을 때 총액
  meals: MealPlanItem[]; // affordableCount개의 실제 카드 + shortfallCount개의 빈 끼니 카드
  extraMealsPerExtraBudget: number; // 예산 5,000원 추가 시 더 해결되는 끼니 수
  extraMealsWithShareable: number; // 나눠먹기 옵션을 켰을 때 더 해결되는 끼니 수
}

export interface MealPlan {
  planId: "save" | "balance" | "near";
  planName: string;
  meals: MealPlanItem[];
  shareShortfall: boolean; // 나눠먹기 옵션을 켰지만 최소 등장 횟수를 못 채운 경우
}

export interface PlanSummary {
  totalBudget: number;
  estimatedSpend: number;
  remaining: number;
  survivalGrade: string;
  survivalSubtitle: string; // 세부 칭호 (예: "동네 맛집 탐험가"). "텅장 경보"일 때는 빈 문자열
  survivalMessage: string;
  avgPerMeal: number; // 한 끼 평균 예산 (총 예산 ÷ 끼니 수)
  eatoutCount: number;
  convenienceCount: number;
  cookingCount: number;
  averageDistance: number; // 외식/편의점 끼니만 평균
  personaLine: string;
  diversityScore: number; // 0~100, 메뉴/매장 다양성 점수
  hasConsecutiveMenuRepeat: boolean; // 후처리 후에도 남은 연속 메뉴 반복이 있는지
  hasConsecutivePlaceRepeat: boolean; // 후처리 후에도 남은 연속 매장/브랜드 반복이 있는지
  budgetUsageRatio: number; // 0~100+, 예산 대비 지출 비율 (%)
}

export interface RecommendRequestInput {
  location: string;
  budget: number;
  meals: number;
  options: OptionKey[];
}
