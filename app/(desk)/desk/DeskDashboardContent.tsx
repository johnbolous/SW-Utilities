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

// دالة ذكية لحساب الاستهلاك الشهري للعدادات التراكمية مع التعامل مع الشهور الفارغة بدون دمج
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
    const monthKey = String(rawDate).slice(0, 7); // "YYYY-MM"
    
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
    const monthKey = String(rawDate).slice(0, 7); // "YYYY-MM"
    
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

  const parkNames = data?.parkNames || [];
  const summary = data?.summary || {};
  const rawParksElec = data?.parksDailyElec || [];
  const rawParksWater = data?.parksWaterData || [];
  const rawParksSolar = data?.parksSolarData || [];

  // بيانات الأكشاك من جدول kiosks في الداتا بيز
  const [kiosksTableData, setKiosksTableData] = useState<any[]>([]);
  const [kioskMonthlyConsumptions, setKioskMonthlyConsumptions] = useState<Map<string, { [monthKey: string]: number }>>(new Map());

  // جلب الأكشاك وقراءاتها مباشرة باستخدام park_id المطابق لجدولك
  useEffect(() => {
    const fetchKiosksAndReadings = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseKey = 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

      if (!supabaseUrl || !supabaseKey) return;
      const supabase = createClient(supabaseUrl, supabaseKey);

      try {
        const { data: kiosksRows, error: kiosksErr } = await supabase.from("kiosks").select("*");
        if (kiosksErr) {
          console.error("Error fetching kiosks:", kiosksErr);
          return;
        }

        if (kiosksRows && kiosksRows.length > 0) {
          const kioskIds = kiosksRows.map(k => k.id);
          
          const { data: kioskReadings, error: readingsErr } = await supabase
            .from("kiosk_readings")
            .select("*")
            .in("kiosk_id", kioskIds);

          if (!readingsErr && kioskReadings) {
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
        console.error("Error in fetchKiosksAndReadings:", err);
      }
    };

    fetchKiosksAndReadings();
  }, []);

  // ربط الأكشاك بمناطقها عبر park_id بناءً على هيكل جدول kiosks
  const rawParksKiosks = useMemo(() => {
    if (!rawParksElec || !Array.isArray(rawParksElec)) return [];
    return rawParksElec.map((park: any) => {
      const parkId = park?.id;
      const parkKiosks = kiosksTableData.filter(k => String(k?.park_id) === String(parkId));
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
    return rawParksElec && rawParksElec.length > 0 ? rawParksElec.map((p: any) => p.id) : [];
  });

  // التحكم في حالة الإشعارات والتبويبات
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState<"important" | "normal">("important");
  const [hasUnread, setHasUnread] = useState(true);

  // Photo modal states
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [currentMeterForPhoto, setCurrentMeterForPhoto] = useState<any>(null);
  const [meterPhotosList, setMeterPhotosList] = useState<any[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [selectedPhotoMonth, setSelectedPhotoMonth] = useState<string>("");

  // Monthly consumption delta maps
  const [meterMonthlyConsumptions, setMeterMonthlyConsumptions] = useState<Map<string, { [monthKey: string]: number }>>(new Map());
  const [waterMeterMonthlyConsumptions, setWaterMeterMonthlyConsumptions] = useState<Map<string, { [monthKey: string]: number }>>(new Map());
  const [solarMonthlyConsumptions, setSolarMonthlyConsumptions] = useState<Map<string, { [monthKey: string]: number }>>(new Map());

  useEffect(() => {
    if (currentRawParks && Array.isArray(currentRawParks) && currentRawParks.length > 0) {
      const newIds = currentRawParks.map((p: any) => p?.id).filter(Boolean);
      setSelectedParkIds(newIds);
    }
  }, [activeTab, data]);

  const todayStr = new Date().toISOString().split("T")[0];
  const currentMonthKey = todayStr.slice(0, 7); // "YYYY-MM"
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

  // Fetch readings for monthly delta / sum calculations including kiosks
  useEffect(() => {
    const fetchAllReadingsForCalculations = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseKey = 
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

      if (!supabaseUrl || !supabaseKey) return;
      const supabase = createClient(supabaseUrl, supabaseKey);

      try {
        // Electric readings
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
          if (elecReadings) {
            setMeterMonthlyConsumptions(calculateMonthlyConsumptionsForAllMeters(elecReadings, "meter_id"));
          }
        }

        // Water readings
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
          if (waterReadings) {
            setWaterMeterMonthlyConsumptions(calculateMonthlyConsumptionsForAllMeters(waterReadings, "water_meter_id"));
          }
        }

        // Solar production
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
          if (solarReadings) {
            setSolarMonthlyConsumptions(calculateSolarConsumptionsForAllInverters(solarReadings));
          }
        }
      } catch (err) {
        console.error("Error fetching readings for calculations:", err);
      }
    };

    fetchAllReadingsForCalculations();
  }, [rawParksElec, rawParksWater, rawParksSolar]);

  const handleDemandTimeFrameChange = (frame: "day" | "week" | "month" | "year") => {
    setDemandTimeFrame(frame);
    const now = Date.now();
    const end = new Date(now).toISOString().split("T")[0];
    let start = end;

    if (frame === "day") {
      start = end;
    } else if (frame === "week") {
      start = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    } else if (frame === "month") {
      start = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    } else if (frame === "year") {
      start = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    }

    setDemandStartDate(start);
    setDemandEndDate(end);
  };

  const handleConsumptionTimeFrameChange = (frame: "day" | "week" | "month" | "year") => {
    setConsumptionTimeFrame(frame);
    const now = Date.now();
    const end = new Date(now).toISOString().split("T")[0];
    let start = end;

    if (frame === "day") {
      start = end;
    } else if (frame === "week") {
      start = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    } else if (frame === "month") {
      start = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    } else if (frame === "year") {
      start = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    }

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

  // استخراج وتقسيم التنبيهات (عاجل وهام / ملاحظات عامة)
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
      if (activeTab === "water" || cat.includes("water")) {
        folderCategory = "water";
      } else if (cat.includes("low") || cat === "low") {
        folderCategory = "low";
      } else if (activeTab === "kiosks" || cat.includes("kiosk")) {
        folderCategory = "kiosk";
      } else {
        folderCategory = "medium";
      }

      const mainBucket = "meter-photos";
      const targetPath = `${folderCategory}/${meterCode}`;

      let fetchedPhotos: any[] = [];

      const { data: storageFiles, error: storageError } = await supabase.storage
        .from(mainBucket)
        .list(targetPath, {
          limit: 100,
          offset: 0,
          sortBy: { column: 'name', order: 'desc' },
        });

      if (!storageError && storageFiles && storageFiles.length > 0) {
        storageFiles.forEach((file: any) => {
          if (file?.name && file.name !== ".emptyFolderPlaceholder") {
            const filePath = `${targetPath}/${file.name}`;
            const { data: publicUrlData } = supabase.storage
              .from(mainBucket)
              .getPublicUrl(filePath);

            let dateStr = file?.created_at || file?.updated_at || "";
            const match = file.name.match(/(\d{4}-\d{2}-\d{2})/);
            if (match) {
              dateStr = match[1];
            }

            fetchedPhotos.push({
              id: file?.id || filePath,
              url: publicUrlData?.publicUrl || "",
              created_at: dateStr || new Date().toISOString().split("T")[0],
              name: file.name
            });
          }
        });
      }

      if (meter?.id) {
        const { data: dbPhotos } = await supabase
          .from("photos")
          .select("*")
          .eq("meter_id", meter.id)
          .order("created_at", { ascending: false });

        if (dbPhotos && dbPhotos.length > 0) {
          dbPhotos.forEach((p: any) => {
            const pUrl = p?.url || p?.image_url || p?.file_path || p?.path;
            if (pUrl && !fetchedPhotos.some(fp => fp.url === pUrl)) {
              fetchedPhotos.push({
                id: p?.id,
                url: pUrl,
                created_at: p?.created_at || p?.reading_date || p?.date || "",
                name: p?.name || "photo"
              });
            }
          });
        }
      }

      setMeterPhotosList(fetchedPhotos);
      if (fetchedPhotos.length > 0 && fetchedPhotos[0]?.created_at) {
        setSelectedPhotoMonth(fetchedPhotos[0].created_at.slice(0, 7));
      }
    } catch (err) {
      console.error("Error fetching photos:", err);
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
        if (!selectedParkIds || selectedParkIds.length === 0) {
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

        if (error || !rows) {
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
          let keyStr = "";
          if (demandTimeFrame === "day") {
            const hours = String(d.getHours()).padStart(2, '0');
            const minutes = String(d.getMinutes()).padStart(2, '0');
            keyStr = `${hours}:${minutes}`;
          } else {
            keyStr = getLocalDateStr(rawTimestamp);
          }

          const val = Number(row?.max_demand_mva || row?.max_demand || 0);

          if (!dateMap.has(keyStr)) {
            dateMap.set(keyStr, { date: keyStr });
          }
          const entry = dateMap.get(keyStr);
          if (!entry[pId] || val > entry[pId]) {
            entry[pId] = Math.round(val * 1000) / 1000;
          }
        });

        const formatted = Array.from(dateMap.values()).sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
        setChartData(formatted);
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
            if (park && selectedParkIds.includes(park.id) && Array.isArray(park.meters)) {
              park.meters.forEach((m: any) => {
                const cat = String(m?.category || "").trim().toUpperCase();
                if (m?.id && (cat === "MEDIUM" || cat === "MED" || cat.includes("MEDIUM") || !cat)) {
                  meterIds.push(m.id);
                  meterToParkMap.set(m.id, park.id);
                }
              });
            }
          });
        }

        if (meterIds.length === 0 && Array.isArray(rawParksElec)) {
          rawParksElec.forEach((park: any) => {
            if (park && selectedParkIds.includes(park.id) && Array.isArray(park.meters)) {
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

        const { data: readings, error } = await supabase
          .from("electric_readings")
          .select("*")
          .in("meter_id", meterIds);

        if (error || !readings || readings.length === 0) {
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

          if (!dateParkMap.has(keyStr)) {
            dateParkMap.set(keyStr, { date: keyStr });
          }
          const entry = dateParkMap.get(keyStr);
          entry[pId] = (entry[pId] || 0) + val;
        });

        const formatted = Array.from(dateParkMap.values()).sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
        setConsumptionChartData(formatted);
      } catch (err) {
        setConsumptionChartData([]);
      } finally {
        setIsConsumptionLoading(false);
      }
    };

    if (activeTab === "electric") {
      fetchConsumptionData();
    } else {
      setConsumptionChartData([]);
    }
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
        if (!dailyParkMaxMap.has(key)) {
          dailyParkMaxMap.set(key, val);
        } else {
          dailyParkMaxMap.set(key, Math.max(dailyParkMaxMap.get(key), val));
        }
      });
    }

    const parkStats = new Map();
    dailyParkMaxMap.forEach((maxVal, key) => {
      const [pId] = key.split("_");
      if (!parkStats.has(pId)) {
        parkStats.set(pId, { sum: 0, count: 0 });
      }
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
              const monthlyVal = meterMonthlyMap ? (meterMonthlyMap[currentMonthKey] ?? 0) : Number(m?.totalConsumption || 0);
              monthly += monthlyVal;
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
            const val = invMap ? (invMap[currentMonthKey] ?? 0) : Number(inv?.totalYield || 0);
            sumMonth += val;
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
            const val = waterMap ? (waterMap[currentMonthKey] ?? 0) : Number(m?.totalConsumption || 0);
            sumMonth += val;
          });
        }
      });
    }
    return sumMonth;
  }, [rawParksWater, waterMeterMonthlyConsumptions, currentMonthKey]);

  const processedElecData = useMemo(() => {
    if (!Array.isArray(rawParksElec)) return [];
    return rawParksElec
      .filter((park: any) => park && selectedParkIds.includes(park.id))
      .map((park: any) => {
        const allMeters = park?.meters || [];
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
          const monthlyVal = meterMonthlyMap ? (meterMonthlyMap[currentMonthKey] ?? 0) : Number(m?.totalConsumption || 0);
          return sum + monthlyVal;
        }, 0);

        const parkAvgMaxDemand = parkAveragesMap.get(park?.id) || 0;

        return {
          ...park,
          electricMeters,
          elecDaily,
          elecTotalConsumption,
          elecMaxDemand: parkAvgMaxDemand,
          elecTotalCount: electricMeters.length,
          elecActiveCount: electricMeters.filter((m: any) => Number(m?.consumption || 0) > 0).length,
        };
      });
  }, [rawParksElec, selectedParkIds, selectedCategory, parkAveragesMap, meterMonthlyConsumptions, currentMonthKey]);

  const processedWaterData = useMemo(() => {
    if (!Array.isArray(rawParksWater)) return [];
    return rawParksWater
      .filter((park: any) => park && selectedParkIds.includes(park.id))
      .map((park: any) => {
        const meters = park?.meters || [];
        const waterDaily = meters.reduce((sum: number, m: any) => sum + Number(m?.consumption || 0), 0);
        const waterTotal = meters.reduce((sum: number, m: any) => {
          const waterMonthlyMap = waterMeterMonthlyConsumptions.get(m?.id);
          const monthlyVal = waterMonthlyMap ? (waterMonthlyMap[currentMonthKey] ?? 0) : Number(m?.totalConsumption || 0);
          return sum + monthlyVal;
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
      .filter((park: any) => park && selectedParkIds.includes(park.id))
      .map((park: any) => {
        const inverters = park?.inverters || [];
        const solarDaily = inverters.reduce((sum: number, i: any) => sum + Number(i?.yield || 0), 0);
        
        const solarTotal = inverters.reduce((sum: number, i: any) => {
          const invMap = solarMonthlyConsumptions.get(i?.id);
          const monthlyVal = invMap ? (invMap[currentMonthKey] ?? 0) : Number(i?.totalYield || 0);
          return sum + monthlyVal;
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
      .filter((park: any) => park && selectedParkIds.includes(park.id))
      .map((park: any) => {
        const kiosksList = park?.kiosks || [];
        const kiosksDaily = kiosksList.reduce((sum: number, k: any) => sum + Number(k?.consumption || 0), 0);
        const kiosksTotal = kiosksList.reduce((sum: number, k: any) => {
          const kioskMap = kioskMonthlyConsumptions.get(k?.id);
          const monthlyVal = kioskMap ? (kioskMap[currentMonthKey] ?? 0) : Number(k?.totalConsumption || 0);
          return sum + monthlyVal;
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
    let list: any[] = [];
    if (activeTab === "electric") {
      processedElecData.forEach((park: any) => {
        if (park && Array.isArray(park.electricMeters)) {
          park.electricMeters.forEach((m: any) => {
            list.push({ id: m?.id, name: `${park?.name || ''} - ${getDeviceName(m)} (${getDeviceCode(m)})` });
          });
        }
      });
    } else if (activeTab === "water") {
      processedWaterData.forEach((park: any) => {
        if (park && Array.isArray(park.meters)) {
          park.meters.forEach((m: any) => {
            list.push({ id: m?.id, name: `${park?.name || ''} - ${getDeviceName(m)} (${getDeviceCode(m)})` });
          });
        }
      });
    } else if (activeTab === "solar") {
      processedSolarData.forEach((park: any) => {
        if (park && Array.isArray(park.inverters)) {
          park.inverters.forEach((i: any) => {
            list.push({ id: i?.id, name: `${park?.name || ''} - ${getDeviceName(i)}` });
          });
        }
      });
    } else if (activeTab === "kiosks") {
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

    if (!supabaseUrl || !supabaseKey) {
      alert("خطأ: تأكد من وجود متغيرات البيئة");
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    setIsExporting(true);
    try {
      let tableName = "";
      let meterIdField = "";

      if (activeTab === "electric") {
        tableName = "electric_readings";
        meterIdField = "meter_id";
      } else if (activeTab === "water") {
        tableName = "water_readings";
        meterIdField = "water_meter_id";
      } else if (activeTab === "solar") {
        tableName = "solar_production";
        meterIdField = "inverter_id";
      } else if (activeTab === "kiosks") {
        tableName = "kiosk_readings";
        meterIdField = "kiosk_id";
      }

      const targetMeterIds = selectedMeterIdsForExport.length > 0 
        ? selectedMeterIdsForExport 
        : currentItemsList.map(i => i.id);

      if (targetMeterIds.length === 0) {
        alert("لا توجد عناصر مطابقة للفلاتر الحالية للتصدير!");
        setIsExporting(false);
        return;
      }

      const { data: fetchedReadings, error } = await supabase
        .from(tableName)
        .select(`*`)
        .in(meterIdField, targetMeterIds);

      if (error) {
        alert(`خطأ من الداتا بيز: ${error.message || JSON.stringify(error)}`);
        setIsExporting(false);
        return;
      }

      const readingsMap = new Map();
      if (fetchedReadings) {
        fetchedReadings.forEach((row: any) => {
          const mId = row?.[meterIdField];
          const rawDate = row?.reading_date || row?.timestamp || row?.created_at || row?.date;
          if (!rawDate) return;
          const dStr = getLocalDateStr(rawDate);

          if (dStr < exportStartDate || dStr > exportEndDate) return;

          let val = null;
          if (activeTab === "electric" || activeTab === "water" || activeTab === "kiosks") {
            val = row?.current_value ?? row?.reading ?? row?.reading_value ?? row?.consumption ?? null;
          } else if (activeTab === "solar") {
            val = row?.value ?? row?.yield ?? null;
          }

          readingsMap.set(`${mId}_${dStr}`, val);
        });
      }

      let csvContent = "\uFEFF";
      let filename = `Readings_History_${activeTab}_${exportStartDate}_to_${exportEndDate}.csv`;
      csvContent += "المنطقة,اسم الجهاز,الكود,التاريخ,القراءة المدخلة,الحالة\n";

      const dateRange = getDatesInRange(exportStartDate, exportEndDate);

      const processCsvRows = (items: any[], isSolar = false, isKiosk = false) => {
        items.forEach((park: any) => {
          const entityList = isSolar ? park?.inverters : (isKiosk ? park?.kiosks : (park?.electricMeters || park?.meters || []));
          if (Array.isArray(entityList)) {
            entityList.forEach((item: any) => {
              const itemId = item?.id;
              if (targetMeterIds.includes(itemId)) {
                dateRange.forEach((dateStr) => {
                  const mapKey = `${itemId}_${dateStr}`;
                  const foundVal = readingsMap.get(mapKey);

                  let valCol = "لم يتم ادخال قراءة";
                  let statusCol = "مفقودة";

                  if (foundVal !== undefined && foundVal !== null && foundVal !== "") {
                    valCol = foundVal;
                    statusCol = "متوفرة";
                  }

                  const deviceName = getDeviceName(item);
                  const deviceCode = getDeviceCode(item);

                  csvContent += `"${park?.name || ''}","${deviceName}","${deviceCode}","${dateStr}",${valCol === "لم يتم ادخال قراءة" ? `"${valCol}"` : valCol},"${statusCol}"\n`;
                });
              }
            });
          }
        });
      };

      if (activeTab === "electric") {
        processCsvRows(processedElecData);
      } else if (activeTab === "water") {
        processCsvRows(processedWaterData);
      } else if (activeTab === "solar") {
        processCsvRows(processedSolarData, true);
      } else if (activeTab === "kiosks") {
        processCsvRows(processedKiosksData, false, true);
      }

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsExportModalOpen(false);
    } catch (err) {
      alert("حدث خطأ غير متوقع أثناء التصدير.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      {/* الشريط العلوي مع نظام التنبيهات المنسدل */}
      <div className="bg-slate-100 p-4 rounded-lg flex justify-between items-center border relative" dir="rtl">
        <div>
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
            Technology Park
          </span>
          <h1 className="text-xl font-bold text-slate-800">
            {parkNames.length > 0 ? parkNames.join(", ") : "No Parks Assigned"}
          </h1>
        </div>

        <div className="relative">
          <button 
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className="relative p-2.5 bg-gradient-to-tr from-amber-500 to-yellow-400 hover:from-amber-600 hover:to-yellow-500 text-white rounded-2xl shadow-md transition-all flex items-center justify-center gap-1.5"
            title="التنبيهات والملاحظات"
          >
            <span className="text-base font-black">⚡</span>
            {hasUnread && totalAlertsCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 bg-red-600 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white shadow">
                {totalAlertsCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute left-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden text-right" dir="rtl">
              <div className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center">
                <span className="font-bold text-xs flex items-center gap-1.5">
                  <span className="text-amber-400">⚡</span> سجل التنبيهات
                </span>
                {hasUnread && (
                  <button 
                    onClick={() => setHasUnread(false)}
                    className="text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2 py-1 rounded-lg transition-all"
                  >
                    تحديد الكل كمقروء ✓
                  </button>
                )}
              </div>

              <div className="flex border-b bg-gray-50 p-1 text-xs font-bold gap-1">
                <button
                  onClick={() => setNotificationTab("important")}
                  className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                    notificationTab === "important" 
                      ? "bg-white text-red-600 shadow-sm border" 
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <span>🔴</span> عاجل وهام ({categorizedAlerts.important.length})
                </button>
                <button
                  onClick={() => setNotificationTab("normal")}
                  className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                    notificationTab === "normal" 
                      ? "bg-white text-blue-600 shadow-sm border" 
                      : "text-gray-500 hover:text-gray-800"
                  }`}
                >
                  <span>🔵</span> ملاحظات ({categorizedAlerts.normal.length})
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                {notificationTab === "important" ? (
                  categorizedAlerts.important.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400">
                      لا توجد تنبيهات عاجلة حالياً.
                    </div>
                  ) : (
                    categorizedAlerts.important.map((alert) => (
                      <div key={alert.id} className="p-3.5 hover:bg-red-50/50 transition-all flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 shrink-0"></div>
                        <div className="space-y-0.5 flex-1">
                          <span className="font-bold text-xs text-gray-900 block">{alert.title}</span>
                          <p className="text-[11px] text-gray-600 leading-relaxed">{alert.message}</p>
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  categorizedAlerts.normal.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400">
                      لا توجد ملاحظات عامة.
                    </div>
                  ) : (
                    categorizedAlerts.normal.map((alert) => (
                      <div key={alert.id} className="p-3.5 hover:bg-gray-50 transition-all flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                        <div className="space-y-0.5 flex-1">
                          <span className="font-bold text-xs text-gray-900 block">{alert.title}</span>
                          <p className="text-[11px] text-gray-600 leading-relaxed">{alert.message}</p>
                        </div>
                      </div>
                    ))
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-gray-500 ml-1">فلتر مناطق المخططات:</span>
        {currentRawParks.map((p: any) => {
          if (!p) return null;
          const isSelected = selectedParkIds.includes(p.id);
          return (
            <button 
              key={p.id} 
              onClick={() => setSelectedParkIds(prev => isSelected ? prev.filter(i => i !== p.id) : [...prev, p.id])}
              className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${isSelected ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
            >
              {p.name}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        <div className="bg-[#0c1427] text-white p-5 rounded-3xl shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <span className="text-xs bg-slate-800 text-slate-200 px-3 py-1 rounded-full font-mono">{todayStr}</span>
            <span className="text-xs text-slate-400 font-medium">آخر قراءة مسجلة:</span>
          </div>

          <div className="space-y-3 overflow-y-auto max-h-[300px] pr-1">
            {currentRawParks.map((park: any, idx: number) => {
              if (!park) return null;
              const latestData = latestParkReadingsMap.get(park.id);
              const latestVal = latestData ? latestData.val : 0;
              const latestTime = latestData?.timestamp 
                ? new Date(latestData.timestamp).toLocaleString('en-GB', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit', 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: false 
                  }).replace(',', '')
                : "لا توجد قراءة";
              const color = parkColors[idx % parkColors.length];
              return (
                <div key={park.id} className="bg-[#151f38] p-3 rounded-2xl flex justify-between items-center border border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }}></span>
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">{park.name}</span>
                      <span className="text-[9px] text-slate-400 font-mono block">{latestTime}</span>
                    </div>
                  </div>
                  <div className="text-left" dir="ltr">
                    <span className="text-[10px] text-slate-400 font-bold mr-1">MVA</span>
                    <span className="text-sm font-black text-white">{Number(latestVal).toFixed(3)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-md border border-gray-100 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-2">
            <div>
              <h3 className="font-bold text-sm text-gray-800">الأحمال الكهربائية القصوى (Max Demand)</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">وحدة القياس: MVA لكل منطقة</p>
            </div>
            
            <div className="flex items-center bg-gray-100 p-1 rounded-xl gap-1 text-[10px] font-bold">
              <button onClick={() => handleDemandTimeFrameChange("year")} className={`px-2 py-1 rounded-lg transition-all ${demandTimeFrame === "year" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>سنة</button>
              <button onClick={() => handleDemandTimeFrameChange("month")} className={`px-2 py-1 rounded-lg transition-all ${demandTimeFrame === "month" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>شهر</button>
              <button onClick={() => handleDemandTimeFrameChange("week")} className={`px-2 py-1 rounded-lg transition-all ${demandTimeFrame === "week" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>أسبوع</button>
              <button onClick={() => handleDemandTimeFrameChange("day")} className={`px-2 py-1 rounded-lg transition-all ${demandTimeFrame === "day" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>يوم</button>
            </div>
          </div>

          <div className="h-72 w-full relative">
            {isChartLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-gray-500 font-bold z-10">
                جاري التحميل...
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                {currentRawParks.map((park: any, idx: number) => {
                  if (!park || !selectedParkIds.includes(park.id)) return null;
                  const color = parkColors[idx % parkColors.length];
                  return (
                    <Line key={park.id} type="monotone" dataKey={park.id} name={park.name} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 5 }} connectNulls />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-md border border-gray-100 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-2">
            <div>
              <h3 className="font-bold text-sm text-gray-800">مقارنة الاستهلاك (Consumption Comparison)</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">وحدة القياس: kWh (جهد متوسط - Medium) لكل منطقة</p>
            </div>

            <div className="flex items-center bg-gray-100 p-1 rounded-xl gap-1 text-[10px] font-bold">
              <button onClick={() => handleConsumptionTimeFrameChange("year")} className={`px-2 py-1 rounded-lg transition-all ${consumptionTimeFrame === "year" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>سنة</button>
              <button onClick={() => handleConsumptionTimeFrameChange("month")} className={`px-2 py-1 rounded-lg transition-all ${consumptionTimeFrame === "month" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>شهر</button>
              <button onClick={() => handleConsumptionTimeFrameChange("week")} className={`px-2 py-1 rounded-lg transition-all ${consumptionTimeFrame === "week" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>أسبوع</button>
              <button onClick={() => handleConsumptionTimeFrameChange("day")} className={`px-2 py-1 rounded-lg transition-all ${consumptionTimeFrame === "day" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>يوم</button>
            </div>
          </div>

          <div className="h-72 w-full relative">
            {isConsumptionLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-gray-500 font-bold z-10">
                جاري التحميل...
              </div>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={consumptionChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                {currentRawParks.map((park: any, idx: number) => {
                  if (!park || !selectedParkIds.includes(park.id)) return null;
                  const color = parkColors[idx % parkColors.length];
                  return (
                    <Line key={park.id} type="monotone" dataKey={park.id} name={park.name} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 5 }} connectNulls />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      <div className="space-y-3" dir="ltr">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 text-left justify-start">
          <span className="text-amber-500">⚡</span> Engineer Overview
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-l-4 border-l-amber-500 border-gray-100 flex flex-col justify-between">
            <div>
              <span className="text-xs text-gray-500 font-bold block mb-1">Today's Electricity (Medium Voltage)</span>
              <span className="text-2xl font-black text-gray-900">
                {Math.round(todayMediumElec || 0).toLocaleString()} 
                <span className="text-xs font-normal text-gray-500"> kWh</span>
              </span>
            </div>
            <div className="mt-4 pt-3 border-t text-xs text-gray-500 font-medium space-y-1">
              <div>This Month: <span className="font-bold text-gray-800">{Math.round(monthMediumElec || 0).toLocaleString()} kWh</span></div>
              <div>Avg Max Demand: <span className="font-bold text-amber-600">{Number(mediumMaxDemand || 0).toFixed(3)} MVA</span></div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-l-4 border-l-emerald-500 border-gray-100 flex flex-col justify-between">
            <div>
              <span className="text-xs text-gray-500 font-bold block mb-1">Today's Solar production</span>
              <span className="text-2xl font-black text-gray-900">
                {Math.round(summary?.todaySolar || 0).toLocaleString()} 
                <span className="text-xs font-normal text-gray-500"> kWh</span>
              </span>
            </div>
            <div className="mt-4 pt-3 border-t text-xs text-gray-500 font-medium">
              This Month: <span className="font-bold text-gray-800">{Math.round(summarySolarMonth || 0).toLocaleString()} kWh</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-l-4 border-l-blue-500 border-gray-100 flex flex-col justify-between">
            <div>
              <span className="text-xs text-gray-500 font-bold block mb-1">Today's Water Usage</span>
              <span className="text-2xl font-black text-gray-900">
                {Math.round(summary?.todayWater || 0).toLocaleString()} 
                <span className="text-xs font-normal text-gray-500"> m³</span>
              </span>
            </div>
            <div className="mt-4 pt-3 border-t text-xs text-gray-500 font-medium">
              This Month: <span className="font-bold text-gray-800">{Math.round(summaryWaterMonth || 0).toLocaleString()} m³</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3" dir="ltr">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2 text-left justify-start">
          <span>🏢</span> Infrastructure Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 text-left">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
            <span className="text-xs text-gray-500 font-bold block mb-1">Buildings</span>
            <span className="text-2xl font-black text-gray-800">{summary?.buildingsCount || 0}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
            <span className="text-xs text-gray-500 font-bold block mb-1">Floors</span>
            <span className="text-2xl font-black text-gray-800">{summary?.floorCount || 0}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
            <span className="text-xs text-gray-500 font-bold block mb-1">Electric Meters</span>
            <span className="text-2xl font-black text-gray-800">{summary?.electricMetersCount || 0}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
            <span className="text-xs text-gray-500 font-bold block mb-1">Water Meters</span>
            <span className="text-2xl font-black text-gray-800">{summary?.waterMetersCount || 0}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
            <span className="text-xs text-gray-500 font-bold block mb-1">Solar Inverters</span>
            <span className="text-2xl font-black text-gray-800">{summary?.solarInvertersCount || 0}</span>
          </div>
        </div>
      </div>

      {/* أزرار التبويبات الأربعة المتكاملة */}
      <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-2 shadow-inner">
        <button
          onClick={() => { setActiveTab("electric"); setSelectedParkIds(rawParksElec.map((p: any) => p?.id).filter(Boolean)); setSelectedMeterIdsForExport([]); }}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === "electric" ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
        >
          ⚡ استهلاك الكهرباء (Electricity)
        </button>
        <button
          onClick={() => { setActiveTab("water"); setSelectedParkIds(rawParksWater.map((p: any) => p?.id).filter(Boolean)); setSelectedMeterIdsForExport([]); }}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === "water" ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
        >
          💧 استهلاك المياه (Water)
        </button>
        <button
          onClick={() => { setActiveTab("solar"); setSelectedParkIds(rawParksSolar.map((p: any) => p?.id).filter(Boolean)); setSelectedMeterIdsForExport([]); }}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === "solar" ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
        >
          ☀️ الطاقة الشمسية (Solar Energy)
        </button>
        <button
          onClick={() => { setActiveTab("kiosks"); setSelectedParkIds(rawParksKiosks.map((p: any) => p?.id).filter(Boolean)); setSelectedMeterIdsForExport([]); }}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === "kiosks" ? 'bg-amber-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
        >
          🏪 الأكشاك (Kiosks)
        </button>
      </div>

      <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center">
        {activeTab === "electric" && (
          <div className="w-full md:w-1/4">
            <label className="block text-xs font-bold mb-1.5 text-gray-700">⚡ فئة العدادات:</label>
            <select 
              className="w-full border p-2.5 rounded-xl bg-gray-50 font-medium text-xs text-gray-800 outline-none" 
              value={selectedCategory} 
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="MEDIUM">Medium Voltage (متوسطة - MED)</option>
              <option value="LOW">Low Voltage (منخفضة - LOW)</option>
            </select>
          </div>
        )}

        <div className="w-full flex-1">
          <label className="block text-xs font-bold mb-1.5 text-gray-700">📍 متابعة مناطق:</label>
          <div className="flex flex-wrap gap-1.5 items-center">
            {currentRawParks.map((p: any) => {
              if (!p) return null;
              const isSelected = selectedParkIds.includes(p.id);
              return (
                <button 
                  key={p.id} 
                  onClick={() => setSelectedParkIds(prev => isSelected ? prev.filter(i => i !== p.id) : [...prev, p.id])}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${isSelected ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {p.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="w-full md:w-auto flex items-end">
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="w-full md:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center justify-center gap-2"
          >
            <span>📥</span> تصدير القراءات (Excel/CSV)
          </button>
        </div>
      </div>

      {isExportModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl" dir="rtl">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-lg text-gray-800">تصدير القراءات التاريخية مفصلة</h3>
              <button onClick={() => setIsExportModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">من تاريخ:</label>
                <input type="date" value={exportStartDate} onChange={(e) => setExportStartDate(e.target.value)} className="w-full border p-2 rounded-xl text-xs bg-gray-50 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">إلى تاريخ:</label>
                <input type="date" value={exportEndDate} onChange={(e) => setExportEndDate(e.target.value)} className="w-full border p-2 rounded-xl text-xs bg-gray-50 outline-none" />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-gray-600">اختر العناصر:</label>
                <button onClick={() => setSelectedMeterIdsForExport(currentItemsList.map(i => i.id))} className="text-[11px] text-blue-600 font-bold hover:underline">
                  تحديد الكل
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto border rounded-xl p-2 space-y-1.5 bg-gray-50">
                {currentItemsList.map((item: any) => {
                  const isChecked = selectedMeterIdsForExport.includes(item.id);
                  return (
                    <label key={item.id} className="flex items-center gap-2 text-xs p-1.5 hover:bg-gray-100 rounded cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedMeterIdsForExport(prev => [...prev, item.id]);
                          else setSelectedMeterIdsForExport(prev => prev.filter(id => id !== item.id));
                        }}
                        className="rounded text-blue-600"
                      />
                      <span className="text-gray-800 font-medium">{item.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button onClick={() => setIsExportModalOpen(false)} disabled={isExporting} className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl">إلغاء</button>
              <button onClick={handleCustomExport} disabled={isExporting} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow flex items-center gap-2">
                {isExporting ? "جاري التصدير..." : "تحميل ملف الـ CSV"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة صور العدادات */}
      {isPhotoModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl" dir="rtl">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="font-bold text-lg text-gray-800">
                  صور العداد الشهرية: {currentMeterForPhoto ? getDeviceName(currentMeterForPhoto) : ""}
                </h3>
                <p className="text-xs text-gray-400">الكود: {currentMeterForPhoto ? getDeviceCode(currentMeterForPhoto) : ""}</p>
              </div>
              <button onClick={() => setIsPhotoModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
            </div>

            {isLoadingPhotos ? (
              <div className="py-12 text-center text-xs text-gray-500 font-bold">جاري جلب الصور من خوادم التخزين...</div>
            ) : meterPhotosList.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">لا توجد صور مخزنة حتى الآن.</div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-xl border">
                  <span className="text-xs font-bold text-gray-700">اختر الشهر:</span>
                  <select
                    value={selectedPhotoMonth}
                    onChange={(e) => setSelectedPhotoMonth(e.target.value)}
                    className="border p-2 rounded-lg text-xs bg-white font-medium outline-none flex-1"
                  >
                    {Array.from(new Set(meterPhotosList.map(p => (p?.created_at || "").slice(0, 7)))).map((monthStr: any) => (
                      <option key={monthStr} value={monthStr}>شهر {monthStr} (صورة العداد)</option>
                    ))}
                  </select>
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-3">
                  {meterPhotosList
                    .filter(p => {
                      const pDate = p?.created_at || "";
                      return !selectedPhotoMonth || pDate.startsWith(selectedPhotoMonth);
                    })
                    .map((photo: any, index: number) => (
                      <div key={photo?.id || index} className="bg-gray-50 p-4 rounded-2xl border space-y-2">
                        <div className="flex justify-between items-center text-xs text-gray-500">
                          <span className="font-bold text-gray-700">التاريخ المستخرج: {photo?.created_at}</span>
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-bold">{photo?.name}</span>
                        </div>
                        {photo?.url ? (
                          <div>
                            <img src={photo.url} alt="صورة العداد" className="w-full max-h-80 object-contain rounded-xl border bg-black/5 shadow-sm" />
                            <div className="mt-2 text-left">
                              <a href={photo.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-xs font-bold underline hover:text-blue-800">
                                فتح الصورة بالحجم الكامل 🔍
                              </a>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-red-500 italic">رابط الصورة غير متوفر.</p>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t">
              <button onClick={() => setIsPhotoModalOpen(false)} className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* عرض تفاصيل الكهرباء */}
      {activeTab === "electric" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {processedElecData.map((park: any) => {
            if (!park) return null;
            return (
              <div key={park.id} className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-lg text-gray-800">{park.name}</h3>
                  <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg font-bold">
                    {park.elecActiveCount} / {park.elecTotalCount} عداد
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-gray-50 p-2.5 rounded-xl">
                    <span className="text-gray-500 block mb-0.5">الاستهلاك اليومي</span>
                    <span className="font-bold text-gray-800">{Math.round(park.elecDaily || 0).toLocaleString()} kWh</span>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-xl">
                    <span className="text-gray-500 block mb-0.5">إجمالي الشهر</span>
                    <span className="font-bold text-gray-800">{Math.round(park.elecTotalConsumption || 0).toLocaleString()} kWh</span>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-xl">
                    <span className="text-gray-500 block mb-0.5">متوسط أقصى حمل</span>
                    <span className="font-bold text-amber-600">{Number(park.elecMaxDemand || 0).toFixed(3)} MVA</span>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {Array.isArray(park.electricMeters) && park.electricMeters.map((m: any) => {
                    if (!m) return null;
                    return (
                      <div key={m.id} className="flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 text-xs">
                        <span className="font-medium text-gray-700">{getDeviceName(m)} ({getDeviceCode(m)})</span>
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); openPhotoModal(m); }} className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all">
                            <span>📷</span> صور العداد
                          </button>
                          <span className="font-bold text-blue-600">{Math.round(Number(m.consumption || 0)).toLocaleString()} kWh</span>
                          <span className={`w-2 h-2 rounded-full ${Number(m.consumption || 0) > 0 ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* عرض تفاصيل المياه */}
      {activeTab === "water" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {processedWaterData.map((park: any) => {
            if (!park) return null;
            return (
              <div key={park.id} className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-lg text-gray-800">{park.name}</h3>
                  <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg font-bold">
                    {park.activeCount} / {park.totalCount} عداد مياه
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-gray-50 p-2.5 rounded-xl">
                    <span className="text-gray-500 block mb-0.5">الاستهلاك اليومي</span>
                    <span className="font-bold text-gray-800">{Math.round(park.waterDaily || 0).toLocaleString()} m³</span>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-xl">
                    <span className="text-gray-500 block mb-0.5">إجمالي الشهر</span>
                    <span className="font-bold text-gray-800">{Math.round(park.waterTotal || 0).toLocaleString()} m³</span>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {Array.isArray(park.meters) && park.meters.map((m: any) => {
                    if (!m) return null;
                    return (
                      <div key={m.id} className="flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 text-xs">
                        <span className="font-medium text-gray-700">{getDeviceName(m)} ({getDeviceCode(m)})</span>
                        <div className="flex items-center gap-2">
                          <button onClick={(e) => { e.stopPropagation(); openPhotoModal(m); }} className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all">
                            <span>📷</span> صور العداد
                          </button>
                          <span className="font-bold text-blue-600">{Math.round(Number(m.consumption || 0)).toLocaleString()} m³</span>
                          <span className={`w-2 h-2 rounded-full ${Number(m.consumption || 0) > 0 ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* عرض تفاصيل الطاقة الشمسية (بدون كود بجانب اسم الانفرتر) */}
      {activeTab === "solar" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {processedSolarData.map((park: any) => {
            if (!park) return null;
            return (
              <div key={park.id} className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-lg text-gray-800">{park.name}</h3>
                  <span className="text-xs bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-lg font-bold">
                    {park.activeCount} / {park.totalCount} انفرتر شمسي
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-gray-50 p-2.5 rounded-xl">
                    <span className="text-gray-500 block mb-0.5">الإنتاج اليومي</span>
                    <span className="font-bold text-gray-800">{Math.round(park.solarDaily || 0).toLocaleString()} kWh</span>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-xl">
                    <span className="text-gray-500 block mb-0.5">إجمالي الشهر</span>
                    <span className="font-bold text-gray-800">{Math.round(park.solarTotal || 0).toLocaleString()} kWh</span>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {Array.isArray(park.inverters) && park.inverters.map((i: any) => {
                    if (!i) return null;
                    return (
                      <div key={i.id} className="flex-1 flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 text-xs">
                        <span className="font-medium text-gray-700">{getDeviceName(i)}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-emerald-600">{Math.round(Number(i.yield || 0)).toLocaleString()} kWh</span>
                          <span className={`w-2 h-2 rounded-full ${Number(i.yield || 0) > 0 ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* عرض تفاصيل الأكشاك المرتبطة بالمنطقة عبر park_id */}
      {activeTab === "kiosks" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {processedKiosksData.map((park: any) => {
            if (!park) return null;
            return (
              <div key={park.id} className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 space-y-4">
                <div className="flex justify-between items-center border-b pb-3">
                  <h3 className="font-bold text-lg text-gray-800">{park.name}</h3>
                  <span className="text-xs bg-amber-50 text-amber-600 px-2.5 py-1 rounded-lg font-bold">
                    {park.activeCount} / {park.totalCount} كشك
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-gray-50 p-2.5 rounded-xl">
                    <span className="text-gray-500 block mb-0.5">الاستهلاك اليومي</span>
                    <span className="font-bold text-gray-800">{Math.round(park.kiosksDaily || 0).toLocaleString()} kWh</span>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-xl">
                    <span className="text-gray-500 block mb-0.5">إجمالي الشهر</span>
                    <span className="font-bold text-gray-800">{Math.round(park.kiosksTotal || 0).toLocaleString()} kWh</span>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {Array.isArray(park.kiosks) && park.kiosks.length > 0 ? (
                    park.kiosks.map((k: any) => {
                      if (!k) return null;
                      return (
                        <div key={k.id} className="flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 text-xs">
                          <span className="font-medium text-gray-700">{getDeviceName(k)} ({getDeviceCode(k)})</span>
                          <div className="flex items-center gap-2">
                            <button onClick={(e) => { e.stopPropagation(); openPhotoModal(k); }} className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all">
                              <span>📷</span> صور العداد
                            </button>
                            <span className="font-bold text-amber-600">{Math.round(Number(k.consumption || 0)).toLocaleString()} kWh</span>
                            <span className={`w-2 h-2 rounded-full ${Number(k.consumption || 0) > 0 ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-xs text-gray-400">لا توجد أكشاك مسجلة في هذه المنطقة</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
