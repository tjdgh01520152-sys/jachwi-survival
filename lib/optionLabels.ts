import { OptionKey } from "./types";

// OptionChips(UI)와 recommend.ts(추천 이유 문구)가 공유하는 옵션 메타데이터.
// core: true인 항목은 칩이 많은 그룹에서 기본 노출되고, 나머지는 "더 보기"로 펼쳐진다.
export interface OptionMeta {
  key: OptionKey;
  label: string;
  group: string;
  core?: boolean;
}

export const OPTION_META: OptionMeta[] = [
  { key: "closeFirst", label: "가까운 곳 우선", group: "거리·가격 성향" },
  { key: "balanced", label: "균형", group: "거리·가격 성향" },
  { key: "valueOverDistance", label: "멀어도 가성비", group: "거리·가격 성향" },
  { key: "mixCooking", label: "요리 섞기", group: "구성" },
  { key: "convenienceOk", label: "편의점 OK", group: "구성" },
  { key: "hearty", label: "든든하게", group: "구성" },
  { key: "varietySeeking", label: "다양하게 먹기", group: "반복 허용도" },
  { key: "mildRepeatOk", label: "적당히 반복 가능", group: "반복 허용도" },
  { key: "cheapRepeatOk", label: "싸면 반복 OK", group: "반복 허용도" },
  { key: "shareableOk", label: "나눠먹기 가능", group: "나눠먹기" },
  { key: "styleCheapest", label: "최대한 싸게", group: "식사 스타일" },
  { key: "styleBalanced", label: "적당히 든든하게", group: "식사 스타일" },
  { key: "styleSetOk", label: "세트/사이드도 OK", group: "식사 스타일" },

  // 좋아하는 취향 (12개, 4개만 기본 노출)
  { key: "likeSpicy", label: "매운 음식", group: "좋아하는 취향", core: true },
  { key: "likeMeat", label: "고기", group: "좋아하는 취향", core: true },
  { key: "likeSoup", label: "국물 메뉴", group: "좋아하는 취향", core: true },
  { key: "likeKorean", label: "한식 선호", group: "좋아하는 취향", core: true },
  { key: "likeMild", label: "담백한 음식", group: "좋아하는 취향" },
  { key: "likeCrispyFried", label: "바삭한/튀김류", group: "좋아하는 취향" },
  { key: "likeCheeseCream", label: "치즈/크림", group: "좋아하는 취향" },
  { key: "likeRice", label: "밥 메뉴", group: "좋아하는 취향" },
  { key: "likeNoodle", label: "면 메뉴", group: "좋아하는 취향" },
  { key: "likeBunsik", label: "분식", group: "좋아하는 취향" },
  { key: "likeFastfoodOk", label: "패스트푸드 OK", group: "좋아하는 취향" },
  { key: "likeNewMenu", label: "새로운 메뉴 도전", group: "좋아하는 취향" },

  // 피하고 싶은 것 (8개, 3개만 기본 노출)
  { key: "avoidSpicy", label: "매운 음식 피하기", group: "피하고 싶은 것", core: true },
  { key: "avoidNoodle", label: "면 피하기", group: "피하고 싶은 것", core: true },
  { key: "avoidMeat", label: "고기 피하기", group: "피하고 싶은 것", core: true },
  { key: "avoidFried", label: "튀김 피하기", group: "피하고 싶은 것" },
  { key: "avoidSeafood", label: "해산물 피하기", group: "피하고 싶은 것" },
  { key: "avoidGreasy", label: "느끼한 음식 피하기", group: "피하고 싶은 것" },
  { key: "avoidFlour", label: "밀가루 줄이기", group: "피하고 싶은 것" },
  { key: "avoidSmallPortion", label: "양 적은 메뉴 피하기", group: "피하고 싶은 것" },
];

export const OPTION_LABEL_BY_KEY: Partial<Record<OptionKey, string>> = Object.fromEntries(
  OPTION_META.map((o) => [o.key, o.label])
);

// 이 그룹들은 성격이 상반되는 선택지 3개짜리라 하나만 고를 수 있어야 한다(라디오 버튼처럼 동작).
// 같은 그룹에서 새 항목을 고르면 그 그룹의 이전 선택은 자동으로 해제된다.
export const SINGLE_SELECT_GROUPS = ["거리·가격 성향", "반복 허용도", "식사 스타일"];

export function isSingleSelectGroup(group: string): boolean {
  return SINGLE_SELECT_GROUPS.includes(group);
}
