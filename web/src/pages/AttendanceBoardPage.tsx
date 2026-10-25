import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Camera,
  MapPin,
  Filter,
  Check,
  X,
  FileEdit,
  History,
  ShieldCheck,
  FileText,
  Download,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api, apiFetch } from '../services/api';
import GlassCard from '../components/common/GlassCard';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import Skeleton from '../components/common/Skeleton';
import CameraAttendanceModal from '../components/attendance/CameraAttendanceModal';

export default function AttendanceBoardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const role = user?.role?.toLowerCase();
  const isEmployee = role === 'employee';
  const isAdminOrHR = role === 'admin' || role === 'hr';

  // Filters & State
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [activeTab, setActiveTab] = useState<'board' | 'corrections' | 'my-history' | 'report'>(
    isEmployee ? 'my-history' : 'board'
  );
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraType, setCameraType] = useState<'check-in' | 'check-out'>('check-in');

  // Manual Check-Out state for HR
  const [clockingOutStaffId, setClockingOutStaffId] = useState<number | null>(null);

  // Report tab states
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const [reportMonth, setReportMonth] = useState<number>(currentMonth);
  const [reportYear, setReportYear] = useState<number>(currentYear);
  const [reportEmployeeId, setReportEmployeeId] = useState<number | string>(user?.employee_id || 1);
  const [employeesList, setEmployeesList] = useState<any[]>([]);

  useEffect(() => {
    if (isAdminOrHR) {
      apiFetch<any>('/employees?page_size=100').then((res) => {
        if (res?.items) {
          setEmployeesList(res.items);
          if (!user?.employee_id && res.items.length > 0) {
            setReportEmployeeId(res.items[0].id);
          }
        }
      }).catch(() => {});
    }
  }, [isAdminOrHR]);

  const handleAdminManualCheckout = async (employeeId: number, employeeName: string) => {
    if (!window.confirm(`Are you sure you want to manually clock out ${employeeName}?`)) return;
    setClockingOutStaffId(employeeId);
    try {
      await api.adminManualCheckout(employeeId);
      alert(`Manual check-out recorded successfully for ${employeeName}.`);
      queryClient.invalidateQueries({ queryKey: ['attendanceBoard'] });
    } catch (err: any) {
      alert(err.response?.data?.detail || err.message || 'Manual checkout failed');
    } finally {
      setClockingOutStaffId(null);
    }
  };

  // Correction Modal State
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({
    date: today,
    requested_check_in: '09:00',
    requested_check_out: '18:00',
    reason: '',
  });

  // Review Correction State (HR/Admin)
  const [reviewModalItem, setReviewModalItem] = useState<any | null>(null);
  const [reviewStatus, setReviewStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewNote, setReviewNote] = useState('');

  // 1. Fetch Daily Attendance Board (HR/Admin)
  const { data: dailyBoard, isLoading: loadingBoard } = useQuery({
    queryKey: ['attendanceBoard', selectedDate],
    queryFn: () => api.getDailyAttendance(selectedDate),
    enabled: isAdminOrHR,
  });

  // 2. Fetch Employee's Own Attendance History
  const { data: myHistory, isLoading: loadingMyHistory } = useQuery({
    queryKey: ['myAttendance'],
    queryFn: () => api.getMyAttendance(),
    enabled: isEmployee || activeTab === 'my-history',
  });

  // 3. Fetch Pending Corrections (HR/Admin)
  const { data: correctionsList, isLoading: loadingCorrections } = useQuery({
    queryKey: ['attendanceCorrections'],
    queryFn: () => api.getAttendanceCorrections(),
    enabled: isAdminOrHR || isEmployee,
  });

  // 4. Fetch Monthly Attendance Report (HR/Admin & Employee)
  const { data: attendanceReport, isLoading: loadingReport } = useQuery({
    queryKey: ['attendanceReport', reportEmployeeId, reportMonth, reportYear],
    queryFn: () => api.getAttendanceReport(reportEmployeeId, reportMonth, reportYear),
    enabled: activeTab === 'report' && Boolean(reportEmployeeId),
  });

  // Mutations
  const webCheckInMutation = useMutation({
    mutationFn: (data?: any) => api.checkIn(data),
    onSuccess: (res: any) => {
      alert(`Checked in successfully! Status: ${res.status}`);
      queryClient.invalidateQueries({ queryKey: ['attendanceBoard'] });
      queryClient.invalidateQueries({ queryKey: ['myAttendance'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Check-in failed');
    },
  });

  const webCheckOutMutation = useMutation({
    mutationFn: (data?: any) => api.checkOut(data),
    onSuccess: (res: any) => {
      alert(`Checked out successfully! Total hours: ${res.work_hours || 0}`);
      queryClient.invalidateQueries({ queryKey: ['attendanceBoard'] });
      queryClient.invalidateQueries({ queryKey: ['myAttendance'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Check-out failed');
    },
  });

  const requestCorrectionMutation = useMutation({
    mutationFn: (data: any) => api.requestCorrection(data),
    onSuccess: () => {
      alert('Correction request submitted for HR review!');
      setShowCorrectionModal(false);
      setCorrectionForm({ date: today, requested_check_in: '09:00', requested_check_out: '18:00', reason: '' });
      queryClient.invalidateQueries({ queryKey: ['attendanceCorrections'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to submit correction request');
    },
  });

  const reviewCorrectionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.reviewCorrection(id, data),
    onSuccess: () => {
      alert(`Correction request marked as ${reviewStatus}!`);
      setReviewModalItem(null);
      setReviewNote('');
      queryClient.invalidateQueries({ queryKey: ['attendanceCorrections'] });
      queryClient.invalidateQueries({ queryKey: ['attendanceBoard'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Review action failed');
    },
  });

  // Today's record for Employee
  const todayRecord = myHistory?.find((r: any) => r.date === today);

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'present':
        return <Badge variant="success">Present</Badge>;
      case 'late':
        return <Badge variant="warning">Late (After 09:15)</Badge>;
      case 'half_day':
        return <Badge variant="secondary">Half Day (&lt;5h)</Badge>;
      case 'absent':
        return <Badge variant="danger">Absent</Badge>;
      case 'on_leave':
        return <Badge variant="primary">On Leave</Badge>;
      case 'missing_checkout':
        return <Badge variant="warning">Missing Checkout</Badge>;
      default:
        return <Badge variant="secondary">{status || 'Unknown'}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-7 h-7 text-indigo-500" />
            Attendance Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isEmployee
              ? 'Check in, view your daily working hours, and request time adjustments.'
              : 'Monitor real-time company attendance, daily check-ins, and pending corrections.'}
          </p>
        </div>

        {/* Quick Check-in/out Buttons for Employee */}
        {isEmployee && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={Clock}
              disabled={webCheckInMutation.isPending || !!todayRecord?.check_in_time}
              onClick={() => webCheckInMutation.mutate({})}
            >
              {todayRecord?.check_in_time ? 'Checked In' : 'Quick Check-In'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={webCheckOutMutation.isPending || !todayRecord?.check_in_time || !!todayRecord?.check_out_time}
              onClick={() => webCheckOutMutation.mutate({})}
            >
              {todayRecord?.check_out_time ? 'Checked Out' : 'Quick Check-Out'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={Camera}
              onClick={() => {
                setCameraType(todayRecord?.check_in_time ? 'check-out' : 'check-in');
                setShowCameraModal(true);
              }}
            >
              Camera + GPS
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {isAdminOrHR && (
          <button
            onClick={() => setActiveTab('board')}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'board'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            Daily Attendance Board
          </button>
        )}
        <button
          onClick={() => setActiveTab('my-history')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'my-history'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {isEmployee ? 'My Attendance Calendar' : 'My Records'}
        </button>
        <button
          onClick={() => setActiveTab('corrections')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors relative ${
            activeTab === 'corrections'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Attendance Corrections
          {Array.isArray(correctionsList) && correctionsList.filter((c: any) => c.status === 'PENDING').length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
              {correctionsList.filter((c: any) => c.status === 'PENDING').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('report')}
          className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'report'
              ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Monthly Attendance Report</span>
        </button>
      </div>

      {/* TAB 1: Daily Attendance Board (HR / Admin) */}
      {isAdminOrHR && activeTab === 'board' && (
        <div className="space-y-6">
          {/* Date Picker Bar & Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/60 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <label htmlFor="board-date" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                View Date:
              </label>
              <input
                id="board-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedDate(today)}>
                Today
              </Button>
            </div>
          </div>

          {/* Quick Metrics */}
          {dailyBoard && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <GlassCard className="p-4 text-center">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Check-Ins</span>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {dailyBoard?.records?.length || 0}
                </p>
              </GlassCard>
              <GlassCard className="p-4 text-center">
                <span className="text-xs font-medium text-emerald-500">Present</span>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {dailyBoard?.records?.filter((r: any) => r.status === 'present').length || 0}
                </p>
              </GlassCard>
              <GlassCard className="p-4 text-center">
                <span className="text-xs font-medium text-amber-500">Late (&gt;09:15)</span>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {dailyBoard?.records?.filter((r: any) => r.status === 'late').length || 0}
                </p>
              </GlassCard>
              <GlassCard className="p-4 text-center">
                <span className="text-xs font-medium text-blue-500">Half Day (&lt;5h)</span>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {dailyBoard?.records?.filter((r: any) => r.status === 'half_day').length || 0}
                </p>
              </GlassCard>
              <GlassCard className="p-4 text-center">
                <span className="text-xs font-medium text-purple-500">On Leave</span>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                  {dailyBoard?.records?.filter((r: any) => r.status === 'on_leave').length || 0}
                </p>
              </GlassCard>
            </div>
          )}

          {/* Table */}
          <GlassCard className="overflow-hidden p-0">
            {loadingBoard ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : dailyBoard?.records?.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No attendance records found"
                description={`No employees have checked in or recorded attendance for ${selectedDate}.`}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200/50 dark:border-gray-700/50">
                    <tr>
                      <th className="px-6 py-4">Employee</th>
                      <th className="px-6 py-4">Department</th>
                      <th className="px-6 py-4">Check-In</th>
                      <th className="px-6 py-4">Check-Out</th>
                      <th className="px-6 py-4">Hours</th>
                      <th className="px-6 py-4">Verification</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">HR Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/40 dark:divide-gray-800/40">
                    {(dailyBoard?.records || []).map((rec: any) => (
                      <tr key={rec.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                          <div>
                            <p className="font-semibold">{rec.employee_name || 'N/A'}</p>
                            <span className="text-xs text-gray-400">{rec.employee_code}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">{rec.department_name || '-'}</td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {rec.check_in_time ? new Date(rec.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {rec.check_out_time ? new Date(rec.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-700 dark:text-gray-300">
                          {rec.work_hours ? `${rec.work_hours.toFixed(1)} hrs` : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {rec.face_verified && (
                              <span title="Face Verified" className="p-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500">
                                <Camera className="w-3.5 h-3.5" />
                              </span>
                            )}
                            {rec.location_verified && (
                              <span title="Office Geofence Verified" className="p-1 rounded bg-emerald-50 dark:bg-emerald-900/30 text-emerald-500">
                                <MapPin className="w-3.5 h-3.5" />
                              </span>
                            )}
                            {!rec.face_verified && !rec.location_verified && (
                              <span className="text-xs text-gray-400">Web</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(rec.status)}</td>
                        <td className="px-6 py-4 text-right">
                          {rec.check_in_time && !rec.check_out_time ? (
                            <Button
                              variant="danger"
                              size="sm"
                              disabled={clockingOutStaffId === rec.employee_id}
                              onClick={() => handleAdminManualCheckout(rec.employee_id, rec.employee_name)}
                              icon={Clock}
                            >
                              {clockingOutStaffId === rec.employee_id ? 'Clocking Out...' : 'Manual Check-Out'}
                            </Button>
                          ) : (
                            <span className="text-xs text-gray-400 font-medium">Completed</span>
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

      {/* TAB 2: Employee My Attendance */}
      {activeTab === 'my-history' && (
        <div className="space-y-6">
          {/* Today's overview card */}
          {todayRecord ? (
            <GlassCard className="p-6 border-indigo-500/30 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs uppercase tracking-wider text-indigo-500 font-bold">Today's Shift</span>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                    {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                  </h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-300">
                    <span>
                      Check-In:{' '}
                      <strong className="font-mono text-indigo-600 dark:text-indigo-400">
                        {todayRecord.check_in_time ? new Date(todayRecord.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                      </strong>
                    </span>
                    <span>
                      Check-Out:{' '}
                      <strong className="font-mono text-indigo-600 dark:text-indigo-400">
                        {todayRecord.check_out_time ? new Date(todayRecord.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                      </strong>
                    </span>
                    <span>
                      Hours: <strong>{todayRecord.work_hours ? `${todayRecord.work_hours.toFixed(1)} hrs` : '0 hrs'}</strong>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(todayRecord.status)}
                </div>
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="p-6 text-center border-dashed">
              <Clock className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
              <p className="text-gray-700 dark:text-gray-300 font-medium">You haven't checked in yet today.</p>
              <p className="text-xs text-gray-500 mt-1">Office starts at 09:00 with a 15-minute grace period.</p>
              <div className="mt-4 flex justify-center gap-3">
                <Button size="sm" variant="primary" onClick={() => webCheckInMutation.mutate({})}>
                  Check In Now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  icon={Camera}
                  onClick={() => {
                    setCameraType('check-in');
                    setShowCameraModal(true);
                  }}
                >
                  Camera + GPS Check-In
                </Button>
              </div>
            </GlassCard>
          )}

          {/* Action to Request Correction */}
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Attendance Logs</h2>
            <Button
              variant="outline"
              size="sm"
              icon={FileEdit}
              onClick={() => setShowCorrectionModal(true)}
            >
              Request Correction
            </Button>
          </div>

          {/* History Table */}
          <GlassCard className="overflow-hidden p-0">
            {loadingMyHistory ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : myHistory?.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No attendance records"
                description="Your attendance logs will appear here once you check in."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200/50 dark:border-gray-700/50">
                    <tr>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Check-In</th>
                      <th className="px-6 py-4">Check-Out</th>
                      <th className="px-6 py-4">Hours</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/40 dark:divide-gray-800/40">
                    {(Array.isArray(myHistory) ? myHistory : []).map((rec: any) => (
                      <tr key={rec.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{rec.date}</td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {rec.check_in_time ? new Date(rec.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {rec.check_out_time ? new Date(rec.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-700 dark:text-gray-300">
                          {rec.work_hours ? `${rec.work_hours.toFixed(1)} hrs` : '-'}
                        </td>
                        <td className="px-6 py-4">{getStatusBadge(rec.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* TAB 3: Attendance Corrections */}
      {activeTab === 'corrections' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {isEmployee ? 'My Attendance Correction Requests' : 'Pending Attendance Corrections'}
              </h2>
              <p className="text-xs text-gray-500">
                {isEmployee
                  ? 'Track the status of your adjustment requests.'
                  : 'Review and approve/reject employee time adjustment requests.'}
              </p>
            </div>
            {isEmployee && (
              <Button
                variant="primary"
                size="sm"
                icon={FileEdit}
                onClick={() => setShowCorrectionModal(true)}
              >
                New Request
              </Button>
            )}
          </div>

          <GlassCard className="overflow-hidden p-0">
            {loadingCorrections ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : correctionsList?.length === 0 ? (
              <EmptyState
                icon={FileEdit}
                title="No correction requests"
                description="There are currently no attendance correction requests."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200/50 dark:border-gray-700/50">
                    <tr>
                      {!isEmployee && <th className="px-6 py-4">Employee</th>}
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Requested Times</th>
                      <th className="px-6 py-4">Reason</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Reviewer Note</th>
                      {!isEmployee && <th className="px-6 py-4 text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/40 dark:divide-gray-800/40">
                    {(Array.isArray(correctionsList) ? correctionsList : []).map((corr: any) => (
                      <tr key={corr.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors">
                        {!isEmployee && (
                          <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                            {corr.employee_name || 'Employee'}
                          </td>
                        )}
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">{corr.date}</td>
                        <td className="px-6 py-4 font-mono text-xs">
                          <div>In: {corr.requested_check_in || '-'}</div>
                          <div>Out: {corr.requested_check_out || '-'}</div>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-700 dark:text-gray-300 max-w-xs truncate">
                          {corr.reason}
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              corr.status === 'APPROVED'
                                ? 'success'
                                : corr.status === 'REJECTED'
                                ? 'danger'
                                : 'warning'
                            }
                          >
                            {corr.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500">{corr.review_note || '-'}</td>
                        {!isEmployee && (
                          <td className="px-6 py-4 text-right">
                            {corr.status === 'PENDING' ? (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => {
                                    setReviewModalItem(corr);
                                    setReviewStatus('APPROVED');
                                  }}
                                  className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
                                  title="Approve"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setReviewModalItem(corr);
                                    setReviewStatus('REJECTED');
                                  }}
                                  className="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 transition-colors"
                                  title="Reject"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Reviewed</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* TAB 4: Date-Wise Monthly Attendance Report (Weekend Off rule) */}
      {activeTab === 'report' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/60 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex flex-wrap items-center gap-3">
              {isAdminOrHR && employeesList.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Staff Member:</label>
                  <select
                    value={reportEmployeeId}
                    onChange={(e) => setReportEmployeeId(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    {employeesList.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_code}) - {emp.department_name || 'Staff'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Month:</label>
                <select
                  value={reportMonth}
                  onChange={(e) => setReportMonth(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {[
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                  ].map((mName, i) => (
                    <option key={i + 1} value={i + 1}>{mName}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Year:</label>
                <select
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {[2024, 2025, 2026, 2027].map((yr) => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => window.print()} icon={FileText}>
                Print / Save PDF
              </Button>
            </div>
          </div>

          {/* Report Summary Cards */}
          {attendanceReport && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-sky-500/10 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                    {attendanceReport.employee_name} ({attendanceReport.employee_code})
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Department: <strong className="text-gray-700 dark:text-gray-200">{attendanceReport.department_name}</strong> | Period: {attendanceReport.month}/{attendanceReport.year}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-400 font-bold border border-purple-500/20">
                    Saturday & Sunday: Full Weekend (Off)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <GlassCard className="p-3 text-center">
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Days in Month</span>
                  <p className="text-xl font-bold text-gray-900 dark:text-white mt-0.5">{attendanceReport.total_days}</p>
                </GlassCard>
                <GlassCard className="p-3 text-center">
                  <span className="text-[11px] font-medium text-sky-500">Working Days</span>
                  <p className="text-xl font-bold text-sky-600 dark:text-sky-400 mt-0.5">{attendanceReport.working_days_count}</p>
                </GlassCard>
                <GlassCard className="p-3 text-center">
                  <span className="text-[11px] font-medium text-purple-500">Weekend Days (Off)</span>
                  <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">{attendanceReport.weekend_days_count}</p>
                </GlassCard>
                <GlassCard className="p-3 text-center">
                  <span className="text-[11px] font-medium text-emerald-500">Present (On Time)</span>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{attendanceReport.present_days}</p>
                </GlassCard>
                <GlassCard className="p-3 text-center">
                  <span className="text-[11px] font-medium text-amber-500">Late Arrivals</span>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">{attendanceReport.late_days}</p>
                </GlassCard>
                <GlassCard className="p-3 text-center">
                  <span className="text-[11px] font-medium text-indigo-500">Total Hours Worked</span>
                  <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{attendanceReport.total_working_hours.toFixed(1)}h</p>
                </GlassCard>
              </div>
            </div>
          )}

          {/* Date-wise Table */}
          <GlassCard className="overflow-hidden p-0">
            {loadingReport ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : !attendanceReport?.records?.length ? (
              <EmptyState
                icon={Calendar}
                title="No report records available"
                description="Select an employee and period to fetch official attendance audit."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200/50 dark:border-gray-700/50">
                    <tr>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Day of Week</th>
                      <th className="px-5 py-3.5">Check-In</th>
                      <th className="px-5 py-3.5">Check-Out</th>
                      <th className="px-5 py-3.5">Working Hours</th>
                      <th className="px-5 py-3.5">Method</th>
                      <th className="px-5 py-3.5">Audit Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/40 dark:divide-gray-800/40">
                    {attendanceReport.records.map((item: any, idx: number) => {
                      const isWk = item.is_weekend;
                      return (
                        <tr
                          key={idx}
                          className={`transition-colors ${
                            isWk
                              ? 'bg-purple-500/5 dark:bg-purple-900/10'
                              : 'hover:bg-gray-50/40 dark:hover:bg-gray-800/40'
                          }`}
                        >
                          <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-900 dark:text-white">
                            {item.date}
                          </td>
                          <td className="px-5 py-3 text-xs">
                            <span className={isWk ? 'font-bold text-purple-600 dark:text-purple-400' : 'text-gray-700 dark:text-gray-300'}>
                              {item.day_name}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-mono text-xs">
                            {item.check_in_time || '--:--'}
                          </td>
                          <td className="px-5 py-3 font-mono text-xs">
                            {item.check_out_time || '--:--'}
                          </td>
                          <td className="px-5 py-3 font-semibold text-xs text-gray-800 dark:text-gray-200">
                            {item.working_hours > 0 ? `${item.working_hours.toFixed(1)} hrs` : '--'}
                          </td>
                          <td className="px-5 py-3 text-xs">
                            <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[11px] text-gray-600 dark:text-gray-400">
                              {item.source || (isWk ? 'Calendar' : 'N/A')}
                            </span>
                          </td>
                          <td className="px-5 py-3">
                            {isWk ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25">
                                🌴 Weekend (Off)
                              </span>
                            ) : item.status === 'present' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Present (On Time)
                              </span>
                            ) : item.status === 'late' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                                <AlertTriangle className="w-3.5 h-3.5" /> Late Arrival
                              </span>
                            ) : item.status === 'half_day' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                                Half Day (&lt;5h)
                              </span>
                            ) : item.status === 'on_leave' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25">
                                Approved Leave
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                                <XCircle className="w-3.5 h-3.5" /> Absent
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* MODAL 1: Request Correction Modal */}
      <Modal
        isOpen={showCorrectionModal}
        onClose={() => setShowCorrectionModal(false)}
        title="Request Attendance Correction"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            requestCorrectionMutation.mutate(correctionForm);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
            <input
              type="date"
              required
              value={correctionForm.date}
              onChange={(e) => setCorrectionForm({ ...correctionForm, date: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Requested Check-In
              </label>
              <input
                type="time"
                value={correctionForm.requested_check_in}
                onChange={(e) => setCorrectionForm({ ...correctionForm, requested_check_in: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Requested Check-Out
              </label>
              <input
                type="time"
                value={correctionForm.requested_check_out}
                onChange={(e) => setCorrectionForm({ ...correctionForm, requested_check_out: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reason for Adjustment
            </label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Forgot to punch out due to client emergency meeting..."
              value={correctionForm.reason}
              onChange={(e) => setCorrectionForm({ ...correctionForm, reason: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowCorrectionModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={requestCorrectionMutation.isPending}>
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Review Correction Modal (HR / Admin) */}
      <Modal
        isOpen={!!reviewModalItem}
        onClose={() => setReviewModalItem(null)}
        title={`Review Correction: ${reviewStatus}`}
      >
        {reviewModalItem && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Employee: <strong>{reviewModalItem.employee_name}</strong>
              <br />
              Date: <strong>{reviewModalItem.date}</strong>
              <br />
              Requested Times: <strong>{reviewModalItem.requested_check_in}</strong> to{' '}
              <strong>{reviewModalItem.requested_check_out}</strong>
              <br />
              Reason: <em>"{reviewModalItem.reason}"</em>
            </p>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reviewer Note / Comment
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Approved as per team lead confirmation..."
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <Button variant="ghost" size="sm" onClick={() => setReviewModalItem(null)}>
                Cancel
              </Button>
              <Button
                variant={reviewStatus === 'APPROVED' ? 'success' : 'danger'}
                size="sm"
                loading={reviewCorrectionMutation.isPending}
                onClick={() =>
                  reviewCorrectionMutation.mutate({
                    id: reviewModalItem.id,
                    data: { status: reviewStatus, review_note: reviewNote },
                  })
                }
              >
                Confirm {reviewStatus}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: Camera & Geolocation Attendance Modal */}
      {showCameraModal && (
        <CameraAttendanceModal
          isOpen={showCameraModal}
          onClose={() => setShowCameraModal(false)}
          type={cameraType}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['attendanceBoard'] });
            queryClient.invalidateQueries({ queryKey: ['myAttendance'] });
          }}
        />
      )}
    </div>
  );
}
