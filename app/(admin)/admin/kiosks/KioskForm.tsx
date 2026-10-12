"use client";

import { useState } from "react";
import { FieldLabel, Input, Button } from "@/components/ui/primitives";

interface KioskRecord {
  id: string;
  name: string;
  meter_code: string;
  sort_order: number;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = isEdit
        ? await fetch(`/api/admin/kiosks/${record!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, sortOrder: Number(sortOrder) }),
          })
        : await fetch("/api/admin/kiosks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, meterCode, sortOrder: Number(sortOrder) }),
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
        <Button type="submit" disabled={loading}>
          {loading ? "…" : isEdit ? "Save changes" : "Create kiosk"}
        </Button>
      </div>
    </form>
  );
}
