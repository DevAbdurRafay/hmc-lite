import React, { useState, useEffect } from 'react';
import {
  Users, CheckCircle2, UserX, AlertTriangle, Clock,
  Sparkles, RefreshCw, Info, AlertCircle, MapPin, Play, Square, CheckCheck, Shield
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Skeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#0ea5e9', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#6366f1'];

export const HRDashboard: React.FC = () => {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [empData, setEmpData] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [summaryBullets, setSummaryBullets] = useState<string[] | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const fetchHRData = async () => {
    setIsLoading(true);
    try {
      let url = '/analytics/hr';
      if (selectedDept) url += `?department_id=${selectedDept}`;
      const res = await apiFetch<any>(url);
      setData(res);
    } catch {
      //
    } finally {
      setIsLoading(false);
    }
  };

  const fetchHRTimeClock = async () => {
    if (!user?.employee_id) return;
    try {
      const res = await apiFetch<any>(`/analytics/employee/${user.employee_id}`);
      setEmpData(res);
    } catch {
      //
    }
  };

  useEffect(() => {
    apiFetch<any[]>('/org/departments').then(setDepartments).catch(() => {});
    fetchHRTimeClock();
  }, [user]);

  useEffect(() => {
    fetchHRData();
  }, [selectedDept]);

  // Live ticking counter when checked in and not checked out
  useEffect(() => {
    let timer: any = null;
    const isCheckedIn = empData?.today_status && empData.today_status !== 'NOT_CHECKED_IN';
    const hasCheckedOut = Boolean(empData?.check_out_time);

    if (isCheckedIn && !hasCheckedOut) {
      timer = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [empData?.today_status, empData?.check_out_time]);

  const formatTimer = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleHRCheckIn = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsCheckingIn(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await apiFetch('/attendance/check-in', {
            method: 'POST',
            body: JSON.stringify({
              source: 'WEB',
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            }),
          });
          await fetchHRTimeClock();
          await fetchHRData();
        } catch (err: any) {
          alert(err.message || 'Check-in failed');
        } finally {
          setIsCheckingIn(false);
        }
      },
      (err) => {
        setIsCheckingIn(false);
        alert(`GPS location error: ${err.message}. Please allow location access for office check-in.`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleHRCheckOut = () => {
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
            await fetchHRTimeClock();
            await fetchHRData();
          } catch (err: any) {
            alert(err.message || 'Check-out failed');
          } finally {
            setIsCheckingOut(false);
          }
        },
        async () => {
          try {
            await apiFetch('/attendance/check-out', {
              method: 'POST',
              body: JSON.stringify({ source: 'WEB' }),
            });
            await fetchHRTimeClock();
            await fetchHRData();
          } catch (err: any) {
            alert(err.message || 'Check-out failed');
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
      }).then(() => {
        fetchHRTimeClock();
        fetchHRData();
      }).catch((err: any) => alert(err.message)).finally(() => setIsCheckingOut(false));
    }
  };

  const handleAiSummarize = async () => {
    if (!data) return;
    setIsSummarizing(true);
    try {
      const res = await apiFetch<any>('/ai/summary', {
        method: 'POST',
        body: JSON.stringify({
          dashboard_type: 'HR',
          kpi_data: data.kpis,
        }),
      });
      setSummaryBullets(res.summary_bullets);
    } catch (err: any) {
      alert(err.message || 'Unable to generate summary.');
    } finally {
      setIsSummarizing(false);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const kpis = data?.kpis || {};

  return (
    <div className="space-y-6">
      {/* Top Filter & AI Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-4">
        <div>
          <h2 className="text-xl font-extrabold text-white light:text-slate-900 tracking-tight">
            People Operations & Daily Presence
          </h2>
          <p className="text-xs text-slate-400 light:text-slate-500">
            Real-time daily attendance matrix, late trends, and approval workflows
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="glass-input px-3 py-1.5 text-xs rounded-xl"
          >
            <option value="">All Departments</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <Button
            variant="glass"
            size="sm"
            onClick={handleAiSummarize}
            isLoading={isSummarizing}
            icon={<Sparkles className="w-3.5 h-3.5 text-purple-400" />}
          >
            AI Summarize
          </Button>

          <button
            onClick={fetchHRData}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
            title="Refresh Metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AI Summary Highlight Box */}
      {summaryBullets && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-500/15 via-indigo-500/15 to-sky-500/15 border border-purple-500/30 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h4 className="text-xs font-bold text-purple-200 uppercase tracking-wider">AI Operations Digest</h4>
            <Badge variant="purple" size="sm">Strict Data Grounding</Badge>
          </div>
          <ul className="space-y-1.5 text-xs sm:text-sm text-slate-200 light:text-slate-800">
            {summaryBullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-purple-400 mt-1 shrink-0">•</span>
                <span className="leading-relaxed">
                  {bullet.split(/(\*\*[^*]+?\*\*)/g).map((part, pIdx) => {
                    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
                      return (
                        <strong key={pIdx} className="font-bold text-white light:text-slate-900 tracking-tight">
                          {part.slice(2, -2).trim()}
                        </strong>
                      );
                    }
                    return part.replace(/\*\*/g, '');
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* HR Operations Time Clock & Live Ticker */}
      <GlassCard className="p-4 sm:p-5 light:bg-white light:border-slate-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-sky-400" />
              <h3 className="font-extrabold text-base text-white light:text-slate-900">
                HR Operations Time Clock
              </h3>
              <Badge variant={empData?.today_status && empData.today_status !== 'NOT_CHECKED_IN' ? 'success' : 'neutral'} size="sm">
                {empData?.today_status || 'NOT_CHECKED_IN'}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 light:text-slate-600 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Office GPS Geofence Check-In (No camera required for HR)
            </p>
          </div>

          {/* Time & Live Ticker Display */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-white/5 light:bg-slate-100 border border-white/10 light:border-slate-200 text-center min-w-[110px]">
              <span className="text-[10px] text-slate-400 light:text-slate-500 font-semibold uppercase block">Check-In</span>
              <span className="text-sm font-bold text-white light:text-slate-900 font-mono">
                {empData?.check_in_time || '--:--'}
              </span>
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-white/5 light:bg-slate-100 border border-white/10 light:border-slate-200 text-center min-w-[110px]">
              <span className="text-[10px] text-slate-400 light:text-slate-500 font-semibold uppercase block">Check-Out</span>
              <span className="text-sm font-bold text-white light:text-slate-900 font-mono">
                {empData?.check_out_time || '--:--'}
              </span>
            </div>

            {empData?.today_status && empData.today_status !== 'NOT_CHECKED_IN' && !empData?.check_out_time && (
              <div className="px-4 py-2 rounded-xl bg-sky-500/10 light:bg-sky-50 border border-sky-500/20 text-center">
                <span className="text-[10px] text-sky-400 light:text-sky-600 font-semibold uppercase block flex items-center gap-1 justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Working Timer
                </span>
                <span className="text-base font-extrabold text-sky-300 light:text-sky-700 font-mono tracking-wider">
                  {formatTimer(elapsedSeconds)}
                </span>
              </div>
            )}

            <div>
              {!empData?.today_status || empData.today_status === 'NOT_CHECKED_IN' ? (
                <Button
                  variant="primary"
                  onClick={handleHRCheckIn}
                  isLoading={isCheckingIn}
                  icon={<Play className="w-4 h-4 fill-current" />}
                >
                  GPS Check-In
                </Button>
              ) : !empData?.check_out_time ? (
                <Button
                  variant="danger"
                  onClick={handleHRCheckOut}
                  isLoading={isCheckingOut}
                  icon={<Square className="w-4 h-4 fill-current" />}
                >
                  Clock Out
                </Button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 light:text-emerald-700 font-bold px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCheck className="w-4 h-4" /> Shift Completed
                </div>
              )}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* 5 Operational KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Headcount */}
        <GlassCard hoverLift>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-400">Headcount</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <h3 className="text-2xl font-extrabold text-white light:text-slate-900">{kpis.headcount?.value ?? 0}</h3>
          <p className="text-[11px] text-slate-400 mt-1">Total active staff</p>
        </GlassCard>

        {/* Present Today */}
        <GlassCard hoverLift>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-400">Present Today</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-2xl font-extrabold text-white light:text-slate-900">{kpis.present_today?.value ?? 0}</h3>
          <p className="text-[11px] text-emerald-400 mt-1">Checked in</p>
        </GlassCard>

        {/* On Leave Today */}
        <GlassCard hoverLift>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-400">On Leave Today</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <h3 className="text-2xl font-extrabold text-white light:text-slate-900">{kpis.on_leave_today?.value ?? 0}</h3>
          <p className="text-[11px] text-purple-400 mt-1">Approved leaves</p>
        </GlassCard>

        {/* Late Today */}
        <GlassCard hoverLift>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-400">Late Today</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <h3 className="text-2xl font-extrabold text-white light:text-slate-900">{kpis.late_today?.value ?? 0}</h3>
          <p className="text-[11px] text-amber-400 mt-1">Past 09:15 AM</p>
        </GlassCard>

        {/* Pending Approvals */}
        <GlassCard hoverLift>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-400">Pending Actions</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <h3 className="text-2xl font-extrabold text-white light:text-slate-900">{kpis.pending_approvals?.value ?? 0}</h3>
          <p className="text-[11px] text-rose-400 mt-1">Leaves & corrections</p>
        </GlassCard>
      </div>

      {/* Charts Row: Attendance Trend, Absenteeism, and Gender Diversity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard>
          <h3 className="text-sm font-bold text-white light:text-slate-900 mb-4">
            14-Day Attendance Velocity (Present vs Absent)
          </h3>
          {data?.attendance_trend?.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.attendance_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem' }} />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line type="monotone" dataKey="value" name="Present / Late" stroke="#0ea5e9" strokeWidth={2} />
                  <Line type="monotone" dataKey="secondary_value" name="Absent" stroke="#f43f5e" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState description="Attendance trend updates as staff check in." />
          )}
        </GlassCard>

        <GlassCard>
          <h3 className="text-sm font-bold text-white light:text-slate-900 mb-4">
            Absenteeism Rate by Department (%)
          </h3>
          {data?.absenteeism_by_department?.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.absenteeism_by_department}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} unit="%" />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem' }} />
                  <Bar dataKey="value" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState description="No departmental absences recorded." />
          )}
        </GlassCard>

        <GlassCard>
          <h3 className="text-sm font-bold text-white light:text-slate-900 mb-2 flex items-center justify-between">
            <span>Gender Diversity Ratio</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/15 text-pink-400 font-semibold border border-pink-500/20">
              Live Biometrics
            </span>
          </h3>
          <p className="text-xs text-slate-400 light:text-slate-500 mb-4">Accurate active employee gender distribution</p>
          {data?.gender_distribution?.length > 0 ? (
            <div className="space-y-4">
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.gender_distribution}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={68}
                      paddingAngle={4}
                    >
                      {data.gender_distribution.map((entry: any, index: number) => {
                        const lbl = (entry.label || '').toUpperCase();
                        const color = lbl === 'FEMALE' ? '#ec4899' : lbl === 'MALE' ? '#0ea5e9' : '#8b5cf6';
                        return <Cell key={`gender-${index}`} fill={color} />;
                      })}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {data.gender_distribution.map((item: any, idx: number) => {
                  const lbl = (item.label || '').toUpperCase();
                  const dotColor = lbl === 'FEMALE' ? 'bg-pink-500' : lbl === 'MALE' ? 'bg-sky-500' : 'bg-purple-500';
                  const total = data.gender_distribution.reduce((acc: number, cur: any) => acc + (cur.value || 0), 0);
                  const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                  return (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 truncate">
                        <span className={`w-2.5 h-2.5 rounded-full ${dotColor} shrink-0`} />
                        <span className="text-slate-300 light:text-slate-700 capitalize font-medium">{item.label}</span>
                      </div>
                      <span className="font-bold text-white light:text-slate-900 ml-1">{item.value} <span className="text-slate-400 font-normal">({pct}%)</span></span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <EmptyState description="Gender distribution updates as staff are registered." />
          )}
        </GlassCard>
      </div>

      {/* Row 2: Top Late-Comers & Absence Anomaly Flags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Late-Comers Ranked List */}
        <GlassCard>
          <h3 className="text-sm font-bold text-white light:text-slate-900 mb-4 flex items-center justify-between">
            <span>Top Late-Comers (Current Period)</span>
            <Badge variant="warning" size="sm">Ranked</Badge>
          </h3>
          {data?.top_late_comers?.length > 0 ? (
            <div className="space-y-2.5">
              {data.top_late_comers.map((c: any, index: number) => (
                <div key={c.employee_id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-[10px]">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-white">{c.employee_name}</p>
                      <p className="text-[11px] text-slate-400">{c.department_name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-amber-300">{c.late_count} lates</span>
                    <p className="text-[10px] text-slate-400">{c.late_percentage}% of workdays</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState description="Punctuality is high! No repeated late arrivals recorded." />
          )}
        </GlassCard>

        {/* Statistical Absence Anomalies (Z-Score) */}
        <GlassCard>
          <h3 className="text-sm font-bold text-white light:text-slate-900 mb-4 flex items-center justify-between">
            <span>Absence Anomaly Flags (Z-Score &gt; 1.5σ)</span>
            <Badge variant="danger" size="sm">Outliers</Badge>
          </h3>
          {data?.absence_anomalies?.length > 0 ? (
            <div className="space-y-2.5">
              {data.absence_anomalies.map((a: any) => (
                <div key={a.employee_id} className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white">{a.employee_name} ({a.department_name})</span>
                    <span className="font-bold text-rose-400">+{a.z_score}σ Outlier</span>
                  </div>
                  <p className="text-[11px] text-slate-300">{a.reason_note}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState description="No statistical absence anomalies detected against team baselines." />
          )}
        </GlassCard>
      </div>
    </div>
  );
};
