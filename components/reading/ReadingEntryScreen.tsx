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

  // إضافة حالة المنطقة المحددة للفلترة العامة
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
  const [currentValue, setCurrentValue] = useState("");
  const [notes, setNotes] = useState("");
  const [photoId, setPhotoId] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const photoRequired = isPhotoRequiredToday(today);
  const readingDate = todayIso();

  useEffect(() => {
    fetchStructure()
      .then((data) => {
        setStructure(data);
        // إذا كانت هناك منطقة واحدة فقط متاحة، قم بتحديدها تلقائياً
        const parksList = data?.parks ?? [];
        if (parksList.length === 1) {
          setSelectedParkId(parksList[0].id);
        }
      })
      .catch((err: any) => setLoadError(err?.message || "Load structure failed"));
  }, []); 

  const isFirst = today.getDate() === 1;
  const parksList = structure?.parks ?? [];

  // فلترة العناصر بناءً على المنطقة المحددة (selectedParkId)
  const lowBuildings = useMemo(() => {
    let list = (structure?.buildings ?? []).filter((b) => b.has_meters);
    if (selectedParkId) {
      list = list.filter((b: any) => b.park_id === selectedParkId);
    }
    return list;
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
      list = list.filter((m: any) => m.park_id === selectedParkId || (m.building_id && lowBuildings.some(b => b.id === m.building_id)));
    }
    return list;
  }, [structure, isFirst, selectedParkId, lowBuildings]);

  const visibleWaterMeters = useMemo(() => {
    let list = (structure?.waterMeters ?? []).filter((w) => w.reading_frequency === "DAILY" || isFirst);
    if (selectedParkId) {
      list = list.filter((w: any) => w.park_id === selectedParkId);
    }
    return list;
  }, [structure, isFirst, selectedParkId]);

  const visibleKiosks = useMemo(() => {
    let list = isFirst ? structure?.kiosks ?? [] : [];
    if (selectedParkId) {
      list = list.filter((k: any) => k.park_id === selectedParkId);
    }
    return list;
  }, [structure, isFirst, selectedParkId]);

  const solarBuildingIds = useMemo(() => {
    let inverters = structure?.solarInverters ?? [];
    if (selectedParkId) {
      const validBuildingIds = new Set(lowBuildings.map(b => b.id));
      inverters = inverters.filter(i => validBuildingIds.has(i.building_id));
    }
    return [...new Set(inverters.map((i) => i.building_id))];
  }, [structure, selectedParkId, lowBuildings]);

  const invertersForBuilding = useMemo(
    () => (structure?.solarInverters ?? []).filter((i) => i.building_id === solarBuildingId).sort((a, b) => a.inverter_no - b.inverter_no),
    [structure, solarBuildingId]
  );

  // إعادة ضبط الحقول عند تغيير المنطقة المحددة
  useEffect(() => {
    setBuildingId(""); setFloorId(""); setLowMeterId(""); setMediumMeterId("");
    setSolarBuildingId(""); setInverterId(""); setWaterMeterId(""); setKioskId("");
    setError(null);
  }, [selectedParkId]);

  useEffect(() => {
    setBuildingId(""); setFloorId(""); setLowMeterId(""); setMediumMeterId("");
    setSolarBuildingId(""); setInverterId(""); setWaterMeterId(""); setKioskId("");
    setDistributorParkId(""); setPhaseA(""); setPhaseB(""); setPhaseC("");
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
    if (!entityId || category === "SOLAR" || category === "DISTRIBUTOR") return;
    fetchLatestReading(category as ReadingEntityType, entityId)
      .then((info) => {
        setPreviousValue(info.previousValue);
        setAlreadyRead(info.alreadyReadThisPeriod);
        setMeterCode(info.meterCode);
      })
      .catch((err: any) => setError(err?.message || "Fetch latest reading failed"));
  }, [entityId, category]);

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
      setDistributorParkId("");
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
      readingDate,
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
        {/* خانة فلترة المنطقة (تظهر تلقائياً إذا كانت هناك أكثر من منطقة متاحة للمستخدم، كحساب المهندس مثلاً) */}
        {parksList.length > 1 && (
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

        {category === "LOW" && (
          <>
            <FieldLabel>{t("building")}</FieldLabel>
            <Select value={buildingId} onChange={(e) => setBuildingId(e.target.value)} className="mb-3">
              <option value="">{t("selectValue")}</option>
              {lowBuildings.map((b: Building) => (
                <option key={b.id} value={b.id}>{b.name_en}</option>
              ))}
            </Select>
            {floorsForBuilding.length > 0 && (
              <>
                <FieldLabel>{t("floor")}</FieldLabel>
                <Select value={floorId} onChange={(e) => setFloorId(e.target.value)} className="mb-3">
                  <option value="">{t("selectValue")}</option>
                  {floorsForBuilding.map((f: Floor) => (
                    <option key={f.id} value={f.id}>{f.name_en}</option>
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
                <option key={m.id} value={m.id}>{m.label_en}</option>
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
                return <option key={bid} value={bid}>{b?.name_en ?? bid}</option>;
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
