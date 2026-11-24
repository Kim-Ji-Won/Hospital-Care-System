"use client";

/** S8 기준 정보: 첫 탭(진료과)으로 보냄. 탭마다 주소가 따로 있습니다(/staff/master/drugs 등). */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui";

export default function MasterIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/staff/master/departments");
  }, [router]);
  return <Skeleton rows={4} />;
}
