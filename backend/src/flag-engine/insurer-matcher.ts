import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface InsurerEntry {
  insurerName: string;
  icrPct: number;
}

interface SettlementRatios {
  sourceLabel: string;
  reportingPeriod: string;
  lastVerified: string;
  insurers: InsurerEntry[];
}

let ratiosCache: SettlementRatios | null = null;

function loadSettlementRatios(): SettlementRatios {
  if (ratiosCache) return ratiosCache;
  const path = join(__dirname, '..', '..', '..', 'data', 'settlement_ratios.json');
  const raw = readFileSync(path, 'utf-8');
  ratiosCache = JSON.parse(raw) as SettlementRatios;
  return ratiosCache;
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/insurance\s*co(\.|mpany)?/g, '')
    .replace(/insurance/g, '')
    .replace(/limited|lt[sd]/g, '')
    .replace(/ltd/g, '')
    .replace(/corp(oration)?/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchInsurer(extractedName: string | null | undefined): {
  icrPct: number | null;
  matchedName: string | null;
} {
  if (!extractedName) return { icrPct: null, matchedName: null };

  const data = loadSettlementRatios();
  const normalized = normalize(extractedName);
  const normalizedWords = normalized.split(/\s+/).filter(Boolean);

  let best: { name: string; icr: number; score: number } | null = null;

  for (const entry of data.insurers) {
    const entryNorm = normalize(entry.insurerName);
    const entryWords = entryNorm.split(/\s+/).filter(Boolean);

    let matches = 0;
    for (const w of normalizedWords) {
      if (entryWords.some(ew => ew.includes(w) || w.includes(ew))) matches++;
    }
    const score = matches / Math.max(normalizedWords.length, entryWords.length);

    if (score > 0 && (!best || score > best.score)) {
      best = { name: entry.insurerName, icr: entry.icrPct, score };
    }
  }

  if (best && best.score >= 0.4) {
    return { icrPct: best.icr, matchedName: best.name };
  }

  return { icrPct: null, matchedName: null };
}