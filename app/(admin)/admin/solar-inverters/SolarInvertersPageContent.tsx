"use client";

import { useEffect, useState } from "react";
import { AdminListPage } from "@/components/admin/AdminListPage";
import { Badge } from "@/components/ui/primitives";
import { SolarInverterForm } from "./SolarInverterForm";

interface SolarInverterRow {
  id: string;
  building_id: string;
  inverter_no: number;
  label_en: string;
  meter_code: string;
  is_active: boolean;
  buildings: { name_en: string } | { name_en: string }[] | null;
}

interface BuildingItem {
  id: string;
  name_en: string;
  technology_park_id: string | null;
}

function buildingName(row: SolarInverterRow): string {
  const b = row.buildings;
  if (!b) return "—";
  return Array.isArray(b) ? b[0]?.name_en ?? "—" : b.name_en;
}

export function SolarInvertersPageContent() {
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

  const handleParkChange = (parkId: string) => {
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
    <AdminListPage<SolarInverterRow>
      title="Solar Inverters"
      apiBase="/api/admin/solar-inverters"
      listKey="solarInverters"
      getId={(r) => r.id}
      getStatus={(r) => r.is_active}
      statusFieldLabel="inverter"
      searchPlaceholder="Search by label or meter code…"
      newLabel="+ New inverter"
      filters={[
        {
          key: "parkId",
          label: "All Parks",
          options: parkOptions,
          value: selectedParkId,
          onChange: handleParkChange,
        },
        {
          key: "buildingId",
          label: "All Buildings",
          options: buildingOptions,
          value: selectedBuildingId,
          onChange: setSelectedBuildingId,
        },
      ]}
      columns={[
        { key: "label_en", label: "Label" },
        { key: "inverter_no", label: "Inverter #" },
        { key: "meter_code", label: "Meter Code" },
        { key: "buildings", label: "Building", render: buildingName },
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
        <SolarInverterForm record={record} onDone={onDone} onCancel={onCancel} />
      )}
    />
  );
}