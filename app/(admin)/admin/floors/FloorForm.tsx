"use client";

import { useEffect, useState } from "react";
import { FieldLabel, Input, Select, Button } from "@/components/ui/primitives";

interface FloorRecord {
  id: string;
  building_id: string;
  code: string;
  name_en: string;
  name_ar: string | null;
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

export function FloorForm({
  record,
  onDone,
  onCancel,
}: {
  record: FloorRecord | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!record;
  const [parks, setParks] = useState<ParkItem[]>([]);
  const [buildings, setBuildings] = useState<BuildingItem[]>([]);
  const [selectedParkId, setSelectedParkId] = useState("");
  const [buildingId, setBuildingId] = useState(record?.building_id ?? "");
  const [code, setCode] = useState(record?.code ?? "");
  const [nameEn, setNameEn] = useState(record?.name_en ?? "");
  const [nameAr, setNameAr] = useState(record?.name_ar ?? "");
  const [sortOrder, setSortOrder] = useState(String(record?.sort_order ?? 0));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // جلب المناطق والمباني معاً
    Promise.all([
      fetch("/api/admin/parks?pageSize=100").then((res) => res.json()),
      fetch("/api/admin/buildings?pageSize=100").then((res) => res.json()),
    ]).then(([parksBody, buildingsBody]) => {
      const allParks = parksBody.parks ?? [];
      const allBuildings: BuildingItem[] = buildingsBody.buildings ?? [];

      setParks(allParks);
      setBuildings(allBuildings);

      if (!buildingId && allBuildings.length) {
        setBuildingId(allBuildings[0].id);
        // تعيين المنطقة التابعة أول مبنى افتراضياً إذا وجد
        if (allBuildings[0].technology_park_id) {
          setSelectedParkId(allBuildings[0].technology_park_id);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // تصفية المباني بناءً على المنطقة المحددة
  const filteredBuildings = selectedParkId
    ? buildings.filter((b) => b.technology_park_id === selectedParkId)
    : buildings;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = isEdit
        ? await fetch(`/api/admin/floors/${record!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nameEn, nameAr, sortOrder: Number(sortOrder) }),
          })
        : await fetch("/api/admin/floors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ buildingId, code, nameEn, nameAr, sortOrder: Number(sortOrder) }),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "FAILED");
      }
      onDone();
    } catch (e: any) {
      setError(e.message === "CODE_TAKEN_FOR_BUILDING" ? "That floor code already exists for this building." : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="font-display font-bold text-lg mb-4">{isEdit ? "Edit floor" : "New floor"}</div>

      {!isEdit && (
        <>
          {/* فلتر اختيار المنطقة أولاً */}
          <FieldLabel>Technology Park</FieldLabel>
          <Select
            value={selectedParkId}
            onChange={(e) => {
              setSelectedParkId(e.target.value);
              setBuildingId(""); // إعادة تعيين المبنى عند تغيير المنطقة
            }}
            className="mb-3"
          >
            <option value="">All Parks / Select Park...</option>
            {parks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>

          {/* اختيار المبنى مفزلاً بناءً على المنطقة */}
          <FieldLabel>Building</FieldLabel>
          <Select value={buildingId} onChange={(e) => setBuildingId(e.target.value)} className="mb-3" required>
            <option value="">Select Building...</option>
            {filteredBuildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name_en}
              </option>
            ))}
          </Select>

          <FieldLabel>Code (e.g. ground, first, second)</FieldLabel>
          <Input value={code} onChange={(e) => setCode(e.target.value)} className="mb-3" required />
        </>
      )}

      <FieldLabel>Name (English)</FieldLabel>
      <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="mb-3" required />

      <FieldLabel>Name (Arabic, optional)</FieldLabel>
      <Input value={nameAr ?? ""} onChange={(e) => setNameAr(e.target.value)} className="mb-3" dir="rtl" />

      <FieldLabel>Sort order</FieldLabel>
      <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="mb-3" />

      {error && <div className="text-sm text-danger mb-3">{error}</div>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "…" : isEdit ? "Save changes" : "Create floor"}
        </Button>
      </div>
    </form>
  );
}
