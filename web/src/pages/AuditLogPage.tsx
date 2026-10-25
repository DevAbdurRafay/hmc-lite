import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck,
  Search,
  Filter,
  Eye,
  Calendar,
  User,
  Activity,
  Terminal,
  FileCode,
} from 'lucide-react';
import { api } from '../services/api';
import GlassCard from '../components/common/GlassCard';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';

export default function AuditLogPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  // Fetch Audit Logs
  const { data: logs, isLoading } = useQuery({
    queryKey: ['auditLogs', actionFilter],
    queryFn: () => api.getAuditLogs({ action: actionFilter || undefined, limit: 100 }),
  });

  const filteredLogs = logs?.filter((log: any) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.action?.toLowerCase().includes(term) ||
      log.user_email?.toLowerCase().includes(term) ||
      log.entity_type?.toLowerCase().includes(term)
    );
  });

  const getActionBadge = (action: string) => {
    if (action.includes('FINALIZED') || action.includes('LOCK')) {
      return <Badge variant="danger">{action}</Badge>;
    }
    if (action.includes('APPROVED') || action.includes('CREATED') || action.includes('REGISTERED')) {
      return <Badge variant="success">{action}</Badge>;
    }
    if (action.includes('REJECTED') || action.includes('DEACTIVATED')) {
      return <Badge variant="warning">{action}</Badge>;
    }
    return <Badge variant="primary">{action}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-indigo-500" />
          Immutable Audit Trail
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Cryptographically referenced, append-only log of every administrative action, payroll lock, approval, and data modification.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/60 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by user email, action, or entity..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            aria-label="Filter by action category"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
          >
            <option value="">All Actions</option>
            <option value="PAYROLL">Payroll Actions</option>
            <option value="EMPLOYEE">Employee Actions</option>
            <option value="LEAVE">Leave Approvals</option>
            <option value="ATTENDANCE">Attendance Actions</option>
            <option value="SETTINGS">Settings Changes</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <GlassCard className="overflow-hidden p-0">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filteredLogs?.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No audit entries recorded"
            description="All sensitive actions and database modifications will be logged here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200/50 dark:border-gray-700/50">
                <tr>
                  <th className="px-6 py-4">Timestamp (UTC / PKT)</th>
                  <th className="px-6 py-4">Actor</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Target Entity</th>
                  <th className="px-6 py-4">IP Address</th>
                  <th className="px-6 py-4 text-right">State Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/40 dark:divide-gray-800/40">
                {filteredLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-gray-700 dark:text-gray-300">
                      <div>
                        {new Date(log.created_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </div>
                      <span className="text-[11px] text-gray-400">
                        {new Date(log.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                      <div>
                        <p className="font-semibold text-xs">{log.user_email || 'System'}</p>
                        <span className="text-[10px] text-gray-400 uppercase">{log.user_role || 'automated'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getActionBadge(log.action)}</td>
                    <td className="px-6 py-4 text-xs font-mono">
                      <span className="text-gray-800 dark:text-gray-200 font-semibold">{log.entity_type}</span>
                      {log.entity_id && (
                        <div className="text-[10px] text-gray-400 truncate max-w-[120px]">{log.entity_id}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500">{log.ip_address || '127.0.0.1'}</td>
                    <td className="px-6 py-4 text-right">
                      {(log.before_state || log.after_state) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          onClick={() => setSelectedLog(log)}
                        >
                          View Diff
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Before / After Diff Inspector Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`Audit Inspector: ${selectedLog?.action}`}
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="text-xs text-gray-500 flex justify-between">
              <span>Actor: {selectedLog.user_email}</span>
              <span>Time: {new Date(selectedLog.created_at).toLocaleString()}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-xs font-bold text-red-500 uppercase flex items-center gap-1 mb-1">
                  <FileCode className="w-3.5 h-3.5" /> Before State
                </span>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-auto max-h-64 border border-gray-700">
                  {selectedLog.before_state
                    ? JSON.stringify(selectedLog.before_state, null, 2)
                    : '// No prior state (created/inserted)'}
                </pre>
              </div>

              <div>
                <span className="text-xs font-bold text-emerald-500 uppercase flex items-center gap-1 mb-1">
                  <FileCode className="w-3.5 h-3.5" /> After State
                </span>
                <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs font-mono overflow-auto max-h-64 border border-gray-700">
                  {selectedLog.after_state
                    ? JSON.stringify(selectedLog.after_state, null, 2)
                    : '// Record deleted / archived'}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-200 dark:border-gray-700">
              <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                Close Inspector
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
