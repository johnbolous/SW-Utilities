"use client";

import { useEffect, useState } from "react";
import { FieldLabel, Input, Select, Button } from "@/components/ui/primitives";
import { isMeterCategory, isReadingFrequency } from "@/lib/utils/enumGuards";

interface MeterRecord {
  id: string;
  category: "LOW" | "MEDIUM";
  building_id: string;
  floor_id: string | null;
  room_code: string | null;
  label_en: string;
  meter_code: string;
  reading_frequency: "DAILY" | "MONTHLY";
  monthly_reading_day: number | null;
  sort_order: number;
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

export function MeterForm({
  record,
  onDone,
  onCancel,
}: {
  record: MeterRecord | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!record;
  const [parks, setParks] = useState<ParkItem[]>([]);
  const [buildings, setBuildings] = useState<BuildingItem[]>([]);
  const [floors, setFloors] = useState<{ id: string; name_en: string }[]>([]);

  const [category, setCategory] = useState<"LOW" | "MEDIUM">(record?.category ?? "LOW");
  const [parkId, setParkId] = useState("");
  const [buildingId, setBuildingId] = useState(record?.building_id ?? "");
  const [floorId, setFloorId] = useState(record?.floor_id ?? "");
  const [roomCode, setRoomCode] = useState(record?.room_code ?? "");
  const [labelEn, setLabelEn] = useState(record?.label_en ?? "");
  const [meterCode, setMeterCode] = useState(record?.meter_code ?? "");
  const [frequency, setFrequency] = useState<"DAILY" | "MONTHLY">(record?.reading_frequency ?? "DAILY");
  const [monthlyDay, setMonthlyDay] = useState(String(record?.monthly_reading_day ?? 1));
  const [sortOrder, setSortOrder] = useState(String(record?.sort_order ?? 0));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch parks and buildings on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/admin/parks?pageSize=100").then((res) => res.json()),
      fetch("/api/admin/buildings?pageSize=100").then((res) => res.json()),
    ]).then(([parksBody, buildingsBody]) => {
      const fetchedParks = parksBody.parks ?? [];
      const fetchedBuildings = buildingsBody.buildings ?? [];
      setParks(fetchedParks);
      setBuildings(fetchedBuildings);

      if (isEdit && record?.building_id) {
        const foundBldg = fetchedBuildings.find((b: BuildingItem) => b.id === record.building_id);
        if (foundBldg?.technology_park_id) {
          setParkId(foundBldg.technology_park_id);
        }
      } else if (!isEdit && fetchedParks.length > 0) {
        setParkId(fetchedParks[0].id);
      }
    });
  }, [isEdit, record?.building_id]);

  // When park changes, adjust building selection if invalid
  const handleParkChange = (newParkId: string) => {
    setParkId(newParkId);
    const validBldgs = buildings.filter((b) => b.technology_park_id === newParkId);
    const isCurrentBuildingValid = validBldgs.some((b) => b.id === buildingId);
    if (!isCurrentBuildingValid) {
    setBuildingId(validBldgs[0]?.id ?? "");    }
  };

  // Fetch floors when buildingId changes
  useEffect(() => {
    if (!buildingId) {
      setFloors([]);
      return;
    }
    fetch(`/api/admin/floors?buildingId=${buildingId}&pageSize=50`)
      .then((res) => res.json())
      .then((body) => setFloors(body.floors ?? []));
  }, [buildingId]);

  const filteredBuildings = buildings.filter((b) => !parkId || b.technology_park_id === parkId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = isEdit
        ? await fetch(`/api/admin/meters/${record!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              buildingId,
              labelEn,
              floorId: floorId || null,
              roomCode: roomCode || null,
              sortOrder: Number(sortOrder),
              readingFrequency: frequency,
              // التعديل هنا: إرسال null إذا كان يومي
              monthlyReadingDay: frequency === "MONTHLY" ? Number(monthlyDay) : null,
            }),
          })
        : await fetch("/api/admin/meters", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              category,
              buildingId,
              floorId: floorId || null,
              roomCode: roomCode || null,
              labelEn,
              meterCode,
              readingFrequency: frequency,
              // التعديل هنا: إرسال null إذا كان يومي
              monthlyReadingDay: frequency === "MONTHLY" ? Number(monthlyDay) : null,
              sortOrder: Number(sortOrder),
            }),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.error || "FAILED");
      }
      onDone();
    } catch (e: any) {
      setError(e.message); 
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="font-display font-bold text-lg mb-4">{isEdit ? "Edit meter" : "New electric meter"}</div>

      {!isEdit && (
        <>
          <FieldLabel>Category</FieldLabel>
          <Select value={category} onChange={(e) => { if (isMeterCategory(e.target.value)) setCategory(e.target.value); }} className="mb-3">
            <option value="LOW">Low voltage</option>
            <option value="MEDIUM">Medium voltage</option>
          </Select>
        </>
      )}

      <FieldLabel>Technology Park</FieldLabel>
      <Select value={parkId} onChange={(e) => handleParkChange(e.target.value)} className="mb-3" required>
        <option value="">Select Park</option>
        {parks.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </Select>

      <FieldLabel>Building</FieldLabel>
      <Select value={buildingId} onChange={(e) => setBuildingId(e.target.value)} className="mb-3" required>
        <option value="">Select Building</option>
        {filteredBuildings.map((b) => (
          <option key={b.id} value={b.id}>{b.name_en}</option>
        ))}
      </Select>

      {category === "LOW" && (
        <>
          <FieldLabel>Floor (optional)</FieldLabel>
          <Select value={floorId} onChange={(e) => setFloorId(e.target.value)} className="mb-3">
            <option value="">—</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>{f.name_en}</option>
            ))}
          </Select>

          <FieldLabel>Room code (optional, e.g. GA1)</FieldLabel>
          <Input value={roomCode ?? ""} onChange={(e) => setRoomCode(e.target.value)} className="mb-3" />
        </>
      )}

      <FieldLabel>Label</FieldLabel>
      <Input value={labelEn} onChange={(e) => setLabelEn(e.target.value)} className="mb-3" required />

      {!isEdit && (
        <>
          <FieldLabel>Meter code (unique, e.g. LOW-TR-G)</FieldLabel>
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

      <FieldLabel>Sort order</FieldLabel>
      <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="mb-3" />

      {error && <div className="text-sm text-danger mb-3">{error}</div>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "…" : isEdit ? "Save changes" : "Create meter"}
        </Button>
      </div>
    </form>
  );
}
