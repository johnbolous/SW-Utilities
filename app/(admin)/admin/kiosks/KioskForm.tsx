"use client";

import { useState, useEffect } from "react";
import { FieldLabel, Input, Button } from "@/components/ui/primitives";

interface KioskRecord {
  id: string;
  name: string;
  meter_code: string;
  sort_order: number;
  park_id?: string;
}

interface Park {
  id: string;
  name: string;
}

export function KioskForm({
  record,
  onDone,
  onCancel,
}: {
  record: KioskRecord | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const isEdit = !!record;
  const [name, setName] = useState(record?.name ?? "");
  const [meterCode, setMeterCode] = useState(record?.meter_code ?? "");
  const [sortOrder, setSortOrder] = useState(String(record?.sort_order ?? 0));
  const [parkId, setParkId] = useState(record?.park_id ?? "");
  
  const [parks, setParks] = useState<Park[]>([]);
  const [loadingParks, setLoadingParks] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // جلب قائمة المناطق (Parks) عند فتح الفورم
  useEffect(() => {
    async function fetchParks() {
      try {
        const res = await fetch("/api/admin/parks"); // تأكد من مسار الـ API الخاص بالمناطق لديك
        if (res.ok) {
          const data = await res.json();
          setParks(data.parks || data || []);
          // إذا لم يكن هناك منطقة محددة وكانت القائمة تحتوي على عناصر، حدد أول منطقة افتراضياً عند الإضافة الجديدة
          if (!parkId && (data.parks || data)?.length > 0) {
            setParkId((data.parks || data)[0].id);
          }
        }
      } catch (err) {
        console.error("Error fetching parks:", err);
      } finally {
        setLoadingParks(false);
      }
    }
    fetchParks();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!parkId) {
      setError("يرجى اختيار المنطقة التابع لها الكشك.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = isEdit
        ? await fetch(`/api/admin/kiosks/${record!.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, sortOrder: Number(sortOrder), parkId }),
          })
        : await fetch("/api/admin/kiosks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, meterCode, sortOrder: Number(sortOrder), parkId }),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "FAILED");
      }
      onDone();
    } catch (e: any) {
      setError(e.message === "METER_CODE_TAKEN" ? "كود العداد مستخدم من قبل." : "حدث خطأ ما.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="font-display font-bold text-lg mb-4">{isEdit ? "تعديل الكشك" : "كشك جديد"}</div>

      <FieldLabel>المنطقة (Park)</FieldLabel>
      <select 
        value={parkId} 
        onChange={(e) => setParkId(e.target.value)} 
        className="w-full border p-2 rounded-xl text-xs bg-gray-50 mb-3 outline-none"
        required
        disabled={loadingParks}
      >
        <option value="" disabled>اختر المنطقة...</option>
        {parks.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <FieldLabel>اسم الكشك</FieldLabel>
      <Input value={name} onChange={(e) => setName(e.target.value)} className="mb-3" required />

      {!isEdit && (
        <>
          <FieldLabel>كود العداد (فريد)</FieldLabel>
          <Input value={meterCode} onChange={(e) => setMeterCode(e.target.value)} className="mb-3" required />
        </>
      )}

      <FieldLabel>ترتيب العرض</FieldLabel>
      <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="mb-3" />

      <div className="text-xs text-brand-gray mb-3">قراءات الكشك شهرية دائماً، يتم إدخالها في اليوم الأول — ولا يمكن تغيير ذلك لكل كشك على حدة.</div>

      {error && <div className="text-sm text-danger mb-3">{error}</div>}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={loading}>
          إلغاء
        </Button>
        <Button type="submit" disabled={loading || loadingParks}>
          {loading ? "جاري الحفظ..." : isEdit ? "حفظ التغييرات" : "إضافة الكشك"}
        </Button>
      </div>
    </form>
  );
}
