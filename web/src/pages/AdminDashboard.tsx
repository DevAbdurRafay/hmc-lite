import React, { useState, useEffect } from 'react';
import {
  Users, TrendingDown, DollarSign, Award,
  Sparkles, ArrowUpRight, ArrowDownRight, Info, Filter,
  ShieldAlert, Download, RefreshCw
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

export const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('30d');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [summaryBullets, setSummaryBullets] = useState<string[] | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      let url = '/analytics/admin';
      const params = new URLSearchParams();
      if (selectedDept) params.append('department_id', selectedDept);
      if (params.toString()) url += `?${params.toString()}`;

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
    fetchDashboardData();
  }, [selectedDept, dateRange]);

  const handleAiSummarize = async () => {
    if (!data) return;
    setIsSummarizing(true);
    try {
      const res = await apiFetch<any>('/ai/summary', {
        method: 'POST',
        body: JSON.stringify({
          dashboard_type: 'ADMIN',
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
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
            Executive Analytics & Workforce Intel
          </h2>
          <p className="text-xs text-slate-400 light:text-slate-500">
            Company-wide consolidated metrics and explainable risk indicators
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Department Filter */}
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

          {/* AI Summarize Button */}
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
            onClick={fetchDashboardData}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
            title="Refresh Metrics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AI Summary Highlight Box (if triggered) */}
      {summaryBullets && (
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-purple-500/15 via-indigo-500/15 to-sky-500/15 border border-purple-500/30 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h4 className="text-xs font-bold text-purple-200 uppercase tracking-wider">AI Executive Briefing</h4>
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

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Headcount */}
        <GlassCard hoverLift>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 light:text-slate-500 mb-1">
                <span>{kpis.headcount?.label || 'Total Headcount'}</span>
                <span title={kpis.headcount?.tooltip}><Info className="w-3 h-3 text-slate-400" /></span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white light:text-slate-900 tracking-tight">
                {kpis.headcount?.value ?? 0}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1 text-xs text-emerald-400">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Active & probation employees</span>
          </div>
        </GlassCard>

        {/* Attrition YTD */}
        <GlassCard hoverLift>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 light:text-slate-500 mb-1">
                <span>{kpis.attrition_ytd?.label || 'Attrition (YTD)'}</span>
                <span title={kpis.attrition_ytd?.tooltip}><Info className="w-3 h-3 text-slate-400" /></span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white light:text-slate-900 tracking-tight">
                {kpis.attrition_ytd?.value ?? '0.0%'}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/20">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            <span>Year-to-date annualized turnover</span>
          </div>
        </GlassCard>

        {/* Monthly Payroll Cost */}
        <GlassCard hoverLift>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 light:text-slate-500 mb-1">
                <span>{kpis.payroll_cost?.label || 'Monthly Payroll'}</span>
                <span title={kpis.payroll_cost?.tooltip}><Info className="w-3 h-3 text-slate-400" /></span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white light:text-slate-900 tracking-tight">
                {kpis.payroll_cost?.value ?? 'PKR 0'}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            <span>Total gross payroll in PKR</span>
          </div>
        </GlassCard>

        {/* Average Salary */}
        <GlassCard hoverLift>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 light:text-slate-500 mb-1">
                <span>{kpis.average_salary?.label || 'Average Salary'}</span>
                <span title={kpis.average_salary?.tooltip}><Info className="w-3 h-3 text-slate-400" /></span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white light:text-slate-900 tracking-tight">
                {kpis.average_salary?.value ?? 'PKR 0'}
              </h3>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            <span>Mean gross salary per employee</span>
          </div>
        </GlassCard>
      </div>

      {/* Charts Row 1: Headcount & Payroll by Department */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard>
          <h3 className="text-sm font-bold text-white light:text-slate-900 mb-4">
            Headcount by Department
          </h3>
          {data?.headcount_by_department?.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.headcount_by_department}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem' }}
                  />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState description="No departmental headcount records yet." />
          )}
        </GlassCard>

        <GlassCard>
          <h3 className="text-sm font-bold text-white light:text-slate-900 mb-4">
            Payroll Cost Trend (Gross vs Net)
          </h3>
          {data?.monthly_payroll_trend?.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.monthly_payroll_trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Line type="monotone" dataKey="value" name="Gross Pay" stroke="#0ea5e9" strokeWidth={2} />
                  <Line type="monotone" dataKey="secondary_value" name="Net Pay" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState description="Payroll trend will appear once monthly drafts are generated." />
          )}
        </GlassCard>
      </div>

      {/* Charts Row 2: Demographic & Tenure Distribution */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <GlassCard>
          <h3 className="text-sm font-bold text-white light:text-slate-900 mb-4">
            Gender Demographics
          </h3>
          {data?.gender_distribution?.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.gender_distribution}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    label
                  >
                    {data.gender_distribution.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState description="Demographics appear after registering employees." />
          )}
        </GlassCard>

        <GlassCard>
          <h3 className="text-sm font-bold text-white light:text-slate-900 mb-4">
            Tenure Milestones
          </h3>
          {data?.tenure_distribution?.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.tenure_distribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} />
                  <YAxis type="category" dataKey="label" stroke="#94a3b8" fontSize={10} width={75} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem' }} />
                  <Bar dataKey="value" fill="#a855f7" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState description="Tenure bands calculate automatically." />
          )}
        </GlassCard>

        {/* Explainable Attrition Risk Hotspots */}
        <GlassCard>
          <h3 className="text-sm font-bold text-white light:text-slate-900 mb-3 flex items-center justify-between">
            <span>Attrition Risk Hotspots</span>
            <Badge variant="danger" size="sm">Explainable AI</Badge>
          </h3>
          {data?.attrition_risk_hotspots?.length > 0 ? (
            <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {data.attrition_risk_hotspots.map((item: any) => (
                <div key={item.employee_id} className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white">{item.employee_name}</span>
                    <span className="font-bold text-rose-400">{item.risk_score}/100</span>
                  </div>
                  <p className="text-[11px] text-slate-400">{item.factors?.join(' • ')}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState description="No high-risk retention flags identified." />
          )}
        </GlassCard>
      </div>

      {/* Moving Average Projections & Forecasts */}
      {data?.forecasts?.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.forecasts.map((f: any, i: number) => (
            <GlassCard key={i} className="border-sky-500/20 bg-sky-500/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-sky-400">{f.metric}</span>
                <Badge variant="info" size="sm">Statistical Forecast</Badge>
              </div>
              <div className="flex items-baseline gap-3 mb-1">
                <span className="text-2xl font-extrabold text-white">
                  {typeof f.forecasted_next_month === 'number' && f.forecasted_next_month > 1000
                    ? `PKR ${f.forecasted_next_month.toLocaleString()}`
                    : `${f.forecasted_next_month}%`}
                </span>
                <span className="text-xs text-slate-400">Projected Next Month</span>
              </div>
              <p className="text-[11px] text-slate-400">{f.note}</p>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
};
