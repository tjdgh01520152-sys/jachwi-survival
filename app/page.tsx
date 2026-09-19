"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandidatePool,
  MealPlanItem,
  MinimalSurvivalResult,
  OptionKey,
  UserPreferences,
} from "@/lib/types";
import { COOKING_POOL } from "@/lib/cooking";
import { OPTION_META, isSingleSelectGroup } from "@/lib/optionLabels";
import {
  GeneratedPlan,
  ReplaceFeedback,
  analyzeMinimalSurvival,
  generatePlans,
  replaceMeal,
} from "@/lib/recommend";
import {
  DEFAULT_PREFS,
  FeedbackType,
  applyFeedback,
  loadPrefs,
  removeExcludedPlace,
  saveLastInput,
} from "@/lib/storage";
import SentenceForm from "@/components/SentenceForm";
import OptionChips from "@/components/OptionChips";
import SummaryDashboard from "@/components/SummaryDashboard";
import PlanTabs from "@/components/PlanTabs";
import MealCard from "@/components/MealCard";
import ExcludedPanel from "@/components/ExcludedPanel";
import ShortfallPanel from "@/components/ShortfallPanel";
import SurvivalMap from "@/components/SurvivalMap";
import Mascot from "@/components/Mascot";

const LOADING_MSGS = [
  "근처 가게를 훑는 중…",
  "예산에 맞는 조합을 고르는 중…",
  "편의점 행사도 확인하는 중…",
  "거리랑 가격을 저울질하는 중…",
];

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 12, behavior: "smooth" });
}

export default function Home() {
  const [location, setLocation] = useState("안암역");
  const [budget, setBudget] = useState("40000");
  const [mealsInput, setMealsInput] = useState("8");
  const [selectedOptions, setSelectedOptions] = useState<Set<OptionKey>>(new Set());

  const [pool, setPool] = useState<CandidatePool | null>(null);
  const [generated, setGenerated] = useState<GeneratedPlan[] | null>(null);
  const [shortfall, setShortfall] = useState<MinimalSurvivalResult | null>(null);
  const [activePlanId, setActivePlanId] = useState<string>("balance");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [showExcluded, setShowExcluded] = useState(false);
  const [busyMealKey, setBusyMealKey] = useState<string | null>(null);

  // 리디자인: 입력 카드 접힘/펼침, 옵션 카드 접힘, 끼니-지도 연동, 플랜 변경 뱃지, 로딩 문구 로테이션
  const [editing, setEditing] = useState(false);
  const [prefOpen, setPrefOpen] = useState(false);
  const [activeMealIndex, setActiveMealIndex] = useState<number>(-1);
  const [changed, setChanged] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const changedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLoadingRef = useRef(false);

  useEffect(() => {
    const saved = loadPrefs();
    setPrefs(saved);
    if (saved.lastInput) {
      setLocation(saved.lastInput.location);
      setBudget(String(saved.lastInput.budget));
      setMealsInput(String(saved.lastInput.meals));
    }
    if (saved.lastOptions) {
      setSelectedOptions(new Set(saved.lastOptions));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (changedTimerRef.current) clearTimeout(changedTimerRef.current);
    };
  }, []);

  // 로딩 중에는 0.7초마다 안내 문구를 돌린다.
  useEffect(() => {
    if (!loading) {
      setLoadingMsgIdx(0);
      return;
    }
    const iv = setInterval(() => setLoadingMsgIdx((m) => m + 1), 700);
    return () => clearInterval(iv);
  }, [loading]);

  // 로딩이 시작되면 로딩 섹션으로, 로딩이 끝나고 결과가 나오면(피드백으로 인한 재계산은 제외) 결과 섹션으로 스크롤.
  useEffect(() => {
    const wasLoading = prevLoadingRef.current;
    prevLoadingRef.current = loading;
    if (loading) {
      const t = setTimeout(() => scrollToId("loading-section"), 60);
      return () => clearTimeout(t);
    }
    if (wasLoading) {
      const t = setTimeout(() => scrollToId("result-section"), 60);
      return () => clearTimeout(t);
    }
  }, [loading]);

  function markChanged() {
    setChanged(true);
    if (changedTimerRef.current) clearTimeout(changedTimerRef.current);
    changedTimerRef.current = setTimeout(() => setChanged(false), 1800);
  }

  function toggleOption(key: OptionKey) {
    setSelectedOptions((prev) => {
      const next = new Set(prev);
      const meta = OPTION_META.find((o) => o.key === key);

      if (next.has(key)) {
        next.delete(key);
      } else {
        if (meta && isSingleSelectGroup(meta.group)) {
          for (const o of OPTION_META) {
            if (o.group === meta.group) next.delete(o.key);
          }
        }
        next.add(key);
      }
      return next;
    });
  }

  /** 후보 풀이 이미 있을 때, 예산 초부족부터 확인하고 아니면 일반 3플랜을 생성한다. */
  function runRecommendation(
    targetPool: CandidatePool,
    budgetNum: number,
    mealsNum: number,
    optionsArr: OptionKey[],
    prefsArg: UserPreferences,
    locArg: string,
    seed = 0
  ) {
    const shortfallResult = analyzeMinimalSurvival(targetPool, budgetNum, mealsNum, optionsArr, prefsArg);
    if (shortfallResult.isSevereShortfall) {
      setShortfall(shortfallResult);
      setGenerated(null);
      return;
    }

    setShortfall(null);
    const plans = generatePlans(targetPool, budgetNum, mealsNum, optionsArr, prefsArg, locArg, seed);
    setGenerated(plans);
    setActivePlanId((prev) =>
      plans.some((p) => p.plan.planId === prev) ? prev : plans[1]?.plan.planId ?? plans[0].plan.planId
    );
  }

  async function handleSubmit() {
    const budgetNum = Number(budget) || 0;
    const mealsNum = Number(mealsInput) || 0;
    const loc = location.trim() || "안암역";

    if (budgetNum <= 0 || mealsNum <= 0) {
      setError("예산과 끼니 수를 올바르게 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);
    setEditing(false);
    setActiveMealIndex(-1);

    try {
      const res = await fetch(
        `/api/restaurants?location=${encodeURIComponent(loc)}&radius=1200`
      );
      const data = await res.json();
      const fullPool: CandidatePool = { ...data, cooking: COOKING_POOL };
      setPool(fullPool);

      const optionsArr = Array.from(selectedOptions);
      const freshPrefs = saveLastInput(loc, budgetNum, mealsNum, optionsArr);
      setPrefs(freshPrefs);

      runRecommendation(fullPool, budgetNum, mealsNum, optionsArr, freshPrefs, loc);
    } catch (e) {
      setError("추천을 불러오는 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  function regenerateAll(nextPrefs: UserPreferences, seed = 0) {
    if (!pool) return;
    const budgetNum = Number(budget) || 0;
    const mealsNum = Number(mealsInput) || 0;
    const optionsArr = Array.from(selectedOptions);
    runRecommendation(pool, budgetNum, mealsNum, optionsArr, nextPrefs, location.trim() || "안암역", seed);
  }

  function handleFullRegenerate() {
    // 매번 다른 시드를 줘서, 같은 조건이라도 버튼을 누를 때마다 다른 조합을 보여준다.
    regenerateAll(prefs, Date.now());
    setActiveMealIndex(-1);
    markChanged();
  }

  function handleSelectPlan(id: string) {
    setActivePlanId(id);
    setActiveMealIndex(-1);
    markChanged();
  }

  function handleIncreaseBudget() {
    if (!pool) return;
    const nextBudget = (Number(budget) || 0) + 5000;
    setBudget(String(nextBudget));
    const mealsNum = Number(mealsInput) || 0;
    const optionsArr = Array.from(selectedOptions);
    runRecommendation(pool, nextBudget, mealsNum, optionsArr, prefs, location.trim() || "안암역");
  }

  function handleEnableShareable() {
    if (!pool) return;
    const nextOptions = new Set(selectedOptions);
    nextOptions.add("shareableOk");
    setSelectedOptions(nextOptions);
    const budgetNum = Number(budget) || 0;
    const mealsNum = Number(mealsInput) || 0;
    runRecommendation(pool, budgetNum, mealsNum, Array.from(nextOptions), prefs, location.trim() || "안암역");
  }

  function handleSwitchToCheapestMode() {
    if (!pool) return;
    const nextOptions = new Set(selectedOptions);
    nextOptions.add("styleCheapest");
    nextOptions.add("convenienceOk");
    setSelectedOptions(nextOptions);
    const budgetNum = Number(budget) || 0;
    const mealsNum = Number(mealsInput) || 0;
    runRecommendation(pool, budgetNum, mealsNum, Array.from(nextOptions), prefs, location.trim() || "안암역");
  }

  function handleMealFeedback(planId: string, meal: MealPlanItem, type: ReplaceFeedback) {
    if (!pool || !generated) return;
    const key = `${planId}:${meal.mealIndex}`;
    setBusyMealKey(key);

    let nextPrefs = prefs;
    if (type !== "reroll") {
      nextPrefs = applyFeedback(type as FeedbackType, {
        tags: meal.tags,
        category: meal.category,
        placeId: meal.placeId,
      });
      setPrefs(nextPrefs);
    }

    if (type === "exclude") {
      regenerateAll(nextPrefs);
    } else {
      const budgetNum = Number(budget) || 0;
      const optionsArr = Array.from(selectedOptions);
      const target = generated.find((g) => g.plan.planId === planId);
      if (!target) {
        setBusyMealKey(null);
        return;
      }
      const { plan: newPlan, summary } = replaceMeal(
        target.plan,
        meal.mealIndex,
        type,
        pool,
        budgetNum,
        optionsArr,
        nextPrefs,
        location.trim() || "안암역",
        type === "reroll" ? Date.now() : 0
      );
      setGenerated((prev) =>
        prev
          ? prev.map((g) => (g.plan.planId === planId ? { plan: newPlan, summary } : g))
          : prev
      );
    }
    setBusyMealKey(null);
  }

  function handleRestore(id: string) {
    const nextPrefs = removeExcludedPlace(id);
    setPrefs(nextPrefs);
    regenerateAll(nextPrefs);
  }

  const activeEntry = generated?.find((g) => g.plan.planId === activePlanId) ?? generated?.[0] ?? null;
  const hasResult = !!(generated && activeEntry) || !!(shortfall && shortfall.isSevereShortfall);
  const collapsed = (hasResult || loading) && !editing;
  const budgetDisplayWon = `${(Number(budget) || 0).toLocaleString("ko-KR")}원`;

  return (
    <main
      className="min-h-screen bg-moss px-3 pb-10 pt-3.5 font-body text-ink"
      style={{
        backgroundImage: "radial-gradient(#9BBE72 1.5px, transparent 1.6px)",
        backgroundSize: "18px 18px",
      }}
    >
      <div className="mx-auto flex max-w-[460px] flex-col gap-3.5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-ink px-3 py-1.5 text-xs font-black tracking-[0.14em] text-coin">
              SURVIVAL MODE
            </span>
          </div>

          <div className="relative rounded-[22px] border-4 border-ink bg-coin p-[22px] pb-5 shadow-hardLg">
            <div
              className="font-heading leading-[0.92] tracking-tight text-ink"
              style={{
                fontSize: "clamp(46px,15vw,68px)",
                textShadow: "4px 4px 0 #FAF6E8",
              }}
            >
              자취생
              <br />
              생존기
            </div>
            <div
              className="mt-3.5 font-black leading-[1.35]"
              style={{ fontSize: "clamp(17px,5vw,21px)" }}
            >
              아슬아슬한 식비,
              <br />
              끝까지 버틸 수 있을까?
            </div>
            <div className="absolute -right-2 -top-3.5 rounded-full border-[3px] border-ink bg-ramen px-[13px] py-[7px] text-[13px] font-black text-white [transform:rotate(7deg)]">
              EP.1 개강
            </div>
          </div>

          <div className="flex items-end gap-3 rounded-[20px] border-4 border-ink bg-paper p-3.5 shadow-hard">
            <div className="flex-none animate-bob">
              <Mascot />
            </div>
            <div className="relative flex-1 rounded-2xl border-[3px] border-ink bg-white p-3 text-sm font-extrabold leading-[1.45]">
              라면만 먹고 버티긴
              <br />좀 그렇잖아요?
              <div className="absolute -left-[9px] bottom-3.5 h-3 w-3 rotate-45 border-b-[3px] border-l-[3px] border-ink bg-white" />
            </div>
          </div>

          <p className="text-[15px] font-semibold leading-[1.6]">
            위치, 예산, 끼니 수만 입력하면 근처 식당, 편의점, 직접요리를 섞어 현실적인 생존 루트를
            짜드려요.
          </p>

          {collapsed ? (
            <div className="panel flex flex-col gap-2 px-3.5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <span className="text-[15px] font-black text-ink">
                  {location.trim() || "안암역"} · {budgetDisplayWon} · {mealsInput || 0}끼
                </span>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="press min-h-[44px] rounded-full border-[3px] border-ink bg-coin px-4 text-[13px] font-black text-ink"
                >
                  수정
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="flex flex-col gap-4"
            >
              <SentenceForm
                location={location}
                budget={budget}
                meals={mealsInput}
                onLocationChange={setLocation}
                onBudgetChange={setBudget}
                onMealsChange={setMealsInput}
              />

              <div className="panel flex flex-col gap-3.5 p-4">
                <button
                  type="button"
                  onClick={() => setPrefOpen((v) => !v)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-2.5"
                >
                  <span className="text-[15px] font-black text-ink">
                    더 정확한 추천을 원한다면 (선택 사항)
                  </span>
                  <span className="text-[13px] font-black text-[#6B7360]">
                    {prefOpen ? "접기 −" : "더 정확하게 +"}
                  </span>
                </button>
                {prefOpen && <OptionChips selected={selectedOptions} onToggle={toggleOption} />}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="press w-full rounded-[18px] border-4 border-ink bg-ramen px-4 py-5 font-heading text-[26px] text-[#FFF8EC] shadow-hardBtn disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "생존 루트 계산 중..." : "생존 루트 뽑기"}
              </button>
            </form>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            <Tag label="근처 식당" />
            <Tag label="편의점 조합" />
            <Tag label="직접요리" />
          </div>
        </div>

        {loading && (
          <div id="loading-section" className="flex flex-col gap-3.5">
            <div className="panel flex flex-col gap-3.5 px-4 py-[18px]">
              <div className="flex items-end gap-3">
                <div className="relative h-[112px] w-24 shrink-0">
                  {[0, 0.7, 1.3].map((d, i) => (
                    <div
                      key={i}
                      className="absolute top-0 h-4 w-2.5 animate-steam rounded-md bg-[#C9CDBD]"
                      style={{ left: 18 + i * 22, animationDelay: `${d}s` }}
                    />
                  ))}
                  <div className="absolute bottom-0 left-0 animate-bob-fast">
                    <Mascot size={88} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-[7px]">
                  <span className="font-heading leading-[1.2] text-ink" style={{ fontSize: "22px" }}>
                    생존 루트 계산 중
                  </span>
                  <span className="text-[13px] font-bold leading-[1.5] text-[#4A5140]">
                    {LOADING_MSGS[loadingMsgIdx % LOADING_MSGS.length]}
                  </span>
                  <div className="h-3.5 overflow-hidden rounded-full border-[3px] border-ink bg-[#EDEAD8]">
                    <div className="h-full animate-bar bg-ramen" />
                  </div>
                </div>
              </div>
            </div>

            {/* 결과 레이아웃을 그대로 본뜬 스켈레톤 */}
            <div className="panel flex flex-col gap-3 px-[15px] py-4">
              <div className="h-3 w-16 animate-shimmer rounded-lg bg-[length:220%_100%] bg-[linear-gradient(90deg,#E6E2CF_0_30%,#F2EFE0_45%,#E6E2CF_60%)]" />
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="h-[42px] w-[210px] animate-shimmer rounded-full border-[3px] border-ink bg-[length:220%_100%] bg-[linear-gradient(90deg,#E6E2CF_0_30%,#F2EFE0_45%,#E6E2CF_60%)]" />
                <div className="h-3 w-28 animate-shimmer rounded-lg bg-[length:220%_100%] bg-[linear-gradient(90deg,#E6E2CF_0_30%,#F2EFE0_45%,#E6E2CF_60%)]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="h-[74px] animate-shimmer rounded-[14px] border-[3px] border-ink bg-[length:220%_100%] bg-[linear-gradient(90deg,#E6E2CF_0_30%,#F2EFE0_45%,#E6E2CF_60%)]"
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-x-3.5 gap-y-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-3 animate-shimmer rounded-lg bg-[length:220%_100%] bg-[linear-gradient(90deg,#E6E2CF_0_30%,#F2EFE0_45%,#E6E2CF_60%)]"
                  />
                ))}
              </div>
            </div>

            <div className="panel-sm flex flex-col gap-[11px] p-[15px]">
              <div className="flex items-center justify-between">
                <div className="h-4 w-28 animate-shimmer rounded-lg bg-[length:220%_100%] bg-[linear-gradient(90deg,#E6E2CF_0_30%,#F2EFE0_45%,#E6E2CF_60%)]" />
                <div className="h-3 w-32 animate-shimmer rounded-lg bg-[length:220%_100%] bg-[linear-gradient(90deg,#E6E2CF_0_30%,#F2EFE0_45%,#E6E2CF_60%)]" />
              </div>
              <div className="relative h-[190px] overflow-hidden rounded-[14px] border-[3px] border-ink bg-[repeating-linear-gradient(135deg,#E3E0CF_0_10px,#DAD7C5_10px_20px)]">
                {[
                  ["20%", "22%"],
                  ["52%", "14%"],
                  ["63%", "52%"],
                ].map(([l, t], i) => (
                  <div
                    key={i}
                    className="absolute h-7 w-14 animate-shimmer rounded-full border-[3px] border-ink bg-[length:220%_100%] bg-[linear-gradient(90deg,#E6E2CF_0_30%,#F2EFE0_45%,#E6E2CF_60%)]"
                    style={{ left: l, top: t }}
                  />
                ))}
              </div>
            </div>

            {[0, 1].map((i) => (
              <div key={i} className="panel-sm flex flex-col gap-2.5 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="h-3 w-28 animate-shimmer rounded-lg bg-[length:220%_100%] bg-[linear-gradient(90deg,#E6E2CF_0_30%,#F2EFE0_45%,#E6E2CF_60%)]" />
                  <div className="h-6 w-24 animate-shimmer rounded-full border-2 border-ink bg-[length:220%_100%] bg-[linear-gradient(90deg,#E6E2CF_0_30%,#F2EFE0_45%,#E6E2CF_60%)]" />
                </div>
                <div className="h-6 w-2/3 animate-shimmer rounded-lg bg-[length:220%_100%] bg-[linear-gradient(90deg,#E6E2CF_0_30%,#F2EFE0_45%,#E6E2CF_60%)]" />
                <div className="h-3 w-1/2 animate-shimmer rounded-lg bg-[length:220%_100%] bg-[linear-gradient(90deg,#E6E2CF_0_30%,#F2EFE0_45%,#E6E2CF_60%)]" />
                <div className="h-3 w-11/12 animate-shimmer rounded-lg bg-[length:220%_100%] bg-[linear-gradient(90deg,#E6E2CF_0_30%,#F2EFE0_45%,#E6E2CF_60%)]" />
                <div className="h-3 w-2/5 animate-shimmer rounded-lg bg-[length:220%_100%] bg-[linear-gradient(90deg,#E6E2CF_0_30%,#F2EFE0_45%,#E6E2CF_60%)]" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="rounded-xl border-[3px] border-ink bg-white px-4 py-3 text-sm font-bold text-ramen">
            {error}
          </p>
        )}

        {pool?.isFallback && (
          <p className="rounded-xl border-[3px] border-ink bg-coin px-4 py-3 text-sm font-bold text-ink">
            {pool.fallbackReason ?? "예시 데이터를 보여드리고 있어요."}
          </p>
        )}

        {shortfall && shortfall.isSevereShortfall && (
          <div id="result-section">
            <ShortfallPanel
              result={shortfall}
              budget={Number(budget) || 0}
              shareableOn={selectedOptions.has("shareableOk")}
              onIncreaseBudget={handleIncreaseBudget}
              onEnableShareable={handleEnableShareable}
              onSwitchToCheapestMode={handleSwitchToCheapestMode}
            />
          </div>
        )}

        {generated && activeEntry && (
          <section id="result-section" className="flex flex-col gap-3.5">
            <SummaryDashboard summary={activeEntry.summary} />

            <SurvivalMap
              center={pool?.center ? { lat: pool.center.y, lng: pool.center.x } : null}
              meals={activeEntry.plan.meals}
              activeMealIndex={activeMealIndex}
            />

            <div className="flex flex-wrap gap-2">
              <PlanTabs plans={generated} activePlanId={activePlanId} onSelect={handleSelectPlan} />
              <button
                type="button"
                onClick={handleFullRegenerate}
                className="press min-h-[44px] shrink-0 rounded-[14px] border-[3px] border-ink bg-coin px-3.5 py-[11px] text-[13px] font-black text-ink"
              >
                전체 다시 추천
              </button>
            </div>

            {activeEntry.plan.shareShortfall && (
              <p className="rounded-xl border-[3px] border-ink bg-[#D3E7F8] px-4 py-3 text-sm font-bold text-ink">
                나눠먹기 메뉴를 넣고 싶었지만, 현재 예산/거리 조건에 맞는 후보가 부족했어요.
              </p>
            )}

            <div className="flex flex-col">
              {activeEntry.plan.meals.map((meal) => (
                <div key={meal.mealIndex} className="mb-3">
                  <MealCard
                    meal={meal}
                    isExcluded={!!meal.placeId && prefs.excludedPlaceIds.includes(meal.placeId)}
                    busy={busyMealKey === `${activePlanId}:${meal.mealIndex}`}
                    isActive={activeMealIndex === meal.mealIndex}
                    showChangedBadge={changed}
                    onSelect={() => setActiveMealIndex(meal.mealIndex)}
                    onReroll={() => handleMealFeedback(activePlanId, meal, "reroll")}
                    onTooFar={() => handleMealFeedback(activePlanId, meal, "tooFar")}
                    onTooExpensive={() => handleMealFeedback(activePlanId, meal, "tooExpensive")}
                    onNotAppealing={() => handleMealFeedback(activePlanId, meal, "notAppealing")}
                    onExclude={() => handleMealFeedback(activePlanId, meal, "exclude")}
                  />
                </div>
              ))}
            </div>

            <div className="panel-sm p-[15px]">
              <button
                type="button"
                onClick={() => setShowExcluded((s) => !s)}
                className="text-sm font-black text-ink"
              >
                내가 뺀 가게 ({prefs.excludedPlaceIds.length})
              </button>
              {showExcluded && (
                <div className="mt-3">
                  <ExcludedPanel
                    excludedIds={prefs.excludedPlaceIds}
                    pool={pool}
                    onRestore={handleRestore}
                  />
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="rounded-full border-[3px] border-ink bg-paper px-3 py-1.5 text-xs font-extrabold text-ink">
      {label}
    </span>
  );
}
