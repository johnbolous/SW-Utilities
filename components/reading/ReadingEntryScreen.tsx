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
  const [lowerReason, setLowerReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const photoRequired = isPhotoRequiredToday(today);
  const readingDate = todayIso();

  useEffect(() => {
    fetchStructure()
      .then(setStructure)
      .catch((err: any) => setLoadError(err?.message || "Load structure failed"));
  }, []); 

  const isFirst = today.getDate() === 1;

  const visibleMediumMeters = useMemo(
    () => (structure?.meters ?? []).filter((m) => m.category === "MEDIUM" && (m.reading_frequency === "DAILY" || isFirst)),
    [structure, isFirst]
  );
  const visibleWaterMeters = useMemo(
    () => (structure?.waterMeters ?? []).filter((w) => w.reading_frequency === "DAILY" || isFirst),
    [structure, isFirst]
  );
  const visibleKiosks = useMemo(() => (isFirst ? structure?.kiosks ?? [] : []), [structure, isFirst]);

  const lowBuildings = useMemo(() => (structure?.buildings ?? []).filter((b) => b.has_meters), [structure]);
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

  const solarBuildingIds = useMemo(
    () => [...new Set((structure?.solarInverters ?? []).map((i) => i.building_id))],
    [structure]
  );
  const invertersForBuilding = useMemo(
    () => (structure?.solarInverters ?? []).filter((i) => i.building_id === solarBuildingId).sort((a, b) => a.inverter_no - b.inverter_no),
    [structure, solarBuildingId]
  );

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
      setPendingPrevValue(result.previousValue);
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
        )}

        {category === "WATER" && (
          <>
            <FieldLabel>{t("meter")}</FieldLabel>
            <Select value={waterMeterId} onChange={(e) => setWaterMeterId(e.target.value)} className="mb-3">
              <option value="">{t("selectValue")}</option>
              {visibleWaterMeters.map((w) => (
                <option key={w.id} value={w.id}>{w.label_en}</option>
              ))}
            </Select>
          </>
        )}

        {category === "KIOSK" && (
          <>
            <FieldLabel>{t("kiosk")}</FieldLabel>
            {visibleKiosks.length === 0 ? (
              <div className="text-sm text-brand-gray mb-3">{t("todayIsFirst")}</div>
            ) : (
              <Select value={kioskId} onChange={(e) => setKioskId(e.target.value)} className="mb-3">
                <option value="">{t("selectValue")}</option>
                {visibleKiosks!.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </Select>
            )}
          </>
        )}

        {/* واجهة إدخال قراءات Main SG مع محاذاة يمين كاملة */}
        {category === "DISTRIBUTOR" && (
          <div className="space-y-3 mb-4">
            <FieldLabel>اختر المنطقة (Technology Park):</FieldLabel>
            <Select value={distributorParkId} onChange={(e) => setDistributorParkId(e.target.value)} className="mb-3">
              <option value="">{t("selectValue")}</option>
              {(structure?.parks ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <FieldLabel className="text-right block text-xs mb-1">Phase A (Amp)</FieldLabel>
                <Input 
                  type="number" inputMode="decimal" value={phaseA}
                  onChange={(e) => setPhaseA(e.target.value)}
                  placeholder="0.0"
                  className="font-mono text-sm text-right"
                />
              </div>
              <div>
                <FieldLabel className="text-right block text-xs mb-1">Phase B (Amp)</FieldLabel>
                <Input 
                  type="number" inputMode="decimal" value={phaseB}
                  onChange={(e) => setPhaseB(e.target.value)}
                  placeholder="0.0"
                  className="font-mono text-sm text-right"
                />
              </div>
              <div>
                <FieldLabel className="text-right block text-xs mb-1">Phase C (Amp)</FieldLabel>
                <Input 
                  type="number" inputMode="decimal" value={phaseC}
                  onChange={(e) => setPhaseC(e.target.value)}
                  placeholder="0.0"
                  className="font-mono text-sm text-right"
                />
              </div>
            </div>
          </div>
        )}

        {(category === "MEDIUM" || category === "WATER" || category === "KIOSK") &&
          entityId &&
          [...(structure.meters ?? []), ...(structure.waterMeters ?? [])].find(
            (m: any) => m.id === entityId && m.reading_frequency === "MONTHLY"
          ) && <div className="mb-3"><Badge>{t("monthlyBadge")}</Badge></div>}

        {alreadyRead && category !== "DISTRIBUTOR" && (
          <div className="mb-3"><Badge tone="success">{t("alreadyReadThisPeriod")}</Badge></div>
        )}

        {category !== "SOLAR" && category !== "DISTRIBUTOR" && entityId && (
          <div className="mb-3 px-3 py-2.5 rounded-lg bg-surface-soft text-sm flex justify-between items-center">
            <span>{t("previousReading")}:</span>
            <span className="font-mono font-semibold">{previousValue.toLocaleString()}</span>
          </div>
        )}

        {category !== "DISTRIBUTOR" && canEnterValue && (
          <>
            <FieldLabel>{category === "SOLAR" ? t("dailyProduction") : t("currentReading")}</FieldLabel>
            <Input
              type="number" inputMode="decimal" value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              className="mb-2 font-mono text-lg text-right"
            />
            {category !== "SOLAR" && !isNaN(numericCurrent) && currentValue !== "" && (
              <div className={`mb-3 text-sm flex justify-between items-center ${isLower ? "text-danger" : "text-brand-gray"}`}>
                <span>{isLower ? t("lowerWarningTitle") : `${t("consumption")}:`}</span>
                {!isLower && <span className="font-mono font-semibold">{(numericCurrent - previousValue).toFixed(2)}</span>}
              </div>
            )}

            <FieldLabel>{t("notes")}</FieldLabel>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm mb-4 resize-y"
            />

            {photoRequired && (
              <div className="mb-4">
                <FieldLabel>{t("photoRequiredTitle")}</FieldLabel>
                <div className="text-xs text-brand-gray mb-2">{t("photoRequiredBody")}</div>
                <PhotoCapture entityType={category} entityId={entityId} readingDate={readingDate} onAccepted={setPhotoId} />
              </div>
            )}

            {error && <div className="mb-3 text-sm text-danger">{error}</div>}
            {photoRequired && !photoId && (
              <div className="mb-3 text-xs text-brand-gray">{t("submitDisabledNoPhoto")}</div>
            )}

            <Button onClick={handleSave} disabled={!canSave || submitting} className="w-full">
              {submitting ? "…" : t("save")}
            </Button>

            {justSaved && <div className="mt-3 text-sm text-success">{t("saved")}</div>}
          </>
        )}

        {category === "DISTRIBUTOR" && (
          <>
            {error && <div className="mb-3 text-sm text-danger">{error}</div>}
            <Button onClick={handleSave} disabled={!canSave || submitting} className="w-full">
              {submitting ? "جاري الحفظ..." : "حفظ قراءات Main SG"}
            </Button>
            {justSaved && <div className="mt-3 text-sm text-success">تم حفظ قراءات Main SG بنجاح!</div>}
          </>
        )}
      </Card>
    </div>
  );
}