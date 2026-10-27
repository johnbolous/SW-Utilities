"use client";

import { useState, useEffect } from "react";
import { FieldLabel, Input, Button } from "@/components/ui/primitives";

interface KioskRecord {
  id: string;
  name: string;
  meter_code: string;
  sort_order: number;
  park_id?: string;
}

interface Park {
  id: name;
  name: string;
}

export function KioskForm({
  record,
  onDone,
  onCancel,
}: {
  record: KioskRecord | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!record;
  const [name, setName] = useState(record?.name ?? "");
  const [meterCode, setMeterCode] = useState(record?.meter_code ?? "");
  const [sortOrder, setSortOrder] = useState(String(record?.sort_order ?? 0));
  const [parkId, setParkId] = useState(record?.park_id ?? "");
  
  const [parks, setParks] = useState<Park[]>([]);
  const [loadingParks, setLoadingParks] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // جلب قائمة المناطق (Parks) من قاعدة البيانات لعرضها في القائمة المنسدلة
  useEffect(() => {
    async function fetchParks() {
      try {
        const res = await fetch("/api/admin/parks");
        if (res.ok) {
          const data = await res.json();
          const parksList = data.parks || data || [];
          setParks(parksList);
          if (!parkId && parksList.length > 0) {
            setParkId(parksList[0].id);
          }
        }
      } catch (err) {
        console.error("Error fetching parks:", err);
      } finally {
        setLoadingParks(false);
      }
    }
    fetchParks();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e._preventDefault?.();
    e.preventDefault();
    if (!parkId) {
      setError("يرجى اختيار المنطقة التابع لها الكشك.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = isEdit
        ? await fetch(`/api/admin/kiosks/${record!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, sortOrder: Number(sortOrder), parkId }),
          })
        : await fetch("/api/admin/kiosks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, meterCode, sortOrder: Number(sortOrder), parkId }),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "FAILED");
      }
      onDone();
    } catch (e: any) {
      setError(e.message === "METER_CODE_TAKEN" ? "That meter code is already used." : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="font-display font-bold text-lg mb-4">{isEdit ? "Edit kiosk" : "New kiosk"}</div>

      <FieldLabel>المنطقة (Park)</FieldLabel>
      <select 
        value={parkId} 
        onChange={(e) => setParkId(e.target.value)} 
        className="w-full border p-2 rounded-xl text-xs bg-gray-50 mb-3 outline-none"
        required
        disabled={loadingParks}
      >
        <option value="" disabled>اختر المنطقة...</option>
        {parks.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <FieldLabel>Name</FieldLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} className="mb-3" required />

      {!isEdit && (
        <>
          <FieldLabel>Meter code (unique)</FieldLabel>
          <Input value={meterCode} onChange={(e) => setMeterCode(e.target.value)} className="mb-3" required />
        </>
      )}

      <FieldLabel>Sort order</FieldLabel>
      <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="mb-3" />

      <div className="text-xs text-brand-gray mb-3">Kiosk readings are always monthly, entered on day 1 — this can't be changed per kiosk.</div>

      {error && <div className="text-sm text-danger mb-3">{error}</div>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || loadingParks}>
          {loading ? "…" : isEdit ? "Save changes" : "Create kiosk"}
        </Button>
      </div>
    </form>
  );
}
