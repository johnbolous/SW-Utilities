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
        {
          key: "actions_delete",
          label: "Delete",
          render: (r) => (
            <button
              onClick={async () => {
                if (window.confirm(`هل أنت متأكد من حذف الكشك "${r.name}"؟`)) {
                  try {
                    const res = await fetch(`/api/admin/kiosks/${r.id}`, { method: "DELETE" });
                    if (res.ok) {
                      window.location.reload();
                    } else {
                      alert("فشل مسح الكشك.");
                    }
                  } catch (err) {
                    alert("حدث خطأ أثناء الاتصال.");
                  }
                }
              }}
              className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-all"
            >
              🗑️ حذف
            </button>
          ),
        },
      ]}
      renderForm={({ record, onDone, onCancel }) => <KioskForm record={record} onDone={onDone} onCancel={onCancel} />}
    />
  );
}
