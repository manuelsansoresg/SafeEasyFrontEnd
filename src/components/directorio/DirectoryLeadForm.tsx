"use client";

import { MarketingLeadForm } from "@/components/marketing/MarketingLeadForm";

export function DirectoryLeadForm({ onLeadCreated }: { onLeadCreated: () => void }) {
  return <MarketingLeadForm kind="directory" onLeadCreated={onLeadCreated} />;
}
