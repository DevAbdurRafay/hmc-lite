import React, { useState, useEffect } from 'react';
import {
  Clock, CheckCircle, Camera, AlertTriangle, Calendar,
  FileText, Megaphone, Sparkles, Download, ArrowRight, ShieldCheck
} from 'lucide-react';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { CameraAttendanceModal } from '../components/attendance/CameraAttendanceModal';
import { EmptyState } from '../components/common/EmptyState';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';

export const EmployeeDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [webCheckInLoading, setWebCheckInLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const fetchDashboard = async () => {
    if (!user?.employee_id) return;
    try {
      const res = await apiFetch<any>(`/analytics/employee/${user.employee_id}`);
      setData(res);
    } catch {
      //
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [user]);

  // Live continuous duty timer ticking every second
  useEffect(() => {
    if (!data?.check_in_time || data?.check_out_time) {
      setElapsedSeconds(0);
      return;
    }
    const checkIn = new Date(data.check_in_time);
    const updateElapsed = () => {
      const now = new Date();
      const diff = Math.max(0, Math.floor((now.getTime() - checkIn.getTime()) / 1000));
      setElapsedSeconds(diff);
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [data?.check_in_time, data?.check_out_time]);

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleWebCheckIn = async () => {
    setWebCheckInLoading(true);
    try {
      await apiFetch('/attendance/check-in', {
        method: 'POST',
        body: JSON.stringify({ source: 'WEB' }),
      });
      await fetchDashboard();
    } catch (err: any) {
      alert(err.message || 'Check-in failed');
    } finally {
      setWebCheckInLoading(false);
    }
  };

  const handleCheckOut = () => {
    setIsCheckingOut(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await apiFetch('/attendance/check-out', {
              method: 'POST',
              body: JSON.stringify({
                source: 'WEB',
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
              }),
            });
            await fetchDashboard();
          } catch (err: any) {
            alert(err.message || 'Check-out rejected by company geofence policy.');
          } finally {
            setIsCheckingOut(false);
          }
        },
        async (geoErr) => {
          try {
            await apiFetch('/attendance/check-out', {
              method: 'POST',
              body: JSON.stringify({ source: 'WEB' }),
            });
            await fetchDashboard();
          } catch (err: any) {
            alert(err.message || `Location access error: ${geoErr.message}. If outside office radius, contact HR for manual checkout.`);
          } finally {
            setIsCheckingOut(false);
          }
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      apiFetch('/attendance/check-out', {
        method: 'POST',
        body: JSON.stringify({ source: 'WEB' }),
      })
        .then(() => fetchDashboard())
        .catch((err: any) => alert(err.message || 'Check-out failed'))
        .finally(() => setIsCheckingOut(false));
    }
  };

  const handleDownloadSlip = (slipId: number) => {
    const token = localStorage.getItem('hcmlite_token');
    const url = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/v1/payroll/payslips/${slipId}/pdf`;
    const win = window.open(url, '_blank');
  };

  const isCheckedIn = data?.today_status && data.today_status !== 'NOT_CHECKED_IN';
  const hasCheckedOut = Boolean(data?.check_out_time);
  const weeklyHours = data?.hours_this_week || 0;
  const progressPct = Math.min(100, Math.round((weeklyHours / 40.0) * 100));

  const formatLocalDisplayTime = (timeStr?: string) => {
    if (!timeStr) return '--:--';
    if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr;
    if (timeStr.includes('T') || timeStr.includes('-')) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      }
    }
    return timeStr;
  };

  return (
    <div className="space-y-6">
      {/* Top Welcome Card */}
      <GlassCard className="bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 border-sky-500/20 light:bg-white light:border-slate-200 light:shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white light:text-slate-900 tracking-tight">
              Welcome back, {user?.employee_name || 'Team Member'}!
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 light:text-slate-600 mt-1">
              Personal self-service portal: manage time tracking, leave requests, and verified payslips.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isCheckedIn ? 'success' : 'neutral'} size="md">
              {isCheckedIn ? `Status: ${data.today_status}` : 'Not Checked In Today'}
            </Badge>
          </div>
        </div>
      </GlassCard>

      {/* Grid: Check-in Widget & 40h Progress */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Check-In Action Card */}
        <GlassCard className="md:col-span-2 flex flex-col justify-between light:bg-white light:border-slate-200">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white light:text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-sky-400" /> Daily Time Clock
              </h3>
              <span className="text-xs text-slate-400 light:text-slate-600 font-medium">Shift: 09:00 AM (15m grace)</span>
            </div>

            {isCheckedIn && !hasCheckedOut && (
              <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                  </span>
                  <div>
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">Live Shift Timer</span>
                    <span className="text-[11px] text-slate-400 light:text-slate-600">Continuously recording shift duty</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono tracking-wider text-emerald-400">
                    {formatTimer(elapsedSeconds)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium block">HOURS : MINS : SECS</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-white/5 light:bg-slate-100/90 border border-white/10 light:border-slate-200">
                <span className="text-xs text-slate-400 light:text-slate-600 font-semibold block mb-1">Check-In Time</span>
                <span className="text-lg font-bold text-white light:text-slate-900 font-mono tracking-tight">
                  {formatLocalDisplayTime(data?.check_in_time)}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-white/5 light:bg-slate-100/90 border border-white/10 light:border-slate-200">
                <span className="text-xs text-slate-400 light:text-slate-600 font-semibold block mb-1">Check-Out Time</span>
                <span className="text-lg font-bold text-white light:text-slate-900 font-mono tracking-tight">
                  {formatLocalDisplayTime(data?.check_out_time)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-white/10 light:border-slate-200">
            {!isCheckedIn ? (
              <>
                <Button
                  variant="primary"
                  onClick={handleWebCheckIn}
                  isLoading={webCheckInLoading}
                  icon={<CheckCircle className="w-4 h-4" />}
                >
                  Standard Web Check-In
                </Button>
                <Button
                  variant="glass"
                  onClick={() => setCameraModalOpen(true)}
                  icon={<Camera className="w-4 h-4 text-sky-400" />}
                >
                  Camera + GPS Attendance
                </Button>
              </>
            ) : !hasCheckedOut ? (
              <Button
                variant="danger"
                onClick={handleCheckOut}
                isLoading={isCheckingOut}
                icon={<Clock className="w-4 h-4" />}
              >
                Clock Out for Today
              </Button>
            ) : (
              <p className="text-xs text-emerald-400 light:text-emerald-700 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Day completed! Worked hours recorded.
              </p>
            )}
          </div>
        </GlassCard>

        {/* 40h Weekly Progress Ring */}
        <GlassCard className="flex flex-col items-center justify-center text-center light:bg-white light:border-slate-200">
          <h3 className="text-xs font-bold text-slate-400 light:text-slate-600 uppercase tracking-wider mb-4">
            Weekly Hours Goal (40h)
          </h3>
          <div className="relative w-36 h-36 flex items-center justify-center mb-3">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50" cy="50" r="40"
                stroke="currentColor" className="text-white/10 light:text-slate-200" strokeWidth="10" fill="transparent"
              />
              <circle
                cx="50" cy="50" r="40"
                stroke="#0ea5e9" strokeWidth="10" fill="transparent"
                strokeDasharray={251.2}
                strokeDashoffset={251.2 - (251.2 * progressPct) / 100}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-2xl font-extrabold text-white light:text-slate-900">{weeklyHours}h</span>
              <span className="text-[10px] text-slate-400 light:text-slate-600 font-medium">of 40 hrs</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 light:text-slate-600 font-medium">
            {progressPct}% completed this workweek
          </p>
        </GlassCard>
      </div>

      {/* Leave Balances Grid */}
      <div>
        <h3 className="text-sm font-bold text-white light:text-slate-900 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-400" /> My Annual Leave Balances
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {data?.leave_balances?.map((b: any) => (
            <GlassCard key={b.code} hoverLift className="p-4 light:bg-white light:border-slate-200">
              <span className="text-xs font-semibold text-slate-400 light:text-slate-700 block mb-1">{b.name}</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold text-white light:text-slate-900">
                  {b.is_unpaid ? '∞' : b.remaining_balance}
                </span>
                {!b.is_unpaid && <span className="text-xs text-slate-400 light:text-slate-600">/ {b.quota} days</span>}
              </div>
              <span className="text-[11px] text-slate-400 light:text-slate-600 block mt-2 font-medium">
                {b.used_days} days utilized
              </span>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Row: Recent Payslip & Announcements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Latest Payslip Card */}
        <GlassCard className="light:bg-white light:border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white light:text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" /> Latest Verified Payslip
            </h3>
            {data?.last_payslip && (
              <Badge variant="success" size="sm">Finalized</Badge>
            )}
          </div>
          {data?.last_payslip ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 light:bg-emerald-50 border border-emerald-500/20 light:border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400 light:text-slate-600 block">
                  Period: {String(data.last_payslip.month).padStart(2, '0')}/{data.last_payslip.year}
                </span>
                <span className="text-xl font-bold text-emerald-400 light:text-emerald-700">
                  PKR {data.last_payslip.net_salary?.toLocaleString()}
                </span>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDownloadSlip(data.last_payslip.id)}
                icon={<Download className="w-4 h-4" />}
              >
                Download PDF
              </Button>
            </div>
          ) : (
            <EmptyState description="No payslips generated for your account yet." />
          )}
        </GlassCard>

        {/* Announcements Feed */}
        <GlassCard className="light:bg-white light:border-slate-200">
          <h3 className="text-sm font-bold text-white light:text-slate-900 mb-4 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-400" /> Company Announcements
          </h3>
          {data?.announcements?.length > 0 ? (
            <div className="space-y-3">
              {data.announcements.map((a: any) => (
                <div key={a.id} className="p-3 rounded-xl bg-white/5 light:bg-slate-100/90 border border-white/10 light:border-slate-200 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white light:text-slate-900">{a.title}</span>
                    <span className="text-[10px] text-slate-400 light:text-slate-500">{a.created_at}</span>
                  </div>
                  <p className="text-slate-300 light:text-slate-700 text-[11px] leading-relaxed">{a.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState description="No company announcements posted." />
          )}
        </GlassCard>
      </div>

      {/* Camera Attendance Modal */}
      <CameraAttendanceModal
        isOpen={cameraModalOpen}
        onClose={() => setCameraModalOpen(false)}
        onSuccess={() => fetchDashboard()}
      />
    </div>
  );
};
