"use client";

import { useEffect, useRef, useState } from "react";
import { MealPlanItem } from "@/lib/types";
import { loadKakaoMaps } from "@/lib/kakaoMapsLoader";

interface Props {
  center: { lat: number; lng: number } | null; // 내 위치
  meals: MealPlanItem[]; // 현재 보고 있는 플랜의 끼니들
}

type LoadState = "idle" | "loading" | "ready" | "no-key" | "error";

/** 좌표가 있는(=직접요리가 아닌) 끼니만 지도에 올린다. */
function mappableMeals(meals: MealPlanItem[]) {
  return meals.filter(
    (m) => !m.isEmpty && typeof m.lat === "number" && typeof m.lng === "number"
  );
}

export default function SurvivalMap({ center, meals }: Props) {
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
      const style = meal.source === "convenience" ? "convenience" : "eatout";
      overlaysRef.current.push(makePinOverlay(kakao, pos, `${meal.mealIndex}끼`, style, meal.placeName));
    }

    overlaysRef.current.forEach((o) => o.setMap(map));

    if (pins.length > 0) {
      map.setBounds(bounds, 48, 48, 48, 48);
    } else {
      map.setCenter(centerPos);
      map.setLevel(4);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, center?.lat, center?.lng, JSON.stringify(pins.map((p) => [p.mealIndex, p.lat, p.lng, p.source]))]);

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-neutral-800">안암 생존 지도</p>
        <div className="flex items-center gap-3 text-xs text-neutral-500">
          <Legend color="bg-neutral-800" label="내 위치" />
          <Legend color="bg-brand-600" label="식당" />
          <Legend color="bg-emerald-600" label="편의점" />
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-neutral-100">
        {state === "ready" || state === "loading" ? (
          <div ref={containerRef} className="h-64 w-full bg-neutral-50 sm:h-80" />
        ) : (
          <PlaceholderMap center={center} pins={pins} />
        )}
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
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
      <div className="flex h-64 items-center justify-center p-6 text-center text-sm text-neutral-400 sm:h-80">
        위치 정보를 불러오지 못했어요.
      </div>
    );
  }

  return (
    <div className="flex h-64 flex-col gap-2 overflow-y-auto bg-neutral-50 p-4 sm:h-80">
      <div className="flex items-center gap-2 rounded-lg bg-neutral-800 px-3 py-2 text-sm font-semibold text-white">
        <span>내 위치</span>
      </div>
      {pins.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">지도에 표시할 실제 매장이 없어요.</p>
      ) : (
        pins.map((m) => (
          <div
            key={`${m.mealIndex}-${m.placeId}`}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm"
          >
            <span
              className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold text-white ${
                m.source === "convenience" ? "bg-emerald-600" : "bg-brand-600"
              }`}
            >
              {m.mealIndex}
            </span>
            <span className="font-medium text-neutral-700">{m.placeName}</span>
            {m.distanceMeters !== null && (
              <span className="ml-auto shrink-0 text-xs text-neutral-400">
                {Math.round(m.distanceMeters)}m
              </span>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/** 커스텀 오버레이(둥근 뱃지) DOM 노드를 만들어 kakao.maps.CustomOverlay로 감싼다. */
function makePinOverlay(
  kakao: any,
  position: any,
  label: string,
  style: "center" | "eatout" | "convenience",
  title?: string
) {
  const el = document.createElement("div");
  el.style.display = "inline-flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.borderRadius = "9999px";
  el.style.fontSize = "12px";
  el.style.fontWeight = "700";
  el.style.color = "#fff";
  el.style.whiteSpace = "nowrap";
  el.style.padding = style === "center" ? "4px 10px" : "4px 8px";
  el.style.boxShadow = "0 2px 6px rgba(0,0,0,0.25)";
  el.style.border = "2px solid white";
  el.style.background =
    style === "center" ? "#1f2937" : style === "convenience" ? "#059669" : "#f06100";
  el.textContent = label;
  if (title) el.title = title;

  return new kakao.maps.CustomOverlay({
    position,
    content: el,
    yAnchor: 1.2,
  });
}
