"use client";

import type {
  Building,
  Floor,
  Room,
  Meter,
  SolarInverter,
  WaterMeter,
  Kiosk,
  ReadingEntityType,
} from "@/types/database";

export interface StructureBundle {
  buildings: Building[];
  floors: Floor[];
  rooms: Room[];
  meters: Meter[];
  solarInverters: SolarInverter[];
  waterMeters: WaterMeter[];
  kiosks: Kiosk[];
  parks: any[]; // إضافة مصفوفة المناطق هنا[cite: 4]
}

export async function fetchStructure(): Promise<StructureBundle> {
  const res = await fetch("/api/structure");
  if (!res.ok) throw new Error("STRUCTURE_LOAD_FAILED");
  return res.json();
}

export interface LatestReadingInfo {
  previousValue: number;
  alreadyReadThisPeriod: boolean;
  readingFrequency: "DAILY" | "MONTHLY";
  monthlyReadingDay: number | null;
  meterCode: string;
  buildingName: string;
}

export async function fetchLatestReading(entityType: ReadingEntityType, entityId: string): Promise<LatestReadingInfo> {
  const res = await fetch(`/api/readings/latest?entityType=${entityType}&entityId=${entityId}`);
  if (!res.ok) throw new Error("LATEST_READING_LOAD_FAILED");
  return res.json();
}

export interface SubmitReadingParams {
  entityType: ReadingEntityType;
  entityId: string;
  readingDate: string;
  currentValue: number;
  notes?: string;
  isLowerConfirmed?: boolean;
  lowerReason?: string;
  photoId?: string | null;
}

export type SubmitReadingResult =
  | { ok: true }
  | { ok: false; error: "LOWER_THAN_PREVIOUS"; previousValue: number }
  | { ok: false; error: string; detail?: string };

export async function submitReading(params: SubmitReadingParams): Promise<SubmitReadingResult> {
  const res = await fetch("/api/readings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const body = await res.json().catch(() => ({}));

  if (res.ok) return { ok: true };

  if (body.error === "LOWER_THAN_PREVIOUS") {
    return { ok: false, error: "LOWER_THAN_PREVIOUS", previousValue: body.previousValue };
  }

  return { 
    ok: false, 
    error: body.error || "SERVER_ERROR", 
    detail: body.detail || res.statusText 
  };
}