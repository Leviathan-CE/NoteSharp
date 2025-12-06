import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity,
  Bell,
  Home,
  Inbox,
  Layers,
  Search,
  Server,
  Settings,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/admin", icon: Home },
  { label: "User Management", to: "/admin/manage-users", icon: Users },
  { label: "System Performance", to: "/admin/performance", icon: Activity },
  { label: "Server Configuration", to: "/admin/server-config", icon: Server },
  { label: "Bulk Operations", to: "/admin/bulk-operations", icon: Layers },
  { label: "Support Requests", to: "/admin/support", icon: Inbox },
  { label: "Settings", to: "/admin/settings", icon: Settings },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const location = useLocation();

  const isActivePath = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-64 bg-blue-900 text-white flex flex-col">
        <div className="p-6 text-2xl font-bold border-b border-blue-700">
          Admin Dashboard
        </div>
        <nav className="flex-1 p-4 space-y-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActivePath(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg cursor-pointer transition ${
                  active ? "bg-blue-700 text-white" : "hover:bg-blue-800 text-gray-200"
                }`}
              >
                <Icon size={18} />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between bg-white shadow px-6 py-3">
          <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 w-80">
            <Search size={18} className="text-gray-500 mr-2" />
            <input
              type="text"
              placeholder="Search"
              className="bg-transparent outline-none text-sm text-gray-700 w-full"
            />
          </div>
          <div className="flex items-center space-x-4">
            <Bell size={20} className="text-gray-600 cursor-pointer" />
            <div className="flex items-center space-x-2 cursor-pointer">
              <img
                src="https://i.pravatar.cc/45"
                alt="Admin"
                className="w-8 h-8 rounded-full"
              />
              <span className="text-gray-800 font-medium">Admin</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
