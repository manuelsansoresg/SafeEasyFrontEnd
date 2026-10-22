"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AdminAdsPanel } from "@/components/admin/ads/AdminAdsPanel";
import { AdLoading } from "@/components/admin/ads/AdControls";
import type { AdApprovalStatus } from "@/services/adsService";

function AdsPageContent() {
  const params = useSearchParams();
  const approval = params.get("approval_status");
  const initialApproval = ["PENDING", "APPROVED", "REJECTED"].includes(approval || "") ? approval as AdApprovalStatus : "";
  const id = Number(params.get("ad_id"));
  const targetId = Number.isSafeInteger(id) && id > 0 ? id : undefined;
  return <AdminAdsPanel key={`${initialApproval}-${targetId ?? ""}`} initialApproval={initialApproval} targetId={targetId} />;
}

export default function AdminAdsPage() {
  return <Suspense fallback={<AdLoading />}><AdsPageContent /></Suspense>;
}
