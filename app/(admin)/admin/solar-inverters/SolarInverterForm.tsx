"use client";

import { useEffect, useState } from "react";
import { FieldLabel, Input, Select, Button } from "@/components/ui/primitives";

interface SolarInverterRecord {
  id: string;
  building_id: string;
  inverter_no: number;
  label_en: string;
  meter_code: string;
}

export function SolarInverterForm({
  record,
  onDone,
  onCancel,
}: {
  record: SolarInverterRecord | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!record;
  const [buildings, setBuildings] = useState<{ id: string; name_en: string }[]>([]);
  const [buildingId, setBuildingId] = useState(record?.building_id ?? "");
  const [inverterNo, setInverterNo] = useState(String(record?.inverter_no ?? 1));
  const [labelEn, setLabelEn] = useState(record?.label_en ?? "");
  const [meterCode, setMeterCode] = useState(record?.meter_code ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/buildings?pageSize=100")
      .then((res) => res.json())
      .then((body) => {
        setBuildings(body.buildings ?? []);
        if (!buildingId && body.buildings?.length) setBuildingId(body.buildings[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = isEdit
        ? await fetch(`/api/admin/solar-inverters/${record!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ labelEn }),
          })
        : await fetch("/api/admin/solar-inverters", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ buildingId, inverterNo: Number(inverterNo), labelEn, meterCode }),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "FAILED");
      }
      onDone();
    } catch (e: any) {
      setError(e.message === "DUPLICATE_INVERTER" ? "That inverter number already exists for this building." : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="font-display font-bold text-lg mb-4">{isEdit ? "Edit inverter" : "New solar inverter"}</div>

      {!isEdit && (
        <>
          <FieldLabel>Building</FieldLabel>
          <Select value={buildingId} onChange={(e) => setBuildingId(e.target.value)} className="mb-3" required>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name_en}</option>
            ))}
          </Select>

          <FieldLabel>Inverter number</FieldLabel>
          <Input type="number" min={1} value={inverterNo} onChange={(e) => setInverterNo(e.target.value)} className="mb-3" required />
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

      {error && <div className="text-sm text-danger mb-3">{error}</div>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "…" : isEdit ? "Save changes" : "Create inverter"}
        </Button>
      </div>
    </form>
  );
}
