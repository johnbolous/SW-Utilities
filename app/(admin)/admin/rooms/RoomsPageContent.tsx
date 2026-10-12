"use client";

import { useEffect, useState } from "react";
import { AdminListPage } from "@/components/admin/AdminListPage";
import { RoomsForm } from "./RoomsForm";
import { Badge } from "@/components/ui/primitives";

interface RoomRow {
  id: string;
  building_id: string;
  floor_id: string;
  name_en: string;
  name_ar: string | null;
  sort_order: number;
  is_active: boolean;
  buildings: { name_en: string } | { name_en: string }[] | null;
  floors: { name_en: string } | { name_en: string }[] | null;
}

interface BuildingItem {
  id: string;
  name_en: string;
  technology_park_id: string | null;
}

function buildingName(row: RoomRow): string {
  const b = row.buildings;
  if (!b) return "—";
  return Array.isArray(b) ? b[0]?.name_en ?? "—" : b.name_en;
}

function floorName(row: RoomRow): string {
  const f = row.floors;
  if (!f) return "—";
  return Array.isArray(f) ? f[0]?.name_en ?? "—" : f.name_en;
}

export function RoomsPageContent() {
  const [parkOptions, setParkOptions] = useState<{ value: string; label: string }[]>([]);
  const [buildingOptions, setBuildingOptions] = useState<{ value: string; label: string }[]>([]);
  const [floorOptions, setFloorOptions] = useState<{ value: string; label: string }[]>([]);

  const [selectedParkId, setSelectedParkId] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [selectedFloorId, setSelectedFloorId] = useState("");

  // Load Technology Parks on initial mount
  useEffect(() => {
    fetch("/api/admin/parks?pageSize=100")
      .then((res) => res.json())
      .then((body) =>
        setParkOptions((body.parks ?? []).map((p: any) => ({ value: p.id, label: p.name })))
      );
  }, []);

  // Fetch Buildings when selectedParkId changes
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

  // Fetch Floors from API when selectedBuildingId changes
  useEffect(() => {
    const url = selectedBuildingId
      ? `/api/admin/floors?pageSize=100&buildingId=${encodeURIComponent(selectedBuildingId)}`
      : "/api/admin/floors?pageSize=100";

    fetch(url)
      .then((res) => res.json())
      .then((body) => {
        const floors = body.floors ?? [];
        setFloorOptions(
          floors.map((f: any) => ({
            value: f.id,
            label: f.name_en,
          }))
        );
      });
  }, [selectedBuildingId]);

  const handleParkChange = (parkId: string) => {
    setSelectedParkId(parkId);
    setSelectedBuildingId("");
    setSelectedFloorId("");
  };

  const handleBuildingChange = (buildingId: string) => {
    setSelectedBuildingId(buildingId);
    setSelectedFloorId("");
  };

  return (
    <AdminListPage<RoomRow>
      title="Rooms"
      apiBase="/api/admin/rooms"
      listKey="rooms"
      getId={(r) => r.id}
      onDelete={async (row) => {
        const res = await fetch(`/api/admin/rooms/${row.id}`, { method: "DELETE" });
        if (res.ok) return { ok: true };
        const body = await res.json().catch(() => ({}));
        return { ok: false, error: body.detail ?? "Could not delete this room." };
      }}
      deleteLabel="room"
      searchPlaceholder="Search rooms..."
      newLabel="+ New room"
      filters={[
        {
          key: "parkId",
          label: "All parks",
          options: parkOptions,
          value: selectedParkId,
          onChange: handleParkChange,
        },
        {
          key: "buildingId",
          label: "All buildings",
          options: buildingOptions,
          value: selectedBuildingId,
          onChange: handleBuildingChange,
        },
        {
          key: "floorId",
          label: "All floors",
          options: floorOptions,
          value: selectedFloorId,
          onChange: setSelectedFloorId,
        },
      ]}
      columns={[
        { key: "name_en", label: "Name" },
        { key: "buildings", label: "Building", render: buildingName },
        { key: "floors", label: "Floor", render: floorName },
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
        <RoomsForm record={record} onDone={onDone} onCancel={onCancel} />
      )}
    />
  );
}