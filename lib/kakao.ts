import { KakaoPlace } from "./types";

const KAKAO_BASE = "https://dapi.kakao.com/v2/local";

interface KakaoDocumentAddress {
  x: string;
  y: string;
}

interface KakaoDocumentPlace {
  id: string;
  place_name: string;
  category_name: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  distance: string;
  place_url: string;
}

export class KakaoApiError extends Error {}

function getApiKey(): string {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) {
    throw new KakaoApiError("KAKAO_REST_API_KEY 환경변수가 설정되어 있지 않습니다.");
  }
  return key;
}

async function kakaoFetch(path: string, params: Record<string, string>) {
  const apiKey = getApiKey();
  const url = new URL(`${KAKAO_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `KakaoAK ${apiKey}`,
    },
    // 위치/음식점 데이터는 매 요청마다 최신값을 받는다.
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new KakaoApiError(`Kakao API 호출 실패 (${res.status}): ${body}`);
  }

  return res.json();
}

/** 키워드(예: "안암역")를 좌표로 변환한다. 실패 시 주소 검색으로 재시도한다. */
export async function geocodeLocation(
  query: string
): Promise<{ x: number; y: number } | null> {
  try {
    const keywordResult = await kakaoFetch("/search/keyword.json", {
      query,
      size: "1",
    });
    const doc = keywordResult?.documents?.[0] as KakaoDocumentPlace | undefined;
    if (doc) {
      return { x: parseFloat(doc.x), y: parseFloat(doc.y) };
    }
    // 결과가 비어있으면(진짜 못 찾은 경우) 주소 검색으로 폴백
  } catch (e) {
    // 키워드 검색 자체가 실패(인증/설정 오류 등)한 경우는 그대로 위로 던져서
    // 호출자가 "위치를 못 찾음"이 아니라 실제 원인을 알 수 있게 한다.
    if (e instanceof KakaoApiError) throw e;
  }

  const addressResult = await kakaoFetch("/search/address.json", {
    query,
  });
  const doc = addressResult?.documents?.[0]?.address as
    | KakaoDocumentAddress
    | undefined;
  if (doc) {
    return { x: parseFloat(doc.x), y: parseFloat(doc.y) };
  }

  return null;
}

/**
 * 좌표 기준 카테고리 검색 (FD6: 음식점, CS2: 편의점).
 * 거리순 정렬(sort=distance), 반경 1000~1500m.
 */
export async function searchByCategory(
  categoryCode: "FD6" | "CS2",
  x: number,
  y: number,
  radius: number = 1200
): Promise<KakaoPlace[]> {
  const results: KakaoPlace[] = [];
  // 카카오 카테고리 검색은 페이지당 최대 15개, 최대 3페이지(45개)까지 수집
  for (let page = 1; page <= 3; page++) {
    const data = await kakaoFetch("/search/category.json", {
      category_group_code: categoryCode,
      x: String(x),
      y: String(y),
      radius: String(radius),
      sort: "distance",
      page: String(page),
      size: "15",
    });

    const docs = (data?.documents ?? []) as KakaoDocumentPlace[];
    for (const d of docs) {
      results.push({
        id: d.id,
        place_name: d.place_name,
        category_name: d.category_name,
        address_name: d.address_name,
        road_address_name: d.road_address_name,
        x: d.x,
        y: d.y,
        distance: d.distance,
        place_url: d.place_url,
      });
    }

    const isEnd = data?.meta?.is_end;
    if (isEnd) break;
  }

  return results;
}
