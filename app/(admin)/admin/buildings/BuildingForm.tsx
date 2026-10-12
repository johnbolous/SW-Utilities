"use client";

import { useEffect, useState } from "react";
import { FieldLabel, Input, Select, Button } from "@/components/ui/primitives";

interface BuildingRecord {
  id: string;
  code: string;
  name_en: string;
  name_ar: string | null;
  sort_order: number;
  has_meters: boolean;
  technology_park_id: string | null;
}

export function BuildingForm({
  record,
  onDone,
  onCancel,
}: {
  record: BuildingRecord | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!record;
  const [parks, setParks] = useState<{ id: string; name: string }[]>([]);
  const [parkId, setParkId] = useState(record?.technology_park_id ?? "");
  const [code, setCode] = useState(record?.code ?? "");
  const [nameEn, setNameEn] = useState(record?.name_en ?? "");
  const [nameAr, setNameAr] = useState(record?.name_ar ?? "");
  const [sortOrder, setSortOrder] = useState(String(record?.sort_order ?? 0));
  const [hasMeters, setHasMeters] = useState(record?.has_meters ?? true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/parks?pageSize=100")
      .then((res) => res.json())
      .then((body) => {
        setParks(body.parks ?? []);
        if (!parkId && body.parks?.length) setParkId(body.parks[0].id);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = isEdit
        ? await fetch(`/api/admin/buildings/${record!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nameEn, nameAr, sortOrder: Number(sortOrder), hasMeters, parkId }),
          })
        : await fetch("/api/admin/buildings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, nameEn, nameAr, sortOrder: Number(sortOrder), hasMeters, parkId }),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "FAILED");
      }
      onDone();
    } catch (e: any) {
      setError(e.message === "CODE_TAKEN" ? "That code is already used." : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="font-display font-bold text-lg mb-4">{isEdit ? "Edit building" : "New building"}</div>

      <FieldLabel>Technology Park</FieldLabel>
      <Select value={parkId} onChange={(e) => setParkId(e.target.value)} className="mb-3" required>
        {parks.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </Select>

      {!isEdit && (
        <>
          <FieldLabel>Code (internal, no spaces)</FieldLabel>
          <Input value={code} onChange={(e) => setCode(e.target.value)} className="mb-3" required />
        </>
      )}

      <FieldLabel>Name (English)</FieldLabel>
      <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="mb-3" required />

      <FieldLabel>Name (Arabic, optional)</FieldLabel>
      <Input value={nameAr ?? ""} onChange={(e) => setNameAr(e.target.value)} className="mb-3" dir="rtl" />

      <FieldLabel>Sort order</FieldLabel>
      <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="mb-3" />

      <label className="flex items-center gap-2 text-sm mb-3">
        <input type="checkbox" checked={hasMeters} onChange={(e) => setHasMeters(e.target.checked)} />
        Has meters (uncheck for a building that exists but isn't metered yet)
      </label>

      {error && <div className="text-sm text-danger mb-3">{error}</div>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "…" : isEdit ? "Save changes" : "Create building"}
        </Button>
      </div>
    </form>
  );
}
