import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Cloud,
  CloudRain,
  Cpu,
  Database,
  RefreshCw,
  Server,
  Shield,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "../../components/common";
import {
  getServerConfiguration,
  testServerConfigurationConnection,
  updateServerConfiguration,
} from "../../services/api";
import AdminLayout from "../../components/admin/AdminLayout";
import { getStoredAuthToken } from "../../utils/auth";
import { formatTimestamp } from "../../utils/dates";

type ServerConfig = {
  environment: "production" | "staging" | "development";
  region: string;
  maintenanceMode: boolean;
  autoScaling: boolean;
  logRetentionDays: number;
  errorTracking: boolean;
  allowSelfRegistration: boolean;
  requireEmailVerification: boolean;
  requireTwoFactor: boolean;
  sessionTimeout: number;
  maxConcurrentUsers: number;
  loggingLevel: "debug" | "info" | "warn" | "error";
  notificationChannels: {
    email: boolean;
    sms: boolean;
    slack: boolean;
  };
  automaticBackups: boolean;
  backupFrequency: "hourly" | "daily" | "weekly";
  storageQuotaGb: number;
  maxUploadMb: number;
  metrics: {
    uptime: string;
    cpuUsage: number;
    memoryUsage: number;
    responseTime: number;
    activeUsers: number;
  };
};

type DeploymentEntry = {
  id: string;
  version: string;
  timestamp: string;
  summary: string;
  status: "success" | "warning" | "failed";
};

const DEFAULT_CONFIG: ServerConfig = {
  environment: "production",
  region: "us-central1",
  maintenanceMode: false,
  autoScaling: true,
  logRetentionDays: 14,
  errorTracking: true,
  allowSelfRegistration: true,
  requireEmailVerification: true,
  requireTwoFactor: false,
  sessionTimeout: 30,
  maxConcurrentUsers: 500,
  loggingLevel: "info",
  notificationChannels: {
    email: true,
    sms: false,
    slack: true,
  },
  automaticBackups: true,
  backupFrequency: "daily",
  storageQuotaGb: 250,
  maxUploadMb: 50,
  metrics: {
    uptime: "99.97%",
    cpuUsage: 38,
    memoryUsage: 63,
    responseTime: 210,
    activeUsers: 426,
  },
};

const deployments: DeploymentEntry[] = [
  {
    id: "deploy-235",
    version: "v1.12.4",
    timestamp: "2025-02-24 09:23",
    summary: "Applied security updates and refined login throttle.",
    status: "success",
  },
  {
    id: "deploy-234",
    version: "v1.12.3",
    timestamp: "2025-02-22 17:40",
    summary: "Improved board rendering performance.",
    status: "success",
  },
  {
    id: "deploy-233",
    version: "v1.12.2",
    timestamp: "2025-02-20 11:09",
    summary: "Hotfix: corrected admin verification bug.",
    status: "warning",
  },
];

const statusBadgeClasses: Record<DeploymentEntry["status"], string> = {
  success: "bg-green-100 text-green-700",
  warning: "bg-yellow-100 text-yellow-700",
  failed: "bg-red-100 text-red-700",
};

const CONFIG_CACHE_KEY = "server-config-cache";

const mergeWithDefaults = (partial: Partial<ServerConfig>): ServerConfig => ({
  ...DEFAULT_CONFIG,
  ...partial,
  notificationChannels: {
    ...DEFAULT_CONFIG.notificationChannels,
    ...(partial.notificationChannels ?? {}),
  },
  metrics: {
    ...DEFAULT_CONFIG.metrics,
    ...(partial.metrics ?? {}),
  },
});

function ServerConfiguration(): React.ReactElement {
  const [config, setConfig] = useState<ServerConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string>("");
  const authToken = useMemo(() => getStoredAuthToken() ?? "", []);

  const loadConfig = useCallback(async () => {
    if (!authToken) {
      setErrorMessage("Missing authentication token. Please log in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await getServerConfiguration(authToken);
      const incoming = (response?.config ?? {}) as Partial<ServerConfig>;
      const merged = mergeWithDefaults(incoming);
      setConfig(merged);

      if (response?.updatedAt) {
        setLastSavedAt(formatTimestamp(response.updatedAt, ""));
      }

      localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(merged));
    } catch (err: any) {
      console.error(err);
      const cached = localStorage.getItem(CONFIG_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as ServerConfig;
          setConfig(parsed);
          setSuccessMessage("Loaded cached configuration. Live sync failed.");
        } catch {
          setErrorMessage("Failed to load cached configuration.");
        }
      }
      setErrorMessage(err?.message || "Failed to load configuration.");
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleConfigUpdate = <K extends keyof ServerConfig>(
    key: K,
    value: ServerConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const toggleChannel = (channel: keyof ServerConfig["notificationChannels"]) => {
    setConfig((prev) => ({
      ...prev,
      notificationChannels: {
        ...prev.notificationChannels,
        [channel]: !prev.notificationChannels[channel],
      },
    }));
  };

  const handleSave = async () => {
    if (!authToken) {
      setErrorMessage("Missing authentication token. Please log in again.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      await updateServerConfiguration(config as unknown as Record<string, unknown>, authToken);
      localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config));
      const timestamp = new Date().toLocaleString();
      setLastSavedAt(timestamp);
      setSuccessMessage("Configuration saved successfully.");
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!authToken) {
      setErrorMessage("Missing authentication token. Please log in again.");
      return;
    }

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");
    try {
      const response = await testServerConfigurationConnection(authToken);
      setSuccessMessage(response?.message || "Connection to Firebase services verified.");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Connection test failed.");
    } finally {
      setSaving(false);
    }
  };

  const summaryCards = useMemo(
    () => [
      {
        label: "Environment",
        value: config.environment.toUpperCase(),
        icon: Cloud,
        tone: "text-blue-600",
      },
      {
        label: "Active Users",
        value: `${config.metrics.activeUsers}`,
        icon: Users,
        tone: "text-indigo-600",
      },
      {
        label: "Avg Response",
        value: `${config.metrics.responseTime} ms`,
        icon: Activity,
        tone: "text-purple-600",
      },
      {
        label: "Uptime",
        value: config.metrics.uptime,
        icon: CheckCircle2,
        tone: "text-emerald-600",
      },
    ],
    [config]
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="bg-white rounded-lg shadow p-6 flex items-center space-x-3">
          <RefreshCw className="animate-spin text-blue-600" />
          <span>Loading configuration...</span>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Server Configuration</h1>
          <p className="text-gray-600">
            Review operational metrics and adjust infrastructure controls in one place.
          </p>
          {lastSavedAt && (
            <p className="text-sm text-gray-400 mt-1">Last saved {lastSavedAt}</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleTestConnection}
            variant="secondary"
            disabled={saving}
            className="flex items-center justify-center gap-2"
          >
            <RefreshCw size={18} />
            Test Connection
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <RefreshCw size={18} className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Server size={18} />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {(successMessage || errorMessage) && (
        <div
          className={`rounded-lg border px-4 py-3 ${
            successMessage ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {successMessage || errorMessage}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">{label}</p>
              <Icon className={tone} size={20} />
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <header className="mb-4 flex items-center gap-2">
            <Cpu className="text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-800">Runtime Settings</h2>
          </header>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-700">Environment</label>
                <select
                  value={config.environment}
                  onChange={(e) =>
                    handleConfigUpdate("environment", e.target.value as ServerConfig["environment"])
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Region</label>
                <select
                  value={config.region}
                  onChange={(e) => handleConfigUpdate("region", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="us-central1">us-central1</option>
                  <option value="us-west1">us-west1</option>
                  <option value="europe-west1">europe-west1</option>
                  <option value="asia-east1">asia-east1</option>
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-gray-700">Max concurrent users</label>
                <input
                  type="number"
                  value={config.maxConcurrentUsers}
                  min={50}
                  max={5000}
                  onChange={(e) => handleConfigUpdate("maxConcurrentUsers", Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Session timeout (minutes)</label>
                <input
                  type="number"
                  value={config.sessionTimeout}
                  min={5}
                  max={180}
                  onChange={(e) => handleConfigUpdate("sessionTimeout", Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: "Maintenance mode", key: "maintenanceMode" as const },
                { label: "Auto scaling", key: "autoScaling" as const },
                { label: "Verbose error tracking", key: "errorTracking" as const },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
                >
                  <span className="text-gray-700">{item.label}</span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-blue-600"
                    checked={config[item.key]}
                    onChange={(e) => handleConfigUpdate(item.key, e.target.checked)}
                  />
                </label>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <header className="mb-4 flex items-center gap-2">
            <Shield className="text-emerald-600" />
            <h2 className="text-xl font-semibold text-gray-800">Security & Access</h2>
          </header>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col rounded-lg border border-gray-200 p-4">
                <span className="text-sm font-medium text-gray-700">Log retention (days)</span>
                <input
                  type="number"
                  value={config.logRetentionDays}
                  min={7}
                  max={60}
                  onChange={(e) => handleConfigUpdate("logRetentionDays", Number(e.target.value))}
                  className="mt-2 rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
              <label className="flex flex-col rounded-lg border border-gray-200 p-4">
                <span className="text-sm font-medium text-gray-700">Logging level</span>
                <select
                  value={config.loggingLevel}
                  onChange={(e) =>
                    handleConfigUpdate("loggingLevel", e.target.value as ServerConfig["loggingLevel"])
                  }
                  className="mt-2 rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="debug">Debug</option>
                  <option value="info">Info</option>
                  <option value="warn">Warn</option>
                  <option value="error">Error</option>
                </select>
              </label>
            </div>
            <div className="space-y-3">
              {[
                { label: "Allow self-registration", key: "allowSelfRegistration" as const },
                { label: "Require email verification", key: "requireEmailVerification" as const },
                { label: "Require 2FA for admins", key: "requireTwoFactor" as const },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
                >
                  <span className="text-gray-700">{item.label}</span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-emerald-600"
                    checked={config[item.key]}
                    onChange={(e) => handleConfigUpdate(item.key, e.target.checked)}
                  />
                </label>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <header className="mb-4 flex items-center gap-2">
            <Bell className="text-yellow-600" />
            <h2 className="text-xl font-semibold text-gray-800">Notifications</h2>
          </header>
          <div className="space-y-3">
            {[
              { key: "email", label: "Email alerts" },
              { key: "sms", label: "SMS alerts" },
              { key: "slack", label: "Slack webhooks" },
            ].map((channel) => (
              <label
                key={channel.key}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
              >
                <span className="text-gray-700">{channel.label}</span>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-yellow-500"
                  checked={config.notificationChannels[channel.key as keyof typeof config.notificationChannels]}
                  onChange={() => toggleChannel(channel.key as keyof ServerConfig["notificationChannels"])}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <header className="mb-4 flex items-center gap-2">
            <Database className="text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-800">Storage & Backup</h2>
          </header>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col rounded-lg border border-gray-200 p-4">
                <span className="text-sm font-medium text-gray-700">Storage quota per user (GB)</span>
                <input
                  type="number"
                  value={config.storageQuotaGb}
                  min={10}
                  max={1000}
                  onChange={(e) => handleConfigUpdate("storageQuotaGb", Number(e.target.value))}
                  className="mt-2 rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
              <label className="flex flex-col rounded-lg border border-gray-200 p-4">
                <span className="text-sm font-medium text-gray-700">Max upload size (MB)</span>
                <input
                  type="number"
                  value={config.maxUploadMb}
                  min={1}
                  max={500}
                  onChange={(e) => handleConfigUpdate("maxUploadMb", Number(e.target.value))}
                  className="mt-2 rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </label>
            </div>
            <label className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
              <span className="text-gray-700">Automatic backups</span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-purple-600"
                checked={config.automaticBackups}
                onChange={(e) => handleConfigUpdate("automaticBackups", e.target.checked)}
              />
            </label>
            {config.automaticBackups && (
              <div>
                <label className="text-sm font-medium text-gray-700">Backup frequency</label>
                <select
                  value={config.backupFrequency}
                  onChange={(e) =>
                    handleConfigUpdate("backupFrequency", e.target.value as ServerConfig["backupFrequency"])
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <header className="mb-4 flex items-center gap-2">
          <Wrench className="text-red-600" />
          <h2 className="text-xl font-semibold text-gray-800">Recent Deployments</h2>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 font-medium text-gray-600">Deployment</th>
                <th className="px-4 py-3 font-medium text-gray-600">Version</th>
                <th className="px-4 py-3 font-medium text-gray-600">Description</th>
                <th className="px-4 py-3 font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deployments.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 text-gray-800">{entry.timestamp}</td>
                  <td className="px-4 py-3 text-gray-800">{entry.version}</td>
                  <td className="px-4 py-3 text-gray-600">{entry.summary}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        statusBadgeClasses[entry.status]
                      }`}
                    >
                      {entry.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <header className="mb-4 flex items-center gap-2">
          <CloudRain className="text-slate-600" />
          <h2 className="text-xl font-semibold text-gray-800">Incident readiness</h2>
        </header>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <AlertTriangle size={16} className="text-amber-500" />
              Automated alerts
            </div>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {config.notificationChannels.email && config.notificationChannels.slack ? "Compliant" : "Needs review"}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Email and Slack alerts must stay enabled for on-call rotation.
            </p>
          </div>
          <div className="rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Server size={16} className="text-sky-500" />
              Recovery testing
            </div>
            <p className="mt-2 text-3xl font-semibold text-gray-900">Quarterly</p>
            <p className="mt-1 text-sm text-gray-500">
              Schedule the next failover test if you switch to maintenance mode.
            </p>
          </div>
        </div>
      </section>
    </div>
    </AdminLayout>
  );
}

export default ServerConfiguration;
