import type { Enums } from "@/types/database";

type UserRole = Enums<"user_role">;
type MeterCategory = Enums<"meter_category">;
type ReadingFrequency = Enums<"reading_frequency">;
type WaterMeterType = Enums<"water_meter_type">;
type PhotoStatus = Enums<"photo_status">;
type AlertSeverity = Enums<"alert_severity">;
type AlertType = Enums<"alert_type">;
type ReadingEntityType = Enums<"reading_entity_type">;

export function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "engineer" || value === "technician";
}

export function isMeterCategory(value: unknown): value is MeterCategory {
  return value === "LOW" || value === "MEDIUM";
}

export function isReadingFrequency(value: unknown): value is ReadingFrequency {
  return value === "DAILY" || value === "MONTHLY";
}

export function isWaterMeterType(value: unknown): value is WaterMeterType {
  return value === "DRINKING" || value === "IRRIGATION" || value === "FACTORY";
}

export function isPhotoStatus(value: unknown): value is PhotoStatus {
  return value === "pending" || value === "approved" || value === "rejected";
}

export function isAlertSeverity(value: unknown): value is AlertSeverity {
  return value === "warning" || value === "critical";
}

export function isAlertType(value: unknown): value is AlertType {
  return value === "LOW_READING" || value === "HIGH_CONSUMPTION" || value === "ZERO_SOLAR" || value === "MISSING_READING";
}

export function isReadingEntityType(value: unknown): value is ReadingEntityType {
  return value === "LOW" || value === "MEDIUM" || value === "SOLAR" || value === "WATER" || value === "KIOSK";
}
