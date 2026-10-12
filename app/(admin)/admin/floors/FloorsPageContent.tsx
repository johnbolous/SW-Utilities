"use client";

import { useEffect, useState } from "react";
import { AdminListPage } from "@/components/admin/AdminListPage";
import { FloorForm } from "./FloorForm";
import { Badge } from "@/components/ui/primitives";

interface FloorRow {
  id: string;
  building_id: string;
  code: string;
  name_en: string;
  name_ar: string | null;
  sort_order: number;
  is_active: boolean;
  buildings: { name_en: string } | { name_en: string }[] | null;
}

interface BuildingItem {
  id: string;
  name_en: string;
  technology_park_id: string | null;
}

function buildingName(row: FloorRow): string {
  const b = row.buildings;
  if (!b) return "—";
  return Array.isArray(b) ? b[0]?.name_en ?? "—" : b.name_en;
}

export function FloorsPageContent() {
  const [parkOptions, setParkOptions] = useState<{ value: string; label: string }[]>([]);
  const [buildingOptions, setBuildingOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedParkId, setSelectedParkId] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState("");

  useEffect(() => {
    fetch("/api/admin/parks?pageSize=100")
      .then((res) => res.json())
      .then((body) =>
        setParkOptions((body.parks ?? []).map((p: any) => ({ value: p.id, label: p.name })))
      );
  }, []);

  useEffect(() => {
    const url = selectedParkId
      ? `/api/admin/buildings?pageSize=100&parkId=${encodeURIComponent(selectedParkId)}`
      : "/api/admin/buildings?pageSize=100";

    fetch(url)
      .then((res) => res.json())
      .then((body) => {
        const buildings: BuildingItem[] = body.buildings ?? [];
        setBuildingOptions(
          buildings.map((b) => ({
            value: b.id,
            label: b.name_en,
          }))
        );
      });
  }, [selectedParkId]);

  const handleParkChange = (parkId: string) => {
    setSelectedParkId(parkId);
    setSelectedBuildingId("");
  };

  return (
    <AdminListPage<FloorRow>
      title="Floors"
      apiBase="/api/admin/floors"
      listKey="floors"
      getId={(r) => r.id}
      onDelete={async (row) => {
        const res = await fetch(`/api/admin/floors/${row.id}`, { method: "DELETE" });
        if (res.ok) return { ok: true };
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.detail ?? "Could not delete this floor." };
      }}
      deleteLabel="floor"
      searchPlaceholder="Search by name or code…"
      newLabel="+ New floor"
      filters={[
        {
          key: "parkId",
          label: "All Parks",
          options: parkOptions,
          onChange: handleParkChange,
        },
        {
          key: "buildingId",
          label: "All Buildings",
          options: buildingOptions,
        },
      ]}
      columns={[
        { key: "name_en", label: "Name" },
        { key: "code", label: "Code" },
        { key: "buildings", label: "Building", render: buildingName },
        { key: "sort_order", label: "Order" },
        {
          key: "is_active",
          label: "Status",
          render: (row) =>
            row.is_active ? (
              <Badge tone="success">Active</Badge>
            ) : (
              <Badge tone="neutral">Disabled</Badge>
            ),
        },
      ]}
      renderForm={({ record, onDone, onCancel }) => (
        <FloorForm record={record} onDone={onDone} onCancel={onCancel} />
      )}
    />
  );
}