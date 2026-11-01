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
    if (!groupedByMonth[monthKey]) groupedByMonth[monthKey] = [];
    groupedByMonth[monthKey].push(r);
  });

  const monthKeys = Object.keys(groupedByMonth).sort();
  const monthlyResults: { [key: string]: number } = {};
  const getVal = (item: any) => Number(item?.current_value ?? item?.reading ?? item?.reading_value ?? item?.consumption ?? 0);

  let lastKnownReading: number | null = null;
  let lastReadingDate: Date | null = null;

  monthKeys.forEach((monthKey) => {
    const monthReadings = groupedByMonth[monthKey];
    if (!monthReadings || monthReadings.length === 0) return;

    const firstItem = monthReadings[0];
    const lastItem = monthReadings[monthReadings.length - 1];
    const firstVal = getVal(firstItem);
    const lastVal = getVal(lastItem);
    const firstDate = new Date(firstItem.reading_date || firstItem.timestamp || firstItem.created_at || firstItem.date);

    let monthConsumption = 0;
    if (monthReadings.length > 1) {
      monthConsumption = lastVal - firstVal;
    } else {
      if (lastKnownReading !== null && lastReadingDate !== null) {
        const diffMonths = (firstDate.getFullYear() - lastReadingDate.getFullYear()) * 12 + (firstDate.getMonth() - lastReadingDate.getMonth());
        if (diffMonths <= 1) monthConsumption = lastVal - lastKnownReading;
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
    if (!meterReadingsMap.has(mId)) meterReadingsMap.set(mId, []);
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
    if (!monthlyResults[monthKey]) monthlyResults[monthKey] = 0;
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
    if (!inverterReadingsMap.has(invId)) inverterReadingsMap.set(invId, []);
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

  const [kiosksTableData, setKiosksTableData] = useState<any[]>([]);
  const [kioskMonthlyConsumptions, setKioskMonthlyConsumptions] = useState>(new Map());

  // جلب الأكشاك وقراءاتها مباشرة من قاعدة البيانات
  useEffect(() => {
    const fetchKiosksAndReadings = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
      if (!supabaseUrl || !supabaseKey) return;
      const supabase = createClient(supabaseUrl, supabaseKey);

      try {
        const { data: kiosksRows, error: kiosksErr } = await supabase.from("kiosks").select("*");
        if (kiosksErr || !kiosksRows) return;

        if (kiosksRows.length > 0) {
          const kioskIds = kiosksRows.map(k => k.id);
          const { data: kioskReadings } = await supabase.from("kiosk_readings").select("*").in("kiosk_id", kioskIds);

          if (kioskReadings && kioskReadings.length > 0) {
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

  // ربط الأكشاك بمناطقها عبر park_id مع معالجة آمنة
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
    if (currentRawParks && Array.isArray(currentRawParks) && currentRawParks.length > 0) {
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
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
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
          if (elecReadings) setMeterMonthlyConsumptions(calculateMonthlyConsumptionsForAllMeters(elecReadings, "meter_id"));
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
          if (waterReadings) setWaterMeterMonthlyConsumptions(calculateMonthlyConsumptionsForAllMeters(waterReadings, "water_meter_id"));
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
          if (solarReadings) setSolarMonthlyConsumptions(calculateSolarConsumptionsForAllInverters(solarReadings));
        }
      } catch (err) {
        console.error("Error fetching readings:", err);
      }
    };

    fetchAllReadingsForCalculations();
  }, [rawParksElec, rawParksWater, rawParksSolar]);

  const handleDemandTimeFrameChange = (frame: "day" | "week" | "month" | "year") => {
    setDemandTimeFrame(frame);
    const now = Date.now();
    const end = new Date(now).toISOString().split("T")[0];
    let start = end;
    if (frame === "week") start = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
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
    if (frame === "week") start = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    else if (frame === "month") start = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    else if (frame === "year") start = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    setConsumptionStartDate(start);
    setConsumptionEndDate(end);
  };

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedMeterIdsForExport, setSelectedMeterIdsForExport] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  const parkColors = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

  const getLocalDateStr = (timestamp: string) => {
    if (!timestamp) return "";
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const getDeviceName = (item: any) => item?.name || item?.label || item?.code || item?.meter_code || `جهاز رقم ${item?.id ? String(item.id).slice(0, 6) : ""}`;
  const getDeviceCode = (item: any) => item?.code || item?.meter_code || item?.id || "";

  const categorizedAlerts = useMemo(() => {
    const important: { id: string; title: string; message: string }[] = [];
    const normal: { id: string; title: string; message: string }[] = [];
    return { important, normal };
  }, []);

  const totalAlertsCount = categorizedAlerts.important.length + categorizedAlerts.normal.length;

  const openPhotoModal = async (meter: any) => {
    setCurrentMeterForPhoto(meter);
    setIsPhotoModalOpen(true);
    setIsLoadingPhotos(true);
    setMeterPhotosList([]);
  };

  useEffect(() => {
    const fetchDistributorReadings = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
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

        const { data: rows } = await supabase
          .from("main_distributor_readings")
          .select("reading_timestamp, max_demand_mva, park_id")
          .in("park_id", selectedParkIds)
          .gte("reading_timestamp", startIso)
          .lte("reading_timestamp", endIso)
          .order("reading_timestamp", { ascending: true });

        if (!rows) {
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
          let keyStr = demandTimeFrame === "day" ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : getLocalDateStr(rawTimestamp);
          const val = Number(row?.max_demand_mva || row?.max_demand || 0);

          if (!dateMap.has(keyStr)) dateMap.set(keyStr, { date: keyStr });
          const entry = dateMap.get(keyStr);
          if (!entry[pId] || val > entry[pId]) entry[pId] = Math.round(val * 1000) / 1000;
        });

        setChartData(Array.from(dateMap.values()).sort((a: any, b: any) => String(a.date).localeCompare(String(b.date))));
      } catch (err) {
        setChartData([]);
      } finally {
        setIsChartLoading(false);
      }
    };

    fetchDistributorReadings();
  }, [demandStartDate, demandEndDate, selectedParkIds, demandTimeFrame]);

  useEffect(() => {
    const fetchConsumptionData = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
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
        if (!readings) {
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

          const val = Number(row?.consumption ?? row?.current_value ?? 0);
          if (!dateParkMap.has(keyStr)) dateParkMap.set(keyStr, { date: keyStr });
          dateParkMap.get(keyStr)[pId] = (dateParkMap.get(keyStr)[pId] || 0) + val;
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
        const dStr = getLocalDateStr(row?.reading_timestamp);
        const val = Number(row?.max_demand_mva || row?.max_demand || 0);
        const key = `${pId}_${dStr}`;
        dailyParkMaxMap.set(key, Math.max(dailyParkMaxMap.get(key) || 0, val));
      });
    }
    const parkStats = new Map();
    dailyParkMaxMap.forEach((maxVal, key) => {
      const [pId] = key.split("_");
      const current = parkStats.get(pId) || { sum: 0, count: 0 };
      parkStats.set(pId, { sum: current.sum + maxVal, count: current.count + 1 });
    });
    const averages = new Map();
    parkStats.forEach((stats, pId) => averages.set(pId, stats.count > 0 ? stats.sum / stats.count : 0));
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
    let daily = 0; let monthly = 0; let maxDem = 0;
    if (Array.isArray(rawParksElec)) {
      rawParksElec.forEach((park: any) => {
        if (park && Array.isArray(park.meters)) {
          park.meters.forEach((m: any) => {
            daily += Number(m?.consumption || 0);
            const meterMonthlyMap = meterMonthlyConsumptions.get(m?.id);
            monthly += meterMonthlyMap ? (meterMonthlyMap[currentMonthKey] ?? 0) : Number(m?.totalConsumption || 0);
          });
        }
      });
    }
    if (parkAveragesMap.size > 0) {
      let sum = 0; parkAveragesMap.forEach(avg => sum += avg);
      maxDem = sum / parkAveragesMap.size;
    }
    return { todayMediumElec: daily, monthMediumElec: monthly, mediumMaxDemand: maxDem };
  }, [rawParksElec, parkAveragesMap, meterMonthlyConsumptions, currentMonthKey]);

  const processedElecData = useMemo(() => {
    if (!Array.isArray(rawParksElec)) return [];
    return rawParksElec.filter((park: any) => park && selectedParkIds.includes(park.id)).map((park: any) => {
      const electricMeters = park?.meters || [];
      const elecDaily = electricMeters.reduce((sum: number, m: any) => sum + Number(m?.consumption || 0), 0);
      const elecTotalConsumption = electricMeters.reduce((sum: number, m: any) => {
        const meterMonthlyMap = meterMonthlyConsumptions.get(m?.id);
        return sum + (meterMonthlyMap ? (meterMonthlyMap[currentMonthKey] ?? 0) : Number(m?.totalConsumption || 0));
      }, 0);
      return { ...park, electricMeters, elecDaily, elecTotalConsumption, elecMaxDemand: parkAveragesMap.get(park?.id) || 0, elecTotalCount: electricMeters.length, elecActiveCount: electricMeters.filter((m: any) => Number(m?.consumption || 0) > 0).length };
    });
  }, [rawParksElec, selectedParkIds, parkAveragesMap, meterMonthlyConsumptions, currentMonthKey]);

  const processedWaterData = useMemo(() => {
    if (!Array.isArray(rawParksWater)) return [];
    return rawParksWater.filter((park: any) => park && selectedParkIds.includes(park.id)).map((park: any) => {
      const meters = park?.meters || [];
      return { ...park, meters, waterDaily: meters.reduce((sum: number, m: any) => sum + Number(m?.consumption || 0), 0), waterTotal: meters.reduce((sum: number, m: any) => sum + Number(m?.totalConsumption || 0), 0), activeCount: meters.filter((m: any) => Number(m?.consumption || 0) > 0).length, totalCount: meters.length };
    });
  }, [rawParksWater, selectedParkIds]);

  const processedSolarData = useMemo(() => {
    if (!Array.isArray(rawParksSolar)) return [];
    return rawParksSolar.filter((park: any) => park && selectedParkIds.includes(park.id)).map((park: any) => {
      const inverters = park?.inverters || [];
      return { ...park, inverters, solarDaily: inverters.reduce((sum: number, i: any) => sum + Number(i?.yield || 0), 0), solarTotal: inverters.reduce((sum: number, i: any) => sum + Number(i?.totalYield || 0), 0), activeCount: inverters.filter((i: any) => Number(i?.yield || 0) > 0).length, totalCount: inverters.length };
    });
  }, [rawParksSolar, selectedParkIds]);

  const processedKiosksData = useMemo(() => {
    if (!Array.isArray(rawParksKiosks)) return [];
    return rawParksKiosks.filter((park: any) => park && selectedParkIds.includes(park.id)).map((park: any) => {
      const list = park?.kiosks || [];
      const kiosksDaily = list.reduce((sum: number, k: any) => sum + Number(k?.consumption || 0), 0);
      const kiosksTotal = list.reduce((sum: number, k: any) => {
        const kioskMap = kioskMonthlyConsumptions.get(k?.id);
        return sum + (kioskMap ? (kioskMap[currentMonthKey] ?? 0) : Number(k?.totalConsumption || 0));
      }, 0);
      return { ...park, kiosks: list, kiosksDaily, kiosksTotal, activeCount: list.filter((k: any) => Number(k?.consumption || 0) > 0).length, totalCount: list.length };
    });
  }, [rawParksKiosks, selectedParkIds, kioskMonthlyConsumptions, currentMonthKey]);

  const currentItemsList = useMemo(() => {
    let list: any[] = [];
    if (activeTab === "electric") processedElecData.forEach(p => p.electricMeters.forEach((m: any) => list.push({ id: m.id, name: `${p.name} - ${getDeviceName(m)}` })));
    else if (activeTab === "water") processedWaterData.forEach(p => p.meters.forEach((m: any) => list.push({ id: m.id, name: `${p.name} - ${getDeviceName(m)}` })));
    else if (activeTab === "solar") processedSolarData.forEach(p => p.inverters.forEach((i: any) => list.push({ id: i.id, name: `${p.name} - ${getDeviceName(i)}` })));
    else if (activeTab === "kiosks") processedKiosksData.forEach(p => p.kiosks.forEach((k: any) => list.push({ id: k.id, name: `${p.name} - ${getDeviceName(k)}` })));
    return list;
  }, [activeTab, processedElecData, processedWaterData, processedSolarData, processedKiosksData]);

  const handleCustomExport = async () => {
    setIsExporting(false);
    setIsExportModalOpen(false);
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="bg-slate-100 p-4 rounded-lg flex justify-between items-center border">
        <div>
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Technology Park</span>
          <h1 className="text-xl font-bold text-slate-800">{parkNames.length > 0 ? parkNames.join(", ") : "No Parks Assigned"}</h1>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-gray-500 ml-1">فلتر مناطق المخططات:</span>
        {currentRawParks.map((p: any) => {
          if (!p) return null;
          const isSelected = selectedParkIds.includes(p.id);
          return (
            <button key={p.id} onClick={() => setSelectedParkIds(prev => isSelected ? prev.filter(i => i !== p.id) : [...prev, p.id])} className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${isSelected ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-gray-200 text-gray-500'}`}>
              {p.name}
            </button>
          );
        })}
      </div>

      <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-2 shadow-inner">
        <button onClick={() => { setActiveTab("electric"); setSelectedParkIds(rawParksElec.map((p: any) => p?.id).filter(Boolean)); }} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === "electric" ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}>⚡ استهلاك الكهرباء</button>
        <button onClick={() => { setActiveTab("water"); setSelectedParkIds(rawParksWater.map((p: any) => p?.id).filter(Boolean)); }} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === "water" ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}>💧 استهلاك المياه</button>
        <button onClick={() => { setActiveTab("solar"); setSelectedParkIds(rawParksSolar.map((p: any) => p?.id).filter(Boolean)); }} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === "solar" ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}>☀️ الطاقة الشمسية</button>
        <button onClick={() => { setActiveTab("kiosks"); setSelectedParkIds(rawParksKiosks.map((p: any) => p?.id).filter(Boolean)); }} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === "kiosks" ? 'bg-amber-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}>🏪 الأكشاك (Kiosks)</button>
      </div>

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

      {activeTab === "electric" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {processedElecData.map((park: any) => (
            <div key={park.id} className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="font-bold text-lg text-gray-800">{park.name}</h3>
                <span className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg font-bold">{park.elecActiveCount} / {park.elecTotalCount} عداد</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="bg-gray-50 p-2.5 rounded-xl"><span className="text-gray-500 block mb-0.5">الاستهلاك اليومي</span><span className="font-bold text-gray-800">{Math.round(park.elecDaily || 0).toLocaleString()} kWh</span></div>
                <div className="bg-gray-50 p-2.5 rounded-xl"><span className="text-gray-500 block mb-0.5">إجمالي الشهر</span><span className="font-bold text-gray-800">{Math.round(park.elecTotalConsumption || 0).toLocaleString()} kWh</span></div>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {Array.isArray(park.electricMeters) && park.electricMeters.map((m: any) => (
                  <div key={m.id} className="flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 text-xs">
                    <span className="font-medium text-gray-700">{getDeviceName(m)} ({getDeviceCode(m)})</span>
                    <span className="font-bold text-blue-600">{Math.round(Number(m.consumption || 0)).toLocaleString()} kWh</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "water" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {processedWaterData.map((park: any) => (
            <div key={park.id} className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 space-y-4">
              <div className="flex justify-between items-center border-b pb-3"><h3 className="font-bold text-lg text-gray-800">{park.name}</h3></div>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {Array.isArray(park.meters) && park.meters.map((m: any) => (
                  <div key={m.id} className="flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 text-xs">
                    <span className="font-medium text-gray-700">{getDeviceName(m)}</span>
                    <span className="font-bold text-blue-600">{Math.round(Number(m.consumption || 0)).toLocaleString()} m³</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "solar" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {processedSolarData.map((park: any) => (
            <div key={park.id} className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 space-y-4">
              <div className="flex justify-between items-center border-b pb-3"><h3 className="font-bold text-lg text-gray-800">{park.name}</h3></div>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {Array.isArray(park.inverters) && park.inverters.map((i: any) => (
                  <div key={i.id} className="flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 text-xs">
                    <span className="font-medium text-gray-700">{getDeviceName(i)}</span>
                    <span className="font-bold text-emerald-600">{Math.round(Number(i.yield || 0)).toLocaleString()} kWh</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
