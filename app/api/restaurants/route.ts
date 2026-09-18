import { NextRequest, NextResponse } from "next/server";
import { geocodeLocation, searchByCategory, KakaoApiError } from "@/lib/kakao";
import { estimatePrice, convenienceEstimate, toPriceLabel } from "@/lib/pricing";
import { FALLBACK_CENTER, FALLBACK_RESTAURANTS, FALLBACK_CONVENIENCE } from "@/lib/fallbackData";
import { KakaoPlace, PricedCandidate } from "@/lib/types";

export const dynamic = "force-dynamic";

// 프랜차이즈 seed(단품/세트/나눠먹기) 매칭은 lib/recommend.ts에서 후보를 펼칠 때 처리한다.
// 여기서는 카테고리/상호명 키워드 기반 추정 가격만 계산한다.
function toPriced(place: KakaoPlace, sourceType: "eatout" | "convenience"): PricedCandidate {
  const { min, max, tags } =
    sourceType === "convenience"
      ? convenienceEstimate()
      : estimatePrice(place.category_name, place.place_name);

  return {
    ...place,
    sourceType,
    priceMin: min,
    priceMax: max,
    priceLabel: toPriceLabel(min, max),
    tags,
    distanceMeters: Number(place.distance) || 0,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const location = searchParams.get("location")?.trim() || "안암역";
  const radiusParam = Number(searchParams.get("radius"));
  const radius = Number.isFinite(radiusParam) && radiusParam > 0 ? radiusParam : 1200;

  const hasKey = !!process.env.KAKAO_REST_API_KEY;

  if (!hasKey) {
    return NextResponse.json({
      center: FALLBACK_CENTER,
      restaurants: FALLBACK_RESTAURANTS.map((p) => toPriced(p, "eatout")),
      convenience: FALLBACK_CONVENIENCE.map((p) => toPriced(p, "convenience")),
      isFallback: true,
      fallbackReason:
        "카카오 API 키(KAKAO_REST_API_KEY)가 설정되어 있지 않아 예시 데이터를 보여드리고 있어요. .env.local 파일을 확인해주세요.",
    });
  }

  try {
    const center = await geocodeLocation(location);
    if (!center) {
      return NextResponse.json({
        center: FALLBACK_CENTER,
        restaurants: FALLBACK_RESTAURANTS.map((p) => toPriced(p, "eatout")),
        convenience: FALLBACK_CONVENIENCE.map((p) => toPriced(p, "convenience")),
        isFallback: true,
        fallbackReason: `"${location}" 위치를 찾지 못해 안암역 기준 예시 데이터를 보여드리고 있어요.`,
      });
    }

    const [restaurants, convenience] = await Promise.all([
      searchByCategory("FD6", center.x, center.y, radius),
      searchByCategory("CS2", center.x, center.y, radius),
    ]);

    return NextResponse.json({
      center,
      restaurants: restaurants.map((p) => toPriced(p, "eatout")),
      convenience: convenience.map((p) => toPriced(p, "convenience")),
      isFallback: false,
    });
  } catch (err) {
    const message =
      err instanceof KakaoApiError
        ? err.message
        : "카카오 API 호출 중 알 수 없는 오류가 발생했어요.";

    return NextResponse.json({
      center: FALLBACK_CENTER,
      restaurants: FALLBACK_RESTAURANTS.map((p) => toPriced(p, "eatout")),
      convenience: FALLBACK_CONVENIENCE.map((p) => toPriced(p, "convenience")),
      isFallback: true,
      fallbackReason: `${message} 대신 예시 데이터를 보여드리고 있어요.`,
    });
  }
}
