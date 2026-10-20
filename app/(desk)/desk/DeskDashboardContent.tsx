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

export default function DeskDashboardContent({ data }: { data: any }) {
  const [activeTab, setActiveTab] = useState<"electric" | "water" | "solar">("electric");

  const parkNames = data?.parkNames || [];
  const summary = data?.summary || {};
  const rawParksElec = data?.parksDailyElec || [];
  const rawParksWater = data?.parksWaterData || [];
  const rawParksSolar = data?.parksSolarData || [];

  const currentRawParks = activeTab === "electric" ? rawParksElec : activeTab === "water" ? rawParksWater : rawParksSolar;

  const [selectedCategory, setSelectedCategory] = useState("MEDIUM");
  
  const [selectedParkIds, setSelectedParkIds] = useState<string[]>(() => {
    return rawParksElec && rawParksElec.length > 0 ? rawParksElec.map((p: any) => p.id) : [];
  });

  useEffect(() => {
    if (currentRawParks && currentRawParks.length > 0) {
      const newIds = currentRawParks.map((p: any) => p.id);
      setSelectedParkIds(newIds);
    }
  }, [activeTab, data]);

  const todayStr = new Date().toISOString().split("T")[0];
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

  // Helper for local date string YYYY-MM-DD
  const getLocalDateStr = (timestamp: string) => {
    const d = new Date(timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

        // Convert local filter dates to precise UTC ISO strings to prevent timezone shifts
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
          const pId = row.park_id;
          const rawTimestamp = row.reading_timestamp;
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

          const val = Number(row.max_demand_mva || row.max_demand || 0);

          if (!dateMap.has(keyStr)) {
            dateMap.set(keyStr, { date: keyStr });
          }
          const entry = dateMap.get(keyStr);
          if (!entry[pId] || val > entry[pId]) {
            entry[pId] = Math.round(val * 1000) / 1000;
          }
        });

        const formatted = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
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

        rawParksElec.forEach((park: any) => {
          if (selectedParkIds.includes(park.id)) {
            (park.meters || []).forEach((m: any) => {
              const cat = String(m.category || "").trim().toUpperCase();
              if (m.id && (cat === "MEDIUM" || cat === "MED" || cat.includes("MEDIUM") || !cat)) {
                meterIds.push(m.id);
                meterToParkMap.set(m.id, park.id);
              }
            });
          }
        });

        if (meterIds.length === 0) {
          rawParksElec.forEach((park: any) => {
            if (selectedParkIds.includes(park.id)) {
              (park.meters || []).forEach((m: any) => {
                if (m.id) {
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

        if (error) {
          setConsumptionChartData([]);
          setIsConsumptionLoading(false);
          return;
        }

        if (!readings || readings.length === 0) {
          setConsumptionChartData([]);
          setIsConsumptionLoading(false);
          return;
        }

        const dateParkMap = new Map<string, any>();

        readings.forEach((row: any) => {
          const mId = row.meter_id;
          const pId = meterToParkMap.get(mId);
          const rawDate = row.reading_date || row.timestamp || row.created_at || row.date;
          if (!pId || !rawDate) return;

          const keyStr = getLocalDateStr(rawDate);

          if (keyStr < consumptionStartDate || keyStr > consumptionEndDate) return;

          const val = Number(row.consumption ?? row.current_value ?? row.reading ?? row.reading_value ?? 0);

          if (!dateParkMap.has(keyStr)) {
            dateParkMap.set(keyStr, { date: keyStr });
          }
          const entry = dateParkMap.get(keyStr);
          entry[pId] = (entry[pId] || 0) + val;
        });

        const formatted = Array.from(dateParkMap.values()).sort((a, b) => a.date.localeCompare(b.date));
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
    distributorRows.forEach((row: any) => {
      const pId = row.park_id;
      const rawTimestamp = row.reading_timestamp;
      if (!pId || !rawTimestamp) return;
      
      const dStr = getLocalDateStr(rawTimestamp);
      const val = Number(row.max_demand_mva || row.max_demand || 0);

      const key = `${pId}_${dStr}`;
      if (!dailyParkMaxMap.has(key)) {
        dailyParkMaxMap.set(key, val);
      } else {
        dailyParkMaxMap.set(key, Math.max(dailyParkMaxMap.get(key), val));
      }
    });

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
    distributorRows.forEach((row: any) => {
      const pId = row.park_id;
      const val = Number(row.max_demand_mva || row.max_demand || 0);
      const timestamp = row.reading_timestamp;
      
      if (!map.has(pId) || new Date(timestamp).getTime() > new Date(map.get(pId).timestamp).getTime()) {
        map.set(pId, { val, timestamp });
      }
    });
    return map;
  }, [distributorRows]);

  const { todayMediumElec, monthMediumElec, mediumMaxDemand } = useMemo(() => {
    let daily = 0;
    let monthly = 0;
    let maxDem = 0;
    
    rawParksElec.forEach((park: any) => {
      (park.meters || []).forEach((m: any) => {
        const cat = String(m.category || "").trim().toUpperCase();
        if (cat === "MEDIUM" || cat === "MED" || cat.includes("MEDIUM")) {
          daily += Number(m.consumption || 0);
          monthly += Number(m.totalConsumption || 0);
        }
      });
    });

    if (parkAveragesMap.size > 0) {
      let sum = 0;
      parkAveragesMap.forEach((avg) => { sum += avg; });
      maxDem = sum / parkAveragesMap.size;
    }

    return { todayMediumElec: daily, monthMediumElec: monthly, mediumMaxDemand: maxDem };
  }, [rawParksElec, parkAveragesMap]);

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

  const processedElecData = useMemo(() => {
    return rawParksElec
      .filter((park: any) => selectedParkIds.includes(park.id))
      .map((park: any) => {
        const allMeters = park.meters || [];
        const electricMeters = allMeters.filter((m: any) => {
          const cat = String(m.category || "").trim().toUpperCase();
          if (selectedCategory.toUpperCase() === "MEDIUM") {
            return cat === "MEDIUM" || cat === "MED" || cat.includes("MEDIUM") || !cat;
          }
          return cat === selectedCategory.toUpperCase();
        });
        const elecDaily = electricMeters.reduce((sum: number, m: any) => sum + Number(m.consumption || 0), 0);
        const elecTotalConsumption = electricMeters.reduce((sum: number, m: any) => sum + Number(m.totalConsumption || 0), 0);
        const parkAvgMaxDemand = parkAveragesMap.get(park.id) || 0;

        return {
          ...park,
          electricMeters,
          elecDaily,
          elecTotalConsumption,
          elecMaxDemand: parkAvgMaxDemand,
          elecTotalCount: electricMeters.length,
          elecActiveCount: electricMeters.filter((m: any) => Number(m.consumption || 0) > 0).length,
        };
      });
  }, [rawParksElec, selectedParkIds, selectedCategory, parkAveragesMap]);

  const processedWaterData = useMemo(() => {
    return rawParksWater
      .filter((park: any) => selectedParkIds.includes(park.id))
      .map((park: any) => {
        const meters = park.meters || [];
        return {
          ...park,
          meters,
          waterDaily: meters.reduce((sum: number, m: any) => sum + Number(m.consumption || 0), 0),
          waterTotal: meters.reduce((sum: number, m: any) => sum + Number(m.totalConsumption || 0), 0),
          activeCount: meters.filter((m: any) => Number(m.consumption || 0) > 0).length,
          totalCount: meters.length,
        };
      });
  }, [rawParksWater, selectedParkIds]);

  const processedSolarData = useMemo(() => {
    return rawParksSolar
      .filter((park: any) => selectedParkIds.includes(park.id))
      .map((park: any) => {
        const inverters = park.inverters || [];
        return {
          ...park,
          inverters,
          solarDaily: inverters.reduce((sum: number, i: any) => sum + Number(i.yield || 0), 0),
          solarTotal: inverters.reduce((sum: number, i: any) => sum + Number(i.totalYield || 0), 0),
          activeCount: inverters.filter((i: any) => Number(i.yield || 0) > 0).length,
          totalCount: inverters.length,
        };
      });
  }, [rawParksSolar, selectedParkIds]);

  const currentItemsList = useMemo(() => {
    let list: any[] = [];
    if (activeTab === "electric") {
      processedElecData.forEach((park: any) => {
        park.electricMeters.forEach((m: any) => {
          list.push({ id: m.id, name: `${park.name} - ${getDeviceName(m)} (${getDeviceCode(m)})` });
        });
      });
    } else if (activeTab === "water") {
      processedWaterData.forEach((park: any) => {
        park.meters.forEach((m: any) => {
          list.push({ id: m.id, name: `${park.name} - ${getDeviceName(m)} (${getDeviceCode(m)})` });
        });
      });
    } else if (activeTab === "solar") {
      processedSolarData.forEach((park: any) => {
        park.inverters.forEach((i: any) => {
          list.push({ id: i.id, name: `${park.name} - ${getDeviceName(i)} (${getDeviceCode(i)})` });
        });
      });
    }
    return list;
  }, [activeTab, processedElecData, processedWaterData, processedSolarData]);

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
      alert("خطأ: تأكد من وجود متغيرات البيئة في ملف .env.local");
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
          const mId = row[meterIdField];
          const rawDate = row.reading_date || row.timestamp || row.created_at || row.date;
          if (!rawDate) return;
          const dStr = getLocalDateStr(rawDate);

          if (dStr < exportStartDate || dStr > exportEndDate) return;

          let val = null;
          if (activeTab === "electric" || activeTab === "water") {
            val = row.current_value ?? row.reading ?? row.reading_value ?? row.consumption ?? null;
          } else if (activeTab === "solar") {
            val = row.value ?? row.yield ?? null;
          }

          readingsMap.set(`${mId}_${dStr}`, val);
        });
      }

      let csvContent = "\uFEFF";
      let filename = `Readings_History_${activeTab}_${exportStartDate}_to_${exportEndDate}.csv`;
      csvContent += "المنطقة,اسم الجهاز,الكود,التاريخ,القراءة المدخلة,الحالة\n";

      const dateRange = getDatesInRange(exportStartDate, exportEndDate);

      const processCsvRows = (items: any[], isSolar = false) => {
        items.forEach((park: any) => {
          const entityList = isSolar ? park.inverters : (park.electricMeters || park.meters || []);
          entityList.forEach((item: any) => {
            const itemId = item.id;
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

                csvContent += `"${park.name}","${deviceName}","${deviceCode}","${dateStr}",${valCol === "لم يتم ادخال قراءة" ? `"${valCol}"` : valCol},"${statusCol}"\n`;
              });
            }
          });
        });
      };

      if (activeTab === "electric") {
        processCsvRows(processedElecData);
      } else if (activeTab === "water") {
        processCsvRows(processedWaterData);
      } else if (activeTab === "solar") {
        processCsvRows(processedSolarData, true);
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
      <div className="bg-slate-100 p-4 rounded-lg flex justify-between items-center border" dir="ltr">
        <div className="text-left">
          <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">
            Technology Park
          </span>
          <h1 className="text-xl font-bold text-slate-800">
            {parkNames.length > 0 ? parkNames.join(", ") : "No Parks Assigned"}
          </h1>
        </div>
        <span className="text-xs text-slate-500 bg-white px-3 py-1 rounded border shadow-sm font-medium">
          Authorized Scope Only
        </span>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-gray-500 ml-1">فلتر مناطق المخططات:</span>
        {currentRawParks.map((p: any) => {
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

          <div className="pt-3 border-t border-slate-800 text-center">
            <span className="text-[11px] text-slate-400 font-medium block">
              تحديث مباشر للأحمال القصوى
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-md border border-gray-100 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-3 gap-2">
            <div>
              <h3 className="font-bold text-sm text-gray-800">الأحمال الكهربائية القصوى (Max Demand)</h3>
              <p className="text-[11px] text-gray-400 mt-0.5">وحدة القياس: MVA لكل منطقة</p>
            </div>
            
            <div className="flex items-center bg-gray-100 p-1 rounded-xl gap-1 text-[10px] font-bold">
              <button 
                onClick={() => handleDemandTimeFrameChange("year")}
                className={`px-2 py-1 rounded-lg transition-all ${demandTimeFrame === "year" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                سنة
              </button>
              <button 
                onClick={() => handleDemandTimeFrameChange("month")}
                className={`px-2 py-1 rounded-lg transition-all ${demandTimeFrame === "month" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                شهر
              </button>
              <button 
                onClick={() => handleDemandTimeFrameChange("week")}
                className={`px-2 py-1 rounded-lg transition-all ${demandTimeFrame === "week" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                أسبوع
              </button>
              <button 
                onClick={() => handleDemandTimeFrameChange("day")}
                className={`px-2 py-1 rounded-lg transition-all ${demandTimeFrame === "day" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                يوم
              </button>
            </div>
          </div>

          <div className="h-72 w-full relative">
            {isChartLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-gray-500 font-bold z-10">
                جاري التحميل...
              </div>
            ) : chartData.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 z-10">
                لا توجد بيانات متاحة
              </div>
            ) : null}

            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                {currentRawParks.map((park: any, idx: number) => {
                  if (!selectedParkIds.includes(park.id)) return null;
                  const color = parkColors[idx % parkColors.length];
                  return (
                    <Line 
                      key={park.id}
                      type="monotone" 
                      dataKey={park.id} 
                      name={park.name}
                      stroke={color} 
                      strokeWidth={2} 
                      dot={false}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
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
              <button 
                onClick={() => handleConsumptionTimeFrameChange("year")}
                className={`px-2 py-1 rounded-lg transition-all ${consumptionTimeFrame === "year" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                سنة
              </button>
              <button 
                onClick={() => handleConsumptionTimeFrameChange("month")}
                className={`px-2 py-1 rounded-lg transition-all ${consumptionTimeFrame === "month" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                شهر
              </button>
              <button 
                onClick={() => handleConsumptionTimeFrameChange("week")}
                className={`px-2 py-1 rounded-lg transition-all ${consumptionTimeFrame === "week" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                أسبوع
              </button>
              <button 
                onClick={() => handleConsumptionTimeFrameChange("day")}
                className={`px-2 py-1 rounded-lg transition-all ${consumptionTimeFrame === "day" ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                يوم
              </button>
            </div>
          </div>

          <div className="h-72 w-full relative">
            {isConsumptionLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-gray-500 font-bold z-10">
                جاري التحميل...
              </div>
            ) : consumptionChartData.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-400 z-10">
                لا توجد بيانات استهلاك متاحة
              </div>
            ) : null}

            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={consumptionChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '5px' }} />
                {currentRawParks.map((park: any, idx: number) => {
                  if (!selectedParkIds.includes(park.id)) return null;
                  const color = parkColors[idx % parkColors.length];
                  return (
                    <Line 
                      key={park.id}
                      type="monotone" 
                      dataKey={park.id} 
                      name={park.name}
                      stroke={color} 
                      strokeWidth={2} 
                      dot={false}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
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
                {Math.round(summary.todaySolar || 0).toLocaleString()} 
                <span className="text-xs font-normal text-gray-500"> kWh</span>
              </span>
            </div>
            <div className="mt-4 pt-3 border-t text-xs text-gray-500 font-medium">
              This Month: <span className="font-bold text-gray-800">{Math.round(summary.monthSolar || 0).toLocaleString()} kWh</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-l-4 border-l-blue-500 border-gray-100 flex flex-col justify-between">
            <div>
              <span className="text-xs text-gray-500 font-bold block mb-1">Today's Water Usage</span>
              <span className="text-2xl font-black text-gray-900">
                {Math.round(summary.todayWater || 0).toLocaleString()} 
                <span className="text-xs font-normal text-gray-500"> m³</span>
              </span>
            </div>
            <div className="mt-4 pt-3 border-t text-xs text-gray-500 font-medium">
              This Month: <span className="font-bold text-gray-800">{Math.round(summary.monthWater || 0).toLocaleString()} m³</span>
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
            <span className="text-2xl font-black text-gray-800">{summary.buildingsCount || 0}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
            <span className="text-xs text-gray-500 font-bold block mb-1">Floors</span>
            <span className="text-2xl font-black text-gray-800">{summary.floorCount || 0}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
            <span className="text-xs text-gray-500 font-bold block mb-1">Electric Meters</span>
            <span className="text-2xl font-black text-gray-800">{summary.electricMetersCount || 0}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
            <span className="text-xs text-gray-500 font-bold block mb-1">Water Meters</span>
            <span className="text-2xl font-black text-gray-800">{summary.waterMetersCount || 0}</span>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
            <span className="text-xs text-gray-500 font-bold block mb-1">Solar Inverters</span>
            <span className="text-2xl font-black text-gray-800">{summary.solarInvertersCount || 0}</span>
          </div>
        </div>
      </div>

      <div className="flex bg-gray-100 p-1.5 rounded-2xl gap-2 shadow-inner">
        <button
          onClick={() => { setActiveTab("electric"); setSelectedParkIds(rawParksElec.map((p: any) => p.id)); setSelectedMeterIdsForExport([]); }}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === "electric" ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
        >
          ⚡ استهلاك الكهرباء (Electricity)
        </button>
        <button
          onClick={() => { setActiveTab("water"); setSelectedParkIds(rawParksWater.map((p: any) => p.id)); setSelectedMeterIdsForExport([]); }}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === "water" ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
        >
          💧 استهلاك المياه (Water)
        </button>
        <button
          onClick={() => { setActiveTab("solar"); setSelectedParkIds(rawParksSolar.map((p: any) => p.id)); setSelectedMeterIdsForExport([]); }}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${activeTab === "solar" ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200'}`}
        >
          ☀️ الطاقة الشمسية (Solar Energy)
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
                <input 
                  type="date" 
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="w-full border p-2 rounded-xl text-xs bg-gray-50 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">إلى تاريخ:</label>
                <input 
                  type="date" 
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="w-full border p-2 rounded-xl text-xs bg-gray-50 outline-none"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-bold text-gray-600">اختر العناصر:</label>
                <button 
                  onClick={() => setSelectedMeterIdsForExport(currentItemsList.map(i => i.id))}
                  className="text-[11px] text-blue-600 font-bold hover:underline"
                >
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
              <button 
                onClick={() => setIsExportModalOpen(false)} 
                disabled={isExporting}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl"
              >
                إلغاء
              </button>
              <button 
                onClick={handleCustomExport} 
                disabled={isExporting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow flex items-center gap-2"
              >
                {isExporting ? "جاري التصدير..." : "تحميل ملف الـ CSV"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "electric" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {processedElecData.map((park: any) => (
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
                {park.electricMeters.map((m: any) => (
                  <div key={m.id} className="flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 text-xs">
                    <span className="font-medium text-gray-700">{getDeviceName(m)} ({getDeviceCode(m)})</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-600">{Math.round(Number(m.consumption || 0)).toLocaleString()} kWh</span>
                      <span className={`w-2 h-2 rounded-full ${Number(m.consumption || 0) > 0 ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                    </div>
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
                {park.meters.map((m: any) => (
                  <div key={m.id} className="flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 text-xs">
                    <span className="font-medium text-gray-700">{getDeviceName(m)} ({getDeviceCode(m)})</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-blue-600">{Math.round(Number(m.consumption || 0)).toLocaleString()} m³</span>
                      <span className={`w-2 h-2 rounded-full ${Number(m.consumption || 0) > 0 ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                    </div>
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
                {park.inverters.map((i: any) => (
                  <div key={i.id} className="flex justify-between items-center bg-gray-50/50 p-2.5 rounded-xl border border-gray-100 text-xs">
                    <span className="font-medium text-gray-700">{getDeviceName(i)} ({getDeviceCode(i)})</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-600">{Math.round(Number(i.yield || 0)).toLocaleString()} kWh</span>
                      <span className={`w-2 h-2 rounded-full ${Number(i.yield || 0) > 0 ? 'bg-emerald-500' : 'bg-gray-300'}`}></span>
                    </div>
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
