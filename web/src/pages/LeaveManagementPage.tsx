import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  Sparkles,
  Plus,
  Check,
  X,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  HelpCircle,
  Send,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import GlassCard from '../components/common/GlassCard';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import Skeleton from '../components/common/Skeleton';

export default function LeaveManagementPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const role = user?.role?.toLowerCase();
  const isEmployee = role === 'employee';
  const isAdminOrHR = role === 'admin' || role === 'hr';

  // Tabs
  const [activeTab, setActiveTab] = useState<'my-leaves' | 'inbox' | 'all-leaves'>(
    isEmployee ? 'my-leaves' : 'inbox'
  );

  // Apply Leave Modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [applyForm, setApplyForm] = useState({
    leave_type_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    reason: '',
  });

  // Smart Leave AI Modal
  const [showSmartModal, setShowSmartModal] = useState(false);
  const [smartInput, setSmartInput] = useState('');
  const [smartLoading, setSmartLoading] = useState(false);

  // Review Modal (HR/Admin)
  const [reviewItem, setReviewItem] = useState<any | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewComment, setReviewComment] = useState('');

  // 1. Fetch Leave Types
  const { data: leaveTypes } = useQuery({
    queryKey: ['leaveTypes'],
    queryFn: () => api.getLeaveTypes(),
  });

  // 2. Fetch My Leave Balance
  const { data: balances, isLoading: loadingBalances } = useQuery({
    queryKey: ['leaveBalances'],
    queryFn: () => api.getMyLeaveBalance(),
    enabled: isEmployee || activeTab === 'my-leaves',
  });

  // 3. Fetch My Leave Requests
  const { data: myLeaves, isLoading: loadingMyLeaves } = useQuery({
    queryKey: ['myLeaves'],
    queryFn: () => api.getMyLeaveRequests(),
    enabled: isEmployee || activeTab === 'my-leaves',
  });

  // 4. Fetch Pending Leaves Inbox (HR/Admin)
  const { data: pendingLeaves, isLoading: loadingPending } = useQuery({
    queryKey: ['pendingLeaves'],
    queryFn: () => api.getPendingLeaves(),
    enabled: isAdminOrHR,
  });

  // Mutations
  const applyMutation = useMutation({
    mutationFn: (data: any) => api.applyLeave(data),
    onSuccess: () => {
      alert('Leave application submitted successfully!');
      setShowApplyModal(false);
      setApplyForm({
        leave_type_id: leaveTypes?.[0]?.id || '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        reason: '',
      });
      queryClient.invalidateQueries({ queryKey: ['myLeaves'] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalances'] });
      queryClient.invalidateQueries({ queryKey: ['pendingLeaves'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to apply for leave');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelLeave(id),
    onSuccess: () => {
      alert('Leave request cancelled.');
      queryClient.invalidateQueries({ queryKey: ['myLeaves'] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalances'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to cancel leave');
    },
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.reviewLeave(id, data),
    onSuccess: () => {
      alert(`Leave request has been ${reviewStatus.toLowerCase()}!`);
      setReviewItem(null);
      setReviewComment('');
      queryClient.invalidateQueries({ queryKey: ['pendingLeaves'] });
      queryClient.invalidateQueries({ queryKey: ['myLeaves'] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalances'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Action failed');
    },
  });

  // Smart Leave Handler
  const handleSmartLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smartInput.trim()) return;
    try {
      setSmartLoading(true);
      const res = await api.parseSmartLeave(smartInput);
      setShowSmartModal(false);

      // Match leave type if returned
      let matchedTypeId = leaveTypes?.[0]?.id || '';
      if (res.leave_type_code && leaveTypes) {
        const found = leaveTypes.find(
          (t: any) => t.code.toLowerCase() === res.leave_type_code.toLowerCase()
        );
        if (found) matchedTypeId = found.id;
      }

      setApplyForm({
        leave_type_id: matchedTypeId,
        start_date: res.start_date || new Date().toISOString().split('T')[0],
        end_date: res.end_date || new Date().toISOString().split('T')[0],
        reason: res.reason || smartInput,
      });
      setShowApplyModal(true);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Could not parse smart leave text.');
    } finally {
      setSmartLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'APPROVED':
        return <Badge variant="success">Approved</Badge>;
      case 'PENDING':
        return <Badge variant="warning">Pending Review</Badge>;
      case 'REJECTED':
        return <Badge variant="danger">Rejected</Badge>;
      case 'CANCELLED':
        return <Badge variant="secondary">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarDays className="w-7 h-7 text-indigo-500" />
            Leave Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isEmployee
              ? 'Check remaining balances, apply for paid or unpaid time off, and track requests.'
              : 'Review pending employee leave requests and monitor workforce availability.'}
          </p>
        </div>

        {/* Action Buttons for Employees */}
        {isEmployee && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Sparkles}
              onClick={() => {
                setSmartInput('');
                setShowSmartModal(true);
              }}
              className="text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
            >
              Smart Leave (AI)
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => {
                if (leaveTypes && leaveTypes.length > 0 && !applyForm.leave_type_id) {
                  setApplyForm((prev) => ({ ...prev, leave_type_id: leaveTypes[0].id }));
                }
                setShowApplyModal(true);
              }}
            >
              Apply Leave
            </Button>
          </div>
        )}
      </div>

      {/* Leave Balance Cards (For Employee or when viewing my leaves) */}
      {(isEmployee || activeTab === 'my-leaves') && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 uppercase tracking-wider">
            Your Annual Quota & Balances
          </h2>
          {loadingBalances ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.isArray(balances) && balances.length > 0 ? (
                balances.map((b: any) => (
                  <GlassCard key={b.code} className="p-4 relative overflow-hidden">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                        {b.name}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                        {b.code}
                      </span>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                        {b.is_unpaid ? '∞' : b.remaining}
                      </span>
                      {!b.is_unpaid && (
                        <span className="text-xs text-gray-400 font-medium">/ {b.yearly_quota} days left</span>
                      )}
                    </div>
                    {!b.is_unpaid && (
                      <div className="mt-3 w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.max(0, (b.remaining / (b.yearly_quota || 1)) * 100))}%`,
                          }}
                        />
                      </div>
                    )}
                  </GlassCard>
                ))
              ) : (
                <div className="col-span-4 p-4 text-center text-sm text-gray-500 bg-white/40 dark:bg-gray-800/40 rounded-xl">
                  No active leave types configured. Admin can configure leave quotas in Organization Setup.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {isAdminOrHR && (
          <button
            onClick={() => setActiveTab('inbox')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors relative ${
              activeTab === 'inbox'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Approvals Inbox
            {pendingLeaves && pendingLeaves.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-indigo-500 text-white rounded-full">
                {pendingLeaves.length}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab('my-leaves')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'my-leaves'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {isEmployee ? 'My Leave Applications' : 'My Requests'}
        </button>
      </div>

      {/* TAB 1: Pending Approvals Inbox (HR / Admin) */}
      {isAdminOrHR && activeTab === 'inbox' && (
        <div className="space-y-4">
          <GlassCard className="overflow-hidden p-0">
            {loadingPending ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : pendingLeaves?.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title="All caught up!"
                description="No pending leave applications requiring approval."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200/50 dark:border-gray-700/50">
                    <tr>
                      <th className="px-6 py-4">Employee</th>
                      <th className="px-6 py-4">Leave Type</th>
                      <th className="px-6 py-4">Dates</th>
                      <th className="px-6 py-4">Working Days</th>
                      <th className="px-6 py-4">Reason</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/40 dark:divide-gray-800/40">
                    {(Array.isArray(pendingLeaves) ? pendingLeaves : []).map((req: any) => (
                      <tr key={req.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                          <div>
                            <p className="font-semibold">{req.employee_name}</p>
                            <span className="text-xs text-gray-400">{req.employee_code}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            {req.leave_type_name}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono">
                          {req.start_date} → {req.end_date}
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-700 dark:text-gray-300">
                          {req.working_days} days
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-700 dark:text-gray-300 max-w-xs truncate">
                          {req.reason}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setReviewItem(req);
                                setReviewStatus('APPROVED');
                              }}
                              className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                              title="Approve Leave"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setReviewItem(req);
                                setReviewStatus('REJECTED');
                              }}
                              className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
                              title="Reject Leave"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* TAB 2: My Leave Requests (Employee) */}
      {activeTab === 'my-leaves' && (
        <div className="space-y-4">
          <GlassCard className="overflow-hidden p-0">
            {loadingMyLeaves ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : myLeaves?.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No leave requests found"
                description="You haven't submitted any leave applications yet."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200/50 dark:border-gray-700/50">
                    <tr>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Duration</th>
                      <th className="px-6 py-4">Working Days</th>
                      <th className="px-6 py-4">Reason</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Review Note</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/40 dark:divide-gray-800/40">
                    {(Array.isArray(myLeaves) ? myLeaves : []).map((req: any) => (
                      <tr key={req.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                          {req.leave_type_name}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {req.start_date} → {req.end_date}
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-700 dark:text-gray-300">
                          {req.working_days} days
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-700 dark:text-gray-300 max-w-xs truncate">
                          {req.reason}
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                        <td className="px-6 py-4 text-xs text-gray-500">{req.review_comment || '-'}</td>
                        <td className="px-6 py-4 text-right">
                          {req.status === 'PENDING' ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => {
                                if (confirm('Are you sure you want to cancel this pending leave request?')) {
                                  cancelMutation.mutate(req.id);
                                }
                              }}
                            >
                              Cancel
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
        </div>
      )}

      {/* MODAL 1: Standard Apply Leave Modal */}
      <Modal
        isOpen={showApplyModal}
        onClose={() => setShowApplyModal(false)}
        title="Apply for Time Off"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyMutation.mutate(applyForm);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Leave Category
            </label>
            <select
              required
              value={applyForm.leave_type_id}
              onChange={(e) => setApplyForm({ ...applyForm, leave_type_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            >
              <option value="" disabled>
                Select leave type...
              </option>
              {leaveTypes?.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code}) - {t.is_unpaid ? 'Unpaid' : `${t.yearly_quota} days/yr`}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                required
                value={applyForm.start_date}
                onChange={(e) => setApplyForm({ ...applyForm, start_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                required
                value={applyForm.end_date}
                onChange={(e) => setApplyForm({ ...applyForm, end_date: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason / Notes
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Taking annual leave for family travel..."
              value={applyForm.reason}
              onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
          </div>

          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Weekends (Sat-Sun) and company public holidays are automatically excluded from working days calculation.
            </span>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowApplyModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={applyMutation.isPending}>
              Submit Application
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Smart Leave AI Parser */}
      <Modal
        isOpen={showSmartModal}
        onClose={() => setShowSmartModal(false)}
        title="Smart Leave in Plain Words"
      >
        <form onSubmit={handleSmartLeaveSubmit} className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Describe your leave request naturally in plain English or Roman Urdu. The AI assistant will identify the
            leave type, calculate dates, and draft your application.
          </p>

          <div>
            <textarea
              required
              rows={4}
              placeholder="e.g. 'I have a high fever and doctor advised rest for 2 days starting tomorrow.' or 'Going to Lahore for brother wedding next Friday to Monday.'"
              value={smartInput}
              onChange={(e) => setSmartInput(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-indigo-300 dark:border-indigo-600 bg-indigo-50/30 dark:bg-indigo-950/20 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowSmartModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Sparkles}
              type="submit"
              loading={smartLoading}
            >
              Parse & Auto-Fill
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Review Leave Application Modal (HR / Admin) */}
      <Modal
        isOpen={!!reviewItem}
        onClose={() => setReviewItem(null)}
        title={`Review Leave Request: ${reviewStatus}`}
      >
        {reviewItem && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Employee: <strong>{reviewItem.employee_name}</strong>
              <br />
              Category: <strong>{reviewItem.leave_type_name}</strong>
              <br />
              Period: <strong>{reviewItem.start_date}</strong> to <strong>{reviewItem.end_date}</strong> (
              <strong>{reviewItem.working_days} working days</strong>)
              <br />
              Reason: <em>"{reviewItem.reason}"</em>
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reviewer Comment (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Approved. Please hand over urgent tasks to team lead."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <Button variant="ghost" size="sm" onClick={() => setReviewItem(null)}>
                Cancel
              </Button>
              <Button
                variant={reviewStatus === 'APPROVED' ? 'success' : 'danger'}
                size="sm"
                loading={reviewMutation.isPending}
                onClick={() =>
                  reviewMutation.mutate({
                    id: reviewItem.id,
                    data: { status: reviewStatus, review_comment: reviewComment },
                  })
                }
              >
                Confirm {reviewStatus}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
