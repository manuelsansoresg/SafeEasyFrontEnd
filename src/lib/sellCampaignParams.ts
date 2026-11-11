export function sellCampaignParams(params: Record<string, string | string[] | undefined>) {
  const campaign = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && /^(utm_[a-z0-9_]+|gclid|fbclid|code|referral_code)$/.test(key)) {
      campaign.set(key, value.trim());
    }
  }
  return campaign;
}
