/**
 * Shared Apify runner — LinkedIn Jobs, profile posts, etc.
 */

export async function runApifyActor<T = Record<string, unknown>>(
  actorId: string,
  input: Record<string, unknown>,
  opts?: { waitSecs?: number }
): Promise<{ items: T[]; runId?: string }> {
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
  if (!datasetId) {
    throw new Error(`Apify ${actorId}: no dataset (status=${run.data?.status})`);
  }

  const itemsRes = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?format=json&clean=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!itemsRes.ok) {
    throw new Error(`Apify dataset ${datasetId}: ${itemsRes.status}`);
  }

  const items = (await itemsRes.json()) as T[];
  return { items, runId: run.data?.id };
}

export function hasApifyToken() {
  return Boolean(process.env.APIFY_TOKEN);
}
