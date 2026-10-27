"use client";

import { AdminListPage } from "@/components/admin/AdminListPage";
import { Badge } from "@/components/ui/primitives";
import { KioskForm } from "./KioskForm";

interface KioskRow {
  id: string;
  name: string;
  meter_code: string;
  sort_order: number;
  is_active: boolean;
  parks?: { name: string } | null;
}

export function KiosksPageContent() {
  return (
    <AdminListPage<KioskRow>
      title="Kiosks"
      apiBase="/api/admin/kiosks"
      listKey="kiosks"
      getId={(r) => r.id}
      getStatus={(r) => r.is_active}
      statusFieldLabel="kiosk"
      searchPlaceholder="Search by name or meter code…"
      newLabel="+ New kiosk"
      filters={[{ key: "status", label: "All statuses", options: [{ value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }] }]}
      columns={[
        { key: "name", label: "Name" },
        { key: "meter_code", label: "Code" },
        { key: "parks", label: "Park", render: (r) => r.parks?.name ?? "—" },
        { key: "sort_order", label: "Order" },
        { key: "is_active", label: "Status", render: (r) => <Badge tone={r.is_active ? "success" : "danger"}>{r.is_active ? "Active" : "Disabled"}</Badge> },
      ]}
      // إضافة زر الحذف داخل خيارات أو أطر العمليات إذا كان المكون يدعم تخصيص الـ actions،
      // أو يمكنك إضافته ضمن الـ actions الافتراضية للمكون بالشكل المناسب لتصميمك.
    />
  );
}
