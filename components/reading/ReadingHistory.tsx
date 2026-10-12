"use client";

import { useEffect, useState } from "react";
import { Card, Input, Button, Badge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";

interface EditableReading {
  table: string;
  id: string;
  label: string;
  readingDate: string;
  previousValue: number | null;
  currentValue: number;
  technicianUsername: string;
  canEdit: boolean;
}

export function ReadingHistory() {
  const [rows, setRows] = useState<EditableReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<EditableReading | null>(null);
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/readings/editable");
      if (!res.ok) throw new Error();
      const body = await res.json();
      setRows(body.readings ?? []);
    } catch {
      setError("Could not load this data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openEdit(row: EditableReading) {
    setEditing(row);
    setNewValue(String(row.currentValue));
    setReason("");
    setSaveError(null);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/readings/edit", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: editing.table, id: editing.id, newValue: Number(newValue), reason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const map: Record<string, string> = {
          REASON_REQUIRED: "A reason is required to edit a reading.",
          NOT_YOUR_READING: "You can only edit your own readings.",
          OUTSIDE_PARK: "This reading is outside your assigned Technology Park.",
          OUTSIDE_EDIT_WINDOW: "This reading is outside the allowed edit window.",
          INVALID_VALUE: "Enter a valid value.",
        };
        throw new Error(map[body.error] ?? "Could not save this edit.");
      }
      setEditing(null);
      load();
    } catch (e: any) {
      setSaveError(e.message ?? "Could not save this edit.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="font-display font-bold text-2xl mb-1">Reading History</div>
      <div className="text-sm text-brand-gray mb-4">
        Readings you're allowed to edit are shown with an Edit button — governed by your role, assigned Technology Park(s), and the configured edit window.
      </div>

      <Card>
        {error && <div className="text-sm text-danger mb-3">{error}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th>Meter</th>
                <th>Date</th>
                <th>Previous</th>
                <th>Current</th>
                <th>Technician</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="py-6 text-center text-brand-gray">…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-brand-gray">No readings in range.</td></tr>
              )}
              {!loading && rows.map((r) => (
                <tr key={`${r.table}-${r.id}`}>
                  <td>{r.label}</td>
                  <td>{r.readingDate}</td>
                  <td className="font-mono">{r.previousValue ?? "—"}</td>
                  <td className="font-mono">{r.currentValue}</td>
                  <td>{r.technicianUsername}</td>
                  <td>
                    {r.canEdit ? (
                      <button onClick={() => openEdit(r)} className="text-xs px-2.5 py-1 rounded-md bg-surface-soft border border-border">
                        Edit
                      </button>
                    ) : (
                      <Badge>Locked</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <div>
            <div className="font-display font-bold text-lg mb-1">Edit reading</div>
            <div className="text-sm text-brand-gray mb-4">{editing.label} — {editing.readingDate}</div>

            <label className="block text-xs font-display font-semibold tracking-wide uppercase text-brand-gray mb-1.5">New value</label>
            <Input type="number" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="mb-3 font-mono" />

            <label className="block text-xs font-display font-semibold tracking-wide uppercase text-brand-gray mb-1.5">Reason (required)</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} className="mb-4" />

            {saveError && <div className="text-sm text-danger mb-3">{saveError}</div>}

            <div className="flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !reason.trim()}>{saving ? "…" : "Save edit"}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
