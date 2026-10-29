"use client";

import { useEffect, useState } from "react";
import { FieldLabel, Input, Select, Button } from "@/components/ui/primitives";

interface SolarInverterRecord {
  id: string;
  building_id: string;
  inverter_no: number;
  label_en: string;
  meter_code: string;
  buildings?: { technology_park_id: string | null } | null;
}

interface BuildingItem {
  id: string;
  name_en: string;
  technology_park_id: string | null;
}

interface ParkItem {
  id: string;
  name: string;
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
  const [parks, setParks] = useState<ParkItem[]>([]);
  const [buildings, setBuildings] = useState<BuildingItem[]>([]);
  
  const [selectedParkId, setSelectedParkId] = useState("");
  const [buildingId, setBuildingId] = useState(record?.building_id ?? "");
  const [inverterNo, setInverterNo] = useState(String(record?.inverter_no ?? 1));
  const [labelEn, setLabelEn] = useState(record?.label_en ?? "");
  const [meterCode, setMeterCode] = useState(record?.meter_code ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // جلب المناطق والمباني عند فتح النموذج
    Promise.all([
      fetch("/api/admin/parks?pageSize=100").then((res) => res.json()),
      fetch("/api/admin/buildings?pageSize=100").then((res) => res.json()),
    ])
      .then(([parksData, buildingsData]) => {
        const fetchedParks = parksData.parks ?? [];
        const fetchedBuildings = buildingsData.buildings ?? [];
        
        setParks(fetchedParks);
        setBuildings(fetchedBuildings);

        if (isEdit && record?.building_id) {
          // إذا كنت في وضع التعديل، حدد المنطقة التابع لها المبنى الحالي تلقائياً
          const currentBuilding = fetchedBuildings.find((b: BuildingItem) => b.id === record.building_id);
          if (currentBuilding?.technology_park_id) {
            setSelectedParkId(currentBuilding.technology_park_id);
          }
        } else if (fetchedParks.length === 1) {
          setSelectedParkId(fetchedParks[0].id);
        }
      })
      .catch(() => {
        setError("Failed to load form options.");
      });
  }, [isEdit, record]);

  // فلترة المباني بناءً على المنطقة المحددة
  const filteredBuildings = selectedParkId
    ? buildings.filter((b) => b.technology_park_id === selectedParkId)
    : buildings;

  useEffect(() => {
    // إذا تغيرت المنطقة ولم يعد المبنى الحالي ضمن القائمة المفلترة، قم بتفريغه
    if (selectedParkId && buildingId) {
      const isValid = filteredBuildings.some((b) => b.id === buildingId);
      if (!isValid) {
        setBuildingId("");
      }
    }
  }, [selectedParkId, buildingId, filteredBuildings]);

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
          {parks.length > 1 && (
            <>
              <FieldLabel>Technology Park</FieldLabel>
              <Select
                value={selectedParkId}
                onChange={(e) => setSelectedParkId(e.target.value)}
                className="mb-3"
              >
                <option value="">Select park...</option>
                {parks.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </>
          )}

          <FieldLabel>Building</FieldLabel>
          <Select
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value)}
            className="mb-3"
            required
          >
            <option value="">Select building...</option>
            {filteredBuildings.map((b) => (
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
