import type { NextConfig } from "next";

/** 백엔드(Spring Boot) 주소. 브라우저의 /api 요청을 그대로 넘겨 같은 주소로 보이게 합니다(CORS 불필요). */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

/*
 * 화면은 모두 브라우저에서 백엔드 API를 부르는 클라이언트 컴포넌트입니다(로그인도 백엔드 세션 쿠키).
 * 서버 렌더링용 기능인 cacheComponents·partialPrefetching은 켜지 않습니다.
 */
const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
