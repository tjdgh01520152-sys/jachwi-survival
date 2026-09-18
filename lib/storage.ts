"use client";

import { UserPreferences, OptionKey } from "./types";

const STORAGE_KEY = "jachwi-survival:prefs:v1";

export const DEFAULT_PREFS: UserPreferences = {
  distanceSensitivity: 0.5,
  priceSensitivity: 0.5,
  likedTags: {},
  dislikedTags: {},
  cookingAffinity: 0.4,
  excludedPlaceIds: [],
};

export function loadPrefs(): UserPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFS,
      ...parsed,
      likedTags: parsed.likedTags ?? {},
      dislikedTags: parsed.dislikedTags ?? {},
      excludedPlaceIds: parsed.excludedPlaceIds ?? [],
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: UserPreferences) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function updatePrefs(patch: Partial<UserPreferences>): UserPreferences {
  const current = loadPrefs();
  const next = { ...current, ...patch };
  savePrefs(next);
  return next;
}

export function saveLastInput(location: string, budget: number, meals: number, options: OptionKey[]) {
  const current = loadPrefs();
  const next: UserPreferences = {
    ...current,
    lastInput: { location, budget, meals },
    lastOptions: options,
  };
  savePrefs(next);
  return next;
}

export function addExcludedPlace(placeId: string): UserPreferences {
  const current = loadPrefs();
  if (current.excludedPlaceIds.includes(placeId)) return current;
  const next = {
    ...current,
    excludedPlaceIds: [...current.excludedPlaceIds, placeId],
  };
  savePrefs(next);
  return next;
}

export function removeExcludedPlace(placeId: string): UserPreferences {
  const current = loadPrefs();
  const next = {
    ...current,
    excludedPlaceIds: current.excludedPlaceIds.filter((id) => id !== placeId),
  };
  savePrefs(next);
  return next;
}

function bump(record: Record<string, number>, key: string, delta: number) {
  const next = { ...record };
  next[key] = Math.max(0, Math.min(3, (next[key] ?? 0) + delta));
  return next;
}

export type FeedbackType = "tooFar" | "tooExpensive" | "notAppealing" | "exclude";

/** 카드 버튼 피드백을 개인화 상태에 반영한다. */
export function applyFeedback(
  type: FeedbackType,
  meal: { tags: string[]; category: string; placeId: string | null }
): UserPreferences {
  const current = loadPrefs();
  let next: UserPreferences = { ...current };

  switch (type) {
    case "tooFar":
      next.distanceSensitivity = Math.min(1, current.distanceSensitivity + 0.15);
      break;
    case "tooExpensive":
      next.priceSensitivity = Math.min(1, current.priceSensitivity + 0.15);
      break;
    case "notAppealing": {
      let disliked = current.dislikedTags;
      for (const tag of meal.tags) {
        disliked = bump(disliked, tag, 1);
      }
      disliked = bump(disliked, meal.category, 1);
      next.dislikedTags = disliked;
      break;
    }
    case "exclude":
      if (meal.placeId) {
        next.excludedPlaceIds = current.excludedPlaceIds.includes(meal.placeId)
          ? current.excludedPlaceIds
          : [...current.excludedPlaceIds, meal.placeId];
      }
      break;
  }

  savePrefs(next);
  return next;
}

/** 현재 개인화 상태를 사람이 읽을 수 있는 성향 문구 배열로 변환한다. */
export function describePersona(prefs: UserPreferences): string[] {
  const lines: string[] = [];
  if (prefs.priceSensitivity >= 0.6) lines.push("가격 민감도 높음");
  if (prefs.distanceSensitivity >= 0.6) lines.push("가까운 곳 선호");
  if (prefs.cookingAffinity >= 0.6) lines.push("직접 요리 선호");

  const topLiked = Object.entries(prefs.likedTags).sort((a, b) => b[1] - a[1])[0];
  if (topLiked && topLiked[1] > 0) lines.push(`${topLiked[0]} 선호`);

  if (lines.length === 0) lines.push("아직 뚜렷한 취향이 없어요");
  return lines;
}
