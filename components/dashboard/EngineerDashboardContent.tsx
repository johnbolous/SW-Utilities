"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, Sun, Droplet, Building2, Layers, AlertTriangle, ArrowUpRight, CheckCircle2, Clock } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { Card } from "@/components/ui/primitives";
import { useThemeLang } from "@/components/layout/ThemeLangProvider";

interface DashboardData {
  parks: string[];
  overview: {
    todayElec: number;
    monthElec: number;
    todaySolar: number;
    monthSolar: number;
    todayWater: number;
    monthWater: number;
  };
  structure: {
    buildings: number;
    floors: number;
    electricMeters: number;
    waterMeters: number;
    solarInverters: number;
  };
  charts: {
    elecByBuilding: Array<{ name: string; value: number }>;
    elecHistory: Array<{ date: string; consumption: number }>;
    solarByBuilding: Array<{ name: string; value: number }>;
    solarHistory: Array<{ date: string; yield: number }>;
    waterByBuilding: Array<{ name: string; value: number }>;
    waterHistory: Array<{ date: string; consumption: number }>;
  };
  readingStatus: {
    total: number;
    readToday: number;
    pending: number;
  };
  alerts: {
    spike: number;
    lowerThanPrev: number;
    zeroConsumption: number;
    missingReading: number;
  };
}

export function EngineerDashboardContent() {
  const { lang } = useThemeLang();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
    fetch(`/api/dashboard/engineer?t=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-brand-gray">Loading Dashboard Analytics...</div>;
  }

  if (!data) {
    return <div className="p-8 text-center text-danger">Failed to load dashboard data.</div>;
  }

  const completionRate = data.readingStatus.total > 0
    ? Math.round((data.readingStatus.readToday / data.readingStatus.total) * 100)
    : 0;

  return (
    <div className="space-y-8">
      {/* HEADER: Technology Parks Access */}
      <div className="bg-surface-soft border border-border rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="text-xs font-semibold text-brand-gray uppercase tracking-wider mb-1">
            {data.parks.length > 1 ? "Technology Parks" : "Technology Park"}
          </div>
          {data.parks.length <= 1 ? (
            <div className="text-xl font-display font-bold text-brand-navy">
              {data.parks[0] ?? "No Parks Assigned"}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 mt-1">
              {data.parks.map((p) => (
                <span key={p} className="bg-surface px-3 py-1 rounded-md text-sm font-medium border border-border">
                  • {p}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-xs text-brand-gray bg-surface px-3 py-1.5 rounded-lg border border-border">
          Authorized Scope Only
        </div>
      </div>

      {/* SECTION 1: Engineer Overview (KPI Cards) */}
      <div>
        <h2 className="text-lg font-display font-bold mb-3 flex items-center gap-2">
          <Zap className="text-brand-navy" size={20} /> Engineer Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="p-4 border-l-4 border-l-amber-500">
            <div className="flex justify-between items-start text-xs text-brand-gray font-medium">
              <span>Today's Electricity</span>
              <Zap size={16} className="text-amber-500" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold">{data.overview.todayElec.toLocaleString()} <span className="text-xs font-sans font-normal text-brand-gray">kWh</span></div>
            <div className="mt-1 text-xs text-brand-gray">This Month: <span className="font-mono font-semibold">{data.overview.monthElec.toLocaleString()} kWh</span></div>
          </Card>

          <Card className="p-4 border-l-4 border-l-emerald-500">
            <div className="flex justify-between items-start text-xs text-brand-gray font-medium">
              <span>Today's Solar Yield</span>
              <Sun size={16} className="text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold">{data.overview.todaySolar.toLocaleString()} <span className="text-xs font-sans font-normal text-brand-gray">kWh</span></div>
            <div className="mt-1 text-xs text-brand-gray">This Month: <span className="font-mono font-semibold">{data.overview.monthSolar.toLocaleString()} kWh</span></div>
          </Card>

          <Card className="p-4 border-l-4 border-l-blue-500">
            <div className="flex justify-between items-start text-xs text-brand-gray font-medium">
              <span>Today's Water Usage</span>
              <Droplet size={16} className="text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-mono font-bold">{data.overview.todayWater.toLocaleString()} <span className="text-xs font-sans font-normal text-brand-gray">m³</span></div>
            <div className="mt-1 text-xs text-brand-gray">This Month: <span className="font-mono font-semibold">{data.overview.monthWater.toLocaleString()} m³</span></div>
          </Card>
        </div>
      </div>

      {/* SECTION 2: Meter Structure */}
      <div>
        <h2 className="text-lg font-display font-bold mb-3 flex items-center gap-2">
          <Building2 className="text-brand-navy" size={20} /> Infrastructure Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card className="p-3 text-center">
            <div className="text-xs text-brand-gray">Buildings</div>
            <div className="text-xl font-bold font-mono mt-1">{data.structure.buildings}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-xs text-brand-gray">Floors</div>
            <div className="text-xl font-bold font-mono mt-1">{data.structure.floors}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-xs text-brand-gray">Electric Meters</div>
            <div className="text-xl font-bold font-mono mt-1">{data.structure.electricMeters}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-xs text-brand-gray">Water Meters</div>
            <div className="text-xl font-bold font-mono mt-1">{data.structure.waterMeters}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-xs text-brand-gray">Solar Inverters</div>
            <div className="text-xl font-bold font-mono mt-1">{data.structure.solarInverters}</div>
          </Card>
        </div>
      </div>

      {/* SECTION 3: Electricity Dashboard */}
      <div>
        <h2 className="text-lg font-display font-bold mb-3">Electricity Analytics</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-4">Consumption by Building (Today - kWh)</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.elecByBuilding}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-semibold mb-4">Electricity Consumption — Last 30 Days</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.charts.elecHistory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="consumption" stroke="#d97706" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      {/* SECTION 4: Solar Dashboard */}
      <div>
        <h2 className="text-lg font-display font-bold mb-3">Solar Energy Analytics</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-4">Solar Production by Building (Today - kWh)</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.solarByBuilding}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#059669" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-semibold mb-4">Solar Production — Last 30 Days</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.charts.solarHistory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="yield" stroke="#059669" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      {/* SECTION 5: Water Dashboard */}
      <div>
        <h2 className="text-lg font-display font-bold mb-3">Water Analytics</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-4">
            <div className="text-sm font-semibold mb-4">Water Consumption by Building (Today - m³)</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.waterByBuilding}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-4">
            <div className="text-sm font-semibold mb-4">Water Consumption — Last 30 Days</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.charts.waterHistory}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="consumption" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>

      {/* SECTION 6 & 7: Reading Status & Alerts Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 6: Reading Status */}
        <div>
          <h2 className="text-lg font-display font-bold mb-3">Daily Reading Progress</h2>
          <Card className="p-5 flex flex-col justify-between h-full">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-brand-gray">Completion Status</span>
                <span className="text-lg font-mono font-bold text-brand-navy">{completionRate}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-surface-soft rounded-full h-3 overflow-hidden border border-border">
                <div
                  className="bg-brand-navy h-full transition-all duration-500 rounded-full"
                  style={{ width: `${completionRate}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div className="bg-surface-soft p-3 rounded-lg border border-border">
                  <div className="text-xs text-brand-gray flex items-center justify-center gap-1">
                    <Layers size={14} /> Total
                  </div>
                  <div className="text-lg font-mono font-bold mt-1">{data.readingStatus.total}</div>
                </div>
                <div className="bg-emerald-50 text-emerald-900 p-3 rounded-lg border border-emerald-200">
                  <div className="text-xs flex items-center justify-center gap-1">
                    <CheckCircle2 size={14} /> Read
                  </div>
                  <div className="text-lg font-mono font-bold mt-1">{data.readingStatus.readToday}</div>
                </div>
                <div className="bg-amber-50 text-amber-900 p-3 rounded-lg border border-amber-200">
                  <div className="text-xs flex items-center justify-center gap-1">
                    <Clock size={14} /> Pending
                  </div>
                  <div className="text-lg font-mono font-bold mt-1">{data.readingStatus.pending}</div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* SECTION 7: Alerts */}
        <div>
          <h2 className="text-lg font-display font-bold mb-3 flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={20} /> System Alerts
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href="/desk/audit" className="block">
              <Card className="p-4 hover:border-brand-navy transition cursor-pointer">
                <div className="text-xs text-brand-gray">Spike &gt;20%</div>
                <div className="text-2xl font-mono font-bold mt-1 text-amber-600">{data.alerts.spike}</div>
                <div className="text-xs text-brand-gray mt-2 flex items-center gap-1">
                  View Details <ArrowUpRight size={12} />
                </div>
              </Card>
            </Link>

            <Link href="/desk/audit" className="block">
              <Card className="p-4 hover:border-brand-navy transition cursor-pointer">
                <div className="text-xs text-brand-gray">Lower Than Prev</div>
                <div className="text-2xl font-mono font-bold mt-1 text-danger">{data.alerts.lowerThanPrev}</div>
                <div className="text-xs text-brand-gray mt-2 flex items-center gap-1">
                  View Details <ArrowUpRight size={12} />
                </div>
              </Card>
            </Link>

            <Link href="/desk/audit" className="block">
              <Card className="p-4 hover:border-brand-navy transition cursor-pointer">
                <div className="text-xs text-brand-gray">Zero Consumption</div>
                <div className="text-2xl font-mono font-bold mt-1 text-amber-600">{data.alerts.zeroConsumption}</div>
                <div className="text-xs text-brand-gray mt-2 flex items-center gap-1">
                  View Details <ArrowUpRight size={12} />
                </div>
              </Card>
            </Link>

            <Link href="/desk/audit" className="block">
              <Card className="p-4 hover:border-brand-navy transition cursor-pointer">
                <div className="text-xs text-brand-gray">Missing Readings</div>
                <div className="text-2xl font-mono font-bold mt-1 text-brand-navy">{data.alerts.missingReading}</div>
                <div className="text-xs text-brand-gray mt-2 flex items-center gap-1">
                  View Details <ArrowUpRight size={12} />
                </div>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}