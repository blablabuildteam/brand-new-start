import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  SOURCE_COST_MODEL,
  PLATFORM_COST,
  mvpMonthlyTotal,
  ROI_MODEL,
  INGEST_POLICY,
} from "@/lib/costs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const monthly = mvpMonthlyTotal();
  const annualHigh = monthly.total.high * 12;
  const annualLow = monthly.total.low * 12;

  const marginLow = ROI_MODEL.marginPerPlacement({
    marginPerHour: ROI_MODEL.marginPerHour.low,
    weeks: ROI_MODEL.weeksPerPlacement.low,
  });
  const marginMid = ROI_MODEL.marginPerPlacement({
    marginPerHour: 20,
    weeks: 20,
  });
  const marginHigh = ROI_MODEL.marginPerPlacement({
    marginPerHour: ROI_MODEL.marginPerHour.high,
    weeks: ROI_MODEL.weeksPerPlacement.high,
  });

  const breakEvenAtMid = ROI_MODEL.breakEvenPlacementsPerYear(annualHigh, marginMid);

  return NextResponse.json({
    policy: INGEST_POLICY,
    sources: SOURCE_COST_MODEL,
    platform: PLATFORM_COST,
    monthly,
    roi: {
      currency: ROI_MODEL.currency,
      clientRatePerHour: ROI_MODEL.clientRatePerHour,
      contractorRatePerHour: ROI_MODEL.contractorRatePerHour,
      marginPerHour: ROI_MODEL.marginPerHour,
      hoursPerWeek: ROI_MODEL.hoursPerWeek,
      weeksPerPlacement: ROI_MODEL.weeksPerPlacement,
      marginPerPlacement: { low: marginLow, mid: marginMid, high: marginHigh },
      annualCost: { low: annualLow, high: annualHigh },
      breakEvenPlacementsAtMidMargin: breakEvenAtMid,
      formula:
        "marge/plaatsing = (klant €/u − ZZP €/u) × uren/week × weken",
      payoffExample: `Bij €20/u marge × 36u × 20 weken ≈ €${marginMid.toLocaleString("nl-NL")} per plaatsing. Worst-case stack €${annualHigh.toLocaleString("nl-NL")}/jaar → break-even bij ${breakEvenAtMid} plaatsing(en)/jaar.`,
      narrative: ROI_MODEL.narrative,
    },
  });
}
