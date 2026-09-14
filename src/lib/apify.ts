/**
 * Shared Apify runner — LinkedIn Jobs, profile posts, etc.
 */

export async function runApifyActor<T = Record<string, unknown>>(
  actorId: string,
  input: Record<string, unknown>,
  opts?: { waitSecs?: number }
): Promise<{ items: T[]; runId?: string; status?: string; partial?: boolean }> {
  const token = process.env.APIFY_TOKEN;
  if (!token) {
    throw new Error("APIFY_TOKEN missing");
  }

  const wait = opts?.waitSecs ?? 180;
  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?waitForFinish=${wait}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );

  if (!runRes.ok) {
    const err = await runRes.text();
    throw new Error(`Apify ${actorId}: ${runRes.status} ${err.slice(0, 240)}`);
  }

  const run = (await runRes.json()) as {
    data?: { defaultDatasetId?: string; id?: string; status?: string };
  };
  const datasetId = run.data?.defaultDatasetId;
  const status = run.data?.status;
  if (!datasetId) {
    throw new Error(`Apify ${actorId}: no dataset (status=${status})`);
  }
  if (status === "FAILED" || status === "ABORTED") {
    throw new Error(`Apify ${actorId}: run ${status.toLowerCase()}`);
  }

  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?format=json&clean=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!itemsRes.ok) {
    throw new Error(`Apify dataset ${datasetId}: ${itemsRes.status}`);
  }

  const items = (await itemsRes.json()) as T[];
  // A run that is still going (or timed out) returns an empty/short dataset.
  // Without this check "the market had nothing" and "the scrape never finished"
  // look identical, and signals silently vanish between syncs.
  if (status !== "SUCCEEDED" && !items.length) {
    throw new Error(`Apify ${actorId}: run niet klaar binnen ${wait}s (status=${status})`);
  }
  return {
    items,
    runId: run.data?.id,
    status,
    partial: status !== "SUCCEEDED",
  };
}

export function hasApifyToken() {
  return Boolean(process.env.APIFY_TOKEN);
}
