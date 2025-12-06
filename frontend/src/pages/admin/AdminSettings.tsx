import React, { useEffect, useState } from "react";
import { Save, Bell, Shield, Database, Globe, Lock, Users, FileText, RefreshCw } from "lucide-react";
import AdminLayout from "../../components/admin/AdminLayout";
import { getAdminSettings, updateAdminSettings } from "../../services/api";
import { getStoredAuthToken } from "../../utils/auth";

type AdminSettingsData = {
  siteName: string;
  siteDescription: string;
  maintenanceMode: boolean;
  requireEmailVerification: boolean;
  passwordMinLength: number;
  sessionTimeout: number;
  twoFactorAuth: boolean;
  emailNotifications: boolean;
  newUserAlerts: boolean;
  systemAlerts: boolean;
  weeklyReports: boolean;
  allowSelfRegistration: boolean;
  maxUsersPerAccount: number;
  autoApproveUsers: boolean;
  maxFileSize: number;
  storageQuota: number;
  autoBackup: boolean;
  backupFrequency: "daily" | "weekly" | "monthly";
};

const DEFAULT_SETTINGS: AdminSettingsData = {
  siteName: "NotSharp",
  siteDescription: "Collaborative note-taking platform",
  maintenanceMode: false,
  requireEmailVerification: true,
  passwordMinLength: 6,
  sessionTimeout: 30,
  twoFactorAuth: false,
  emailNotifications: true,
  newUserAlerts: true,
  systemAlerts: true,
  weeklyReports: false,
  allowSelfRegistration: true,
  maxUsersPerAccount: 10,
  autoApproveUsers: true,
  maxFileSize: 10,
  storageQuota: 100,
  autoBackup: true,
  backupFrequency: "daily",
};

const parseSettings = (raw?: Partial<AdminSettingsData>): AdminSettingsData => ({
  siteName: raw?.siteName ?? DEFAULT_SETTINGS.siteName,
  siteDescription: raw?.siteDescription ?? DEFAULT_SETTINGS.siteDescription,
  maintenanceMode: raw?.maintenanceMode ?? DEFAULT_SETTINGS.maintenanceMode,
  requireEmailVerification: raw?.requireEmailVerification ?? DEFAULT_SETTINGS.requireEmailVerification,
  passwordMinLength: raw?.passwordMinLength ?? DEFAULT_SETTINGS.passwordMinLength,
  sessionTimeout: raw?.sessionTimeout ?? DEFAULT_SETTINGS.sessionTimeout,
  twoFactorAuth: raw?.twoFactorAuth ?? DEFAULT_SETTINGS.twoFactorAuth,
  emailNotifications: raw?.emailNotifications ?? DEFAULT_SETTINGS.emailNotifications,
  newUserAlerts: raw?.newUserAlerts ?? DEFAULT_SETTINGS.newUserAlerts,
  systemAlerts: raw?.systemAlerts ?? DEFAULT_SETTINGS.systemAlerts,
  weeklyReports: raw?.weeklyReports ?? DEFAULT_SETTINGS.weeklyReports,
  allowSelfRegistration: raw?.allowSelfRegistration ?? DEFAULT_SETTINGS.allowSelfRegistration,
  maxUsersPerAccount: raw?.maxUsersPerAccount ?? DEFAULT_SETTINGS.maxUsersPerAccount,
  autoApproveUsers: raw?.autoApproveUsers ?? DEFAULT_SETTINGS.autoApproveUsers,
  maxFileSize: raw?.maxFileSize ?? DEFAULT_SETTINGS.maxFileSize,
  storageQuota: raw?.storageQuota ?? DEFAULT_SETTINGS.storageQuota,
  autoBackup: raw?.autoBackup ?? DEFAULT_SETTINGS.autoBackup,
  backupFrequency: raw?.backupFrequency ?? DEFAULT_SETTINGS.backupFrequency,
});

const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<AdminSettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const token = getStoredAuthToken();
      if (!token) {
        setError("Missing authentication token. Please log in again.");
        setLoading(false);
        return;
      }

      try {
        const response = await getAdminSettings(token);
        const merged = parseSettings(response?.settings as Partial<AdminSettingsData>);
        setSettings(merged);
        setError("");
      } catch (err: any) {
        console.error("Failed to load admin settings:", err);
        setError(err.message || "Failed to load settings.");
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    const token = getStoredAuthToken();
    if (!token) {
      setError("Missing authentication token. Please log in again.");
      return;
    }

    setIsSaving(true);
    setSaveMessage("");
    setError("");

    try {
      await updateAdminSettings(settings as unknown as Record<string, unknown>, token);
      setSaveMessage("Settings saved successfully!");
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (err: any) {
      console.error("Failed to save settings:", err);
      setError(err.message || "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-bold text-gray-800">Admin Settings</h1>
          <p className="text-gray-600">Configure system settings, security, and operational preferences.</p>
        </header>

        {error && <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">{error}</div>}
        {saveMessage && (
          <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-lg">{saveMessage}</div>
        )}

        {loading ? (
          <div className="p-10 text-center text-gray-500 flex items-center justify-center gap-2">
            <RefreshCw className="animate-spin text-blue-500" size={18} />
            Loading settings...
          </div>
        ) : (
          <>
            <section className="bg-white rounded-lg shadow p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Globe className="text-blue-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">General</h2>
                  <p className="text-sm text-gray-500">Primary application details and maintenance controls</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Site Name</label>
                <input
                  type="text"
                  value={settings.siteName}
                  onChange={(e) => setSettings((prev) => ({ ...prev, siteName: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Site Description</label>
                <textarea
                  value={settings.siteDescription}
                  onChange={(e) => setSettings((prev) => ({ ...prev, siteDescription: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <SettingToggle
                label="Maintenance Mode"
                description="Temporarily disable user access while performing upgrades"
                checked={settings.maintenanceMode}
                onChange={(value) => setSettings((prev) => ({ ...prev, maintenanceMode: value }))}
              />
            </section>

            <section className="bg-white rounded-lg shadow p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Shield className="text-red-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Security</h2>
                  <p className="text-sm text-gray-500">Authentication and access requirements</p>
                </div>
              </div>
              <SettingToggle
                label="Require Email Verification"
                description="Users must verify their email before using the platform"
                checked={settings.requireEmailVerification}
                onChange={(value) => setSettings((prev) => ({ ...prev, requireEmailVerification: value }))}
              />
              <SettingToggle
                label="Two-Factor Authentication"
                description="Ask administrators to use 2FA when signing in"
                checked={settings.twoFactorAuth}
                onChange={(value) => setSettings((prev) => ({ ...prev, twoFactorAuth: value }))}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Password Length</label>
                  <input
                    type="number"
                    min={6}
                    max={20}
                    value={settings.passwordMinLength}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, passwordMinLength: parseInt(e.target.value, 10) || 6 }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Session Timeout (minutes)</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={settings.sessionTimeout}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, sessionTimeout: parseInt(e.target.value, 10) || 30 }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Bell className="text-yellow-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Notifications</h2>
                  <p className="text-sm text-gray-500">Control which automated alerts are enabled</p>
                </div>
              </div>
              <SettingToggle
                label="Email Notifications"
                description="Receive important announcements in your inbox"
                checked={settings.emailNotifications}
                onChange={(value) => setSettings((prev) => ({ ...prev, emailNotifications: value }))}
              />
              <SettingToggle
                label="New User Alerts"
                description="Notify admins whenever a new user signs up"
                checked={settings.newUserAlerts}
                onChange={(value) => setSettings((prev) => ({ ...prev, newUserAlerts: value }))}
              />
              <SettingToggle
                label="System Alerts"
                description="Send warnings about outages or degraded performance"
                checked={settings.systemAlerts}
                onChange={(value) => setSettings((prev) => ({ ...prev, systemAlerts: value }))}
              />
              <SettingToggle
                label="Weekly Reports"
                description="Email a summary of weekly usage and metrics"
                checked={settings.weeklyReports}
                onChange={(value) => setSettings((prev) => ({ ...prev, weeklyReports: value }))}
              />
            </section>

            <section className="bg-white rounded-lg shadow p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Users className="text-green-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">User Management</h2>
                  <p className="text-sm text-gray-500">Onboarding limits and automation</p>
                </div>
              </div>
              <SettingToggle
                label="Allow Self Registration"
                description="Users can sign up without an invitation"
                checked={settings.allowSelfRegistration}
                onChange={(value) => setSettings((prev) => ({ ...prev, allowSelfRegistration: value }))}
              />
              <SettingToggle
                label="Auto-Approve Users"
                description="Skip manual approval for newly registered users"
                checked={settings.autoApproveUsers}
                onChange={(value) => setSettings((prev) => ({ ...prev, autoApproveUsers: value }))}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Max Users per Account</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={settings.maxUsersPerAccount}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, maxUsersPerAccount: parseInt(e.target.value, 10) || 10 }))
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </section>

            <section className="bg-white rounded-lg shadow p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Database className="text-purple-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Storage & Backups</h2>
                  <p className="text-sm text-gray-500">Upload policies and redundancy controls</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <FileText size={16} className="text-purple-500" />
                    Max File Size (MB)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={settings.maxFileSize}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, maxFileSize: parseInt(e.target.value, 10) || 10 }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Storage Quota per User (GB)</label>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={settings.storageQuota}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, storageQuota: parseInt(e.target.value, 10) || 100 }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <SettingToggle
                label="Automatic Backups"
                description="Create scheduled backups of database and files"
                checked={settings.autoBackup}
                onChange={(value) => setSettings((prev) => ({ ...prev, autoBackup: value }))}
              />
              {settings.autoBackup && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Backup Frequency</label>
                  <select
                    value={settings.backupFrequency}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, backupFrequency: e.target.value as AdminSettingsData["backupFrequency"] }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>
              )}
            </section>

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

type SettingToggleProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

const SettingToggle: React.FC<SettingToggleProps> = ({ label, description, checked, onChange }) => (
  <div className="flex items-center justify-between p-4 border rounded-lg">
    <div className="mr-4">
      <p className="font-medium text-gray-800">{label}</p>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="w-12 h-6 bg-gray-200 rounded-full peer-checked:bg-blue-600 flex items-center px-1 transition">
        <span
          className={`h-5 w-5 bg-white rounded-full shadow transform transition ${
            checked ? "translate-x-6" : "translate-x-0"
          }`}
        ></span>
      </span>
    </label>
  </div>
);

export default AdminSettings;
