"use client";

import { useState } from "react";
import { FieldLabel, Input, Button } from "@/components/ui/primitives";

interface ParkRecord {
  id: string;
  code: string;
  name: string;
  sort_order: number;
}

export function ParkForm({
  record,
  onDone,
  onCancel,
}: {
  record: ParkRecord | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!record;
  const [code, setCode] = useState(record?.code ?? "");
  const [name, setName] = useState(record?.name ?? "");
  const [sortOrder, setSortOrder] = useState(String(record?.sort_order ?? 0));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = isEdit
        ? await fetch(`/api/admin/parks/${record!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, sortOrder: Number(sortOrder) }),
          })
        : await fetch("/api/admin/parks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, name, sortOrder: Number(sortOrder) }),
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
      <div className="font-display font-bold text-lg mb-4">{isEdit ? "Edit park" : "New technology park"}</div>

      {!isEdit && (
        <>
          <FieldLabel>Code (internal, no spaces)</FieldLabel>
          <Input value={code} onChange={(e) => setCode(e.target.value)} className="mb-3" required />
        </>
      )}

      <FieldLabel>Name</FieldLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} className="mb-3" required />

      <FieldLabel>Sort order</FieldLabel>
      <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="mb-3" />

      {error && <div className="text-sm text-danger mb-3">{error}</div>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "…" : isEdit ? "Save changes" : "Create park"}
        </Button>
      </div>
    </form>
  );
}
