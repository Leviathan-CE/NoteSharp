import React, { useEffect, useState } from "react";
import {
  Activity,
  Cpu,
  HardDrive,
  Zap,
  Database,
  Globe,
  Clock,
  RefreshCw,
} from "lucide-react";
import AdminLayout from "../../components/admin/AdminLayout";
import { getSystemMetrics } from "../../services/api";
import { getStoredAuthToken } from "../../utils/auth";
import { formatTimestamp, type TimestampValue } from "../../utils/dates";

interface MetricResponse {
  cpuUsage?: number;
  memoryUsage?: number;
  diskIo?: number;
  networkTraffic?: number;
  responseTime?: number;
  updatedAt?: TimestampValue;
  systemInfo?: Array<{
    component: string;
    status: string;
    utilization: number;
    details: string;
  }>;
  processes?: Array<{
    name: string;
    cpu: number;
    memory: number;
    requests: number;
  }>;
}

const DEFAULT_METRICS: MetricResponse = {
  cpuUsage: 45,
  memoryUsage: 63,
  diskIo: 25,
  networkTraffic: 150,
  responseTime: 210,
  systemInfo: [],
  processes: [],
};

const normalizeMetrics = (raw?: MetricResponse): MetricResponse => ({
  cpuUsage: typeof raw?.cpuUsage === "number" ? raw.cpuUsage : DEFAULT_METRICS.cpuUsage,
  memoryUsage: typeof raw?.memoryUsage === "number" ? raw.memoryUsage : DEFAULT_METRICS.memoryUsage,
  diskIo: typeof raw?.diskIo === "number" ? raw.diskIo : DEFAULT_METRICS.diskIo,
  networkTraffic: typeof raw?.networkTraffic === "number" ? raw.networkTraffic : DEFAULT_METRICS.networkTraffic,
  responseTime: typeof raw?.responseTime === "number" ? raw.responseTime : DEFAULT_METRICS.responseTime,
  updatedAt: raw?.updatedAt,
  systemInfo: Array.isArray(raw?.systemInfo) ? raw.systemInfo : [],
  processes: Array.isArray(raw?.processes) ? raw.processes : [],
});

const SystemPerformance: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricResponse>(DEFAULT_METRICS);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const fetchMetrics = async () => {
      const token = getStoredAuthToken();
      if (!token) {
        setError("Missing authentication token. Please log in again.");
        setLoading(false);
        return;
      }

      try {
        const response = await getSystemMetrics(token);
        const normalized = normalizeMetrics(response.metrics);
        setMetrics(normalized);
        setLastUpdated(formatTimestamp(normalized.updatedAt ?? null, ""));
        setError("");
      } catch (err: any) {
        console.error("Failed to load system metrics:", err);
        setError(err.message || "Failed to load system metrics. Showing defaults.");
        setMetrics(DEFAULT_METRICS);
        setLastUpdated("");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  const cardMetrics = [
    { label: "CPU Usage", value: metrics.cpuUsage ?? 0, unit: "%", color: "text-blue-600" },
    { label: "Memory Usage", value: metrics.memoryUsage ?? 0, unit: "%", color: "text-purple-600" },
    { label: "Disk I/O", value: metrics.diskIo ?? 0, unit: "MB/s", color: "text-green-600" },
    { label: "Network", value: metrics.networkTraffic ?? 0, unit: "Mbps", color: "text-orange-500" },
  ];

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-gray-800">System Performance</h1>
          <div className="flex items-center text-gray-600 text-sm gap-2">
            <Clock size={16} />
            Last updated: {lastUpdated || "Not available"}
            {loading && <RefreshCw size={16} className="animate-spin text-blue-500" />}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {cardMetrics.map((metric) => (
            <div key={metric.label} className="bg-white rounded-xl shadow p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">{metric.label}</span>
                <Activity className={metric.color} size={20} />
              </div>
              <div className="text-3xl font-bold text-gray-800 mt-2">
                {metric.value}
                <span className="text-sm text-gray-500 ml-1">{metric.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white rounded-xl shadow p-6">
            <header className="flex items-center gap-2 text-gray-700 mb-4">
              <Cpu className="text-blue-600" />
              <h2 className="text-lg font-semibold">System Load</h2>
            </header>
            <p className="text-sm text-gray-500 mb-2">Average response time</p>
            <div className="text-4xl font-bold text-gray-800">{metrics.responseTime ?? 0} ms</div>
            <div className="mt-4 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500"
                style={{ width: `${Math.min((metrics.responseTime ?? 0) / 4, 100)}%` }}
              />
            </div>
          </section>

          <section className="bg-white rounded-xl shadow p-6">
            <header className="flex items-center gap-2 text-gray-700 mb-4">
              <HardDrive className="text-purple-600" />
              <h2 className="text-lg font-semibold">Top Processes</h2>
            </header>
            <div className="space-y-4">
              {(metrics.processes || []).slice(0, 5).map((process, index) => (
                <div key={`${process.name}-${index}`} className="border p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700 font-medium">{process.name}</span>
                    <span className="text-xs text-gray-500">{process.requests ?? 0} req/min</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-blue-500" />
                      CPU {process.cpu ?? 0}%
                    </div>
                    <div className="flex items-center gap-2">
                      <Database size={14} className="text-purple-500" />
                      Memory {process.memory ?? 0}%
                    </div>
                  </div>
                </div>
              ))}
              {(metrics.processes || []).length === 0 && (
                <p className="text-sm text-gray-500">No process data available.</p>
              )}
            </div>
          </section>
        </div>

        <section className="bg-white rounded-xl shadow p-6">
          <header className="flex items-center gap-2 text-gray-700 mb-4">
            <Globe className="text-green-600" />
            <h2 className="text-lg font-semibold">System Components</h2>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Component</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Utilization</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(metrics.systemInfo || []).map((system) => (
                  <tr key={system.component}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{system.component}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">{system.status}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{system.utilization}%</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{system.details}</td>
                  </tr>
                ))}
                {(metrics.systemInfo || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                      No system information available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
};

export default SystemPerformance;
