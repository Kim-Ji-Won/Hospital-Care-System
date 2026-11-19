import { EmptyState, PageHeader } from "./ui";

/** 아직 만들지 않은 화면의 자리. 화면 번호와 쓸 API를 적어 둡니다. */
export function ComingSoon({ screen, title, apis }: { screen: string; title: string; apis: string[] }) {
  return (
    <>
      <PageHeader title={title} sub={`${screen} · 화면 준비 중`} />
      <EmptyState title="다음 단계에서 만들 화면입니다" description={`쓸 API: ${apis.join(", ")}`} />
    </>
  );
}
