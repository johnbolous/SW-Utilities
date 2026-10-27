"use client";

import { useEffect, useMemo, useState } from "react";
import { Zap, Gauge, Sun, Droplet, Store, Activity } from "lucide-react";
import { useThemeLang } from "@/components/layout/ThemeLangProvider";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Card, FieldLabel, Select, Input, Button, Badge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { PhotoCapture } from "@/components/photo/PhotoCapture";
import { fetchStructure, fetchLatestReading, submitReading, type StructureBundle } from "@/lib/client/api";
import { isPhotoRequiredToday, todayIso } from "@/lib/utils/date";
import type { Building, Floor, ReadingEntityType } from "@/types/database";
import { createClient } from "@supabase/supabase-js";

const CATEGORY_ICON: Record<ReadingEntityType | "DISTRIBUTOR", any> = { 
  LOW: Zap, 
  MEDIUM: Gauge, 
  SOLAR: Sun, 
  WATER: Droplet, 
  KIOSK: Store,
  DISTRIBUTOR: Activity 
};

export function ReadingEntryScreen({ userId }: { userId: string }) {
  const { lang } = useThemeLang();
  const { t } = useTranslation(lang);

  const [structure, setStructure] = useState<StructureBundle | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [category, setCategory] = useState<ReadingEntityType | "DISTRIBUTOR">("LOW");

  const [selectedParkId, setSelectedParkId] = useState("");

  const [buildingId, setBuildingId] = useState("");
  const [floorId, setFloorId] = useState("");
  const [lowMeterId, setLowMeterId] = useState("");
  const [mediumMeterId, setMediumMeterId] = useState("");
  const [solarBuildingId, setSolarBuildingId] = useState("");
  const [inverterId, setInverterId] = useState("");
  const [waterMeterId, setWaterMeterId] = useState("");
  const [kioskId, setKioskId] = useState("");

  // حقول قراءات Main SG
  const [distributorParkId, setDistributorParkId] = useState("");
  const [phaseA, setPhaseA] = useState("");
  const [phaseB, setPhaseB] = useState("");
  const [phaseC, setPhaseC] = useState("");

  const [previousValue, setPreviousValue] = useState(0);
  const [alreadyRead, setAlreadyRead] = useState(false);
  const [meterCode, setMeterCode] = useState("");
  const [displayReadingDate, setDisplayReadingDate] = useState(todayIso()); // تاريخ القراءة المعروض
  const [currentValue, setCurrentValue] = useState("");
  const [notes, setNotes] = useState("");
  const [photoId, setPhotoId] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const isFirst = today.getDate() === 1;
  const photoRequired = isFirst && isPhotoRequiredToday(today);
  const systemTodayIso = todayIso();

  useEffect(() => {
    fetchStructure()
      .then((data) => {
        setStructure(data);
        const parksList = data?.parks ?? [];
        if (parksList.length === 1) {
          setSelectedParkId(parksList[0].id);
          setDistributorParkId(parksList[0].id);
        }
      })
      .catch((err: any) => setLoadError(err?.message || "Load structure failed"));
  }, []); 

  const parksList = structure?.parks ?? [];

  const matchesPark = (item: any, parkId: string) => {
    if (!parkId) return true;
    const itemParkId = String(item.park_id || item.parkId || item.technology_park_id || "");
    if (!itemParkId) return true;
    return itemParkId === String(parkId);
  };

  const lowBuildings = useMemo(() => {
    const list = structure?.buildings ?? [];
    if (!selectedParkId) return list;
    const filtered = list.filter((b: any) => matchesPark(b, selectedParkId));
    return filtered.length > 0 ? filtered : list;
  }, [structure, selectedParkId]);

  const floorsForBuilding = useMemo(
    () => (structure?.floors ?? []).filter((f) => f.building_id === buildingId).sort((a, b) => a.sort_order - b.sort_order),
    [structure, buildingId]
  );

  const metersForFloor = useMemo(
    () =>
      (structure?.meters ?? []).filter(
        (m) => m.category === "LOW" && m.building_id === buildingId && m.floor_id === floorId
      ),
    [structure, buildingId, floorId]
  );

  const visibleMediumMeters = useMemo(() => {
    let list = (structure?.meters ?? []).filter((m) => m.category === "MEDIUM" && (m.reading_frequency === "DAILY" || isFirst));
    if (selectedParkId) {
      const filtered = list.filter((m: any) => matchesPark(m, selectedParkId));
      return filtered.length > 0 ? filtered : list;
    }
    return list;
  }, [structure, isFirst, selectedParkId]);

  const visibleWaterMeters = useMemo(() => {
    let list = (structure?.waterMeters ?? []).filter((w) => w.reading_frequency === "DAILY" || isFirst);
    if (selectedParkId) {
      const filtered = list.filter((w: any) => matchesPark(w, selectedParkId));
      return filtered.length > 0 ? filtered : list;
    }
    return list;
  }, [structure, isFirst, selectedParkId]);

  const visibleKiosks = useMemo(() => {
    let list = isFirst ? structure?.kiosks ?? [] : [];
    if (selectedParkId) {
      const filtered = list.filter((k: any) => matchesPark(k, selectedParkId));
      return filtered.length > 0 ? filtered : list;
    }
    return list;
  }, [structure, isFirst, selectedParkId]);

  const solarBuildingIds = useMemo(() => {
    let inverters = structure?.solarInverters ?? [];
    if (selectedParkId) {
      inverters = inverters.filter((i: any) => matchesPark(i, selectedParkId));
    }
    return [...new Set(inverters.map((i) => i.building_id))];
  }, [structure, selectedParkId]);

  const invertersForBuilding = useMemo(
    () => (structure?.solarInverters ?? []).filter((i) => i.building_id === solarBuildingId).sort((a, b) => a.inverter_no - b.inverter_no),
    [structure, solarBuildingId]
  );

  useEffect(() => {
    setBuildingId(""); setFloorId(""); setLowMeterId(""); setMediumMeterId("");
    setSolarBuildingId(""); setInverterId(""); setWaterMeterId(""); setKioskId("");
    setError(null);
  }, [selectedParkId]);

  useEffect(() => {
    setBuildingId(""); setFloorId(""); setLowMeterId(""); setMediumMeterId("");
    setSolarBuildingId(""); setInverterId(""); setWaterMeterId(""); setKioskId("");
    setPhaseA(""); setPhaseB(""); setPhaseC("");
    setCurrentValue(""); setNotes(""); setPhotoId(null); setError(null);
  }, [category]);

  useEffect(() => { setFloorId(""); setLowMeterId(""); }, [buildingId]);
  useEffect(() => { setLowMeterId(""); }, [floorId]);
  useEffect(() => { setInverterId(""); }, [solarBuildingId]);

  const entityId =
    category === "LOW" ? lowMeterId :
    category === "MEDIUM" ? mediumMeterId :
    category === "SOLAR" ? inverterId :
    category === "WATER" ? waterMeterId :
    category === "KIOSK" ? kioskId :
    distributorParkId;

  useEffect(() => {
    setPreviousValue(0); setAlreadyRead(false); setMeterCode(""); setCurrentValue(""); setPhotoId(null);
    setDisplayReadingDate(systemTodayIso);

    if (!entityId || category === "SOLAR" || category === "DISTRIBUTOR") return;
    fetchLatestReading(category as ReadingEntityType, entityId)
      .then((info: any) => {
        setPreviousValue(info.previousValue);
        setAlreadyRead(info.alreadyReadThisPeriod);
        setMeterCode(info.meterCode);
        // تحديث التاريخ ليطابق تاريخ آخر قراءة مسجلة إن وجد في الاستجابة، وإلا يتم استخدام تاريخ اليوم
        if (info.readingDate || info.lastReadingDate || info.date) {
          setDisplayReadingDate(info.readingDate || info.lastReadingDate || info.date);
        }
      })
      .catch((err: any) => setError(err?.message || "Fetch latest reading failed"));
  }, [entityId, category, systemTodayIso]);

  useEffect(() => {
    if (category === "SOLAR" && inverterId) {
      const inv = (structure?.solarInverters ?? []).find((i) => i.id === inverterId);
      setMeterCode(inv?.meter_code ?? "");
    }
  }, [category, inverterId, structure]);

  const numericCurrent = parseFloat(currentValue);
  const isLower = category !== "SOLAR" && category !== "DISTRIBUTOR" && !isNaN(numericCurrent) && numericCurrent < previousValue;
  
  const canEnterValue = 
    category === "SOLAR" ? !!inverterId : 
    category === "DISTRIBUTOR" ? (!!distributorParkId && phaseA !== "" && phaseB !== "" && phaseC !== "") : 
    !!entityId && !alreadyRead;

  const canSave = category === "DISTRIBUTOR" 
    ? (!!distributorParkId && phaseA !== "" && phaseB !== "" && phaseC !== "") 
    : (canEnterValue && !isNaN(numericCurrent) && numericCurrent >= 0 && (!photoRequired || !!photoId));

  async function handleSaveDistributor() {
    if (!distributorParkId || phaseA === "" || phaseB === "" || phaseC === "") return;
    setSubmitting(true);
    setError(null);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseKey = 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error: insertError } = await supabase
        .from("main_distributor_readings")
        .insert({
          park_id: distributorParkId,
          phase_a: parseFloat(phaseA),
          phase_b: parseFloat(phaseB),
          phase_c: parseFloat(phaseC),
          reading_timestamp: new Date().toISOString()
        });

      if (insertError) {
        setError(`خطأ أثناء الحفظ: ${insertError.message}`);
        setSubmitting(false);
        return;
      }

      setPhaseA("");
      setPhaseB("");
      setPhaseC("");
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
    } catch (err: any) {
      setError(`خطأ غير متوقع: ${err?.message || err}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function doSubmit(isLowerConfirmed: boolean, reason: string) {
    if (category === "DISTRIBUTOR") {
      await handleSaveDistributor();
      return;
    }

    setSubmitting(true);
    setError(null);
    const result = await submitReading({
      entityType: category as ReadingEntityType,
      entityId,
      readingDate: displayReadingDate,
      currentValue: numericCurrent,
      notes,
      isLowerConfirmed,
      lowerReason: reason,
      photoId,
    });
    setSubmitting(false);

    if (result.ok) {
      setCurrentValue(""); setNotes(""); setPhotoId(null); setAlreadyRead(true);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
      return;
    }
    if (result.error === "LOWER_THAN_PREVIOUS") {
      setConfirmOpen(true);
      return;
    }
    if (result.error === "DUPLICATE_READING") { setError(t("alreadyReadThisPeriod")); setAlreadyRead(true); return; }
    if (result.error === "PHOTO_REQUIRED") { setError(t("photoRequiredBody")); return; }
    
    setError(`Server Error: ${result.error} ${(result as any).detail || ""}`);
  }

  function handleSave() {
    if (!canSave) return;
    doSubmit(false, "");
  }

  if (loadError) return <div className="max-w-xl mx-auto p-4 text-danger text-sm">{loadError}</div>;
  if (!structure) return <div className="max-w-xl mx-auto p-8 text-center text-brand-gray text-sm">{t("loadingOptions")}</div>;

  const categories: { key: ReadingEntityType | "DISTRIBUTOR"; labelKey: any; labelCustom?: string }[] = [
    { key: "LOW", labelKey: "low" },
    { key: "MEDIUM", labelKey: "medium" },
    { key: "SOLAR", labelKey: "solar" },
    { key: "WATER", labelKey: "water" },
    { key: "KIOSK", labelKey: "kiosks" },
    { key: "DISTRIBUTOR", labelKey: "distributor" as any, labelCustom: "⚡ Main SG" },
  ];

  return (
    <div className="max-w-xl mx-auto px-4 py-6" dir="rtl">
      {isFirst && (
        <div className="mb-4 text-xs text-brand-gray bg-surface-soft rounded-lg px-3 py-2">{t("todayIsFirst")}</div>
      )}

      <Card>
        <FieldLabel>{t("readingType")}</FieldLabel>
        <div className="flex gap-2 flex-wrap mb-4">
          {categories.map((c) => {
            const Icon = CATEGORY_ICON[c.key];
            return (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`px-3.5 py-2 rounded-lg text-sm font-display font-semibold border flex items-center gap-1.5 ${
                  category === c.key ? "bg-brand-navy text-white border-brand-navy" : "bg-surface-soft text-brand-gray border-border"
                }`}
              >
                <Icon size={15} /> {c.labelCustom || t(c.labelKey)}
              </button>
            );
          })}
        </div>

        {category !== "DISTRIBUTOR" && parksList.length > 1 && (
          <div className="mb-4 pb-3 border-b border-border">
            <FieldLabel>فلترة حسب المنطقة (Technology Park)</FieldLabel>
            <Select value={selectedParkId} onChange={(e) => setSelectedParkId(e.target.value)}>
              <option value="">جميع المناطق المتاحة</option>
              {parksList.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
        )}

        {category === "LOW" && (
          <>
            <FieldLabel>{t("building")}</FieldLabel>
            <Select value={buildingId} onChange={(e) => setBuildingId(e.target.value)} className="mb-3">
              <option value="">{t("selectValue")}</option>
              {lowBuildings.map((b: Building) => (
                <option key={b.id} value={b.id}>{b.name_en || (b as any).name}</option>
              ))}
            </Select>
            {floorsForBuilding.length > 0 && (
              <>
                <FieldLabel>{t("floor")}</FieldLabel>
                <Select value={floorId} onChange={(e) => setFloorId(e.target.value)} className="mb-3">
                  <option value="">{t("selectValue")}</option>
                  {floorsForBuilding.map((f: Floor) => (
                    <option key={f.id} value={f.id}>{f.name_en || (f as any).name}</option>
                  ))}
                </Select>
              </>
            )}
            {floorId && (
              <>
                <FieldLabel>{t("meter")}</FieldLabel>
                <Select value={lowMeterId} onChange={(e) => setLowMeterId(e.target.value)} className="mb-3">
                  <option value="">{t("selectValue")}</option>
                  {metersForFloor.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.room_code ? `${m.room_code} - ${m.label_en}` : m.label_en}
                    </option>
                  ))}
                </Select>
              </>
            )}
          </>
        )}

        {category === "MEDIUM" && (
          <>
            <FieldLabel>{t("meter")}</FieldLabel>
            <Select value={mediumMeterId} onChange={(e) => setMediumMeterId(e.target.value)} className="mb-3">
              <option value="">{t("selectValue")}</option>
              {visibleMediumMeters.map((m) => (
                <option key={m.id} value={m.id}>{m.label_en || (m as any).name}</option>
              ))}
            </Select>
          </>
        )}

        {category === "SOLAR" && (
          <>
            <FieldLabel>{t("building")}</FieldLabel>
            <Select value={solarBuildingId} onChange={(e) => setSolarBuildingId(e.target.value)} className="mb-3">
              <option value="">{t("selectValue")}</option>
              {solarBuildingIds.map((bid) => {
                const b = (structure!.buildings ?? []).find((x) => x.id === bid);
                return <option key={bid} value={bid}>{b?.name_en ?? (b as any)?.name ?? bid}</option>;
              })}
            </Select>
            {solarBuildingId && (
              <>
                <FieldLabel>{t("inverter")}</FieldLabel>
                <Select value={inverterId} onChange={(e) => setInverterId(e.target.value)} className="mb-3">
                  <option value="">{t("selectValue")}</option>
                  {invertersForBuilding.map((i) => (
                    <option key={i.id} value={i.id}>{t("inverter")} {i.inverter_no}</option>
                  ))}
                </Select>
              </>
            )}
          </>
        )}

        {category === "WATER" && (
          <>
            <FieldLabel>{t("meter")}</FieldLabel>
            <Select value={waterMeterId} onChange={(e) => setWaterMeterId(e.target.value)} className="mb-3">
              <option value="">{t("selectValue")}</option>
              {visibleWaterMeters.map((w) => (
                <option key={w.id} value={w.id}>{w.label_en || (w as any).name}</option>
              ))}
            </Select>
          </>
        )}

        {category === "KIOSK" && (
          <>
            <FieldLabel>{t("kiosks")}</FieldLabel>
            <Select value={kioskId} onChange={(e) => setKioskId(e.target.value)} className="mb-3">
              <option value="">{t("selectValue")}</option>
              {visibleKiosks.map((k) => (
                <option key={k.id} value={k.id}>{k.label_en || (k as any).name}</option>
              ))}
            </Select>
          </>
        )}

        {category === "DISTRIBUTOR" && (
          <>
            <FieldLabel>المنطقة (Park)</FieldLabel>
            <Select value={distributorParkId} onChange={(e) => setDistributorParkId(e.target.value)} className="mb-3">
              <option value="">{t("selectValue")}</option>
              {parksList.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div>
                <FieldLabel>Phase A (MVA)</FieldLabel>
                <Input type="number" step="0.001" value={phaseA} onChange={(e) => setPhaseA(e.target.value)} placeholder="0.000" />
              </div>
              <div>
                <FieldLabel>Phase B (MVA)</FieldLabel>
                <Input type="number" step="0.001" value={phaseB} onChange={(e) => setPhaseB(e.target.value)} placeholder="0.000" />
              </div>
              <div>
                <FieldLabel>Phase C (MVA)</FieldLabel>
                <Input type="number" step="0.001" value={phaseC} onChange={(e) => setPhaseC(e.target.value)} placeholder="0.000" />
              </div>
            </div>
          </>
        )}

        {meterCode && (
          <div className="mb-3 text-xs text-brand-gray">
            {t("meterCode")}: <span className="font-mono font-semibold text-brand-navy">{meterCode}</span>
          </div>
        )}

        {alreadyRead && category !== "DISTRIBUTOR" && (
          <div className="mb-3 p-3 bg-warning/10 text-warning text-xs rounded-lg font-semibold">
            {t("alreadyReadThisPeriod")}
          </div>
        )}

        {category !== "DISTRIBUTOR" && (
          <>
            <div className="mb-3 flex justify-between items-center text-xs text-brand-gray">
              <span>{t("previousValue")}: <strong className="font-mono text-brand-navy">{previousValue}</strong></span>
              <span>{t("readingDate")}: <strong className="font-mono text-brand-navy">{displayReadingDate}</strong></span>
            </div>

            <FieldLabel>{t("currentValue")}</FieldLabel>
            <Input
              type="number"
              step="any"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              disabled={!canEnterValue || alreadyRead}
              placeholder="0"
              className="mb-3 font-mono text-lg"
            />

            {isLower && (
              <div className="mb-3 p-3 bg-danger/10 text-danger text-xs rounded-lg">
                ⚠️ القراءة الحالية أقل من القراءة السابقة! سيطلب منك توضيح السبب عند الحفظ.
              </div>
            )}

            <FieldLabel>{t("notes")} ({t("optional")})</FieldLabel>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canEnterValue || alreadyRead}
              placeholder={t("notesPlaceholder")}
              className="mb-4"
            />

            {isFirst && (
              <PhotoCapture
                userId={userId}
                entityType={category as ReadingEntityType}
                entityId={entityId}
                readingDate={displayReadingDate}
                onPhotoUploaded={(id) => setPhotoId(id)}
                required={photoRequired}
              />
            )}
          </>
        )}

        {error && <div className="mt-3 p-3 bg-danger/10 text-danger text-xs rounded-lg">{error}</div>}
        {justSaved && <div className="mt-3 p-3 bg-success/10 text-success text-xs rounded-lg font-semibold">✓ تم الحفظ بنجاح</div>}

        <Button
          onClick={handleSave}
          disabled={!canSave || submitting}
          className="w-full mt-4"
        >
          {submitting ? "جاري الحفظ..." : t("saveReading")}
        </Button>
      </Card>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="p-4 space-y-3" dir="rtl">
          <h3 className="font-display font-bold text-base text-brand-navy">تأكيد القراءة المنخفضة</h3>
          <p className="text-xs text-brand-gray">القراءة الحالية أقل من القراءة السابقة. يرجى إدخال سبب مقنع للمتابعة:</p>
          <Input id="lower-reason-input" placeholder="اكتب السبب هنا..." className="mb-3" />
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>إلغاء</Button>
            <Button onClick={() => {
              const inputEl = document.getElementById("lower-reason-input") as HTMLInputElement;
              const reason = inputEl?.value || "";
              setConfirmOpen(false);
              doSubmit(true, reason);
            }}>تأكيد وحفظ</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
