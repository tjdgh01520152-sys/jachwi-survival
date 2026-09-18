// Kakao Local API는 실제 메뉴 가격을 제공하지 않기 때문에, 자주 보이는 프랜차이즈는
// "한 끼 해결 방식" 단위(단품/세트/나눠먹기)로 대표 메뉴의 "기준가"를 등록해둔다.
// 여기 있는 가격은 확정 가격이 아니라 프랜차이즈 공개 정보를 바탕으로 한 기준가이며,
// 매장/배달앱/프로모션에 따라 실제 가격은 달라질 수 있다. (화면에도 "프랜차이즈 기준가"로 표기)
//
// place_name에 matchKeywords 중 하나라도 포함되면 해당 브랜드의 메뉴들을 후보로 쓴다.
//
// mealMode 구분 ("어떻게 해결하는지")
// - single: 단품 (하나로 한 끼가 되는 메뉴)
// - set: 세트 (사이드/음료 포함, 더 든든하지만 더 비쌈)
// - share: 나눠먹기 메뉴 (totalPrice + servings로 등록, 예산 계산은 1인 부담금 기준)
//
// role 구분 ("한 끼에서 어떤 역할인지")
// - main: 그 자체로 한 끼가 되는 메인 메뉴
// - combo: 메인 + 사이드/음료가 묶인 세트
// - side: 밥/컵밥/감자튀김/음료 같은 곁들이 메뉴. 절대 단독 끼니로 추천하지 않는다.
//
// canBeStandaloneMeal이 false인 메뉴(=side)는 끼니 카드 후보 풀에 아예 들어가지 않는다.
// 대신 같은 브랜드의 메인/나눠먹기 메뉴가 선택됐을 때 "추가하면 좋은 사이드"로만 곁들여 보여준다.

export type MealMode = "single" | "set" | "share";
export type MenuRole = "main" | "combo" | "side";

interface MenuBase {
  id: string;
  menuName: string;
  role: MenuRole;
  canBeStandaloneMeal: boolean;
}

export interface SingleSetMenu extends MenuBase {
  mealMode: "single" | "set";
  price: number;
  fullness: number; // 1~10, 든든함 정도
}

export interface ShareMenu extends MenuBase {
  mealMode: "share";
  totalPrice: number;
  servings: number;
}

export type FranchiseMenu = SingleSetMenu | ShareMenu;

interface FranchiseBrand {
  brand: string;
  matchKeywords: string[];
  tags: string[]; // 브랜드 단위로 등록. 소속 메뉴 전체에 동일하게 적용된다.
  menus: FranchiseMenu[];
}

export const FRANCHISE_BRANDS: FranchiseBrand[] = [
  {
    brand: "동대문엽기떡볶이",
    matchKeywords: ["엽기떡볶이", "엽떡", "동대문엽기떡볶이"],
    tags: ["분식", "매운맛", "나눠먹기"],
    menus: [
      {
        id: "yupgi_tteokbokki_share",
        menuName: "엽기떡볶이",
        mealMode: "share",
        role: "main",
        canBeStandaloneMeal: true,
        totalPrice: 14000,
        servings: 2,
      },
      {
        id: "yupgi_rose_share",
        menuName: "로제떡볶이",
        mealMode: "share",
        role: "main",
        canBeStandaloneMeal: true,
        totalPrice: 16000,
        servings: 2,
      },
      {
        id: "yupgi_tunamayo_single",
        menuName: "참치마요밥",
        mealMode: "single",
        role: "side",
        canBeStandaloneMeal: false,
        price: 3500,
        fullness: 5,
      },
    ],
  },
  {
    brand: "맘스터치",
    matchKeywords: ["맘스터치", "맘터"],
    tags: ["버거", "치킨", "단품", "세트", "든든함"],
    menus: [
      {
        id: "momstouch_psy_single",
        menuName: "싸이버거 단품",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 5200,
        fullness: 6,
      },
      {
        id: "momstouch_psy_set",
        menuName: "싸이버거 세트",
        mealMode: "set",
        role: "combo",
        canBeStandaloneMeal: true,
        price: 7700,
        fullness: 8,
      },
      {
        id: "momstouch_bulgogi_single",
        menuName: "불고기버거 단품",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 4200,
        fullness: 6,
      },
    ],
  },
  {
    brand: "롯데리아",
    matchKeywords: ["롯데리아"],
    tags: ["버거", "불고기", "단품", "세트", "절약"],
    menus: [
      {
        id: "lotteria_deri_single",
        menuName: "데리버거 단품",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 3800,
        fullness: 5,
      },
      {
        id: "lotteria_bulgogi_single",
        menuName: "리아 불고기 단품",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 5100,
        fullness: 6,
      },
      {
        id: "lotteria_bulgogi_set",
        menuName: "리아 불고기 세트",
        mealMode: "set",
        role: "combo",
        canBeStandaloneMeal: true,
        price: 7500,
        fullness: 8,
      },
    ],
  },
  {
    brand: "맥도날드",
    matchKeywords: ["맥도날드", "McDonald"],
    tags: ["버거", "불고기", "단품", "세트", "절약"],
    menus: [
      {
        id: "mcdonald_hamburger_single",
        menuName: "햄버거 단품",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 3700,
        fullness: 5,
      },
      {
        id: "mcdonald_bulgogi_single",
        menuName: "불고기 버거 단품",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 4700,
        fullness: 6,
      },
      {
        id: "mcdonald_bulgogi_set",
        menuName: "불고기 버거 세트",
        mealMode: "set",
        role: "combo",
        canBeStandaloneMeal: true,
        price: 6900,
        fullness: 8,
      },
    ],
  },
  {
    brand: "한솥도시락",
    matchKeywords: ["한솥", "한솥도시락"],
    tags: ["도시락", "밥", "절약", "가성비", "든든함"],
    menus: [
      {
        id: "hansot_chickenmayo",
        menuName: "치킨마요",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 3900,
        fullness: 6,
      },
      {
        id: "hansot_donkatsu",
        menuName: "돈까스도련님",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 5200,
        fullness: 7,
      },
      {
        id: "hansot_dongbaek",
        menuName: "동백",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 6700,
        fullness: 8,
      },
    ],
  },
  {
    brand: "본죽",
    matchKeywords: ["본죽", "본죽&비빔밥", "본죽앤비빔밥"],
    tags: ["죽", "가벼움", "야채", "참치"],
    menus: [
      {
        id: "bonjuk_white",
        menuName: "흰죽",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 6000,
        fullness: 4,
      },
      {
        id: "bonjuk_vegetable7",
        menuName: "7가지야채죽",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 10000,
        fullness: 6,
      },
      {
        id: "bonjuk_tuna",
        menuName: "참치야채죽",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 11000,
        fullness: 6,
      },
    ],
  },
  {
    brand: "홍콩반점0410",
    matchKeywords: ["홍콩반점", "홍콩반점0410"],
    tags: ["중식", "면", "탕수육", "나눠먹기", "세트"],
    menus: [
      {
        id: "hongkong_jjajang",
        menuName: "짜장면",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 8000,
        fullness: 7,
      },
      {
        id: "hongkong_tangsuyuk_share",
        menuName: "탕수육",
        mealMode: "share",
        role: "main",
        canBeStandaloneMeal: true,
        totalPrice: 13800,
        servings: 2,
      },
      {
        id: "hongkong_meal_tangsuyuk_mini_set",
        menuName: "식사1+탕수육 미니 세트",
        mealMode: "set",
        role: "combo",
        canBeStandaloneMeal: true,
        price: 21800,
        fullness: 9,
      },
    ],
  },
  {
    brand: "써브웨이",
    matchKeywords: ["써브웨이", "서브웨이", "Subway"],
    tags: ["샌드위치", "단품", "세트", "가벼움", "든든함"],
    menus: [
      {
        id: "subway_eggmayo_single",
        menuName: "에그마요 15cm 단품",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 7200,
        fullness: 6,
      },
      {
        id: "subway_itbmt_single",
        menuName: "이탈리안 비엠티 15cm 단품",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 8500,
        fullness: 6,
      },
      {
        id: "subway_itbmt_set",
        menuName: "이탈리안 비엠티 15cm 세트",
        mealMode: "set",
        role: "combo",
        canBeStandaloneMeal: true,
        price: 12200,
        fullness: 8,
      },
    ],
  },
  {
    brand: "신전떡볶이",
    matchKeywords: ["신전떡볶이", "신전"],
    tags: ["분식", "매운맛", "떡볶이", "컵밥", "절약"],
    menus: [
      {
        id: "sinjeon_tteokbokki",
        menuName: "떡볶이",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 4000,
        fullness: 5,
      },
      {
        id: "sinjeon_cheese_tteokbokki",
        menuName: "치즈떡볶이",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 5500,
        fullness: 6,
      },
      {
        id: "sinjeon_tunamayo_cupbap",
        menuName: "참치마요컵밥",
        mealMode: "single",
        role: "side",
        canBeStandaloneMeal: false,
        price: 4500,
        fullness: 6,
      },
    ],
  },
  {
    brand: "이삭토스트",
    matchKeywords: ["이삭토스트", "이삭"],
    tags: ["토스트", "간편식", "절약", "아침"],
    menus: [
      {
        id: "isaac_hamcheese",
        menuName: "햄치즈 토스트",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 3600,
        fullness: 4,
      },
      {
        id: "isaac_hamspecial",
        menuName: "햄스페셜 토스트",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 4100,
        fullness: 5,
      },
      {
        id: "isaac_baconbest",
        menuName: "베이컨베스트 토스트",
        mealMode: "single",
        role: "main",
        canBeStandaloneMeal: true,
        price: 4600,
        fullness: 5,
      },
    ],
  },
];

export interface MatchedFranchiseMenu {
  brand: string;
  menu: FranchiseMenu;
  tags: string[];
  hasSetSibling: boolean; // 같은 브랜드에 세트 옵션이 따로 있는지 (단품일 때 이유 문구용)
}

/**
 * place_name을 기준으로 매칭되는 브랜드의 메뉴 후보 목록을 돌려준다. 매칭 안 되면 빈 배열.
 * canBeStandaloneMeal이 false인 사이드 메뉴도 포함해서 돌려주므로, 끼니 후보로 쓸 때는
 * 호출하는 쪽에서 canBeStandaloneMeal을 걸러야 한다.
 */
export function findFranchiseMenus(placeName: string): MatchedFranchiseMenu[] {
  for (const b of FRANCHISE_BRANDS) {
    if (b.matchKeywords.some((k) => placeName.includes(k))) {
      const hasSetSibling = b.menus.some((m) => m.mealMode === "set");
      return b.menus.map((menu) => ({ brand: b.brand, menu, tags: b.tags, hasSetSibling }));
    }
  }
  return [];
}

/** 브랜드 이름으로 "추가하면 좋은 사이드" 메뉴 하나를 찾는다. 없으면 null. */
export function findSideMenu(brand: string): { menuName: string; price: number } | null {
  const b = FRANCHISE_BRANDS.find((x) => x.brand === brand);
  if (!b) return null;
  const side = b.menus.find((m): m is SingleSetMenu => m.role === "side");
  if (!side) return null;
  return { menuName: side.menuName, price: side.price };
}
