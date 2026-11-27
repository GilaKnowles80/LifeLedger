import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type AdRecord = {
  id: string;
  companyName: string;
  contactEmail: string;
  title: string;
  description: string;
  website: string | null;
  category: string;
  region: string;
  amount: "250.00";
  currency: "PHP";
  status: "pending_payment" | "checkout_failed" | "awaiting_review" | "payment_failed";
  paymentStatus: "pending" | "failed" | "paid";
  paypalOrderId: string | null;
  paypalCaptureId: string | null;
  createdAt: string;
  paidAt: string | null;
};

const recordsDirectory = process.env.LIFELEDGER_DATA_DIR
  ? path.join(process.env.LIFELEDGER_DATA_DIR, "ads")
  : path.join(process.cwd(), ".data", "ads");

function recordPath(id: string) {
  return path.join(recordsDirectory, `${id}.json`);
}

export async function createAd(ad: AdRecord) {
  await mkdir(recordsDirectory, { recursive: true });
  await writeFile(recordPath(ad.id), JSON.stringify(ad), { flag: "wx" });
}

export async function getAd(id: string): Promise<AdRecord | null> {
  try {
    return JSON.parse(await readFile(recordPath(id), "utf8")) as AdRecord;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }
}

export async function updateAd(id: string, updates: Partial<AdRecord>) {
  const current = await getAd(id);
  if (!current) throw new Error("Advertisement record was not found.");
  const temporaryPath = `${recordPath(id)}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, JSON.stringify({ ...current, ...updates }));
  await rename(temporaryPath, recordPath(id));
}

export async function findAdByOrderId(orderId: string): Promise<AdRecord | null> {
  await mkdir(recordsDirectory, { recursive: true });
  for (const filename of await readdir(recordsDirectory)) {
    if (!filename.endsWith(".json")) continue;
    const ad = await getAd(filename.slice(0, -5));
    if (ad?.paypalOrderId === orderId) return ad;
  }
  return null;
}