/**
 * 브라우저 목 서버. 환경변수 NEXT_PUBLIC_API_MOCKING으로 범위를 정합니다.
 * - "all"(기본): 모든 영역을 목 서버가 응답
 * - "none": 목 서버를 끄고 모두 실제 백엔드로
 * - "member,reservation": 적은 영역만 목 서버, 나머지는 실제 백엔드로
 * 목 핸들러가 없는 요청은 그대로 통과해 Next.js rewrites를 거쳐 백엔드로 갑니다.
 */
import { setupWorker } from "msw/browser";
import type { RequestHandler } from "msw";
import { mockedAreas } from "@/lib/demo";
import { memberHandlers } from "./handlers/member";
import { reservationHandlers } from "./handlers/reservation";
import { encounterHandlers } from "./handlers/encounter";
import { orderHandlers } from "./handlers/order";
import { admissionHandlers } from "./handlers/admission";
import { paymentHandlers } from "./handlers/payment";

/** 영역 이름은 docs/api 파일 이름과 같습니다. 화면을 만들 때마다 여기에 더합니다. */
const handlersByArea: Record<string, RequestHandler[]> = {
  member: memberHandlers,
  reservation: reservationHandlers,
  encounter: encounterHandlers,
  order: orderHandlers,
  admission: admissionHandlers,
  payment: paymentHandlers,
};

/**
 * 한 번만 켭니다. 개발 모드의 StrictMode가 effect를 두 번 부르면 워커가 둘 생기고,
 * 같은 POST를 두 핸들러가 각각 처리해 회진 같은 기록이 두 번 저장됩니다.
 */
let starting: Promise<void> | null = null;

export function startMockWorker() {
  starting ??= start();
  return starting;
}

async function start() {
  const areas = mockedAreas();
  if (areas === "none") return;
  const names = areas === "all" ? Object.keys(handlersByArea) : areas;
  const handlers = names.flatMap((name) => handlersByArea[name] ?? []);
  const worker = setupWorker(...handlers);
  await worker.start({ onUnhandledRequest: "bypass", quiet: true });
}
