"use client";

import { AdminListPage } from "@/components/admin/AdminListPage";
import { Badge } from "@/components/ui/primitives";
import { ParkForm } from "./ParkForm";

interface ParkRow {
  id: string;
  code: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export function ParksPageContent() {
  return (
    <AdminListPage<ParkRow>
      title="Technology Parks"
      apiBase="/api/admin/parks"
      listKey="parks"
      getId={(r) => r.id}
      getStatus={(r) => r.is_active}
      statusFieldLabel="park"
      searchPlaceholder="Search by name or code…"
      newLabel="+ New park"
      filters={[{ key: "status", label: "All statuses", options: [{ value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }] }]}
      columns={[
        { key: "name", label: "Name" },
        { key: "code", label: "Code" },
        { key: "sort_order", label: "Order" },
        { key: "is_active", label: "Status", render: (r) => <Badge tone={r.is_active ? "success" : "danger"}>{r.is_active ? "Active" : "Disabled"}</Badge> },
      ]}
      renderForm={({ record, onDone, onCancel }) => <ParkForm record={record} onDone={onDone} onCancel={onCancel} />}
    />
  );
}
