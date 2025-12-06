import React, { useEffect, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import { getAdminMetrics } from "../../services/api";
import { getStoredAuthToken } from "../../utils/auth";
import { RefreshCw } from "lucide-react";

type DashboardMetrics = {
  totalUsers: number;
  adminUsers: number;
  regularUsers: number;
  supportTickets: number;
  serverLoad: number;
  uptimePercent: number;
};

const DEFAULT_METRICS: DashboardMetrics = {
  totalUsers: 0,
  adminUsers: 0,
  regularUsers: 0,
  supportTickets: 0,
  serverLoad: 0,
  uptimePercent: 0,
};

function Dashboard(): React.ReactElement {
  const [metrics, setMetrics] = useState<DashboardMetrics>(DEFAULT_METRICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchMetrics = async () => {
      const token = getStoredAuthToken();
      if (!token) {
        setError("Missing authentication token.");
        setLoading(false);
        return;
      }

      try {
        const data = await getAdminMetrics(token);
        setMetrics({
          totalUsers: data.totalUsers ?? 0,
          adminUsers: data.adminUsers ?? 0,
          regularUsers: data.regularUsers ?? 0,
          supportTickets: data.supportTickets ?? 0,
          serverLoad: data.serverLoad ?? 0,
          uptimePercent: data.uptimePercent ?? 0,
        });
        setError("");
      } catch (err: any) {
        console.error("Failed to load admin metrics:", err);
        setError(err.message || "Failed to load admin metrics.");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  return (
    <AdminLayout>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <DashboardCard
          title="Total Users"
          value={loading ? "--" : metrics.totalUsers.toString()}
          icon="👥"
          change=""
        />
        <DashboardCard
          title="Admin Users"
          value={loading ? "--" : metrics.adminUsers.toString()}
          icon="🔑"
          change=""
        />
        <DashboardCard
          title="Regular Users"
          value={loading ? "--" : metrics.regularUsers.toString()}
          icon="👤"
          change=""
        />
        <DashboardCard
          title="Server Load"
          value={loading ? "--" : `${metrics.serverLoad}%`}
          icon="💾"
          chart
        />
        <DashboardCard
          title="Open Support Tickets"
          value={loading ? "--" : metrics.supportTickets.toString()}
          icon="📬"
        />
        <DashboardCard
          title="Uptime (24h)"
          value={loading ? "--" : `${metrics.uptimePercent}%`}
          icon="⚙️"
          chart
        />
      </div>
      {error && (
        <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      {loading && !error && (
        <div className="mt-6 flex items-center text-gray-500">
          <RefreshCw className="animate-spin mr-2" size={16} />
          Loading metrics...
        </div>
      )}
    </AdminLayout>
  );
}

function DashboardCard({
  title,
  value,
  icon,
  change,
  chart = false,
}: {
  title: string;
  value: string;
  icon: string;
  change?: string;
  chart?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl shadow p-5 flex flex-col space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
      </div>
      <div className="text-3xl font-bold text-gray-800">{value}</div>
      {change && <span className="text-sm text-green-600">{change}</span>}
      {chart && (
        <div className="h-10 mt-2 bg-gradient-to-r from-blue-100 to-blue-300 rounded"></div>
      )}
    </div>
  );
}

export default Dashboard;
