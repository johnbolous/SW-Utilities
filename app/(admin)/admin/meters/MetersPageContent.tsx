"use client";

import { useEffect, useState } from "react";
import { AdminListPage } from "@/components/admin/AdminListPage";
import { Badge } from "@/components/ui/primitives";
import { MeterForm } from "./MeterForm";

interface MeterRow {
  id: string;
  category: "LOW" | "MEDIUM";
  building_id: string;
  floor_id: string | null;
  room_code: string | null;
  label_en: string;
  meter_code: string;
  reading_frequency: "DAILY" | "MONTHLY";
  monthly_reading_day: number | null;
  sort_order: number;
  is_active: boolean;
  buildings: { name_en: string; technology_park_id: string | null } | { name_en: string; technology_park_id: string | null }[] | null;
}

interface BuildingItem {
  id: string;
  name_en: string;
  technology_park_id: string | null;
}

function buildingName(row: MeterRow): string {
  const b = row.buildings;
  if (!b) return "—";
  return Array.isArray(b) ? b[0]?.name_en ?? "—" : b.name_en;
}

export function MetersPageContent() {
  const [parkOptions, setParkOptions] = useState<{ value: string; label: string }[]>([]);
  const [allBuildings, setAllBuildings] = useState<BuildingItem[]>([]);
  const [selectedParkId, setSelectedParkId] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState("");

  useEffect(() => {
    fetch("/api/admin/parks?pageSize=100")
      .then((res) => res.json())
      .then((body) =>
        setParkOptions((body.parks ?? []).map((p: any) => ({ value: p.id, label: p.name })))
      );

    fetch("/api/admin/buildings?pageSize=100")
      .then((res) => res.json())
      .then((body) => setAllBuildings(body.buildings ?? []));
  }, []);

  const handleParkCardChange = (parkId: string) => {
    setSelectedParkId(parkId);
    if (parkId) {
      const isStillValid = allBuildings.some(
        (b) => b.id === selectedBuildingId && b.technology_park_id === parkId
      );
      if (!isStillValid) {
        setSelectedBuildingId("");
      }
    }
  };

  const filteredBuildings = selectedParkId
    ? allBuildings.filter((b) => b.technology_park_id === selectedParkId)
    : allBuildings;

  const buildingOptions = filteredBuildings.map((b) => ({
    value: b.id,
    label: b.name_en,
  }));

  return (
    <AdminListPage<MeterRow>
      title="Electric Meters"
      apiBase="/api/admin/meters"
      listKey="meters"
      getId={(r) => r.id}
      getStatus={(r) => r.is_active}
      statusFieldLabel="meter"
      searchPlaceholder="Search by label or meter code…"
      newLabel="+ New meter"
      // تفعيل زر وحوار الحذف تلقائياً بجانب الـ Edit والـ Disable
      deleteLabel="meter"
      onDelete={async (row) => {
        try {
          const res = await fetch(`/api/admin/meters/${row.id}`, {
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
          key: "category",
          label: "All categories",
          options: [
            { value: "LOW", label: "Low voltage" },
            { value: "MEDIUM", label: "Medium voltage" },
          ],
        },
        {
          key: "parkId",
          label: "All Parks",
          options: parkOptions,
          value: selectedParkId,
          onChange: handleParkCardChange,
        },
        {
          key: "buildingId",
          label: "All buildings",
          options: buildingOptions,
          value: selectedBuildingId,
          onChange: setSelectedBuildingId,
        },
        {
          key: "status",
          label: "All statuses",
          options: [
            { value: "active", label: "Active" },
            { value: "disabled", label: "Disabled" },
          ],
        },
      ]}
      columns={[
        { key: "label_en", label: "Label" },
        { key: "meter_code", label: "Code" },
        { key: "category", label: "Category" },
        { key: "buildings", label: "Building", render: buildingName },
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
        <MeterForm record={record} onDone={onDone} onCancel={onCancel} />
      )}
    />
  );
}