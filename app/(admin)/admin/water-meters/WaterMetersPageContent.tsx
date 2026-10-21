"use client";

import { useEffect, useState } from "react";
import { AdminListPage } from "@/components/admin/AdminListPage";
import { Badge } from "@/components/ui/primitives";
import { WaterMeterForm } from "./WaterMeterForm";

interface WaterMeterRow {
  id: string;
  type: string;
  label_en: string;
  meter_code: string;
  reading_frequency: "DAILY" | "MONTHLY";
  monthly_reading_day: number | null;
  is_active: boolean;
  technology_park_id: string | null;
  technology_parks: { name: string } | null;
}

function parkName(row: WaterMeterRow): string {
  return row.technology_parks?.name ?? "—";
}

export function WaterMetersPageContent() {
  const [parkOptions, setParkOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedParkId, setSelectedParkId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  useEffect(() => {
    fetch("/api/admin/parks?pageSize=100")
      .then((res) => res.json())
      .then((body) =>
        setParkOptions((body.parks ?? []).map((p: any) => ({ value: p.id, label: p.name })))
      );
  }, []);

  return (
    <AdminListPage<WaterMeterRow>
      title="Water Meters"
      apiBase="/api/admin/water-meters"
      listKey="waterMeters"
      getId={(r) => r.id}
      getStatus={(r) => r.is_active}
      statusFieldLabel="water meter"
      searchPlaceholder="Search by label or meter code…"
      newLabel="+ New water meter"
      // تفعيل زر وحوار الحذف تلقائياً بنفس نمط صفحة عدادات الكهرباء
      deleteLabel="water meter"
      onDelete={async (row) => {
        try {
          const res = await fetch(`/api/admin/water-meters/${row.id}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            return { ok: false, error: body.detail || body.error || "DELETE_FAILED" };
          }
          return { ok: true };
        } catch (err: any) {
          return { ok: false, error: err.message };
        }
      }}
      filters={[
        {
          key: "parkId",
          label: "All Parks",
          options: parkOptions,
          value: selectedParkId,
          onChange: setSelectedParkId,
        },
        {
          key: "status",
          label: "All statuses",
          options: [
            { value: "active", label: "Active" },
            { value: "disabled", label: "Disabled" },
          ],
          value: selectedStatus,
          onChange: setSelectedStatus,
        },
      ]}
      columns={[
        { key: "label_en", label: "Label" },
        { key: "meter_code", label: "Code" },
        { key: "technology_parks", label: "Technology Park", render: parkName },
        { key: "type", label: "Type", render: (r) => <span className="capitalize">{r.type}</span> },
        {
          key: "reading_frequency",
          label: "Frequency",
          render: (r) => <span className="capitalize">{r.reading_frequency.toLowerCase()}</span>,
        },
        {
          key: "is_active",
          label: "Status",
          render: (r) => (
            <Badge tone={r.is_active ? "success" : "danger"}>
              {r.is_active ? "Active" : "Disabled"}
            </Badge>
          ),
        },
      ]}
      renderForm={({ record, onDone, onCancel }) => (
        <WaterMeterForm record={record} onDone={onDone} onCancel={onCancel} />
      )}
    />
  );
}
