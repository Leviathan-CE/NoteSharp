import React, { useEffect, useMemo, useState } from "react";
import {
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Search,
  Filter,
  Send,
  RefreshCw,
} from "lucide-react";
import AdminLayout from "../../components/admin/AdminLayout";
import { getSupportTickets } from "../../services/api";
import { getStoredAuthToken } from "../../utils/auth";
import { formatTimestamp, type TimestampValue } from "../../utils/dates";

interface SupportMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: string;
  isAdmin: boolean;
}

interface SupportTicket {
  id: string;
  subject: string;
  userName: string;
  userEmail: string;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in-progress" | "resolved" | "closed";
  createdAt: string;
  lastUpdate: string;
  description: string;
  messages: SupportMessage[];
}

type RawSupportMessage = Omit<SupportMessage, "timestamp"> & { timestamp?: TimestampValue };
type RawSupportTicket = Omit<SupportTicket, "createdAt" | "lastUpdate" | "messages"> & {
  createdAt?: TimestampValue;
  lastUpdate?: TimestampValue;
  messages?: RawSupportMessage[];
};

interface TicketStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
}

const defaultStats: TicketStats = { total: 0, open: 0, inProgress: 0, resolved: 0 };

const normalizeMessage = (message: RawSupportMessage, index: number): SupportMessage => ({
  id: message.id || `msg-${Date.now()}-${index}`,
  sender: message.sender || "User",
  message: message.message || "",
  timestamp: formatTimestamp(message.timestamp ?? null),
  isAdmin: Boolean(message.isAdmin),
});

const normalizeTicket = (ticket: RawSupportTicket, index: number): SupportTicket => ({
  id: ticket.id || ticket.userEmail || `ticket-${Date.now()}-${index}`,
  subject: ticket.subject || "Untitled Ticket",
  userName: ticket.userName || "Unknown User",
  userEmail: ticket.userEmail || "unknown",
  category: ticket.category || "General",
  priority: (ticket.priority || "medium") as SupportTicket["priority"],
  status: (ticket.status || "open") as SupportTicket["status"],
  createdAt: formatTimestamp(ticket.createdAt ?? null),
  lastUpdate: formatTimestamp(ticket.lastUpdate ?? ticket.createdAt ?? null),
  description: ticket.description || "No description provided.",
  messages: Array.isArray(ticket.messages)
    ? ticket.messages.map((message, messageIndex) => normalizeMessage(message, messageIndex))
    : [],
});

const SupportRequests: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [stats, setStats] = useState<TicketStats>(defaultStats);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [replyMessage, setReplyMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchTickets = async () => {
      const token = getStoredAuthToken();
      if (!token) {
        setError("Missing authentication token. Please log in again.");
        setLoading(false);
        return;
      }

      try {
        const data = await getSupportTickets(token);
        const rawTickets: RawSupportTicket[] = Array.isArray(data.tickets) ? data.tickets : [];
        const normalizedTickets = rawTickets.map((ticket, index) => normalizeTicket(ticket, index));
        setTickets(normalizedTickets);

        const serverStats = data.stats || {};
        setStats({
          total: serverStats.total ?? normalizedTickets.length,
          open: serverStats.open ?? normalizedTickets.filter((ticket) => ticket.status === "open").length,
          inProgress:
            serverStats.inProgress ??
            normalizedTickets.filter((ticket) => ticket.status === "in-progress").length,
          resolved: serverStats.resolved ?? normalizedTickets.filter((ticket) => ticket.status === "resolved").length,
        });
        setError("");
      } catch (err: any) {
        console.error("Failed to load support tickets:", err);
        setError(err.message || "Failed to load support tickets.");
        setTickets([]);
        setStats(defaultStats);
      } finally {
        setLoading(false);
      }
    };

    fetchTickets();
  }, []);

  useEffect(() => {
    if (tickets.length === 0) {
      setSelectedTicket(null);
      return;
    }
    setSelectedTicket((prev) => {
      if (!prev) {
        return tickets[0];
      }
      return tickets.find((ticket) => ticket.id === prev.id) || tickets[0];
    });
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesSearch =
        ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = filterStatus === "all" || ticket.status === filterStatus;
      const matchesPriority = filterPriority === "all" || ticket.priority === filterPriority;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tickets, searchTerm, filterStatus, filterPriority]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "text-red-600 bg-red-100";
      case "high":
        return "text-orange-600 bg-orange-100";
      case "medium":
        return "text-yellow-600 bg-yellow-100";
      case "low":
        return "text-green-600 bg-green-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return { icon: <AlertCircle size={16} className="text-blue-600" />, color: "text-blue-600 bg-blue-100" };
      case "in-progress":
        return { icon: <Clock size={16} className="text-yellow-600" />, color: "text-yellow-600 bg-yellow-100" };
      case "resolved":
        return { icon: <CheckCircle size={16} className="text-green-600" />, color: "text-green-600 bg-green-100" };
      case "closed":
        return { icon: <XCircle size={16} className="text-gray-600" />, color: "text-gray-600 bg-gray-100" };
      default:
        return { icon: <MessageSquare size={16} className="text-gray-600" />, color: "text-gray-600 bg-gray-100" };
    }
  };

  const handleSendReply = () => {
    if (!selectedTicket || !replyMessage.trim()) return;

    const newMessage: SupportMessage = {
      id: `msg-${Date.now()}`,
      sender: "Admin Support",
      message: replyMessage,
      timestamp: new Date().toLocaleString(),
      isAdmin: true,
    };

    const updatedTicket: SupportTicket = {
      ...selectedTicket,
      messages: [...selectedTicket.messages, newMessage],
      lastUpdate: newMessage.timestamp,
      status: selectedTicket.status === "open" ? "in-progress" : selectedTicket.status,
    };

    setTickets((prev) => prev.map((ticket) => (ticket.id === updatedTicket.id ? updatedTicket : ticket)));
    setSelectedTicket(updatedTicket);
    setReplyMessage("");
  };

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Support Requests</h1>
          <p className="text-gray-600">View and manage user support tickets</p>
        </header>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Total Tickets</p>
            <p className="text-2xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Open</p>
            <p className="text-2xl font-bold text-blue-600">{stats.open}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">In Progress</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Resolved</p>
            <p className="text-2xl font-bold text-green-600">{stats.resolved}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="bg-white rounded-lg shadow">
            <div className="p-4 border-b flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <MessageSquare size={20} className="text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-800">Tickets</h2>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search tickets..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                </div>
                <button className="px-3 py-2 border border-gray-300 rounded-lg text-gray-600 text-sm flex items-center gap-2">
                  <Filter size={16} />
                  Filter
                </button>
              </div>
              <div className="flex gap-2 text-sm">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <select
                  value={filterPriority}
                  onChange={(e) => setFilterPriority(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto divide-y divide-gray-100">
              {loading ? (
                <div className="p-6 text-center text-gray-500 flex items-center justify-center gap-2">
                  <RefreshCw size={18} className="animate-spin" />
                  Loading tickets...
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No tickets found.</div>
              ) : (
                filteredTickets.map((ticket) => {
                  const statusBadge = getStatusBadge(ticket.status);
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`w-full text-left p-4 transition ${
                        selectedTicket?.id === ticket.id ? "bg-blue-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm font-semibold text-gray-800">{ticket.subject}</div>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${statusBadge.color}`}
                        >
                          {statusBadge.icon}
                          {ticket.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 flex justify-between">
                        <span>{ticket.userName}</span>
                        <span>{ticket.createdAt}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                        <span>{ticket.category}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <section className="lg:col-span-2 bg-white rounded-lg shadow flex flex-col">
            {selectedTicket ? (
              <>
                <div className="border-b p-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-gray-800">{selectedTicket.subject}</h2>
                    <span className={`px-3 py-1 text-sm rounded-full ${getPriorityColor(selectedTicket.priority)}`}>
                      {selectedTicket.priority} priority
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 flex flex-wrap gap-4">
                    <span>{selectedTicket.userName}</span>
                    <span>{selectedTicket.userEmail}</span>
                    <span>Opened: {selectedTicket.createdAt}</span>
                    <span>Updated: {selectedTicket.lastUpdate}</span>
                  </div>
                  <p className="text-gray-700 text-sm">{selectedTicket.description}</p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {selectedTicket.messages.length > 0 ? (
                    selectedTicket.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`max-w-[80%] rounded-lg p-4 ${
                          message.isAdmin ? "ml-auto bg-blue-600 text-white" : "mr-auto bg-gray-100 text-gray-800"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-2 opacity-75">
                          <span className="font-semibold">{message.sender}</span>
                          <span>{message.timestamp}</span>
                        </div>
                        <p className="text-sm">{message.message}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center">No messages yet.</p>
                  )}
                </div>

                <div className="border-t bg-gray-50 p-6">
                  <div className="flex gap-3">
                    <textarea
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      rows={3}
                      placeholder="Write your reply..."
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={!replyMessage.trim()}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 h-fit"
                    >
                      <Send size={16} />
                      Send Reply
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-6">
                <MessageSquare size={48} className="text-gray-300 mb-4" />
                <p>Select a ticket from the list to view details.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SupportRequests;
