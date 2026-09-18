import {
  CandidatePool,
  MealMode,
  MealPlan,
  MealPlanItem,
  MinimalSurvivalResult,
  OptionKey,
  PlanSummary,
  PricedCandidate,
  UserPreferences,
} from "./types";
import { representativePrice, toFranchiseBaseLabel } from "./pricing";
import { describePersona } from "./storage";
import { findFranchiseMenus, findSideMenu } from "./franchiseSeeds";
import { OPTION_LABEL_BY_KEY } from "./optionLabels";
import { computeSurvivalScore } from "./survivalScore";

// ---------- 후보 단일 표현 ----------
// 같은 물리적 매장이 단품/세트/나눠먹기 등 여러 "한 끼 해결 방식"으로 후보에 여러 번 등장할 수 있다.
// basePlaceId는 실제 매장(제외 목록/중복 체크용), id는 메뉴 변형까지 포함한 후보 고유값이다.
interface UnifiedCandidate {
  id: string;
  basePlaceId: string;
  source: "eatout" | "convenience" | "cooking";
  mealMode: MealMode;
  menuName: string;
  placeName: string;
  category: string;
  tags: string[];
  price: number; // 예산 계산에 쓰는 대표 가격 (share는 1인당 부담금)
  totalPrice?: number; // share 전용: 전체 가격
  servings?: number; // share 전용: 나눠 먹는 인원
  fullness?: number; // 1~10, 프랜차이즈 seed에 있으면 든든함 점수에 사용
  hasSetSibling?: boolean; // single일 때, 같은 브랜드에 세트가 따로 있는지 (이유 문구용)
  franchiseBrand?: string; // isCurated일 때 브랜드명 ("추가하면 좋은 사이드" 조회용)
  totalCost?: number; // cooking 전용: 추가 장보기 총액
  mealsCovered?: number; // cooking 전용: 이 장보기로 해결되는 끼니 수
  distanceMeters: number | null;
  placeUrl: string | null;
  repeatQuota: number; // 페널티 없이 반복 가능한 횟수
  isCurated: boolean;
  survivalScore: number; // 0~100, 데모용 내부 점수 (카카오 평점 아님. lib/survivalScore.ts 참고)
  survivalStaticLabels: string[]; // 거리/예산과 무관하게 고정된 라벨 (예: "든든함", "직접 요리")
}

// "좋아하는 취향" 옵션 → 매칭되면 취향 점수에 가점을 주는 키워드
const LIKE_KEYWORD_MAP: Partial<Record<OptionKey, string[]>> = {
  likeSpicy: ["매운", "마라", "매콤", "불닭", "떡볶이", "짬뽕"],
  likeMild: ["담백", "흰죽", "백반", "가정식"],
  likeSoup: ["국", "찌개", "탕", "국밥", "전골", "우동", "라멘"],
  likeCrispyFried: ["튀김", "돈까스", "가라아게", "탕수육"],
  likeMeat: ["고기", "구이", "삼겹", "족발", "곱창", "불고기", "스테이크"],
  likeCheeseCream: ["치즈", "크림", "까르보나라", "피자"],
  likeRice: ["밥", "덮밥", "도시락", "죽", "김밥", "볶음밥"],
  likeNoodle: ["면", "국수", "라면", "라멘", "파스타", "우동", "쌀국수", "냉면", "짜장", "짬뽕"],
  likeBunsik: ["분식", "떡볶이", "김밥", "순대", "오뎅"],
  likeFastfoodOk: ["버거", "치킨", "피자", "토스트", "샌드위치"],
  likeKorean: ["한식", "백반", "국밥", "찌개", "비빔밥"],
  // likeNewMenu는 키워드 매칭이 아니라 다양성 가중치로 반영됨 (applyOptionAdjustments)
};

// "피하고 싶은 것" 옵션 → 매칭되면 큰 감점을 주는 키워드
const AVOID_KEYWORD_MAP: Partial<Record<OptionKey, string[]>> = {
  avoidSpicy: LIKE_KEYWORD_MAP.likeSpicy,
  avoidNoodle: LIKE_KEYWORD_MAP.likeNoodle,
  avoidFried: LIKE_KEYWORD_MAP.likeCrispyFried,
  avoidMeat: LIKE_KEYWORD_MAP.likeMeat,
  avoidSeafood: ["해산물", "회", "초밥", "새우", "오징어", "조개", "게", "랍스터"],
  avoidGreasy: ["느끼", "크림", "마요"],
  avoidFlour: ["면", "라면", "파스타", "빵", "토스트", "버거", "만두", "부침개"],
  // avoidSmallPortion은 키워드가 아니라 든든함(fullness) 수치로 판단됨
};

const AVOID_PENALTY_PER_MATCH = 5; // "큰 감점"

// 카페/디저트/간식/술집류는 "한 끼 해결"이 목적인 이 서비스에서 아예 후보 풀에 넣지 않는다
// (점수 감점이 아니라 생성 단계에서 완전히 제거). "간식"은 Kakao 카테고리 자체가
// "음식점 > 간식 > ..." 형태로 상위 분류를 매기는 경우가 많아서(하위 키워드가 없어도)
// 이 한 단어만으로도 대부분 걸러진다.
const CATEGORY_EXCLUDE_KEYWORDS = [
  "간식",
  "카페",
  "커피",
  "디저트",
  "베이커리",
  "빵집",
  "제과",
  "케이크",
  "도넛",
  "아이스크림",
  "빙수",
  "와플",
  "크레페",
  "붕어빵",
  "타코야키",
  "마카롱",
  "초콜릿",
  "버블티",
  "티하우스",
  "츄러스",
  "젤라또",
  "슬러시",
  "음료",
  "주스",
  "스무디",
  "쉐이크",
  "술집",
  "호프",
  "펍",
  "바",
  "이자카야",
  "포차",
  "요리주점",
  "주점",
  "맥주",
  "칵테일",
];

// 위 키워드와 겹칠 수 있어도 자취생 한 끼로 분명히 쓸 수 있는 메뉴는 절대 제외하지 않는다.
// (예: "이삭토스트"는 "토스트"가 간식처럼 보이지만 실제로는 한 끼 대용, "치킨"/"피자"/"마라탕"/
// "찜닭"은 나눠먹기 메뉴로 쓰이므로 술집 관련 키워드와 무관하게 항상 유지)
const CATEGORY_KEEP_KEYWORDS = [
  "분식",
  "김밥",
  "국수",
  "도시락",
  "덮밥",
  "백반",
  "찌개",
  "국밥",
  "돈까스",
  "라멘",
  "쌀국수",
  "버거",
  "토스트",
  "피자",
  "치킨",
  "마라탕",
  "찜닭",
];

function isSnackPlace(categoryName: string, placeName: string): boolean {
  const text = `${categoryName} ${placeName}`;
  if (CATEGORY_KEEP_KEYWORDS.some((k) => text.includes(k))) return false;
  return CATEGORY_EXCLUDE_KEYWORDS.some((k) => text.includes(k));
}

// 프랜차이즈로 등록 안 된 "진짜" 동네 식당도 치킨/찜닭/양꼬치처럼 원래 나눠 먹는 메뉴라면
// 나눠먹기 후보로 함께 넣는다. 특정 브랜드 2~3곳에만 의존하면 위치에 따라 나눠먹기 후보가
// 0개가 되는 문제가 있어서, 카테고리/상호명 키워드로 폭넓게 잡는다.
interface ShareDishRule {
  keywords: string[];
  totalMin: number;
  totalMax: number;
  servings: number;
  tags: string[];
}

const SHARE_DISH_RULES: ShareDishRule[] = [
  { keywords: ["치킨", "통닭"], totalMin: 18000, totalMax: 23000, servings: 2, tags: ["치킨", "나눠먹기"] },
  { keywords: ["찜닭"], totalMin: 20000, totalMax: 28000, servings: 2, tags: ["찜닭", "나눠먹기", "매운맛"] },
  { keywords: ["양꼬치"], totalMin: 25000, totalMax: 35000, servings: 2, tags: ["양꼬치", "나눠먹기"] },
  { keywords: ["족발", "보쌈"], totalMin: 25000, totalMax: 35000, servings: 2, tags: ["족발보쌈", "나눠먹기", "고기"] },
  { keywords: ["피자"], totalMin: 18000, totalMax: 25000, servings: 2, tags: ["피자", "나눠먹기"] },
  {
    keywords: ["삼겹살", "구이", "곱창", "막창"],
    totalMin: 20000,
    totalMax: 30000,
    servings: 2,
    tags: ["고기", "나눠먹기", "회식"],
  },
];

function findShareDishRule(categoryName: string, placeName: string): ShareDishRule | null {
  const text = `${categoryName} ${placeName}`;
  return SHARE_DISH_RULES.find((rule) => rule.keywords.some((k) => text.includes(k))) ?? null;
}

function buildUnifiedPool(pool: CandidatePool): UnifiedCandidate[] {
  const eatout: UnifiedCandidate[] = [];

  for (const r of pool.restaurants) {
    if (isSnackPlace(r.category_name, r.place_name)) continue;

    const matches = findFranchiseMenus(r.place_name);

    if (matches.length === 0) {
      const curated = r.curated;
      const nonFranchiseScore = computeSurvivalScore({
        categoryName: r.category_name,
        placeName: r.place_name,
        source: "eatout",
        isCurated: false,
        curatedRating: curated?.rating,
      });

      // 안암/안암역 큐레이션 데이터가 있으면 그 type이 단품/나눠먹기 여부를 전적으로 결정한다
      // (아래 일반 findShareDishRule 추정은 적용하지 않는다 — 사용자가 이미 직접 분류해준 값이라
      // 예를 들어 삼겹살집이어도 curated.type이 "single"이면 나눠먹기 후보를 만들지 않는다).
      if (curated) {
        if (curated.type === "single" || curated.type === "both") {
          eatout.push({
            id: r.id,
            basePlaceId: r.id,
            source: "eatout",
            mealMode: "single",
            menuName: guessMenuName(r),
            placeName: r.place_name,
            category: shortCategory(r.category_name),
            tags: r.tags,
            price: curated.representativePrice,
            distanceMeters: r.distanceMeters,
            placeUrl: r.place_url,
            repeatQuota: 1,
            isCurated: false,
            survivalScore: nonFranchiseScore.score,
            survivalStaticLabels: nonFranchiseScore.labels,
          });
        }
        if (curated.type === "share" || curated.type === "both") {
          const totalPrice = curated.shareTotalPrice ?? curated.representativePrice * 2;
          eatout.push({
            id: `${r.id}::share`,
            basePlaceId: r.id,
            source: "eatout",
            mealMode: "share",
            menuName: `${guessMenuName(r)} (나눠먹기)`,
            placeName: r.place_name,
            category: shortCategory(r.category_name),
            tags: r.tags,
            price: curated.representativePrice,
            totalPrice,
            servings: 2,
            distanceMeters: r.distanceMeters,
            placeUrl: r.place_url,
            repeatQuota: 1,
            isCurated: false,
            survivalScore: nonFranchiseScore.score,
            survivalStaticLabels: nonFranchiseScore.labels,
          });
        }
        continue;
      }

      eatout.push({
        id: r.id,
        basePlaceId: r.id,
        source: "eatout",
        mealMode: "single",
        menuName: guessMenuName(r),
        placeName: r.place_name,
        category: shortCategory(r.category_name),
        tags: r.tags,
        price: representativePrice(r.priceMin, r.priceMax),
        distanceMeters: r.distanceMeters,
        placeUrl: r.place_url,
        repeatQuota: 1,
        isCurated: false,
        survivalScore: nonFranchiseScore.score,
        survivalStaticLabels: nonFranchiseScore.labels,
      });

      // 치킨/찜닭/양꼬치처럼 원래 나눠 먹는 메뉴면, 같은 매장을 "나눠먹기" 후보로도 추가한다.
      const shareRule = findShareDishRule(r.category_name, r.place_name);
      if (shareRule) {
        const totalPrice = Math.round((shareRule.totalMin + shareRule.totalMax) / 2 / 500) * 500;
        const perPerson = Math.round(totalPrice / shareRule.servings / 100) * 100;
        eatout.push({
          id: `${r.id}::share`,
          basePlaceId: r.id,
          source: "eatout",
          mealMode: "share",
          menuName: `${guessMenuName(r)} (나눠먹기)`,
          placeName: r.place_name,
          category: shortCategory(r.category_name),
          tags: shareRule.tags,
          price: perPerson,
          totalPrice,
          servings: shareRule.servings,
          distanceMeters: r.distanceMeters,
          placeUrl: r.place_url,
          repeatQuota: 1,
          isCurated: false,
          survivalScore: nonFranchiseScore.score,
          survivalStaticLabels: nonFranchiseScore.labels,
        });
      }
      continue;
    }

    for (const { brand, menu, tags, hasSetSibling } of matches) {
      // 사이드/컵밥류(canBeStandaloneMeal=false)는 단독 끼니 후보로 넣지 않는다.
      // 메인/나눠먹기 메뉴가 선택됐을 때 "추가하면 좋은 사이드"로만 곁들여진다.
      if (!menu.canBeStandaloneMeal) continue;

      const franchiseScore = computeSurvivalScore({
        categoryName: r.category_name,
        placeName: r.place_name,
        source: "eatout",
        isCurated: true,
        curatedRating: r.curated?.rating,
      });

      if (menu.mealMode === "share") {
        const perPerson = Math.round(menu.totalPrice / menu.servings);
        eatout.push({
          id: `${r.id}::${menu.id}`,
          basePlaceId: r.id,
          source: "eatout",
          mealMode: "share",
          menuName: menu.menuName,
          placeName: r.place_name,
          category: shortCategory(r.category_name),
          tags,
          price: perPerson,
          totalPrice: menu.totalPrice,
          servings: menu.servings,
          franchiseBrand: brand,
          distanceMeters: r.distanceMeters,
          placeUrl: r.place_url,
          repeatQuota: 1,
          isCurated: true,
          survivalScore: franchiseScore.score,
          survivalStaticLabels: franchiseScore.labels,
        });
      } else {
        eatout.push({
          id: `${r.id}::${menu.id}`,
          basePlaceId: r.id,
          source: "eatout",
          mealMode: menu.mealMode,
          menuName: menu.menuName,
          placeName: r.place_name,
          category: shortCategory(r.category_name),
          tags,
          price: menu.price,
          fullness: menu.fullness,
          hasSetSibling: menu.mealMode === "single" ? hasSetSibling : false,
          franchiseBrand: brand,
          distanceMeters: r.distanceMeters,
          placeUrl: r.place_url,
          repeatQuota: 1,
          isCurated: true,
          survivalScore: franchiseScore.score,
          survivalStaticLabels: franchiseScore.labels,
        });
      }
    }
  }

  const convenience: UnifiedCandidate[] = pool.convenience.map((c) => {
    const cvsScore = computeSurvivalScore({
      categoryName: c.category_name,
      placeName: c.place_name,
      source: "convenience",
      isCurated: false,
    });
    return {
      id: c.id,
      basePlaceId: c.id,
      source: "convenience",
      mealMode: "convenience",
      menuName: "편의점 한 끼 (도시락/삼각김밥)",
      placeName: c.place_name,
      category: "편의점",
      tags: c.tags,
      price: representativePrice(c.priceMin, c.priceMax),
      distanceMeters: c.distanceMeters,
      placeUrl: c.place_url,
      repeatQuota: 2,
      isCurated: false,
      survivalScore: cvsScore.score,
      survivalStaticLabels: cvsScore.labels,
    };
  });

  const cooking: UnifiedCandidate[] = pool.cooking.map((c) => {
    const cookScore = computeSurvivalScore({
      categoryName: c.category,
      placeName: c.menuName,
      source: "cooking",
      isCurated: false,
    });
    return {
      id: c.id,
      basePlaceId: c.id,
      source: "cooking",
      mealMode: "cooking",
      menuName: c.menuName,
      placeName: "직접 요리",
      category: c.category,
      tags: c.tags,
      price: c.pricePerMeal,
      totalCost: c.totalCost,
      mealsCovered: c.meals,
      distanceMeters: null,
      placeUrl: null,
      repeatQuota: c.repeatable,
      isCurated: false,
      survivalScore: cookScore.score,
      survivalStaticLabels: cookScore.labels,
    };
  });

  return [...eatout, ...convenience, ...cooking];
}

function shortCategory(categoryName: string): string {
  const parts = categoryName.split(">").map((p) => p.trim());
  return parts[parts.length - 1] || parts[0] || categoryName;
}

function guessMenuName(r: PricedCandidate): string {
  const cat = shortCategory(r.category_name);
  return cat || "식사";
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

// ---------- 가중치 프로필 ----------

interface WeightProfile {
  wBudget: number;
  wTaste: number;
  wDistance: number;
  wHearty: number;
  wDiversity: number;
  wDislike: number;
  wDuplicate: number;
  cookingBoost: number;
  convenienceBoost: number;
  eatoutBoost: number;
  setPenalty: number; // mealMode가 "set"일 때 빼는 점수. 클수록 단품을 선호.
  // true면 "무조건 저렴할수록 좋음"으로 채점한다(최대 절약 플랜 전용).
  // false면 "배정된 예산을 잘 채울수록 좋음"으로 채점해서, 예산이 커지면 더 든든한 메뉴가 나오게 한다.
  preferCheapest: boolean;
}

function basePlanProfile(planId: "save" | "balance" | "near"): WeightProfile {
  if (planId === "save") {
    return {
      wBudget: 3.0,
      wTaste: 1.0,
      wDistance: 0.6,
      wHearty: 0.8,
      wDiversity: 0.6,
      wDislike: 1.5,
      wDuplicate: 1.0,
      cookingBoost: 6.0,
      convenienceBoost: 3.0,
      eatoutBoost: -1.5,
      setPenalty: 2.5,
      preferCheapest: true,
    };
  }
  if (planId === "near") {
    return {
      wBudget: 1.3,
      wTaste: 1.2,
      wDistance: 3.5,
      wHearty: 1.0,
      wDiversity: 0.8,
      wDislike: 1.5,
      wDuplicate: 1.2,
      cookingBoost: -4.0,
      convenienceBoost: 1.5,
      eatoutBoost: 3.2,
      setPenalty: 0.8,
      preferCheapest: false,
    };
  }
  return {
    wBudget: 1.6,
    wTaste: 1.5,
    wDistance: 1.8,
    wHearty: 1.2,
    wDiversity: 1.0,
    wDislike: 1.5,
    wDuplicate: 1.2,
    cookingBoost: -1.0,
    convenienceBoost: 1.5,
    eatoutBoost: 2.0,
    setPenalty: 0.8,
    preferCheapest: false,
  };
}

// 한 끼 평균 예산(budget / mealsCount) 구간. 생존 등급 표시와 추천 가중치 조정이
// 같은 경계값(3,000 / 6,000 / 12,000원)을 공유해서 "등급이 곧 추천 성향"이 되게 한다.
interface BudgetTier {
  grade: string;
  message: string;
  subtitles: string[];
  cookingBoostDelta: number;
  convenienceBoostDelta: number;
  eatoutBoostDelta: number;
  setPenaltyDelta: number;
}

const BUDGET_TIERS: BudgetTier[] = [
  {
    grade: "냉장고 파먹기 계급",
    message: "지금은 외식보다 집에 뭐가 남아 있는지 확인할 때예요.",
    subtitles: ["엄마밥 약탈자", "간장 계란밥 마스터", "유통기한 추격자"],
    cookingBoostDelta: 4,
    convenienceBoostDelta: 1.5,
    eatoutBoostDelta: -3,
    setPenaltyDelta: 3,
  },
  {
    grade: "생계형 편의점 계급",
    message: "편의점과 저가 메뉴를 잘 섞으면 버틸 수 있어요.",
    subtitles: ["삼김 라면 연합군", "마감 세일 사냥꾼", "학식 프로 참석러"],
    cookingBoostDelta: 1.5,
    convenienceBoostDelta: 3,
    eatoutBoostDelta: -1,
    setPenaltyDelta: 2.5,
  },
  {
    grade: "동네 맛집 탐험 계급",
    message: "이제 한 끼다운 선택지가 보이기 시작해요.",
    subtitles: ["배달 쪼개기 장인", "동네 맛집 탐험가", "밀키트 대가"],
    cookingBoostDelta: 0,
    convenienceBoostDelta: 0,
    eatoutBoostDelta: 0.5,
    setPenaltyDelta: -0.3,
  },
  {
    grade: "귀족 자취생 계급",
    message: "이번 플랜은 생존보다 선택의 문제예요.",
    subtitles: ["알바비 탕진러", "종강 파티 황제", "본가 컴백홈"],
    cookingBoostDelta: -2,
    convenienceBoostDelta: -2,
    eatoutBoostDelta: 3,
    setPenaltyDelta: -3,
  },
];

function budgetTierIndex(avgPerMeal: number): number {
  if (avgPerMeal <= 3000) return 0;
  if (avgPerMeal <= 6000) return 1;
  if (avgPerMeal <= 12000) return 2;
  return 3;
}

function budgetTierFor(avgPerMeal: number): BudgetTier {
  return BUDGET_TIERS[budgetTierIndex(avgPerMeal)];
}

/** 문자열 시드를 배열 인덱스로 바꾼다. seed가 0이면 항상 0번(첫 칭호)을 돌려준다. */
function pickBySeed<T>(items: T[], seed: number, salt: string): T {
  if (seed === 0 || items.length === 0) return items[0];
  let h = seed;
  for (let i = 0; i < salt.length; i++) h = (Math.imul(h, 31) + salt.charCodeAt(i)) | 0;
  return items[Math.abs(h) % items.length];
}

function applyOptionAdjustments(
  profile: WeightProfile,
  options: Set<OptionKey>,
  prefs: UserPreferences,
  avgPerMeal: number
): WeightProfile {
  const p = { ...profile };

  // 사용자가 저장한 민감도 (localStorage 개인화). 기본값(0.5) 기준으로 중립이 되도록 중심을 맞춘다.
  p.wDistance *= 0.6 + prefs.distanceSensitivity;
  p.wBudget *= 0.6 + prefs.priceSensitivity;
  p.cookingBoost += (prefs.cookingAffinity - 0.5) * 3;

  // 예산 티어 기본값 적용 (아래 명시적 옵션들이 필요하면 이 위에 덮어쓴다).
  // 최대 절약 플랜은 예산 크기와 무관하게 항상 "최소 지출"이 목적이므로 티어를 적용하지 않는다.
  if (!p.preferCheapest) {
    const tier = budgetTierFor(avgPerMeal);
    p.cookingBoost += tier.cookingBoostDelta;
    p.convenienceBoost += tier.convenienceBoostDelta;
    p.eatoutBoost += tier.eatoutBoostDelta;
    p.setPenalty += tier.setPenaltyDelta;
  }

  if (options.has("closeFirst")) p.wDistance *= 1.6;
  if (options.has("valueOverDistance")) p.wBudget *= 1.5;
  if (options.has("mixCooking")) p.cookingBoost += 1.5;
  if (options.has("convenienceOk")) p.convenienceBoost += 1.0;
  if (options.has("hearty")) p.wHearty *= 1.8;
  if (options.has("varietySeeking")) {
    p.wDiversity *= 1.8;
    p.wDuplicate *= 1.5;
  }
  if (options.has("likeNewMenu")) {
    // 새로운 메뉴 도전: 특정 키워드가 아니라 다양성 가중치 자체를 올려서 반영한다.
    p.wDiversity *= 1.5;
  }
  if (options.has("mildRepeatOk")) p.wDuplicate *= 0.5;
  if (options.has("cheapRepeatOk")) p.wDuplicate *= 0.35;

  // 식사 스타일: 단품/세트 우선순위. 여러 개를 고르면 "싸게 > 세트OK > 균형" 순으로 적용.
  if (options.has("styleCheapest")) {
    p.setPenalty = 5;
  } else if (options.has("styleSetOk")) {
    p.setPenalty = -2;
  } else if (options.has("styleBalanced")) {
    p.setPenalty = 1;
  }

  return p;
}

// ---------- 점수 계산 ----------

function distanceScore(distanceMeters: number | null): number {
  if (distanceMeters === null) return 3; // 요리는 이동은 없지만, "가까운 곳" 취지에서는 중립으로 취급
  if (distanceMeters <= 300) return 5;
  if (distanceMeters <= 700) return 4;
  if (distanceMeters <= 1200) return 2.5;
  if (distanceMeters <= 2000) return 1;
  return -3;
}

/**
 * "저렴할수록 좋다"가 아니라 "이번 끼니에 배정된 예산을 잘 채울수록 좋다"로 채점한다.
 * 예산이 넉넉해서 1끼당 배정액이 크면(perMealAllowance↑), 그만큼 비싸고 든든한 메뉴가
 * 최고점을 받게 되어 "예산을 늘려도 항상 제일 싼 메뉴만 나오는" 문제를 없앤다.
 * ratio = price / perMealAllowance. 목표 구간은 0.7~1.0 (배정액의 70~100% 사용).
 */
function budgetFitScore(price: number, perMealAllowance: number): number {
  if (perMealAllowance <= 0) return -5;
  const ratio = price / perMealAllowance;
  if (ratio > 1.3) return -4; // 크게 초과
  if (ratio > 1.0) return 1; // 살짝 초과
  if (ratio >= 0.7) return 5; // 딱 맞음 — 배정액을 잘 채움
  if (ratio >= 0.4) return 3; // 다소 저렴 — 나쁘진 않지만 배정액을 못 채움
  if (ratio >= 0.2) return 1; // 꽤 저렴 — 예산을 낭비하는 셈
  return -1; // 지나치게 저렴 — 배정액 대비 너무 아낌
}

/** 최대 절약 플랜 전용: 배정액을 못 채우더라도 저렴할수록 항상 더 좋은 점수. */
function budgetFitScoreCheapest(price: number, perMealAllowance: number): number {
  if (perMealAllowance <= 0) return -5;
  const ratio = price / perMealAllowance;
  if (ratio <= 0.6) return 5;
  if (ratio <= 1.0) return 4;
  if (ratio <= 1.3) return 1;
  return -4;
}

interface ScoreContext {
  perMealAllowance: number;
  remainingBudget: number;
  profile: WeightProfile;
  options: Set<OptionKey>;
  prefs: UserPreferences;
  placeUsage: Map<string, number>;
  categoryUsage: Map<string, number>;
  seed?: number; // 0(기본)이면 완전히 결정론적. "전체 다시 추천" 등에서 매번 다른 시드를 넣어 변화를 준다.
}

/** 문자열 + 시드를 -1~1 사이 의사난수로 바꾼다. 같은 입력이면 항상 같은 값이 나온다. */
function seededJitter(key: string, seed: number): number {
  if (!seed) return 0;
  let h = seed | 0;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  }
  return ((h % 1000) / 1000) * 2 - 1; // -1 ~ 1
}

function scoreCandidate(
  c: UnifiedCandidate,
  ctx: ScoreContext
): { score: number; reasonTags: string[] } {
  const text = `${c.menuName} ${c.placeName} ${c.category}`;

  // 취향 일치도: "좋아하는 취향" 옵션에 매칭되면 가점
  let taste = 0;
  const reasonTags: string[] = [];
  for (const tag of c.tags) {
    const liked = ctx.prefs.likedTags[tag];
    if (liked) taste += liked;
  }
  for (const [key, keywords] of Object.entries(LIKE_KEYWORD_MAP) as [OptionKey, string[]][]) {
    if (ctx.options.has(key) && containsAny(text, keywords)) {
      taste += 2;
      const label = OPTION_LABEL_BY_KEY[key];
      if (label) reasonTags.push(label);
    }
  }

  // 든든함 점수: 프랜차이즈 seed에 fullness가 있으면 그 값을, 없으면 태그로 판단
  const hearty = c.fullness !== undefined ? c.fullness / 2 : c.tags.includes("든든함") ? 2 : 0.4;

  // 싫어하는 음식 패널티 (localStorage 개인화 + "피하고 싶은 것" 옵션은 큰 감점)
  let dislikePenalty = 0;
  for (const tag of c.tags) {
    const disliked = ctx.prefs.dislikedTags[tag];
    if (disliked) dislikePenalty += disliked;
  }
  const catDisliked = ctx.prefs.dislikedTags[c.category];
  if (catDisliked) dislikePenalty += catDisliked;

  for (const [key, keywords] of Object.entries(AVOID_KEYWORD_MAP) as [OptionKey, string[]][]) {
    if (ctx.options.has(key) && containsAny(text, keywords)) {
      dislikePenalty += AVOID_PENALTY_PER_MATCH;
    }
  }
  if (ctx.options.has("avoidSmallPortion")) {
    const fullnessValue = c.fullness ?? (c.tags.includes("든든함") ? 7 : 4);
    if (fullnessValue < 5) dislikePenalty += AVOID_PENALTY_PER_MATCH;
  }

  // 중복 패널티: 메뉴 변형이 아니라 실제 매장(basePlaceId) 기준으로 센다.
  const placeUsedCount = ctx.placeUsage.get(c.basePlaceId) ?? 0;
  const overQuota = Math.max(0, placeUsedCount - (c.repeatQuota - 1));
  const duplicatePenalty = overQuota * (c.source === "cooking" ? 1.2 : 3);

  const categoryUsedCount = ctx.categoryUsage.get(c.category) ?? 0;
  const categoryDuplicatePenalty = categoryUsedCount * 0.5;

  // 다양성 점수: 아직 안 쓴 카테고리일수록 보너스
  const diversity = categoryUsedCount === 0 ? 1.5 : Math.max(0, 1 - categoryUsedCount * 0.4);

  // 소스별 보너스
  const sourceBoost =
    c.source === "cooking"
      ? ctx.profile.cookingBoost
      : c.source === "convenience"
      ? ctx.profile.convenienceBoost
      : ctx.profile.eatoutBoost;

  // 세트 메뉴 패널티 (식사 스타일 옵션 + 예산 상황에 따라 조정됨)
  const setPenalty = c.mealMode === "set" ? ctx.profile.setPenalty : 0;

  // "나눠먹기 가능"을 켰다면 share 후보를 적극적으로 추천하도록 가산점을 준다.
  // (등장 빈도 자체는 전체 끼니의 20% 상한으로 별도 제한됨)
  const shareBoost = c.mealMode === "share" && ctx.options.has("shareableOk") ? 3.5 : 0;

  const budget = ctx.profile.preferCheapest
    ? budgetFitScoreCheapest(c.price, ctx.perMealAllowance)
    : budgetFitScore(c.price, ctx.perMealAllowance);
  const distance = distanceScore(c.distanceMeters);

  // 시드가 있으면(예: "전체 다시 추천") 비슷한 점수의 후보들 사이에서만 순서가 살짝 바뀌도록
  // 작은 흔들림을 더한다. 예산/거리 같은 강한 신호를 뒤집을 만큼 크지는 않다.
  const jitter = seededJitter(c.id, ctx.seed ?? 0) * 1.5;

  // 데모용 내부 점수(생존 적합도)는 가격/거리/취향보다 훨씬 약하게, 동점 후보를 가르는
  // 보조 기준 정도로만 반영한다. 사용자가 "안 끌려요"/"이곳 제외하기"를 누른 곳은
  // dislikePenalty·excludedIds가 이 항보다 훨씬 크게 작동해서 항상 우선한다.
  const survivalScoreAdjust = c.survivalScore >= 80 ? 1.5 : c.survivalScore < 60 ? -1.5 : 0;

  const score =
    budget * ctx.profile.wBudget +
    taste * ctx.profile.wTaste +
    distance * ctx.profile.wDistance +
    hearty * ctx.profile.wHearty +
    diversity * ctx.profile.wDiversity -
    dislikePenalty * ctx.profile.wDislike -
    (duplicatePenalty + categoryDuplicatePenalty) * ctx.profile.wDuplicate +
    sourceBoost -
    setPenalty +
    shareBoost +
    jitter +
    survivalScoreAdjust;

  if (distance >= 4) reasonTags.push("가까움");
  if (budget >= 4) reasonTags.push("예산 적합");
  if (c.source === "cooking") reasonTags.push("직접 요리로 절약");
  if (c.source === "convenience") reasonTags.push("편의점으로 빠르게 해결");

  return { score, reasonTags };
}

function buildReason(
  c: UnifiedCandidate,
  reasonTags: string[],
  location: string
): string {
  if (c.source === "cooking") {
    const mealsCovered = c.mealsCovered ?? 1;
    return `한 번 만들어두면 ${mealsCovered}끼까지 나눠 먹을 수 있어요.`;
  }

  const distText =
    c.distanceMeters !== null ? `${location} 근처 ${Math.round(c.distanceMeters)}m` : `${location} 근처`;

  if (c.mealMode === "share" && c.totalPrice !== undefined && c.servings !== undefined) {
    return `${distText}의 프랜차이즈 매장이에요. 나눠먹기 가능 옵션이 켜져 있어 ${c.servings}명 기준 부담금으로 계산했어요. 총 ${c.totalPrice.toLocaleString(
      "ko-KR"
    )}원을 나눠 먹으면 1인당 ${c.price.toLocaleString("ko-KR")}원, 같이 먹을 사람이 필요해요.`;
  }

  const tagText = reasonTags.slice(0, 2).join(", ") || "예산과 거리";
  const priceNote = c.isCurated
    ? " 프랜차이즈 기준가예요. 매장·배달·프로모션에 따라 가격이 달라질 수 있어요."
    : "";

  let styleNote = "";
  if (c.mealMode === "set") {
    styleNote = " 남은 예산에 여유가 있어서 든든한 세트 메뉴를 넣었어요.";
  } else if (c.mealMode === "single" && c.hasSetSibling) {
    styleNote = " 예산이 빠듯해서 세트 대신 단품으로 계산했어요.";
  }

  return `${distText}의 실제 가게예요. ${tagText}를 고려해서 골랐어요.${priceNote}${styleNote}`;
}

// ---------- 생존 등급 ----------

export interface SurvivalGrade {
  grade: string;
  subtitle: string;
  message: string;
  avgPerMeal: number;
}

/**
 * 생존 등급은 "남은 돈 비율"이 아니라 "한 끼 평균"(실제 예상 지출 ÷ 끼니 수) 기준으로 정해진다.
 * 예산이 아니라 "실제로 이 플랜이 얼마씩 쓰는지"를 기준으로 하기 때문에, 끼니 하나를 바꿔서
 * 예상 지출이 달라지면 한 끼 평균과 등급도 함께 바뀐다.
 * 단, 실제로 예산을 초과한 플랜은 등급과 무관하게 "텅장 경보"로 표시한다.
 */
export function computeSurvivalGrade(
  totalBudget: number,
  mealsCount: number,
  estimatedSpend: number,
  seed = 0
): SurvivalGrade {
  const avgPerMeal = mealsCount > 0 ? Math.round(estimatedSpend / mealsCount) : 0;

  if (estimatedSpend > totalBudget) {
    return {
      grade: "텅장 경보",
      subtitle: "",
      message: "이 플랜은 지갑이 먼저 쓰러져요. 몇 끼는 요리나 편의점으로 돌려야 합니다.",
      avgPerMeal,
    };
  }

  const tier = budgetTierFor(avgPerMeal);
  const subtitle = pickBySeed(tier.subtitles, seed, `${mealsCount}:${totalBudget}`);

  return {
    grade: tier.grade,
    subtitle,
    message: tier.message,
    avgPerMeal,
  };
}

// ---------- 다양성(연속 반복 방지) ----------

interface DiversityMetrics {
  diversityScore: number;
  hasConsecutiveMenuRepeat: boolean;
  hasConsecutivePlaceRepeat: boolean;
}

function computeDiversityMetrics(meals: MealPlanItem[]): DiversityMetrics {
  if (meals.length === 0) {
    return { diversityScore: 100, hasConsecutiveMenuRepeat: false, hasConsecutivePlaceRepeat: false };
  }

  let consecutiveMenuCount = 0;
  let consecutivePlaceCount = 0;
  let consecutiveBrandCount = 0;
  let categoryStreakViolations = 0;
  let categoryStreak = 1;

  for (let i = 1; i < meals.length; i++) {
    const prev = meals[i - 1];
    const curr = meals[i];
    // 요리끼리 연속되는 건 의도된 동작이라 다양성 점수에서 감점하지 않는다.
    const bothCooking = curr.source === "cooking" && prev.source === "cooking";

    if (!bothCooking && curr.menuName === prev.menuName) consecutiveMenuCount++;
    if (!bothCooking && curr.placeId !== null && curr.placeId === prev.placeId) consecutivePlaceCount++;
    if (!bothCooking && curr.franchiseBrand && curr.franchiseBrand === prev.franchiseBrand) consecutiveBrandCount++;

    if (!bothCooking && curr.category === prev.category) {
      categoryStreak += 1;
      if (categoryStreak >= 3) categoryStreakViolations++;
    } else {
      categoryStreak = 1;
    }
  }

  const uniqueMenuRatio = new Set(meals.map((m) => m.menuName)).size / meals.length;
  const uniquePlaceRatio = new Set(meals.map((m) => m.placeId ?? m.placeName)).size / meals.length;

  let score = uniqueMenuRatio * 60 + uniquePlaceRatio * 40;
  score -= consecutiveMenuCount * 15;
  score -= (consecutivePlaceCount + consecutiveBrandCount) * 10;
  score -= categoryStreakViolations * 8;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    diversityScore: score,
    hasConsecutiveMenuRepeat: consecutiveMenuCount > 0,
    hasConsecutivePlaceRepeat: consecutivePlaceCount > 0 || consecutiveBrandCount > 0,
  };
}

/**
 * 바로 다음 끼니의 대체 후보를 찾는다.
 * 우선순위: 1) 앞 끼니와 메뉴 중복 회피 2) 앞 끼니와 식당/브랜드 중복 회피
 * 3) 카테고리 3연속 회피 4) (가능하면) 뒤 끼니와도 안 겹치게.
 * 후보가 부족하면 뒤쪽 제약부터 순서대로 완화한다.
 */
function findDiversityReplacement(
  curr: MealPlanItem,
  prev: MealPlanItem,
  next: MealPlanItem | null,
  fullMeals: MealPlanItem[],
  index: number,
  unifiedPool: UnifiedCandidate[],
  budget: number,
  profile: WeightProfile,
  options: Set<OptionKey>,
  prefs: UserPreferences,
  excludedIds: Set<string>,
  shareableAllowed: boolean
): { c: UnifiedCandidate; reasonTags: string[] } | null {
  const spentBefore = fullMeals.slice(0, index).reduce((s, m) => s + m.priceValue, 0);
  const remainingBudget = Math.max(budget - spentBefore, 0);
  const remainingMeals = fullMeals.length - index;
  const perMealAllowance = remainingMeals > 0 ? remainingBudget / remainingMeals : remainingBudget;

  const placeUsage = new Map<string, number>();
  const categoryUsage = new Map<string, number>();
  fullMeals.forEach((m, j) => {
    if (j === index) return;
    if (m.placeId) placeUsage.set(m.placeId, (placeUsage.get(m.placeId) ?? 0) + 1);
    categoryUsage.set(m.category, (categoryUsage.get(m.category) ?? 0) + 1);
  });

  const isSameAsCurrent = (c: UnifiedCandidate) =>
    c.basePlaceId === curr.placeId && c.menuName === curr.menuName;
  // 요리끼리는 연속 배치를 허용하므로, 후보와 이웃이 둘 다 요리면 아래 제약들을 적용하지 않는다.
  const violatesPrev = (c: UnifiedCandidate) =>
    !(c.source === "cooking" && prev.source === "cooking") &&
    (c.menuName === prev.menuName ||
      c.basePlaceId === prev.placeId ||
      (!!c.franchiseBrand && c.franchiseBrand === prev.franchiseBrand));
  const violatesNext = (c: UnifiedCandidate) =>
    !!next &&
    !(c.source === "cooking" && next.source === "cooking") &&
    (c.menuName === next.menuName ||
      c.basePlaceId === next.placeId ||
      (!!c.franchiseBrand && c.franchiseBrand === next.franchiseBrand));
  const violatesCategoryStreak = (c: UnifiedCandidate) =>
    !(c.source === "cooking" && prev.source === "cooking") && c.category === prev.category;

  const base = unifiedPool.filter((c) => {
    if (excludedIds.has(c.basePlaceId)) return false;
    if (c.mealMode === "share" && !shareableAllowed) return false;
    return true;
  });

  const tiers: ((c: UnifiedCandidate) => boolean)[] = [
    (c) => !isSameAsCurrent(c) && !violatesPrev(c) && !violatesNext(c) && !violatesCategoryStreak(c),
    (c) => !isSameAsCurrent(c) && !violatesPrev(c) && !violatesCategoryStreak(c),
    (c) => !isSameAsCurrent(c) && !violatesPrev(c),
  ];

  let candidates: UnifiedCandidate[] = [];
  for (const tier of tiers) {
    candidates = base.filter(tier);
    if (candidates.length > 0) break;
  }
  if (candidates.length === 0) return null;

  let best: { c: UnifiedCandidate; score: number; reasonTags: string[] } | null = null;
  for (const c of candidates) {
    const { score, reasonTags } = scoreCandidate(c, {
      perMealAllowance,
      remainingBudget,
      profile,
      options,
      prefs,
      placeUsage,
      categoryUsage,
    });
    if (!best || score > best.score) best = { c, score, reasonTags };
  }

  return best ? { c: best.c, reasonTags: best.reasonTags } : null;
}

/**
 * 플랜 생성/교체 후에 실행하는 후처리 단계.
 * - 같은 메뉴가 바로 다음 끼니에 또 나오는 경우
 * - 같은 식당/브랜드가 연속으로 나오는 경우
 * - 같은 카테고리가 3번 이상 연속되는 경우
 * 를 찾아서 순서대로(앞에서부터) 다른 후보로 교체한다. 대체 후보가 부족하면
 * 같은 메뉴/식당 회피를 카테고리 회피보다 우선한다.
 */
function enforceMealDiversity(
  meals: MealPlanItem[],
  unifiedPool: UnifiedCandidate[],
  budget: number,
  planId: "save" | "balance" | "near",
  options: Set<OptionKey>,
  prefs: UserPreferences,
  excludedIds: Set<string>,
  location: string,
  /**
   * 이 인덱스(0-based)는 절대 다시 바꾸지 않는다. 방금 사용자가 "비싸요"/"너무 멀어요" 등으로
   * 직접 고른 끼니를, 다양성 정리가 원래의(더 비싸거나 먼) 후보로 되돌려버리는 걸 막기 위함이다.
   * 이웃 끼니가 이 자리와 충돌하면 이웃 쪽을 바꿔서 해결한다.
   */
  protectedIndex: number | null = null
): MealPlanItem[] {
  if (meals.length <= 1) return meals;

  const result = [...meals];
  const profile = applyOptionAdjustments(basePlanProfile(planId), options, prefs, budget / meals.length);
  const shareableAllowed = options.has("shareableOk");
  let categoryStreak = 1;

  for (let i = 1; i < result.length; i++) {
    const prev = result[i - 1];
    const curr = result[i];
    const next = i + 1 < result.length ? result[i + 1] : null;

    // 직접요리끼리는 연속 배치를 허용한다 (카레→카레→편의점→카레 같은 패턴이 자연스러움).
    // 반복 총량은 scoreCandidate의 repeatQuota 페널티가 따로 관리하므로 여기서는 막지 않는다.
    const bothCooking = curr.source === "cooking" && prev.source === "cooking";

    const sameMenu = !bothCooking && curr.menuName === prev.menuName;
    const samePlace = !bothCooking && curr.placeId !== null && curr.placeId === prev.placeId;
    const sameBrand = !bothCooking && !!curr.franchiseBrand && curr.franchiseBrand === prev.franchiseBrand;
    const prospectiveStreak = curr.category === prev.category ? categoryStreak + 1 : 1;
    const categoryViolation = !bothCooking && prospectiveStreak >= 3;

    if (i !== protectedIndex && (sameMenu || samePlace || sameBrand || categoryViolation)) {
      const replacement = findDiversityReplacement(
        curr,
        prev,
        next,
        result,
        i,
        unifiedPool,
        budget,
        profile,
        options,
        prefs,
        excludedIds,
        shareableAllowed
      );

      if (replacement) {
        const spentBefore = result.slice(0, i).reduce((s, m) => s + m.priceValue, 0);
        const remainingBudget = Math.max(budget - spentBefore, 0);
        const remainingAfter = remainingBudget - replacement.c.price;
        const sideSuggestion = pickSideSuggestion(replacement.c, options, remainingAfter);

        let note: string;
        if (sameMenu) {
          note = "앞 끼니와 겹치지 않게 다른 메뉴로 배치했어요.";
        } else if (samePlace || sameBrand) {
          note = "같은 식당이 연달아 나오지 않게 다른 곳으로 바꿨어요.";
        } else {
          note = `${prev.category}이(가) 연속되지 않도록 다른 메뉴로 배치했어요.`;
        }
        const reason = `${note} ${buildReason(replacement.c, replacement.reasonTags, location)}`;
        result[i] = toMealPlanItem(curr.mealIndex, replacement.c, reason, sideSuggestion, replacement.reasonTags);
      }
      // 대체 후보를 못 찾으면(선택지가 너무 적으면) 그대로 둔다.
    }

    categoryStreak = result[i].category === prev.category ? categoryStreak + 1 : 1;
  }

  return result;
}

// ---------- 예산 사용률 목표(85~95%) 맞추기 ----------

const SPEND_TARGET_LOW = 0.85;
const SPEND_TARGET_HIGH = 0.95;

function neighborsOf(meals: MealPlanItem[], index: number): [MealPlanItem | null, MealPlanItem | null] {
  const prev = index > 0 ? meals[index - 1] : null;
  const next = index < meals.length - 1 ? meals[index + 1] : null;
  return [prev, next];
}

function violatesNeighbor(c: UnifiedCandidate, m: MealPlanItem | null): boolean {
  if (!m) return false;
  if (c.source === "cooking" && m.source === "cooking") return false; // 요리끼리는 연속 반복 허용
  return (
    c.menuName === m.menuName ||
    c.basePlaceId === m.placeId ||
    (!!c.franchiseBrand && !!m.franchiseBrand && c.franchiseBrand === m.franchiseBrand)
  );
}

function buildDuplicateMaps(meals: MealPlanItem[], skipIndex: number) {
  const placeUsage = new Map<string, number>();
  const categoryUsage = new Map<string, number>();
  meals.forEach((m, j) => {
    if (j === skipIndex) return;
    if (m.placeId) placeUsage.set(m.placeId, (placeUsage.get(m.placeId) ?? 0) + 1);
    categoryUsage.set(m.category, (categoryUsage.get(m.category) ?? 0) + 1);
  });
  return { placeUsage, categoryUsage };
}

/** 현재보다 더 비싸면서(=더 든든/만족스러우면서) maxPrice를 넘지 않는 후보를 찾는다. */
function findSpendUpgrade(
  meals: MealPlanItem[],
  index: number,
  unifiedPool: UnifiedCandidate[],
  maxPrice: number,
  profile: WeightProfile,
  options: Set<OptionKey>,
  prefs: UserPreferences,
  excludedIds: Set<string>,
  shareableAllowed: boolean
): { c: UnifiedCandidate; reasonTags: string[] } | null {
  const current = meals[index];
  const [prev, next] = neighborsOf(meals, index);
  const { placeUsage, categoryUsage } = buildDuplicateMaps(meals, index);

  const base = unifiedPool.filter((c) => {
    if (excludedIds.has(c.basePlaceId)) return false;
    if (c.mealMode === "share" && !shareableAllowed) return false;
    if (c.price <= current.priceValue) return false; // 반드시 더 만족스러운(비싼) 후보
    if (c.price > maxPrice) return false; // 예산 초과 방지
    return true;
  });

  let candidates = base.filter((c) => !violatesNeighbor(c, prev) && !violatesNeighbor(c, next));
  if (candidates.length === 0) candidates = base;
  if (candidates.length === 0) return null;

  let best: { c: UnifiedCandidate; score: number; reasonTags: string[] } | null = null;
  for (const c of candidates) {
    const { score, reasonTags } = scoreCandidate(c, {
      perMealAllowance: maxPrice,
      remainingBudget: maxPrice,
      profile,
      options,
      prefs,
      placeUsage,
      categoryUsage,
      seed: 0,
    });
    if (!best || score > best.score) best = { c, score, reasonTags };
  }
  return best ? { c: best.c, reasonTags: best.reasonTags } : null;
}

/** 현재보다 더 저렴한 후보를 찾는다 (예산 초과 안전장치용). */
function findSpendDowngrade(
  meals: MealPlanItem[],
  index: number,
  unifiedPool: UnifiedCandidate[],
  profile: WeightProfile,
  options: Set<OptionKey>,
  prefs: UserPreferences,
  excludedIds: Set<string>,
  shareableAllowed: boolean
): { c: UnifiedCandidate; reasonTags: string[] } | null {
  const current = meals[index];
  const [prev, next] = neighborsOf(meals, index);
  const { placeUsage, categoryUsage } = buildDuplicateMaps(meals, index);

  const base = unifiedPool.filter((c) => {
    if (excludedIds.has(c.basePlaceId)) return false;
    if (c.mealMode === "share" && !shareableAllowed) return false;
    if (c.price >= current.priceValue) return false; // 반드시 더 저렴한 후보
    return true;
  });

  let candidates = base.filter((c) => !violatesNeighbor(c, prev) && !violatesNeighbor(c, next));
  if (candidates.length === 0) candidates = base;
  if (candidates.length === 0) return null;

  // 다운그레이드의 목표는 "예산 안에 들어오는 것"이므로, 배정액을 맞추는 일반 채점 대신
  // 무조건 더 저렴한 쪽을 우선한다(동률이면 취향/거리 점수로 tie-break).
  const cheapestPrice = Math.min(...candidates.map((c) => c.price));
  const cheapestTier = candidates.filter((c) => c.price <= cheapestPrice * 1.1);

  let best: { c: UnifiedCandidate; score: number; reasonTags: string[] } | null = null;
  for (const c of cheapestTier) {
    const { score, reasonTags } = scoreCandidate(c, {
      perMealAllowance: cheapestPrice,
      remainingBudget: cheapestPrice,
      profile: { ...profile, preferCheapest: true },
      options,
      prefs,
      placeUsage,
      categoryUsage,
      seed: 0,
    });
    if (!best || score > best.score) best = { c, score, reasonTags };
  }
  return best ? { c: best.c, reasonTags: best.reasonTags } : null;
}

function buildSpendUpgradeNote(current: MealPlanItem, upgraded: UnifiedCandidate): string {
  if (current.mealMode === "single" && upgraded.mealMode === "set") {
    return "예산에 여유가 있어 단품 대신 세트로 계산했어요.";
  }
  if ((current.source === "convenience" || current.source === "cooking") && upgraded.source === "eatout") {
    return "남는 돈이 너무 많아 편의점 대신 실제 식당을 넣었어요.";
  }
  return "예산에 여유가 있어 더 든든한 메뉴로 바꿨어요.";
}

/**
 * 최종 지출이 예산의 85~95%에 가까워지도록 끼니를 업그레이드/다운그레이드한다.
 * - 너무 적게 쓰면(85% 미만): 저렴한 끼니부터 더 만족스러운 후보로 업그레이드
 * - 예산을 초과하면: 비싼 끼니부터 더 저렴한 후보로 다운그레이드 (모든 플랜 공통 안전장치)
 * 최대 절약 플랜은 "최소 지출"이 목적이므로 업그레이드 대상에서 제외한다.
 */
function enforceSpendTarget(
  meals: MealPlanItem[],
  unifiedPool: UnifiedCandidate[],
  budget: number,
  planId: "save" | "balance" | "near",
  options: Set<OptionKey>,
  prefs: UserPreferences,
  excludedIds: Set<string>,
  location: string
): MealPlanItem[] {
  if (meals.length === 0) return meals;

  let result = [...meals];
  const shareableAllowed = options.has("shareableOk");
  const avgPerMeal = budget / result.length;
  const profile = applyOptionAdjustments(basePlanProfile(planId), options, prefs, avgPerMeal);

  const spendOf = (arr: MealPlanItem[]) => arr.reduce((s, m) => s + m.priceValue, 0);

  // 예산 초과: 비싼 것부터 저렴한 후보로 교체 (모든 플랜 공통 안전장치).
  // 한 바퀴로 안 끝나면 예산 안에 들어올 때까지(또는 더 못 줄일 때까지) 여러 바퀴 반복한다.
  let spend = spendOf(result);
  let downgradeGuard = 0;
  while (spend > budget && downgradeGuard < result.length * 4) {
    downgradeGuard += 1;
    // 나눠먹기 끼니는 이 후처리 대상에서 뺀다 — 어렵게 확보한 나눠먹기 자리를
    // "비싸다"는 이유로 지워버리면 shareMin 보장이 깨진다.
    const order = result
      .map((_, idx) => idx)
      .filter((idx) => result[idx].mealMode !== "share")
      .sort((a, b) => result[b].priceValue - result[a].priceValue);

    let changedInThisPass = false;
    for (const idx of order) {
      spend = spendOf(result);
      if (spend <= budget) break;

      const downgrade = findSpendDowngrade(
        result,
        idx,
        unifiedPool,
        profile,
        options,
        prefs,
        excludedIds,
        shareableAllowed
      );
      if (downgrade) {
        const reason = `목표 예산에 맞추기 위해 저가 메뉴와 든든한 메뉴를 섞었어요. ${buildReason(
          downgrade.c,
          downgrade.reasonTags,
          location
        )}`;
        result[idx] = toMealPlanItem(result[idx].mealIndex, downgrade.c, reason, undefined, downgrade.reasonTags);
        changedInThisPass = true;
      }
    }

    spend = spendOf(result);
    if (!changedInThisPass) break; // 더 이상 내릴 후보가 없으면 무한루프 방지를 위해 멈춘다
  }

  // 최대 절약 플랜은 "최소 지출"이 목적이므로 업그레이드는 하지 않는다.
  if (planId === "save") return result;

  // 너무 적게 씀: 저렴한 것부터 더 만족스러운 후보로 업그레이드
  spend = spendOf(result);
  const targetLow = budget * SPEND_TARGET_LOW;
  const targetHigh = budget * SPEND_TARGET_HIGH;

  if (spend < targetLow) {
    // 업그레이드 대상에서도 나눠먹기 끼니는 뺀다 (같은 이유: 이미 확보한 자리를 지우면 안 됨).
    const order = result
      .map((_, idx) => idx)
      .filter((idx) => result[idx].mealMode !== "share")
      .sort((a, b) => result[a].priceValue - result[b].priceValue);

    for (const idx of order) {
      spend = spendOf(result);
      if (spend >= targetLow) break;

      const current = result[idx];
      const maxPrice = current.priceValue + (targetHigh - spend);
      if (maxPrice <= current.priceValue) continue;

      const upgrade = findSpendUpgrade(
        result,
        idx,
        unifiedPool,
        maxPrice,
        profile,
        options,
        prefs,
        excludedIds,
        shareableAllowed
      );
      if (upgrade) {
        const remainingAfter = maxPrice - upgrade.c.price;
        const sideSuggestion = pickSideSuggestion(upgrade.c, options, remainingAfter);
        const note = buildSpendUpgradeNote(current, upgrade.c);
        const reason = `${note} ${buildReason(upgrade.c, upgrade.reasonTags, location)}`;
        result[idx] = toMealPlanItem(current.mealIndex, upgrade.c, reason, sideSuggestion, upgrade.reasonTags);
      }
    }
  }

  return result;
}

function computeSummary(
  meals: MealPlanItem[],
  totalBudget: number,
  prefs: UserPreferences,
  seed = 0
): PlanSummary {
  const estimatedSpend = meals.reduce((sum, m) => sum + m.priceValue, 0);
  const remaining = totalBudget - estimatedSpend;
  const { grade, subtitle, message, avgPerMeal } = computeSurvivalGrade(
    totalBudget,
    meals.length,
    estimatedSpend,
    seed
  );

  const eatoutCount = meals.filter((m) => m.source === "eatout").length;
  const convenienceCount = meals.filter((m) => m.source === "convenience").length;
  const cookingCount = meals.filter((m) => m.source === "cooking").length;

  const distanceMeals = meals.filter((m) => m.distanceMeters !== null);
  const averageDistance =
    distanceMeals.length > 0
      ? Math.round(
          distanceMeals.reduce((sum, m) => sum + (m.distanceMeters ?? 0), 0) / distanceMeals.length
        )
      : 0;

  const personaLine = describePersona(prefs).join(" · ");
  const diversity = computeDiversityMetrics(meals);
  const budgetUsageRatio = totalBudget > 0 ? Math.round((estimatedSpend / totalBudget) * 100) : 0;

  return {
    totalBudget,
    estimatedSpend,
    remaining,
    survivalGrade: grade,
    survivalSubtitle: subtitle,
    survivalMessage: message,
    avgPerMeal,
    eatoutCount,
    convenienceCount,
    cookingCount,
    averageDistance,
    personaLine,
    diversityScore: diversity.diversityScore,
    hasConsecutiveMenuRepeat: diversity.hasConsecutiveMenuRepeat,
    hasConsecutivePlaceRepeat: diversity.hasConsecutivePlaceRepeat,
    budgetUsageRatio,
  };
}

function toMealPlanItem(
  mealIndex: number,
  c: UnifiedCandidate,
  reason: string,
  sideSuggestion?: { menuName: string; price: number },
  contextTags: string[] = []
): MealPlanItem {
  let priceLabel: string;
  if (c.mealMode === "share" && c.totalPrice !== undefined && c.servings !== undefined) {
    priceLabel = `총 ${c.totalPrice.toLocaleString("ko-KR")}원 · ${c.servings}명 기준 내 부담 ${c.price.toLocaleString(
      "ko-KR"
    )}원`;
  } else if (c.mealMode === "cooking" && c.totalCost !== undefined && c.mealsCovered !== undefined) {
    priceLabel = `장보기 예상 ${c.totalCost.toLocaleString("ko-KR")}원 · ${c.mealsCovered}끼 해결 · 한 끼 ${c.price.toLocaleString(
      "ko-KR"
    )}원`;
  } else if (c.isCurated) {
    priceLabel = toFranchiseBaseLabel(c.price);
  } else {
    priceLabel = `예상 ${(Math.floor(c.price / 1000) * 1000).toLocaleString("ko-KR")}원대`;
  }

  return {
    mealIndex,
    source: c.source,
    mealMode: c.mealMode,
    menuName: c.menuName,
    placeName: c.placeName,
    priceLabel,
    priceValue: c.price,
    distanceMeters: c.distanceMeters,
    category: c.category,
    placeUrl: c.placeUrl,
    placeId: c.basePlaceId,
    franchiseBrand: c.franchiseBrand,
    reason,
    tags: c.tags,
    isCurated: c.isCurated,
    shareInfo:
      c.mealMode === "share" && c.totalPrice !== undefined && c.servings !== undefined
        ? { totalPrice: c.totalPrice, servings: c.servings }
        : undefined,
    sideSuggestion,
    survivalScore: c.survivalScore,
    survivalLabels: Array.from(new Set([...c.survivalStaticLabels, ...contextTags])).slice(0, 4),
  };
}

/**
 * 사이드 메뉴(canBeStandaloneMeal=false)는 단독 추천하지 않는 대신,
 * 1) 나눠먹기 메뉴를 골랐거나 2) 예산이 남았고 "세트/사이드도 OK"를 선택했을 때
 * 같은 브랜드의 사이드를 "추가하면 좋은 사이드"로 곁들여 보여준다.
 */
function pickSideSuggestion(
  c: UnifiedCandidate,
  options: Set<OptionKey>,
  remainingAfter: number
): { menuName: string; price: number } | undefined {
  if (!c.isCurated || !c.franchiseBrand) return undefined;
  const shouldAttach = c.mealMode === "share" || (options.has("styleSetOk") && remainingAfter > 0);
  if (!shouldAttach) return undefined;
  return findSideMenu(c.franchiseBrand) ?? undefined;
}

/** 나눠먹기 메뉴의 최소/최대 등장 횟수를 계산한다. */
function computeShareBounds(mealsCount: number): { min: number; max: number } {
  const min = Math.max(1, Math.ceil(mealsCount * 0.1));
  const max = Math.max(min, Math.floor(mealsCount * 0.2));
  return { min, max };
}

function generateSinglePlan(
  planId: "save" | "balance" | "near",
  planName: string,
  unifiedPool: UnifiedCandidate[],
  budget: number,
  mealsCount: number,
  options: Set<OptionKey>,
  prefs: UserPreferences,
  excludedIds: Set<string>,
  location: string,
  seed: number
): MealPlan {
  const profile = applyOptionAdjustments(basePlanProfile(planId), options, prefs, budget / mealsCount);

  // 나눠먹기: "나눠먹기 가능" 옵션을 켰을 때만 후보에 넣고, 전체 끼니의 10~20% 범위로 등장시킨다.
  const shareableAllowed = options.has("shareableOk");
  const { min: shareMin, max: shareMax } = shareableAllowed
    ? computeShareBounds(mealsCount)
    : { min: 0, max: 0 };
  let shareableUsedCount = 0;

  const placeUsage = new Map<string, number>();
  const categoryUsage = new Map<string, number>();
  const meals: MealPlanItem[] = [];
  let remainingBudget = budget;

  const basePool = unifiedPool.filter((c) => {
    if (excludedIds.has(c.basePlaceId)) return false;
    if (c.mealMode === "share" && !shareableAllowed) return false;
    return true;
  });

  // shareMin을 보장하기 위해 끼니 슬롯 중 일부를 "나눠먹기 전용"으로 미리 예약해둔다.
  const reservedShareSlots = new Set<number>();
  if (shareableAllowed && shareMin > 0) {
    for (let k = 1; k <= shareMin; k++) {
      const idx = Math.min(mealsCount, Math.max(1, Math.round((k * mealsCount) / (shareMin + 1))));
      reservedShareSlots.add(idx);
    }
  }

  for (let i = 1; i <= mealsCount; i++) {
    const remainingMeals = mealsCount - i + 1;
    const perMealAllowance = remainingBudget / remainingMeals;
    const shareSlotsAvailable = shareableUsedCount < shareMax;

    let slotPool: UnifiedCandidate[];
    if (reservedShareSlots.has(i) && shareSlotsAvailable) {
      const affordableShare = basePool.filter(
        (c) => c.mealMode === "share" && c.price <= Math.max(remainingBudget, 0)
      );
      slotPool =
        affordableShare.length > 0
          ? affordableShare
          : basePool.filter((c) => c.mealMode !== "share" || shareSlotsAvailable);
    } else {
      slotPool = basePool.filter((c) => c.mealMode !== "share" || shareSlotsAvailable);
    }

    const affordable = slotPool.filter((c) => c.price <= Math.max(remainingBudget, 0));
    const pickPool = affordable.length > 0 ? affordable : slotPool;

    let best: { c: UnifiedCandidate; score: number; reasonTags: string[] } | null = null;
    for (const c of pickPool) {
      const { score, reasonTags } = scoreCandidate(c, {
        perMealAllowance,
        remainingBudget,
        profile,
        options,
        prefs,
        placeUsage,
        categoryUsage,
        seed,
      });
      if (!best || score > best.score) {
        best = { c, score, reasonTags };
      }
    }

    if (!best) break;

    const remainingAfter = remainingBudget - best.c.price;
    const sideSuggestion = pickSideSuggestion(best.c, options, remainingAfter);
    const reason = buildReason(best.c, best.reasonTags, location);
    meals.push(toMealPlanItem(i, best.c, reason, sideSuggestion, best.reasonTags));

    placeUsage.set(best.c.basePlaceId, (placeUsage.get(best.c.basePlaceId) ?? 0) + 1);
    categoryUsage.set(best.c.category, (categoryUsage.get(best.c.category) ?? 0) + 1);
    remainingBudget = remainingAfter;
    if (best.c.mealMode === "share") shareableUsedCount += 1;
  }

  const diversifiedMeals = enforceMealDiversity(
    meals,
    unifiedPool,
    budget,
    planId,
    options,
    prefs,
    excludedIds,
    location
  );

  const spendAdjustedMeals = enforceSpendTarget(
    diversifiedMeals,
    unifiedPool,
    budget,
    planId,
    options,
    prefs,
    excludedIds,
    location
  );

  // 주의: 여기서 enforceMealDiversity를 한 번 더 돌리지 않는다. 그 함수는 가격 상한을 모르기 때문에,
  // 방금 다운그레이드로 예산을 맞춘 자리를 다시 비싼 후보로 되돌려버릴 수 있다(실제로 발견된 버그).
  // 업그레이드/다운그레이드 탐색 자체에 이웃 회피 로직이 이미 들어있어 중복 실행은 불필요하다.
  //
  // shareShortfall은 반드시 후처리(다양성 정리·지출 조정)까지 끝난 "최종" 끼니 목록 기준으로
  // 다시 세야 한다. 후처리 과정에서 나눠먹기 끼니가 다른 후보로 바뀌어 사라질 수 있는데,
  // 후처리 전 카운트를 그대로 쓰면 실제로는 부족한데도 "충분하다"고 잘못 표시하게 된다.
  const finalShareCount = spendAdjustedMeals.filter((m) => m.mealMode === "share").length;
  const shareShortfall = shareableAllowed && finalShareCount < shareMin;

  return { planId, planName, meals: spendAdjustedMeals, shareShortfall };
}

// ---------- 예산 초부족(모든 끼니를 최저가로 채워도 부족한 상태) 판정 ----------

/** 오직 가격만 보고 repeatQuota를 지키며 count개를 채운다. 취향/거리/다양성은 전혀 고려하지 않는다. */
function pickCheapestMeals(
  unifiedPool: UnifiedCandidate[],
  excludedIds: Set<string>,
  allowShare: boolean,
  count: number
): UnifiedCandidate[] {
  const base = unifiedPool.filter(
    (c) => !excludedIds.has(c.basePlaceId) && (allowShare || c.mealMode !== "share")
  );
  const usage = new Map<string, number>();
  const picks: UnifiedCandidate[] = [];

  for (let i = 0; i < count; i++) {
    const available = base.filter((c) => (usage.get(c.basePlaceId) ?? 0) < c.repeatQuota);
    if (available.length === 0) break;
    available.sort((a, b) => a.price - b.price);
    const picked = available[0];
    picks.push(picked);
    usage.set(picked.basePlaceId, (usage.get(picked.basePlaceId) ?? 0) + 1);
  }

  return picks;
}

/** 가격이 낮은 순으로 정렬해서, budget 안에 몇 개까지 누적으로 들어가는지 센다. */
function countAffordable(picks: UnifiedCandidate[], budget: number): number {
  const sorted = [...picks].sort((a, b) => a.price - b.price);
  let cumulative = 0;
  let count = 0;
  for (const c of sorted) {
    if (cumulative + c.price > budget) break;
    cumulative += c.price;
    count++;
  }
  return count;
}

/**
 * 모든 끼니를 최저 생존 메뉴로만 채워도 예산이 부족한지 판정한다.
 * 부족하면, 실제로 해결 가능한 끼니는 카드로, 나머지는 "빈 끼니"로 표시할 수 있도록
 * 데이터를 구성하고, 예산을 늘리거나 나눠먹기를 켰을 때 얼마나 나아지는지도 함께 계산한다.
 */
export function analyzeMinimalSurvival(
  pool: CandidatePool,
  budget: number,
  mealsCount: number,
  options: OptionKey[],
  prefs: UserPreferences
): MinimalSurvivalResult {
  const unifiedPool = buildUnifiedPool(pool);
  const excludedIds = new Set(prefs.excludedPlaceIds);
  const shareableAllowed = new Set(options).has("shareableOk");

  const minimalPicks = pickCheapestMeals(unifiedPool, excludedIds, shareableAllowed, mealsCount);
  const totalMinCost = minimalPicks.reduce((sum, c) => sum + c.price, 0);
  const avgMinPrice = minimalPicks.length > 0 ? Math.round(totalMinCost / minimalPicks.length) : 0;
  const isSevereShortfall = minimalPicks.length < mealsCount || totalMinCost > budget;

  if (!isSevereShortfall) {
    return {
      isSevereShortfall: false,
      mealsRequested: mealsCount,
      affordableCount: mealsCount,
      shortfallCount: 0,
      avgMinPrice,
      totalMinCost,
      meals: [],
      extraMealsPerExtraBudget: 0,
      extraMealsWithShareable: 0,
    };
  }

  const affordableCount = countAffordable(minimalPicks, budget);
  const shortfallCount = mealsCount - affordableCount;
  const sortedPicks = [...minimalPicks].sort((a, b) => a.price - b.price);

  const meals: MealPlanItem[] = [];
  for (let i = 0; i < mealsCount; i++) {
    if (i < affordableCount && sortedPicks[i]) {
      const c = sortedPicks[i];
      meals.push(
        toMealPlanItem(
          i + 1,
          c,
          "예산 안에서 가장 저렴하게 해결할 수 있는 최저 생존 메뉴예요."
        )
      );
    } else {
      meals.push({
        mealIndex: i + 1,
        source: "cooking",
        mealMode: "single",
        menuName: "빈 끼니",
        placeName: "",
        priceLabel: "예산 부족으로 추천 불가",
        priceValue: 0,
        distanceMeters: null,
        category: "",
        placeUrl: null,
        placeId: null,
        reason: "이 끼니는 추가 예산이 필요해요.",
        tags: [],
        isCurated: false,
        isEmpty: true,
      });
    }
  }

  const affordableWithMoreBudget = countAffordable(minimalPicks, budget + 5000);
  const extraMealsPerExtraBudget = Math.max(0, affordableWithMoreBudget - affordableCount);

  let extraMealsWithShareable = 0;
  if (!shareableAllowed) {
    const picksWithShare = pickCheapestMeals(unifiedPool, excludedIds, true, mealsCount);
    const totalWithShare = picksWithShare.reduce((sum, c) => sum + c.price, 0);
    const affordableWithShare =
      picksWithShare.length >= mealsCount && totalWithShare <= budget
        ? mealsCount
        : countAffordable(picksWithShare, budget);
    extraMealsWithShareable = Math.max(0, affordableWithShare - affordableCount);
  }

  return {
    isSevereShortfall: true,
    mealsRequested: mealsCount,
    affordableCount,
    shortfallCount,
    avgMinPrice,
    totalMinCost,
    meals,
    extraMealsPerExtraBudget,
    extraMealsWithShareable,
  };
}

export interface GeneratedPlan {
  plan: MealPlan;
  summary: PlanSummary;
}

export function generatePlans(
  pool: CandidatePool,
  budget: number,
  mealsCount: number,
  options: OptionKey[],
  prefs: UserPreferences,
  location: string,
  /**
   * 0(기본)이면 완전히 결정론적인 결과를 준다. "전체 다시 추천"처럼 같은 입력으로도
   * 다른 배치를 보여주고 싶을 때 매번 다른 값(예: Date.now())을 넘기면 된다.
   */
  seed = 0
): GeneratedPlan[] {
  const unifiedPool = buildUnifiedPool(pool);
  const optionSet = new Set(options);
  const excludedIds = new Set(prefs.excludedPlaceIds);

  const planDefs: { id: "save" | "balance" | "near"; name: string }[] = [
    { id: "save", name: "최대 절약 플랜" },
    { id: "balance", name: "균형 플랜" },
    { id: "near", name: "가까운 곳 위주 플랜" },
  ];

  return planDefs.map(({ id, name }, planIndex) => {
    const plan = generateSinglePlan(
      id,
      name,
      unifiedPool,
      budget,
      mealsCount,
      optionSet,
      prefs,
      excludedIds,
      location,
      seed === 0 ? 0 : seed + planIndex
    );
    const summary = computeSummary(plan.meals, budget, prefs, seed === 0 ? 0 : seed + planIndex);
    return { plan, summary };
  });
}

/** 특정 끼니 하나만 비슷한 조건으로 교체한다. */
export type ReplaceFeedback = "tooFar" | "tooExpensive" | "notAppealing" | "exclude" | "reroll";

export function replaceMeal(
  plan: MealPlan,
  mealIndex: number,
  feedback: ReplaceFeedback,
  pool: CandidatePool,
  budget: number,
  options: OptionKey[],
  prefs: UserPreferences,
  location: string,
  seed = 0
): { plan: MealPlan; summary: PlanSummary } {
  const unifiedPool = buildUnifiedPool(pool);
  const optionSet = new Set(options);
  const excludedIds = new Set(prefs.excludedPlaceIds);

  const targetMeal = plan.meals.find((m) => m.mealIndex === mealIndex);
  if (!targetMeal) {
    const summary = computeSummary(plan.meals, budget, prefs, seed);
    return { plan, summary };
  }

  const otherMeals = plan.meals.filter((m) => m.mealIndex !== mealIndex);
  const otherPlaceIds = new Set(otherMeals.map((m) => m.placeId).filter(Boolean) as string[]);

  const otherSpend = otherMeals.reduce((sum, m) => sum + m.priceValue, 0);
  const remainingBudget = Math.max(budget - otherSpend, 0);
  const perMealAllowance = remainingBudget;

  const profile = applyOptionAdjustments(
    basePlanProfile(plan.planId),
    optionSet,
    prefs,
    budget / plan.meals.length
  );

  const shareableAllowed = optionSet.has("shareableOk");
  const { min: shareMin, max: shareMax } = shareableAllowed
    ? computeShareBounds(plan.meals.length)
    : { min: 0, max: 0 };
  const shareableUsedElsewhere = otherMeals.filter((m) => m.mealMode === "share").length;
  const shareableSlotOpen = shareableUsedElsewhere < shareMax;

  // 나머지 끼니의 매장/카테고리도 중복·다양성 점수에 반영한다.
  const placeUsage = new Map<string, number>();
  const categoryUsage = new Map<string, number>();
  for (const m of otherMeals) {
    if (m.placeId) placeUsage.set(m.placeId, (placeUsage.get(m.placeId) ?? 0) + 1);
    categoryUsage.set(m.category, (categoryUsage.get(m.category) ?? 0) + 1);
  }

  const shareOk = (c: UnifiedCandidate) =>
    c.mealMode !== "share" || (shareableAllowed && shareableSlotOpen);

  let candidates = unifiedPool.filter((c) => {
    if (excludedIds.has(c.basePlaceId)) return false;
    if (otherPlaceIds.has(c.basePlaceId)) return false;
    if (c.basePlaceId === targetMeal.placeId) return false;
    if (!shareOk(c)) return false;

    if (feedback === "tooFar") {
      // 요리는 "장소"가 아니라 이동 거리 개념이 없으므로, "너무 멀어요"의 대안으로는 부적절하다.
      // 실제 매장(외식/편의점) 중 더 가까운 곳만 후보로 남긴다.
      if (c.distanceMeters === null) return false;
      if (targetMeal.distanceMeters !== null && c.distanceMeters >= targetMeal.distanceMeters) return false;
    }
    if (feedback === "tooExpensive" && c.price >= targetMeal.priceValue) return false;
    if (feedback === "notAppealing" && c.category === targetMeal.category) return false;

    return true;
  });

  if (candidates.length === 0) {
    // 조건이 너무 빡빡하면 제외 목록/현재 자리만 지키고 완화한다.
    // 단, "너무 멀어요"였다면 완화하더라도 요리(이동 거리 없음)는 여전히 후보에서 뺀다 —
    // 사용자가 원한 건 "더 가까운 곳"이지 "이동 안 해도 되는 요리"가 아니기 때문.
    candidates = unifiedPool.filter(
      (c) =>
        !excludedIds.has(c.basePlaceId) &&
        !otherPlaceIds.has(c.basePlaceId) &&
        c.basePlaceId !== targetMeal.placeId &&
        shareOk(c) &&
        (feedback !== "tooFar" || c.distanceMeters !== null)
    );
  }

  let best: { c: UnifiedCandidate; score: number; reasonTags: string[] } | null = null;
  for (const c of candidates) {
    if (c.price > Math.max(remainingBudget, targetMeal.priceValue * 1.3)) continue;
    const { score, reasonTags } = scoreCandidate(c, {
      perMealAllowance,
      remainingBudget,
      profile,
      options: optionSet,
      prefs,
      placeUsage,
      categoryUsage,
      seed,
    });
    if (!best || score > best.score) {
      best = { c, score, reasonTags };
    }
  }

  if (!best) {
    const summary = computeSummary(plan.meals, budget, prefs, seed);
    return { plan, summary };
  }

  const remainingAfter = remainingBudget - best.c.price;
  const sideSuggestion = pickSideSuggestion(best.c, optionSet, remainingAfter);
  const reason = buildReason(best.c, best.reasonTags, location);
  const newMealItem = toMealPlanItem(mealIndex, best.c, reason, sideSuggestion, best.reasonTags);

  const swappedMeals = plan.meals.map((m) => (m.mealIndex === mealIndex ? newMealItem : m));
  const swappedIndex = swappedMeals.findIndex((m) => m.mealIndex === mealIndex);
  const newMeals = enforceMealDiversity(
    swappedMeals,
    unifiedPool,
    budget,
    plan.planId,
    optionSet,
    prefs,
    excludedIds,
    location,
    swappedIndex
  );
  const newShareCount = newMeals.filter((m) => m.mealMode === "share").length;
  const shareShortfall = shareableAllowed && newShareCount < shareMin;
  const newPlan: MealPlan = { ...plan, meals: newMeals, shareShortfall };
  const summary = computeSummary(newMeals, budget, prefs, seed);

  return { plan: newPlan, summary };
}
