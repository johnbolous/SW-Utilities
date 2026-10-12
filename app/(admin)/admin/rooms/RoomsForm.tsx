"use client";

import { useEffect, useState } from "react";
import { FieldLabel, Input, Select, Button } from "@/components/ui/primitives";

interface RoomRecord {
  id: string;
  building_id: string;
  floor_id: string;
  name_en: string;
  name_ar: string | null;
  sort_order: number;
}

export function RoomsForm({
  record,
  onDone,
  onCancel,
}: {
  record: RoomRecord | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!record;

  const [parks, setParks] = useState<{ id: string; name: string }[]>([]);
  const [buildings, setBuildings] = useState<{ id: string; name_en: string; technology_park_id: string | null }[]>([]);
  const [floors, setFloors] = useState<{ id: string; name_en: string }[]>([]);

  const [parkId, setParkId] = useState("");
  const [buildingId, setBuildingId] = useState(record?.building_id ?? "");
  const [floorId, setFloorId] = useState(record?.floor_id ?? "");

  const [nameEn, setNameEn] = useState(record?.name_en ?? "");
  const [nameAr, setNameAr] = useState(record?.name_ar ?? "");
  const [sortOrder, setSortOrder] = useState(String(record?.sort_order ?? 0));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch Parks and pre-populate Buildings on Mount
  useEffect(() => {
    fetch("/api/admin/parks?pageSize=100")
      .then((res) => res.json())
      .then((body) => {
        const fetchedParks = body.parks ?? [];
        setParks(fetchedParks);

        if (isEdit && record?.building_id) {
          fetch("/api/admin/buildings?pageSize=100")
            .then((r) => r.json())
            .then((bBody) => {
              const allBuildings = bBody.buildings ?? [];
              const currentBuilding = allBuildings.find((b: any) => b.id === record.building_id);
              if (currentBuilding?.technology_park_id) {
                setParkId(currentBuilding.technology_park_id);
              }
            });
        }
      });

    // Also fetch initial list of all buildings so user can select building directly
    fetch("/api/admin/buildings?pageSize=100")
      .then((res) => res.json())
      .then((body) => {
        setBuildings(body.buildings ?? []);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Fetch Buildings when Park ID changes
  useEffect(() => {
    if (!parkId) return;

    fetch(`/api/admin/buildings?pageSize=100&parkId=${encodeURIComponent(parkId)}`)
      .then((res) => res.json())
      .then((body) => {
        const fetchedBuildings = body.buildings ?? [];
        setBuildings(fetchedBuildings);

        // If editing and same park, keep current building, otherwise reset
        if (!isEdit || fetchedBuildings.every((b: any) => b.id !== buildingId)) {
          setBuildingId("");
          setFloors([]);
          setFloorId("");
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parkId]);

  // 3. Fetch Floors when Building ID changes
  useEffect(() => {
    if (!buildingId) {
      setFloors([]);
      setFloorId("");
      return;
    }

    fetch(`/api/admin/floors?pageSize=100&buildingId=${encodeURIComponent(buildingId)}`)
      .then((res) => res.json())
      .then((body) => {
        const fetchedFloors = body.floors ?? [];
        setFloors(fetchedFloors);

        // If editing and same building, keep current floor, otherwise reset
        if (!isEdit || fetchedFloors.every((f: any) => f.id !== floorId)) {
          setFloorId("");
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildingId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = isEdit
        ? await fetch(`/api/admin/rooms/${record!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ buildingId, floorId, nameEn, nameAr, sortOrder: Number(sortOrder) }),
          })
        : await fetch("/api/admin/rooms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ buildingId, floorId, nameEn, nameAr, sortOrder: Number(sortOrder) }),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "FAILED");
      }
      onDone();
    } catch (e: any) {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="font-display font-bold text-lg mb-4">{isEdit ? "Edit room" : "New room"}</div>

      <FieldLabel>Technology Park</FieldLabel>
      <Select value={parkId} onChange={(e) => setParkId(e.target.value)} className="mb-3">
        <option value="">Select Technology Park</option>
        {parks.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>

      <FieldLabel>Building</FieldLabel>
      <Select
        value={buildingId}
        onChange={(e) => setBuildingId(e.target.value)}
        className="mb-3"
        required
      >
        <option value="">Select Building</option>
        {buildings.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name_en}
          </option>
        ))}
      </Select>

      <FieldLabel>Floor</FieldLabel>
      <Select
        value={floorId}
        onChange={(e) => setFloorId(e.target.value)}
        className="mb-3"
        disabled={!buildingId}
        required
      >
        <option value="">Select Floor</option>
        {floors.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name_en}
          </option>
        ))}
      </Select>

      <FieldLabel>Name (English)</FieldLabel>
      <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} className="mb-3" required />

      <FieldLabel>Name (Arabic, optional)</FieldLabel>
      <Input value={nameAr ?? ""} onChange={(e) => setNameAr(e.target.value)} className="mb-3" dir="rtl" />

      <FieldLabel>Sort order</FieldLabel>
      <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="mb-3" />

      {error && <div className="text-sm text-danger mb-3">{error}</div>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "…" : isEdit ? "Save changes" : "Create room"}
        </Button>
      </div>
    </form>
  );
}