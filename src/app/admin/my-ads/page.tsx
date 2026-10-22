"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { MyAdsPanel } from "@/components/admin/ads/MyAdsPanel";
import { AdLoading } from "@/components/admin/ads/AdControls";

function MyAdsPageContent() {
  const params = useSearchParams();
  const id = Number(params.get("ad_id"));
  const targetId = Number.isSafeInteger(id) && id > 0 ? id : undefined;
  return <MyAdsPanel key={targetId ?? "list"} targetId={targetId} />;
}

export default function MyAdsPage() {
  return <Suspense fallback={<AdLoading />}><MyAdsPageContent /></Suspense>;
}
