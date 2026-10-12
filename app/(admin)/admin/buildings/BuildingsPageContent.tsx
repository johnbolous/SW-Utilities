"use client";

import { useEffect, useState } from "react";
import { AdminListPage } from "@/components/admin/AdminListPage";
import { Badge } from "@/components/ui/primitives";
import { BuildingForm } from "./BuildingForm";

interface BuildingRow {
  id: string;
  code: string;
  name_en: string;
  name_ar: string | null;
  sort_order: number;
  has_meters: boolean;
  is_active: boolean;
  technology_park_id: string | null;
  technology_parks: { name: string } | { name: string }[] | null;
}

function parkName(row: BuildingRow): string {
  const p = row.technology_parks;
  if (!p) return "—";
  return Array.isArray(p) ? p[0]?.name ?? "—" : p.name;
}

export function BuildingsPageContent() {
  const [parkOptions, setParkOptions] = useState<
    { value: string; label: string }[]
  >([]);

  useEffect(() => {
    fetch("/api/admin/parks?pageSize=100")
      .then((res) => res.json())
      .then((body) =>
        setParkOptions(
          (body.parks ?? []).map((p: any) => ({
            value: p.id,
            label: p.name,
          }))
        )
      );
  }, []);

  return (
    <AdminListPage<BuildingRow>
      title="Buildings"
      apiBase="/api/admin/buildings"
      listKey="buildings"
      getId={(r) => r.id}
      getStatus={(r) => r.is_active}
      statusFieldLabel="building"
      searchPlaceholder="Search by name or code…"
      newLabel="+ New building"
      filters={[
        {
          key: "parkId",
          label: "All parks",
          options: parkOptions,
        },
      ]}
      columns={[
        { key: "name_en", label: "Name" },
        { key: "code", label: "Code" },
        {
          key: "technology_parks",
          label: "Park",
          render: parkName,
        },
        {
          key: "sort_order",
          label: "Order",
        },
        {
          key: "has_meters",
          label: "Metered",
          render: (r) => (
            <Badge tone={r.has_meters ? "success" : "neutral"}>
              {r.has_meters ? "Yes" : "No"}
            </Badge>
          ),
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
      onDelete={async (row) => {
        const res = await fetch(`/api/admin/buildings/${row.id}`, {
          method: "DELETE",
        });

        if (res.ok) {
          return { ok: true };
        }

        const body = await res.json().catch(() => ({}));

        return {
          ok: false,
          error: body.error ?? "DELETE_FAILED",
        };
      }}
      deleteLabel="building"
      renderForm={({ record, onDone, onCancel }) => (
        <BuildingForm
          record={record}
          onDone={onDone}
          onCancel={onCancel}
        />
      )}
    />
  );
}