"use client";

import { useState, useMemo, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

// دالة ذكية لحساب الاستهلاك الشهري للعدادات التراكمية مع حماية تامة
function calculateMonthlyConsumption(readings: any[]) {
  if (!readings || !Array.isArray(readings) || readings.length === 0) return {};

  const sortedReadings = [...readings].sort((a, b) => {
    const dateA = new Date(a?.reading_date || a?.timestamp || a?.created_at || a?.date || 0);
    const dateB = new Date(b?.reading_date || b?.timestamp || b?.created_at || b?.date || 0);
    return dateA.getTime() - dateB.getTime();
  });

  const groupedByMonth: { [key: string]: any[] } = {};
  sortedReadings.forEach(r => {
    const rawDate = r?.reading_date || r?.timestamp || r?.created_at || r?.date;
    if (!rawDate) return;
    const monthKey = String(rawDate).slice(0, 7);
    
    if (!groupedByMonth[monthKey]) {
      groupedByMonth[monthKey] = [];
    }
    groupedByMonth[monthKey].push(r);
  });

  const monthKeys = Object.keys(groupedByMonth).sort();
  const monthlyResults: { [key: string]: number } = {};
  
  const getVal = (item: any) => Number(item?.current_value ?? item?.reading ?? item?.reading_value ?? item?.consumption ?? 0);

  let lastKnownReading: number | null = null;
  let lastReadingDate: Date | null = null;

  monthKeys.forEach((monthKey) => {
    const monthReadings = groupedByMonth[monthKey];
    if (!monthReadings || !Array.isArray(monthReadings) || monthReadings.length === 0) return;

    const firstItem = monthReadings[0];
    const lastItem = monthReadings[monthReadings.length - 1];
    if (!firstItem || !lastItem) return;

    const firstVal = getVal(firstItem);
    const lastVal = getVal(lastItem);
    const firstDate = new Date(firstItem.reading_date || firstItem.timestamp || firstItem.created_at || firstItem.date);

    let monthConsumption = 0;

    if (monthReadings.length > 1) {
      monthConsumption = lastVal - firstVal;
    } else {
      if (lastKnownReading !== null && lastReadingDate !== null) {
        const diffMonths = (firstDate.getFullYear() - lastReadingDate.getFullYear()) * 12 + (firstDate.getMonth() - lastReadingDate.getMonth());
        if (diffMonths <= 1) {
          monthConsumption = lastVal - lastKnownReading;
        } else {
          monthConsumption = 0;
        }
      } else {
        monthConsumption = 0;
      }
    }

    if (monthConsumption < 0) monthConsumption = 0;
    monthlyResults[monthKey] = monthConsumption;

    lastKnownReading = lastVal;
    if (lastItem) {
      lastReadingDate = new Date(lastItem.reading_date || lastItem.timestamp || lastItem.created_at || lastItem.date);
    }
  });

  return monthlyResults;
}

function calculateMonthlyConsumptionsForAllMeters(readings: any[], idField = "meter_id") {
  const meterReadingsMap = new Map<string, any[]>();
  if (!readings || !Array.isArray(readings)) return meterReadingsMap;

  readings.forEach(r => {
    const mId = r?.[idField] || r?.meter_id || r?.water_meter_id || r?.inverter_id || r?.kiosk_id;
    if (!mId) return;
    if (!meterReadingsMap.has(mId)) {
      meterReadingsMap.set(mId, []);
    }
    meterReadingsMap.get(mId)!.push(r);
  });

  const meterMonthlyMap = new Map<string, { [monthKey: string]: number }>();
  meterReadingsMap.forEach((meterReadings, mId) => {
    meterMonthlyMap.set(mId, calculateMonthlyConsumption(meterReadings));
  });

  return meterMonthlyMap;
}

function calculateMonthlySolarSum(readings: any[]) {
  if (!readings || !Array.isArray(readings) || readings.length === 0) return {};
  const monthlyResults: { [key: string]: number } = {};

  readings.forEach(r => {
    const rawDate = r?.reading_date || r?.timestamp || r?.created_at || r?.date;
    if (!rawDate) return;
    const monthKey = String(rawDate).slice(0, 7);
    const val = Number(r?.yield ?? r?.value ?? r?.production ?? 0);

    if (!monthlyResults[monthKey]) {
      monthlyResults[monthKey] = 0;
    }
    monthlyResults[monthKey] += val;
  });

  return monthlyResults;
}

function calculateSolarConsumptionsForAllInverters(readings: any[]) {
  const inverterReadingsMap = new Map<string, any[]>();
  if (!readings || !Array.isArray(readings)) return inverterReadingsMap;

  readings.forEach(r => {
    const invId = r?.inverter_id || r?.meter_id || r?.id;
    if (!invId) return;
    if (!inverterReadingsMap.has(invId)) {
      inverterReadingsMap.set(invId, []);
    }
    inverterReadingsMap.get(invId)!.push(r);
  });

  const inverterMonthlyMap = new Map<string, { [monthKey: string]: number }>();
  inverterReadingsMap.forEach((inverterReadings, invId) => {
    inverterMonthlyMap.set(invId, calculateMonthlySolarSum(inverterReadings));
  });

  return inverterMonthlyMap;
}

export default function DeskDashboardContent({ data }: { data: any }) {
  const [activeTab, setActiveTab] = useState<"electric" | "water" | "solar" | "kiosks">("electric");

  const parkNames = Array.isArray(data?.parkNames) ? data.parkNames : [];
  const summary = data?.summary || {};
  const rawParksElec = Array.isArray(data?.parksDailyElec) ? data.parksDailyElec : [];
  const rawParksWater = Array.isArray(data?.parksWaterData) ? data.parksWaterData : [];
  const rawParksSolar = Array.isArray(data?.parksSolarData) ? data.parksSolarData : [];

  const [kiosksTableData, setKiosksTableData] = useState<any[]>([]);
  const [kioskMonthlyConsumptions, setKioskMonthlyConsumptions] = useState>(new Map());
  const [directKiosksCount, setDirectKiosksCount] = useState<number>(0);

  useEffect(() => {
    const fetchKiosksAndReadings = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseKey = 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

      if (!supabaseUrl || !supabaseKey) return;
      const supabase = createClient(supabaseUrl, supabaseKey);

      try {
        const { count, error: countErr } = await supabase.from("kiosks").select("*", { count: "exact", head: true });
        if (!countErr && count !== null) {
          setDirectKiosksCount(count);
        }

        const { data: kiosksRows, error: kiosksErr } = await supabase.from("kiosks").select("*");
        if (kiosksErr) return;

        if (Array.isArray(kiosksRows) && kiosksRows.length > 0) {
          const kioskIds = kiosksRows.map(k => k.id);
          const { data: kioskReadings } = await supabase
            .from("kiosk_readings")
            .select("*")
            .in("kiosk_id", kioskIds);

          if (Array.isArray(kioskReadings)) {
            const readingsMap = new Map();
            kioskReadings.forEach(r => {
              const kId = r.kiosk_id;
              const consumptionVal = Number(r?.consumption ?? (Number(r?.current_value || 0) - Number(r?.previous_value || 0)) ?? 0);
              if (!readingsMap.has(kId) || new Date(r?.reading_date || 0).getTime() > new Date(readingsMap.get(kId).reading_date || 0).getTime()) {
                readingsMap.set(kId, { consumption: consumptionVal, reading_date: r?.reading_date });
              }
            });

            kiosksRows.forEach(k => {
              const latest = readingsMap.get(k.id);
              k.consumption = latest ? latest.consumption : 0;
            });

            setKioskMonthlyConsumptions(calculateMonthlyConsumptionsForAllMeters(kioskReadings, "kiosk_id"));
          }

          setKiosksTableData(kiosksRows);
        }
      } catch (err) {
        console.error("Error fetching kiosks:", err);
      }
    };

    fetchKiosksAndReadings();
  }, []);

  const rawParksKiosks = useMemo(() => {
    if (!Array.isArray(rawParksElec)) return [];
    return rawParksElec.map((park: any) => {
      const parkId = park?.id;
      const parkKiosks = Array.isArray(kiosksTableData) ? kiosksTableData.filter(k => String(k?.park_id) === String(parkId)) : [];
      return {
        ...park,
        kiosks: parkKiosks
      };
    });
  }, [rawParksElec, kiosksTableData]);

  const currentRawParks = useMemo(() => {
    if (activeTab === "electric") return rawParksElec;
    if (activeTab === "water") return rawParksWater;
    if (activeTab === "solar") return rawParksSolar;
    if (activeTab === "kiosks") return rawParksKiosks;
    return rawParksElec;
  }, [activeTab, rawParksElec, rawParksWater, rawParksSolar, rawParksKiosks]);

  const [selectedCategory, setSelectedCategory] = useState("MEDIUM");
  
  const [selectedParkIds, setSelectedParkIds] = useState<string[]>(() => {
    return Array.isArray(rawParksElec) && rawParksElec.length > 0 ? rawParksElec.map((p: any) => p.id) : [];
  });

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState<"important" | "normal">("important");
  const [hasUnread, setHasUnread] = useState(true);

  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [currentMeterForPhoto, setCurrentMeterForPhoto] = useState<any>(null);
  const [meterPhotosList, setMeterPhotosList] = useState<any[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [selectedPhotoMonth, setSelectedPhotoMonth] = useState<string>("");

  const [meterMonthlyConsumptions, setMeterMonthlyConsumptions] = useState>(new Map());
  const [waterMeterMonthlyConsumptions, setWaterMeterMonthlyConsumptions] = useState>(new Map());
  const [solarMonthlyConsumptions, setSolarMonthlyConsumptions] = useState>(new Map());

  useEffect(() => {
    if (Array.isArray(currentRawParks) && currentRawParks.length > 0) {
      const newIds = currentRawParks.map((p: any) => p?.id).filter(Boolean);
      setSelectedParkIds(newIds);
    }
  }, [activeTab, data]);

  const todayStr = new Date().toISOString().split("T")[0];
  const currentMonthKey = todayStr.slice(0, 7);
  const thirtyDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [demandTimeFrame, setDemandTimeFrame] = useState<"day" | "week" | "month" | "year">("week");
  const [demandStartDate, setDemandStartDate] = useState(thirtyDaysAgoStr);
  const [demandEndDate, setDemandEndDate] = useState(todayStr);

  const [consumptionTimeFrame, setConsumptionTimeFrame] = useState<"day" | "week" | "month" | "year">("week");
  const [consumptionStartDate, setConsumptionStartDate] = useState(thirtyDaysAgoStr);
  const [consumptionEndDate, setConsumptionEndDate] = useState(todayStr);
  
  const [chartData, setChartData] = useState<any[]>([]);
  const [distributorRows, setDistributorRows] = useState<any[]>([]);
  const [isChartLoading, setIsChartLoading] = useState(false);

  const [consumptionChartData, setConsumptionChartData] = useState<any[]>([]);
  const [isConsumptionLoading, setIsConsumptionLoading] = useState(false);

  useEffect(() => {
    const fetchAllReadingsForCalculations = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseKey = 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

      if (!supabaseUrl || !supabaseKey) return;
      const supabase = createClient(supabaseUrl, supabaseKey);

      try {
        const elecMeterIds: string[] = [];
        if (Array.isArray(rawParksElec)) {
          rawParksElec.forEach((park: any) => {
            if (park && Array.isArray(park.meters)) {
              park.meters.forEach((m: any) => { if (m?.id) elecMeterIds.push(m.id); });
            }
          });
        }
        if (elecMeterIds.length > 0) {
          const { data: elecReadings } = await supabase.from("electric_readings").select("*").in("meter_id", elecMeterIds);
          if (Array.isArray(elecReadings)) {
            setMeterMonthlyConsumptions(calculateMonthlyConsumptionsForAllMeters(elecReadings, "meter_id"));
          }
        }

        const waterMeterIds: string[] = [];
        if (Array.isArray(rawParksWater)) {
          rawParksWater.forEach((park: any) => {
            if (park && Array.isArray(park.meters)) {
              park.meters.forEach((m: any) => { if (m?.id) waterMeterIds.push(m.id); });
            }
          });
        }
        if (waterMeterIds.length > 0) {
          const { data: waterReadings } = await supabase.from("water_readings").select("*").in("water_meter_id", waterMeterIds);
          if (Array.isArray(waterReadings)) {
            setWaterMeterMonthlyConsumptions(calculateMonthlyConsumptionsForAllMeters(waterReadings, "water_meter_id"));
          }
        }

        const inverterIds: string[] = [];
        if (Array.isArray(rawParksSolar)) {
          rawParksSolar.forEach((park: any) => {
            if (park && Array.isArray(park.inverters)) {
              park.inverters.forEach((inv: any) => { if (inv?.id) inverterIds.push(inv.id); });
            }
          });
        }
        if (inverterIds.length > 0) {
          const { data: solarReadings } = await supabase.from("solar_production").select("*").in("inverter_id", inverterIds);
          if (Array.isArray(solarReadings)) {
            setSolarMonthlyConsumptions(calculateSolarConsumptionsForAllInverters(solarReadings));
          }
        }
      } catch (err) {
        console.error("Error calculations:", err);
      }
    };

    fetchAllReadingsForCalculations();
  }, [rawParksElec, rawParksWater, rawParksSolar]);

  const handleDemandTimeFrameChange = (frame: "day" | "week" | "month" | "year") => {
    setDemandTimeFrame(frame);
    const now = Date.now();
    const end = new Date(now).toISOString().split("T")[0];
    let start = end;

    if (frame === "day") start = end;
    else if (frame === "week") start = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    else if (frame === "month") start = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    else if (frame === "year") start = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    setDemandStartDate(start);
    setDemandEndDate(end);
  };

  const handleConsumptionTimeFrameChange = (frame: "day" | "week" | "month" | "year") => {
    setConsumptionTimeFrame(frame);
    const now = Date.now();
    const end = new Date(now).toISOString().split("T")[0];
    let start = end;

    if (frame === "day") start = end;
    else if (frame === "week") start = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    else if (frame === "month") start = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    else if (frame === "year") start = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    setConsumptionStartDate(start);
    setConsumptionEndDate(end);
  };

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedMeterIdsForExport, setSelectedMeterIdsForExport] = useState<string[]>([]);
  const [exportStartDate, setExportStartDate] = useState(thirtyDaysAgoStr);
  const [exportEndDate, setExportEndDate] = useState(todayStr);
  const [isExporting, setIsExporting] = useState(false);

  const parkColors = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

  const getLocalDateStr = (timestamp: string) => {
    if (!timestamp) return "";
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDeviceName = (item: any) => {
    return (
      item?.name ||
      item?.label ||
      item?.label_en ||
      item?.label_ar ||
      item?.code ||
      item?.meter_code ||
      `جهاز رقم ${item?.id ? String(item.id).slice(0, 6) : ""}`
    );
  };

  const getDeviceCode = (item: any) => {
    return item?.code || item?.meter_code || item?.id || "";
  };

  const categorizedAlerts = useMemo(() => {
    const important: { id: string; title: string; message: string }[] = [];
    const normal: { id: string; title: string; message: string }[] = [];

    if (Array.isArray(rawParksElec)) {
      rawParksElec.forEach((park: any) => {
        if (park && Array.isArray(park.meters)) {
          park.meters.forEach((m: any) => {
            const consumption = Number(m?.consumption || 0);
            const deviceName = getDeviceName(m);

            if (consumption > 50000) {
              important.push({
                id: `elec-high-${m?.id || Math.random()}`,
                title: "تنبيه: استهلاك فائق",
                message: `العداد (${deviceName}) في ${park?.name || ''} سجل استهلاكاً مرتفعاً قدره ${consumption.toLocaleString()} kWh.`
              });
            } else if (consumption === 0) {
              normal.push({
                id: `elec-zero-${m?.id || Math.random()}`,
                title: "عداد بدون استهلاك",
                message: `العداد (${deviceName}) في ${park?.name || ''} مسجل بقراءة مستقرة دون تغيير.`
              });
            }
          });
        }
      });
    }

    if (Array.isArray(rawParksWater)) {
      rawParksWater.forEach((park: any) => {
        if (park && Array.isArray(park.meters)) {
          park.meters.forEach((m: any) => {
            const consumption = Number(m?.consumption || 0);
            const deviceName = getDeviceName(m);
            if (consumption > 20000) {
              important.push({
                id: `water-high-${m?.id || Math.random()}`,
                title: "استهلاك مياه مرتفع",
                message: `عداد المياه (${deviceName}) في ${park?.name || ''} يسجل استهلاكاً كبيراً قدره ${consumption.toLocaleString()} m³.`
              });
            }
          });
        }
      });
    }

    return { important, normal };
  }, [rawParksElec, rawParksWater]);

  const totalAlertsCount = categorizedAlerts.important.length + categorizedAlerts.normal.length;

  const openPhotoModal = async (meter: any) => {
    setCurrentMeterForPhoto(meter);
    setIsPhotoModalOpen(true);
    setIsLoadingPhotos(true);
    setMeterPhotosList([]);
    setSelectedPhotoMonth("");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

    if (!supabaseUrl || !supabaseKey) {
      setIsLoadingPhotos(false);
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    try {
      const meterCode = getDeviceCode(meter);
      const cat = String(meter?.category || activeTab || "medium").trim().toLowerCase();
      
      let folderCategory = "medium";
      if (activeTab === "water" || cat.includes("water")) folderCategory = "water";
      else if (cat.includes("low") || cat === "low") folderCategory = "low";
      else if (activeTab === "kiosks" || cat.includes("kiosk")) folderCategory = "kiosk";

      const mainBucket = "meter-photos";
      const targetPath = `${folderCategory}/${meterCode}`;
      let fetchedPhotos: any[] = [];

      const { data: storageFiles, error: storageError } = await supabase.storage
        .from(mainBucket)
        .list(targetPath, { limit: 100, sortBy: { column: 'name', order: 'desc' } });

      if (!storageError && Array.isArray(storageFiles)) {
        storageFiles.forEach((file: any) => {
          if (file?.name && file.name !== ".emptyFolderPlaceholder") {
            const filePath = `${targetPath}/${file.name}`;
            const { data: publicUrlData } = supabase.storage.from(mainBucket).getPublicUrl(filePath);

            let dateStr = file?.created_at || file?.updated_at || "";
            const match = file.name.match(/(\d{4}-\d{2}-\d{2})/);
            if (match) dateStr = match[1];

            fetchedPhotos.push({
              id: file?.id || filePath,
              url: publicUrlData?.publicUrl || "",
              created_at: dateStr || todayStr,
              name: file.name
            });
          }
        });
      }

      setMeterPhotosList(fetchedPhotos);
      if (fetchedPhotos.length > 0 && fetchedPhotos[0]?.created_at) {
        setSelectedPhotoMonth(fetchedPhotos[0].created_at.slice(0, 7));
      }
    } catch (err) {
      console.error("Photos error:", err);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  useEffect(() => {
    const fetchDistributorReadings = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseKey = 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

      if (!supabaseUrl || !supabaseKey) return;
      const supabase = createClient(supabaseUrl, supabaseKey);
      setIsChartLoading(true);

      try {
        if (!Array.isArray(selectedParkIds) || selectedParkIds.length === 0) {
          setChartData([]);
          setDistributorRows([]);
          setIsChartLoading(false);
          return;
        }

        const startIso = new Date(`${demandStartDate}T00:00:00`).toISOString();
        const endIso = new Date(`${demandEndDate}T23:59:59`).toISOString();

        const { data: rows, error } = await supabase
          .from("main_distributor_readings")
          .select("reading_timestamp, max_demand_mva, park_id")
          .in("park_id", selectedParkIds)
          .gte("reading_timestamp", startIso)
          .lte("reading_timestamp", endIso)
          .order("reading_timestamp", { ascending: true });

        if (error || !Array.isArray(rows)) {
          setChartData([]);
          setDistributorRows([]);
          setIsChartLoading(false);
          return;
        }

        setDistributorRows(rows);

        const dateMap = new Map();
        rows.forEach((row: any) => {
          const pId = row?.park_id;
          const rawTimestamp = row?.reading_timestamp;
          if (!pId || !rawTimestamp) return;
          
          const d = new Date(rawTimestamp);
          let keyStr = demandTimeFrame === "day" 
            ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` 
            : getLocalDateStr(rawTimestamp);

          const val = Number(row?.max_demand_mva || row?.max_demand || 0);

          if (!dateMap.has(keyStr)) dateMap.set(keyStr, { date: keyStr });
          const entry = dateMap.get(keyStr);
          if (!entry[pId] || val > entry[pId]) {
            entry[pId] = Math.round(val * 1000) / 1000;
          }
        });

        setChartData(Array.from(dateMap.values()).sort((a: any, b: any) => String(a.date).localeCompare(String(b.date))));
      } catch (err) {
        setChartData([]);
        setDistributorRows([]);
      } finally {
        setIsChartLoading(false);
      }
    };

    fetchDistributorReadings();
  }, [demandStartDate, demandEndDate, selectedParkIds, demandTimeFrame]);

  useEffect(() => {
    const fetchConsumptionData = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseKey = 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

      if (!supabaseUrl || !supabaseKey) return;
      const supabase = createClient(supabaseUrl, supabaseKey);
      setIsConsumptionLoading(true);

      try {
        const meterIds: string[] = [];
        const meterToParkMap = new Map<string, string>();

        if (Array.isArray(rawParksElec)) {
          rawParksElec.forEach((park: any) => {
            if (park && Array.isArray(selectedParkIds) && selectedParkIds.includes(park.id) && Array.isArray(park.meters)) {
              park.meters.forEach((m: any) => {
                if (m?.id) {
                  meterIds.push(m.id);
                  meterToParkMap.set(m.id, park.id);
                }
              });
            }
          });
        }

        if (meterIds.length === 0) {
          setConsumptionChartData([]);
          setIsConsumptionLoading(false);
          return;
        }

        const { data: readings } = await supabase.from("electric_readings").select("*").in("meter_id", meterIds);

        if (!Array.isArray(readings) || readings.length === 0) {
          setConsumptionChartData([]);
          setIsConsumptionLoading(false);
          return;
        }

        const dateParkMap = new Map<string, any>();
        readings.forEach((row: any) => {
          const mId = row?.meter_id;
          const pId = meterToParkMap.get(mId);
          const rawDate = row?.reading_date || row?.timestamp || row?.created_at || row?.date;
          if (!pId || !rawDate) return;

          const keyStr = getLocalDateStr(rawDate);
          if (keyStr < consumptionStartDate || keyStr > consumptionEndDate) return;

          const val = Number(row?.consumption ?? row?.current_value ?? row?.reading ?? row?.reading_value ?? 0);

          if (!dateParkMap.has(keyStr)) dateParkMap.set(keyStr, { date: keyStr });
          const entry = dateParkMap.get(keyStr);
          entry[pId] = (entry[pId] || 0) + val;
        });

        setConsumptionChartData(Array.from(dateParkMap.values()).sort((a: any, b: any) => String(a.date).localeCompare(String(b.date))));
      } catch (err) {
        setConsumptionChartData([]);
      } finally {
        setIsConsumptionLoading(false);
      }
    };

    if (activeTab === "electric") fetchConsumptionData();
    else setConsumptionChartData([]);
  }, [consumptionStartDate, consumptionEndDate, selectedParkIds, rawParksElec, activeTab]);

  const parkAveragesMap = useMemo(() => {
    const dailyParkMaxMap = new Map();
    if (Array.isArray(distributorRows)) {
      distributorRows.forEach((row: any) => {
        const pId = row?.park_id;
        const rawTimestamp = row?.reading_timestamp;
        if (!pId || !rawTimestamp) return;
        
        const dStr = getLocalDateStr(rawTimestamp);
        const val = Number(row?.max_demand_mva || row?.max_demand || 0);
        const key = `${pId}_${dStr}`;
        
        if (!dailyParkMaxMap.has(key)) dailyParkMaxMap.set(key, val);
        else dailyParkMaxMap.set(key, Math.max(dailyParkMaxMap.get(key), val));
      });
    }

    const parkStats = new Map();
    dailyParkMaxMap.forEach((maxVal, key) => {
      const [pId] = key.split("_");
      if (!parkStats.has(pId)) parkStats.set(pId, { sum: 0, count: 0 });
      const current = parkStats.get(pId);
      parkStats.set(pId, { sum: current.sum + maxVal, count: current.count + 1 });
    });

    const averages = new Map();
    parkStats.forEach((stats, pId) => {
      averages.set(pId, stats.count > 0 ? stats.sum / stats.count : 0);
    });
    return averages;
  }, [distributorRows]);

  const latestParkReadingsMap = useMemo(() => {
    const map = new Map();
    if (Array.isArray(distributorRows)) {
      distributorRows.forEach((row: any) => {
        const pId = row?.park_id;
        const val = Number(row?.max_demand_mva || row?.max_demand || 0);
        const timestamp = row?.reading_timestamp;
        
        if (pId && timestamp && (!map.has(pId) || new Date(timestamp).getTime() > new Date(map.get(pId).timestamp).getTime())) {
          map.set(pId, { val, timestamp });
        }
      });
    }
    return map;
  }, [distributorRows]);

  const { todayMediumElec, monthMediumElec, mediumMaxDemand } = useMemo(() => {
    let daily = 0;
    let monthly = 0;
    let maxDem = 0;
    
    if (Array.isArray(rawParksElec)) {
      rawParksElec.forEach((park: any) => {
        if (park && Array.isArray(park.meters)) {
          park.meters.forEach((m: any) => {
            const cat = String(m?.category || "").trim().toUpperCase();
            if (cat === "MEDIUM" || cat === "MED" || cat.includes("MEDIUM")) {
              daily += Number(m?.consumption || 0);
              const meterMonthlyMap = meterMonthlyConsumptions.get(m?.id);
              monthly += meterMonthlyMap ? (meterMonthlyMap[currentMonthKey] ?? 0) : Number(m?.totalConsumption || 0);
            }
          });
        }
      });
    }

    if (parkAveragesMap.size > 0) {
      let sum = 0;
      parkAveragesMap.forEach((avg) => { sum += avg; });
      maxDem = sum / parkAveragesMap.size;
    }

    return { todayMediumElec: daily, monthMediumElec: monthly, mediumMaxDemand: maxDem };
  }, [rawParksElec, parkAveragesMap, meterMonthlyConsumptions, currentMonthKey]);

  const summarySolarMonth = useMemo(() => {
    let sumMonth = 0;
    if (Array.isArray(rawParksSolar)) {
      rawParksSolar.forEach((park: any) => {
        if (park && Array.isArray(park.inverters)) {
          park.inverters.forEach((inv: any) => {
            const invMap = solarMonthlyConsumptions.get(inv?.id);
            sumMonth += invMap ? (invMap[currentMonthKey] ?? 0) : Number(inv?.totalYield || 0);
          });
        }
      });
    }
    return sumMonth;
  }, [rawParksSolar, solarMonthlyConsumptions, currentMonthKey]);

  const summaryWaterMonth = useMemo(() => {
    let sumMonth = 0;
    if (Array.isArray(rawParksWater)) {
      rawParksWater.forEach((park: any) => {
        if (park && Array.isArray(park.meters)) {
          park.meters.forEach((m: any) => {
            const waterMap = waterMeterMonthlyConsumptions.get(m?.id);
            sumMonth += waterMap ? (waterMap[currentMonthKey] ?? 0) : Number(m?.totalConsumption || 0);
          });
        }
      });
    }
    return sumMonth;
  }, [rawParksWater, waterMeterMonthlyConsumptions, currentMonthKey]);

  const processedElecData = useMemo(() => {
    if (!Array.isArray(rawParksElec)) return [];
    return rawParksElec
      .filter((park: any) => park && Array.isArray(selectedParkIds) && selectedParkIds.includes(park.id))
      .map((park: any) => {
        const allMeters = Array.isArray(park?.meters) ? park.meters : [];
        const electricMeters = allMeters.filter((m: any) => {
          const cat = String(m?.category || "").trim().toUpperCase();
          if (selectedCategory.toUpperCase() === "MEDIUM") {
            return cat === "MEDIUM" || cat === "MED" || cat.includes("MEDIUM") || !cat;
          }
          return cat === selectedCategory.toUpperCase();
        });
        const elecDaily = electricMeters.reduce((sum: number, m: any) => sum + Number(m?.consumption || 0), 0);
        
        const elecTotalConsumption = electricMeters.reduce((sum: number, m: any) => {
          const meterMonthlyMap = meterMonthlyConsumptions.get(m?.id);
          return sum + (meterMonthlyMap ? (meterMonthlyMap[currentMonthKey] ?? 0) : Number(m?.totalConsumption || 0));
        }, 0);

        return {
          ...park,
          electricMeters,
          elecDaily,
          elecTotalConsumption,
          elecMaxDemand: parkAveragesMap.get(park?.id) || 0,
          elecTotalCount: electricMeters.length,
          elecActiveCount: electricMeters.filter((m: any) => Number(m?.consumption || 0) > 0).length,
        };
      });
  }, [rawParksElec, selectedParkIds, selectedCategory, parkAveragesMap, meterMonthlyConsumptions, currentMonthKey]);

  const processedWaterData = useMemo(() => {
    if (!Array.isArray(rawParksWater)) return [];
    return rawParksWater
      .filter((park: any) => park && Array.isArray(selectedParkIds) && selectedParkIds.includes(park.id))
      .map((park: any) => {
        const meters = Array.isArray(park?.meters) ? park.meters : [];
        const waterDaily = meters.reduce((sum: number, m: any) => sum + Number(m?.consumption || 0), 0);
        const waterTotal = meters.reduce((sum: number, m: any) => {
          const waterMonthlyMap = waterMeterMonthlyConsumptions.get(m?.id);
          return sum + (waterMonthlyMap ? (waterMonthlyMap[currentMonthKey] ?? 0) : Number(m?.totalConsumption || 0));
        }, 0);

        return {
          ...park,
          meters,
          waterDaily,
          waterTotal,
          activeCount: meters.filter((m: any) => Number(m?.consumption || 0) > 0).length,
          totalCount: meters.length,
        };
      });
  }, [rawParksWater, selectedParkIds, waterMeterMonthlyConsumptions, currentMonthKey]);

  const processedSolarData = useMemo(() => {
    if (!Array.isArray(rawParksSolar)) return [];
    return rawParksSolar
      .filter((park: any) => park && Array.isArray(selectedParkIds) && selectedParkIds.includes(park.id))
      .map((park: any) => {
        const inverters = Array.isArray(park?.inverters) ? park.inverters : [];
        const solarDaily = inverters.reduce((sum: number, i: any) => sum + Number(i?.yield || 0), 0);
        const solarTotal = inverters.reduce((sum: number, i: any) => {
          const invMap = solarMonthlyConsumptions.get(i?.id);
          return sum + (invMap ? (invMap[currentMonthKey] ?? 0) : Number(i?.totalYield || 0));
        }, 0);

        return {
          ...park,
          inverters,
          solarDaily,
          solarTotal,
          activeCount: inverters.filter((i: any) => Number(i?.yield || 0) > 0).length,
          totalCount: inverters.length,
        };
      });
  }, [rawParksSolar, selectedParkIds, solarMonthlyConsumptions, currentMonthKey]);

  const processedKiosksData = useMemo(() => {
    if (!Array.isArray(rawParksKiosks)) return [];
    return rawParksKiosks
      .filter((park: any) => park && Array.isArray(selectedParkIds) && selectedParkIds.includes(park.id))
      .map((park: any) => {
        const kiosksList = Array.isArray(park?.kiosks) ? park.kiosks : [];
        const kiosksDaily = kiosksList.reduce((sum: number, k: any) => sum + Number(k?.consumption || 0), 0);
        const kiosksTotal = kiosksList.reduce((sum: number, k: any) => {
          const kioskMap = kioskMonthlyConsumptions.get(k?.id);
          return sum + (kioskMap ? (kioskMap[currentMonthKey] ?? 0) : Number(k?.totalConsumption || 0));
        }, 0);

        return {
          ...park,
          kiosks: kiosksList,
          kiosksDaily,
          kiosksTotal,
          activeCount: kiosksList.filter((k: any) => Number(k?.consumption || 0) > 0).length,
          totalCount: kiosksList.length,
        };
      });
  }, [rawParksKiosks, selectedParkIds, kioskMonthlyConsumptions, currentMonthKey]);

  const currentItemsList = useMemo(() => {
    const list: any[] = [];
    if (activeTab === "electric" && Array.isArray(processedElecData)) {
      processedElecData.forEach((park: any) => {
        if (park && Array.isArray(park.electricMeters)) {
          park.electricMeters.forEach((m: any) => {
            list.push({ id: m?.id, name: `${park?.name || ''} - ${getDeviceName(m)} (${getDeviceCode(m)})` });
          });
        }
      });
    } else if (activeTab === "water" && Array.isArray(processedWaterData)) {
      processedWaterData.forEach((park: any) => {
        if (park && Array.isArray(park.meters)) {
          park.meters.forEach((m: any) => {
            list.push({ id: m?.id, name: `${park?.name || ''} - ${getDeviceName(m)} (${getDeviceCode(m)})` });
          });
        }
      });
    } else if (activeTab === "solar" && Array.isArray(processedSolarData)) {
      processedSolarData.forEach((park: any) => {
        if (park && Array.isArray(park.inverters)) {
          park.inverters.forEach((i: any) => {
            list.push({ id: i?.id, name: `${park?.name || ''} - ${getDeviceName(i)}` });
          });
        }
      });
    } else if (activeTab === "kiosks" && Array.isArray(processedKiosksData)) {
      processedKiosksData.forEach((park: any) => {
        if (park && Array.isArray(park.kiosks)) {
          park.kiosks.forEach((k: any) => {
            list.push({ id: k?.id, name: `${park?.name || ''} - ${getDeviceName(k)} (${getDeviceCode(k)})` });
          });
        }
      });
    }
    return list;
  }, [activeTab, processedElecData, processedWaterData, processedSolarData, processedKiosksData]);

  const getDatesInRange = (startDate: string, endDate: string) => {
    const dates = [];
    let curr = new Date(startDate);
    const last = new Date(endDate);
    while (curr <= last) {
      dates.push(curr.toISOString().split("T")[0]);
      curr.setDate(curr.getDate() + 1);
    }
    return dates.reverse();
  };

  const handleCustomExport = async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = 
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

    if (!supabaseUrl || !supabaseKey) return;
    const supabase = createClient(supabaseUrl, supabaseKey);
    setIsExporting(true);

    try {
      let tableName = "";
      let meterIdField = "";

      if (activeTab === "electric") { tableName = "electric_readings"; meterIdField = "meter_id"; }
      else if (activeTab === "water") { tableName = "water_readings"; meterIdField = "water_meter_id"; }
      else if (activeTab === "solar") { tableName = "solar_production"; meterIdField = "inverter_id"; }
      else if (activeTab === "kiosks") { tableName = "kiosk_readings"; meterIdField = "kiosk_id"; }

      const targetMeterIds = Array.isArray(selectedMeterIdsForExport) && selectedMeterIdsForExport.length > 0 
        ? selectedMeterIdsForExport 
        : currentItemsList.map(i => i.id);

      if (targetMeterIds.length === 0) {
        alert("لا توجد عناصر مطابقة للفلاتر الحالية للتصدير!");
        setIsExporting(false);
        return;
      }

      const { data: fetchedReadings } = await supabase.from(tableName).select("*").in(meterIdField, targetMeterIds);
      const readingsMap = new Map();

      if (Array.isArray(fetchedReadings)) {
        fetchedReadings.forEach((row: any) => {
          const mId = row?.[meterIdField];
          const rawDate = row?.reading_date || row?.timestamp || row?.created_at || row?.date;
          if (!rawDate) return;
          const dStr = getLocalDateStr(rawDate);
          if (dStr < exportStartDate || dStr > exportEndDate) return;

          const val = activeTab === "solar" ? (row?.value ?? row?.yield) : (row?.current_value ?? row?.reading ?? row?.reading_value ?? row?.consumption);
          readingsMap.set(`${mId}_${dStr}`, val);
        });
      }

      let csvContent = "\uFEFFالمنطقة,اسم الجهاز,الكود,التاريخ,القراءة المدخلة,الحالة\n";
      const dateRange = getDatesInRange(exportStartDate, exportEndDate);

      const processRows = (items: any[], isSolar = false, isKiosk = false) => {
        if (!Array.isArray(items)) return;
        items.forEach((park: any) => {
          const entityList = isSolar ? park?.inverters : (isKiosk ? park?.kiosks : (park?.electricMeters || park?.meters || []));
          if (Array.isArray(entityList)) {
            entityList.forEach((item: any) => {
              if (targetMeterIds.includes(item?.id)) {
                dateRange.forEach((dateStr) => {
                  const foundVal = readingsMap.get(`${item.id}_${dateStr}`);
                  const valCol = foundVal !== undefined && foundVal !== null ? foundVal : "لم يتم ادخال قراءة";
                  const statusCol = foundVal !== undefined && foundVal !== null ? "متوفرة" : "مفقودة";
                  csvContent += `"${park?.name || ''}","${getDeviceName(item)}","${getDeviceCode(item)}","${dateStr}",${valCol === "لم يتم ادخال قراءة" ? `"${valCol}"` : valCol},"${statusCol}"\n`;
                });
              }
            });
          }
        });
      };

      if (activeTab === "electric") processRows(processedElecData);
      else if (activeTab === "water") processRows(processedWaterData);
      else if (activeTab === "solar") processRows(processedSolarData, true);
      else if (activeTab === "kiosks") processRows(processedKiosksData, false, true);

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Readings_${activeTab}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExportModalOpen(false);
    } catch (err) {
      alert("حدث خطأ أثناء التصدير.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* الشريط العلوي */}
      <div className="bg-slate-100 p-4 rounded-lg flex justify-between items-center border relative" dir="rtl">
        <div>
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Technology Park</span>
          <h1 className="text-xl font-bold text-slate-800">
            {Array.isArray(parkNames) && parkNames.length > 0 ? parkNames.join(", ") : "No Parks Assigned"}
          </h1>
        </div>

        <div className="relative">
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2.5 bg-gradient-to-tr from-amber-500 to-yellow-400 text-white rounded-2xl shadow-md flex items-center justify-center gap-1.5"
          >
            <span className="text-base font-black">⚡</span>
            {hasUnread && totalAlertsCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 bg-red-600 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow">
                {totalAlertsCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute left-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border z-50 overflow-hidden text-right" dir="rtl">
              <div className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center">
                <span className="font-bold text-xs">سجل التنبيهات</span>
                {hasUnread && (
                  <button onClick={() => setHasUnread(false)} className="text-[10px] bg-slate-800 text-slate-200 px-2 py-1 rounded-lg">
                    تحديد الكل كمقروء ✓
                  </button>
                )}
              </div>
              <div className="flex border-b bg-gray-50 p-1 text-xs font-bold gap-1">
                <button
                  onClick={() => setNotificationTab("important")}
                  className={`flex-1 py-1.5 rounded-lg ${notificationTab === "important" ? "bg-white text-red-600 shadow-sm border" : "text-gray-500"}`}
                >
                  عاجل وهام ({categorizedAlerts.important.length})
                </button>
                <button
                  onClick={() => setNotificationTab("normal")}
                  className={`flex-1 py-1.5 rounded-lg ${notificationTab === "normal" ? "bg-white text-blue-600 shadow-sm border" : "text-gray-500"}`}
                >
                  ملاحظات ({categorizedAlerts.normal.length})
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                {(notificationTab === "important" ? categorizedAlerts.important : categorizedAlerts.normal).map((alert) => (
                  <div key={alert.id} className="p-3.5 flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${notificationTab === "important" ? "bg-red-500" : "bg-blue-500"}`}></div>
                    <div className="space-y-0.5 flex-1">
                      <span className="font-bold text-xs text-gray-900 block">{alert.title}</span>
                      <p className="text-[11px] text-gray-600 leading-relaxed">{alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* أزرار التبويبات الأربعة */}
      <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-2 shadow-inner">
        <button onClick={() => { setActiveTab("electric"); setSelectedParkIds(rawParksElec.map((p: any) => p?.id).filter(Boolean)); }} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === "electric" ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600'}`}>⚡ الكهرباء</button>
        <button onClick={() => { setActiveTab("water"); setSelectedParkIds(rawParksWater.map((p: any) => p?.id).filter(Boolean)); }} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === "water" ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600'}`}>💧 المياه</button>
        <button onClick={() => { setActiveTab("solar"); setSelectedParkIds(rawParksSolar.map((p: any) => p?.id).filter(Boolean)); }} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === "solar" ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-600'}`}>☀️ الطاقة الشمسية</button>
        <button onClick={() => { setActiveTab("kiosks"); setSelectedParkIds(rawParksKiosks.map((p: any) => p?.id).filter(Boolean)); }} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === "kiosks" ? 'bg-amber-600 text-white shadow-md' : 'text-gray-600'}`}>🏪 الأكشاك</button>
      </div>

      {/* التحكم والفلاتر */}
      <div className="bg-white p-5 rounded-2xl shadow-md border flex flex-col md:flex-row gap-4 justify-between items-center">
        {activeTab === "electric" && (
          <div className="w-full md:w-1/4">
            <label className="block text-xs font-bold mb-1.5 text-gray-700">⚡ فئة العدادات:</label>
            <select className="w-full border p-2.5 rounded-xl bg-gray-50 text-xs text-gray-800" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="MEDIUM">Medium Voltage (متوسطة)</option>
              <option value="LOW">Low Voltage (منخفضة)</option>
            </select>
          </div>
        )}

        <div className="w-full flex-1">
          <label className="block text-xs font-bold mb-1.5 text-gray-700">📍 مناطق المخططات:</label>
          <div className="flex flex-wrap gap-1.5 items-center">
            {Array.isArray(currentRawParks) && currentRawParks.map((p: any) => {
              if (!p) return null;
              const isSelected = Array.isArray(selectedParkIds) && selectedParkIds.includes(p.id);
              return (
                <button 
                  key={p.id} 
                  onClick={() => setSelectedParkIds(prev => Array.isArray(prev) ? (isSelected ? prev.filter(i => i !== p.id) : [...prev, p.id]) : [p.id])}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        <button onClick={() => setIsExportModalOpen(true)} className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow">
          📥 تصدير القراءات (Excel/CSV)
        </button>
      </div>

      {/* شبكة العرض حسب التبويب النشط */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {activeTab === "electric" && Array.isArray(processedElecData) && processedElecData.map((park: any) => (
          <div key={park.id} className="bg-white p-5 rounded-2xl shadow-md border space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-gray-800">{park.name}</h3>
              <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg font-bold">{park.elecActiveCount} / {park.elecTotalCount} عداد</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {Array.isArray(park.electricMeters) && park.electricMeters.map((m: any) => (
                <div key={m.id} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl text-xs">
                  <span>{getDeviceName(m)}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openPhotoModal(m)} className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-bold">📷 الصور</button>
                    <span className="font-bold text-blue-600">{Math.round(Number(m.consumption || 0)).toLocaleString()} kWh</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {activeTab === "water" && Array.isArray(processedWaterData) && processedWaterData.map((park: any) => (
          <div key={park.id} className="bg-white p-5 rounded-2xl shadow-md border space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-gray-800">{park.name}</h3>
              <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg font-bold">{park.activeCount} / {park.totalCount} عداد مياه</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {Array.isArray(park.meters) && park.meters.map((m: any) => (
                <div key={m.id} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl text-xs">
                  <span>{getDeviceName(m)}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openPhotoModal(m)} className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-bold">📷 الصور</button>
                    <span className="font-bold text-blue-600">{Math.round(Number(m.consumption || 0)).toLocaleString()} m³</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {activeTab === "solar" && Array.isArray(processedSolarData) && processedSolarData.map((park: any) => (
          <div key={park.id} className="bg-white p-5 rounded-2xl shadow-md border space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-gray-800">{park.name}</h3>
              <span className="text-xs bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg font-bold">{park.activeCount} / {park.totalCount} انفرتر</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {Array.isArray(park.inverters) && park.inverters.map((i: any) => (
                <div key={i.id} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl text-xs">
                  <span>{getDeviceName(i)}</span>
                  <span className="font-bold text-emerald-600">{Math.round(Number(i.yield || 0)).toLocaleString()} kWh</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {activeTab === "kiosks" && Array.isArray(processedKiosksData) && processedKiosksData.map((park: any) => (
          <div key={park.id} className="bg-white p-5 rounded-2xl shadow-md border space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-gray-800">{park.name}</h3>
              <span className="text-xs bg-amber-50 text-amber-600 px-2.5 py-1 rounded-lg font-bold">{park.activeCount} / {park.totalCount} كشك</span>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {Array.isArray(park.kiosks) && park.kiosks.map((k: any) => (
                <div key={k.id} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl text-xs">
                  <span>{getDeviceName(k)}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openPhotoModal(k)} className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-bold">📷 الصور</button>
                    <span className="font-bold text-amber-600">{Math.round(Number(k.consumption || 0)).toLocaleString()} kWh</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* نافذة عرض الصور */}
      {isPhotoModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl" dir="rtl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-gray-800">صور العداد: {getDeviceName(currentMeterForPhoto)}</h3>
              <button onClick={() => setIsPhotoModalOpen(false)} className="text-gray-400 font-bold text-lg">✕</button>
            </div>
            {isLoadingPhotos ? (
              <div className="py-8 text-center text-xs text-gray-500 font-bold">جاري التحميل...</div>
            ) : meterPhotosList.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">لا توجد صور مخزنة لهذا الجهاز.</div>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-3">
                {meterPhotosList.map((p, idx) => (
                  <div key={idx} className="bg-gray-50 p-3 rounded-xl border">
                    <span className="text-xs font-bold block mb-2">{p.created_at}</span>
                    <img src={p.url} alt="Meter" className="w-full max-h-60 object-contain rounded-lg border" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
