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
  const [buildings, setBuildings] = useState<{ id: string; name_en: string }[]>([]);
  const [buildingId, setBuildingId] = useState(record?.building_id ?? "");
  const [code, setCode] = useState(record?.code ?? "");
  const [nameEn, setNameEn] = useState(record?.name_en ?? "");
  const [nameAr, setNameAr] = useState(record?.name_ar ?? "");
  const [sortOrder, setSortOrder] = useState(String(record?.sort_order ?? 0));
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
          <FieldLabel>Building</FieldLabel>
          <Select value={buildingId} onChange={(e) => setBuildingId(e.target.value)} className="mb-3" required>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name_en}</option>
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
