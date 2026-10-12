"use client";

import { useEffect, useState } from "react";
import { FieldLabel, Input, Select, Button } from "@/components/ui/primitives";
import { isReadingFrequency } from "@/lib/utils/enumGuards";

interface WaterMeterRecord {
  id: string;
  type: string;
  label_en: string;
  meter_code: string;
  reading_frequency: "DAILY" | "MONTHLY";
  monthly_reading_day: number | null;
  technology_park_id: string | null;
}

interface ParkItem {
  id: string;
  name: string;
}

export function WaterMeterForm({
  record,
  onDone,
  onCancel,
}: {
  record: WaterMeterRecord | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!record;
  const [parks, setParks] = useState<ParkItem[]>([]);
  const [parkId, setParkId] = useState(record?.technology_park_id ?? "");
  
  // الأنواع الأساسية (شرب أو ري) أو تخصيص نوع جديد
  const initialType = record?.type ?? "Drinking water";
  const isPresetType = initialType === "Drinking water" || initialType === "Irrigation";
  
  const [typePreset, setTypePreset] = useState<string>(isPresetType ? initialType : "__custom__");
  const [customType, setCustomType] = useState<string>(isPresetType ? "" : initialType);

  const [labelEn, setLabelEn] = useState(record?.label_en ?? "");
  const [meterCode, setMeterCode] = useState(record?.meter_code ?? "");
  const [frequency, setFrequency] = useState<"DAILY" | "MONTHLY">(record?.reading_frequency ?? "DAILY");
  const [monthlyDay, setMonthlyDay] = useState(String(record?.monthly_reading_day ?? 1));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/parks?pageSize=100")
      .then((res) => res.json())
      .then((body) => {
        const fetchedParks = body.parks ?? [];
        setParks(fetchedParks);
        if (!isEdit && !parkId && fetchedParks.length > 0) {
          setParkId(fetchedParks[0].id);
        }
      });
  }, [isEdit, parkId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const finalType = typePreset === "__custom__" ? customType.trim() : typePreset;
    if (!finalType) {
      setError("Please specify a meter type.");
      setLoading(false);
      return;
    }

    try {
      const res = isEdit
        ? await fetch(`/api/admin/water-meters/${record!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              technologyParkId: parkId,
              type: finalType,
              labelEn,
              readingFrequency: frequency,
              monthlyReadingDay: Number(monthlyDay),
            }),
          })
        : await fetch("/api/admin/water-meters", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              technologyParkId: parkId,
              type: finalType,
              labelEn,
              meterCode,
              readingFrequency: frequency,
              monthlyReadingDay: Number(monthlyDay),
            }),
          });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail ? `${body.error}: ${body.detail}` : (body.error ?? "FAILED"));
      }
      onDone();
    } catch (e: any) {
      setError(
        e.message === "METER_CODE_TAKEN"
          ? "That meter code is already used."
          : e.message || "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="font-display font-bold text-lg mb-4">{isEdit ? "Edit water meter" : "New water meter"}</div>

      <FieldLabel>Technology Park</FieldLabel>
      <Select value={parkId} onChange={(e) => setParkId(e.target.value)} className="mb-3" required>
        <option value="">Select Park</option>
        {parks.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </Select>

      <FieldLabel>Meter Type</FieldLabel>
      <Select
        value={typePreset}
        onChange={(e) => setTypePreset(e.target.value)}
        className="mb-3"
      >
        <option value="Drinking water">Drinking water (شرب)</option>
        <option value="Irrigation">Irrigation (ري)</option>
        <option value="__custom__">Other / Add new type (إضافة نوع جديد)...</option>
      </Select>

      {typePreset === "__custom__" && (
        <>
          <FieldLabel>Custom Type Name</FieldLabel>
          <Input
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
            className="mb-3"
            placeholder="Enter new meter type name"
            required
          />
        </>
      )}

      <FieldLabel>Label</FieldLabel>
      <Input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} className="mb-3" required />

      {!isEdit && (
        <>
          <FieldLabel>Meter code (unique)</FieldLabel>
          <Input value={meterCode} onChange={(e) => setMeterCode(e.target.value)} className="mb-3" required />
        </>
      )}

      <FieldLabel>Reading frequency</FieldLabel>
      <Select value={frequency} onChange={(e) => { if (isReadingFrequency(e.target.value)) setFrequency(e.target.value); }} className="mb-3">
        <option value="DAILY">Daily</option>
        <option value="MONTHLY">Monthly</option>
      </Select>

      {frequency === "MONTHLY" && (
        <>
          <FieldLabel>Day of month</FieldLabel>
          <Input type="number" min={1} max={28} value={monthlyDay} onChange={(e) => setMonthlyDay(e.target.value)} className="mb-3" />
        </>
      )}

      {error && <div className="text-sm text-danger mb-3 p-2 bg-red-50 rounded border border-red-200">{error}</div>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "…" : isEdit ? "Save changes" : "Create water meter"}
        </Button>
      </div>
    </form>
  );
}