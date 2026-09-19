"use client";

import { useEffect, useRef, useState } from "react";
import { MealPlanItem } from "@/lib/types";
import { loadKakaoMaps } from "@/lib/kakaoMapsLoader";

interface Props {
  center: { lat: number; lng: number } | null; // 내 위치
  meals: MealPlanItem[]; // 현재 보고 있는 플랜의 끼니들
  activeMealIndex?: number; // 끼니 카드를 눌렀을 때 강조할 mealIndex (-1 또는 미지정이면 없음)
}

type LoadState = "idle" | "loading" | "ready" | "no-key" | "error";

/** 좌표가 있는(=직접요리가 아닌) 끼니만 지도에 올린다. */
function mappableMeals(meals: MealPlanItem[]) {
  return meals.filter(
    (m) => !m.isEmpty && typeof m.lat === "number" && typeof m.lng === "number"
  );
}

export default function SurvivalMap({ center, meals, activeMealIndex = -1 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [state, setState] = useState<LoadState>("idle");

  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY;
  const pins = mappableMeals(meals);

  // SDK 로드 + 지도 최초 생성
  useEffect(() => {
    if (!center) return;
    if (!appKey) {
      setState("no-key");
      return;
    }
    let cancelled = false;
    setState("loading");
    loadKakaoMaps(appKey)
      .then((kakao) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new kakao.maps.Map(containerRef.current, {
          center: new kakao.maps.LatLng(center.lat, center.lng),
          level: 4,
        });
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appKey, !!center]);

  // 끼니/위치가 바뀔 때마다 핀을 다시 그린다 (이것만 바꾸기 / 제외하기 / 다시 추천 모두 여기로 흘러온다)
  useEffect(() => {
    if (state !== "ready" || !mapRef.current || !center || !window.kakao) return;
    const kakao = window.kakao;
    const map = mapRef.current;

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    const bounds = new kakao.maps.LatLngBounds();

    const centerPos = new kakao.maps.LatLng(center.lat, center.lng);
    bounds.extend(centerPos);
    overlaysRef.current.push(makePinOverlay(kakao, centerPos, "내 위치", "center"));

    for (const meal of pins) {
      const pos = new kakao.maps.LatLng(meal.lat as number, meal.lng as number);
      bounds.extend(pos);
      const isActive = meal.mealIndex === activeMealIndex;
      const style = isActive ? "active" : meal.source === "convenience" ? "convenience" : "eatout";
      overlaysRef.current.push(makePinOverlay(kakao, pos, `${meal.mealIndex}끼`, style, meal.placeName));
    }

    overlaysRef.current.forEach((o) => o.setMap(map));

    if (pins.length > 0) {
      map.setBounds(bounds, 48, 48, 48, 48);
    } else {
      // 전부 직접요리인 플랜이라 지도에 찍을 매장이 없어도, 내 위치는 항상 보여준다.
      map.setCenter(centerPos);
      map.setLevel(3);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state,
    center?.lat,
    center?.lng,
    activeMealIndex,
    JSON.stringify(pins.map((p) => [p.mealIndex, p.lat, p.lng, p.source])),
  ]);

  return (
    <div className="panel flex flex-col gap-2.5 p-[15px]">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <p className="text-[15px] font-black text-ink">안암 생존 지도</p>
        <div className="flex items-center gap-2.5 text-[11px] font-extrabold text-ink">
          <Legend color="bg-ink" label="내 위치" />
          <Legend color="bg-ramen" label="식당" />
          <Legend color="bg-[#1B7F3B]" label="편의점" />
        </div>
      </div>

      <div className="relative h-[190px] overflow-hidden rounded-[14px] border-[3px] border-ink">
        {state === "ready" || state === "loading" ? (
          <div ref={containerRef} className="h-full w-full bg-[#DDE7CB]" />
        ) : (
          <PlaceholderMap center={center} pins={pins} />
        )}
      </div>

      {center && pins.length === 0 && (
        <p className="text-xs font-bold text-[#6B7360]">
          이번 플랜은 집밥 위주라 지도에는 내 위치만 표시돼요.
        </p>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-[9px] w-[9px] rounded-full ${color}`} />
      {label}
    </span>
  );
}

/** 지도 SDK가 없거나(키 미설정) 로드에 실패했을 때 보여주는, 목록형 미니맵 대체 화면. */
function PlaceholderMap({
  center,
  pins,
}: {
  center: { lat: number; lng: number } | null;
  pins: MealPlanItem[];
}) {
  if (!center) {
    return (
      <div className="flex h-full items-center justify-center bg-[repeating-linear-gradient(135deg,#DDE7CB_0_10px,#D2DFBC_10px_20px)] p-6 text-center text-sm font-bold text-[#5A6350]">
        위치 정보를 불러오지 못했어요.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto bg-[repeating-linear-gradient(135deg,#DDE7CB_0_10px,#D2DFBC_10px_20px)] p-3">
      <div className="flex items-center gap-2 self-start rounded-full border-[3px] border-ink bg-ink px-2.5 py-1 text-xs font-black text-[#FFF8EC]">
        <span>내 위치</span>
      </div>
      {pins.length === 0
        ? null
        : pins.map((m) => (
            <div
              key={`${m.mealIndex}-${m.placeId}`}
              className="flex items-center gap-2 rounded-full border-[3px] border-ink bg-white px-2.5 py-1 text-xs"
            >
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full text-[11px] font-black text-[#FFF8EC] ${
                  m.source === "convenience" ? "bg-[#1B7F3B]" : "bg-ramen"
                }`}
              >
                {m.mealIndex}
              </span>
              <span className="font-extrabold text-ink">{m.placeName}</span>
              {m.distanceMeters !== null && (
                <span className="ml-auto shrink-0 font-bold text-[#6B7360]">
                  {Math.round(m.distanceMeters)}m
                </span>
              )}
            </div>
          ))}
    </div>
  );
}

/** 커스텀 오버레이(둥근 뱃지) DOM 노드를 만들어 kakao.maps.CustomOverlay로 감싼다. */
function makePinOverlay(
  kakao: any,
  position: any,
  label: string,
  style: "center" | "eatout" | "convenience" | "active",
  title?: string
) {
  const el = document.createElement("div");
  el.style.display = "inline-flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.borderRadius = "9999px";
  el.style.fontSize = "12px";
  el.style.fontWeight = "900";
  el.style.color = "#FFF8EC";
  el.style.whiteSpace = "nowrap";
  el.style.padding = "5px 10px";
  el.style.border = "3px solid #12140F";
  el.style.transform = style === "active" ? "scale(1.25)" : "scale(1)";
  el.style.transition = "transform 0.15s ease";
  el.style.background =
    style === "center" || style === "active"
      ? "#12140F"
      : style === "convenience"
        ? "#1B7F3B"
        : "#E5533D";
  el.textContent = label;
  if (title) el.title = title;

  return new kakao.maps.CustomOverlay({
    position,
    content: el,
    yAnchor: 1.2,
  });
}
