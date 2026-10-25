import React, { useState, useEffect } from 'react';
import {
  Users, CheckCircle2, UserX, AlertTriangle, Clock,
  Sparkles, RefreshCw, Info, AlertCircle
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

const COLORS = ['#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981'];

export const HRDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [summaryBullets, setSummaryBullets] = useState<string[] | null>(null);

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

  useEffect(() => {
    apiFetch<any[]>('/org/departments').then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    fetchHRData();
  }, [selectedDept]);

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
          <ul className="space-y-1.5 text-xs sm:text-sm text-slate-200">
            {summaryBullets.map((bullet, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-purple-400 mt-1">•</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      {/* Charts Row: Attendance Trend & Absenteeism */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
