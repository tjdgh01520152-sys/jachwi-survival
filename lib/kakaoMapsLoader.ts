"use client";

// 결과 지도(안암 생존 지도)에서만 쓰는 카카오맵 JavaScript SDK 로더.
// REST API 키(app/api/restaurants/route.ts, lib/kakao.ts)와는 완전히 별개의 키를 쓴다 —
// 이 키는 지도를 그리려고 브라우저에 그대로 노출되는 게 정상이라 NEXT_PUBLIC_ 접두사로 관리한다.
// SDK는 여러 컴포넌트/리렌더에서 중복으로 <script>를 추가하지 않도록 모듈 스코프에 프로미스를 캐싱한다.

declare global {
  interface Window {
    kakao: any;
  }
}

let loadPromise: Promise<any> | null = null;

export function loadKakaoMaps(appKey: string): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("브라우저 환경이 아닙니다."));
  }
  if (window.kakao?.maps) {
    return Promise.resolve(window.kakao);
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`;
    script.async = true;
    script.onload = () => {
      window.kakao.maps.load(() => resolve(window.kakao));
    };
    script.onerror = () => {
      loadPromise = null;
      reject(new Error("카카오맵 SDK 로드에 실패했어요."));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}
