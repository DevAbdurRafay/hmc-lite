import React, { useEffect, useRef } from 'react';
import { BarChart3, PieChart, Users, Banknote, Building2, TrendingUp } from 'lucide-react';
import GlassCard from '../common/GlassCard';

declare global {
  interface Window {
    Plotly: any;
  }
}

interface PlotlyDashboardProps {
  employees: any[];
  title?: string;
  subtitle?: string;
}

export const PlotlyWorkforceDashboard: React.FC<PlotlyDashboardProps> = ({
  employees = [],
  title = "Real-Time Plotly Ingestion Analytics",
  subtitle = "Dynamic interactive visual analytics rendered directly from live database & uploaded workforce records",
}) => {
  const deptChartRef = useRef<HTMLDivElement>(null);
  const salaryChartRef = useRef<HTMLDivElement>(null);
  const genderChartRef = useRef<HTMLDivElement>(null);

  // Compute metrics from current employee list
  const totalEmployees = employees.length;
  const totalPayroll = employees.reduce((sum, e) => {
    const basic = Number(e.salary_structure?.basic_salary || e.basic_salary || 0);
    const gross = Number(e.salary_structure?.gross_salary || e.gross_salary || basic * 1.5);
    return sum + gross;
  }, 0);
  const avgSalary = totalEmployees > 0 ? Math.round(totalPayroll / totalEmployees) : 0;

  // Aggregate by Department
  const deptCounts: Record<string, number> = {};
  const deptSalaries: Record<string, { total: number; count: number }> = {};
  const genderCounts: Record<string, number> = { Male: 0, Female: 0, Other: 0 };

  employees.forEach((emp) => {
    const dept = emp.department_name || emp.department || 'Unassigned';
    deptCounts[dept] = (deptCounts[dept] || 0) + 1;

    const basic = Number(emp.salary_structure?.basic_salary || emp.basic_salary || 0);
    const gross = Number(emp.salary_structure?.gross_salary || emp.gross_salary || basic * 1.5);
    if (!deptSalaries[dept]) {
      deptSalaries[dept] = { total: 0, count: 0 };
    }
    deptSalaries[dept].total += gross;
    deptSalaries[dept].count += 1;

    const g = (emp.gender || 'Other').toLowerCase();
    if (g === 'male' || g === 'm') genderCounts.Male += 1;
    else if (g === 'female' || g === 'f') genderCounts.Female += 1;
    else genderCounts.Other += 1;
  });

  const deptLabels = Object.keys(deptCounts);
  const deptValues = Object.values(deptCounts);
  const deptAvgSalaries = deptLabels.map(
    (d) => Math.round(deptSalaries[d].total / deptSalaries[d].count)
  );

  useEffect(() => {
    const renderCharts = () => {
      if (!window.Plotly) return;

      const isLight = document.documentElement.classList.contains('light');
      const textColor = isLight ? '#0f172a' : '#f8fafc';
      const mutedColor = isLight ? '#475569' : '#94a3b8';
      const gridColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)';

      const colors = ['#38bdf8', '#818cf8', '#a855f7', '#34d399', '#f43f5e', '#fbbf24', '#f97316'];

      // 1. Department Donut Chart
      if (deptChartRef.current) {
        const deptData = [
          {
            values: deptValues.length > 0 ? deptValues : [1],
            labels: deptLabels.length > 0 ? deptLabels : ['No Data'],
            type: 'pie',
            hole: 0.55,
            marker: { colors },
            textinfo: deptValues.length > 0 ? 'label+percent' : 'label',
            textposition: 'outside',
            hoverinfo: 'label+value+percent',
            automargin: true,
          },
        ];

        const deptLayout = {
          font: { family: 'Montserrat, sans-serif', size: 12, color: textColor },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          showlegend: true,
          legend: { font: { family: 'Montserrat, sans-serif', color: mutedColor, size: 10 }, orientation: 'h', y: -0.15 },
          margin: { l: 20, r: 20, t: 15, b: 25 },
          height: 270,
        };

        window.Plotly.react(deptChartRef.current, deptData, deptLayout, {
          responsive: true,
          displayModeBar: false,
        });
      }

      // 2. Average Salary by Department Bar Chart
      if (salaryChartRef.current) {
        const salaryData = [
          {
            x: deptLabels.length > 0 ? deptLabels : ['None'],
            y: deptAvgSalaries.length > 0 ? deptAvgSalaries : [0],
            type: 'bar',
            marker: {
              color: '#38bdf8',
              opacity: 0.85,
              line: { color: '#0284c7', width: 1.5 },
            },
            hoverinfo: 'x+y',
          },
        ];

        const salaryLayout = {
          font: { family: 'Montserrat, sans-serif', size: 12, color: textColor },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          margin: { l: 55, r: 20, t: 15, b: 45 },
          xaxis: {
            tickfont: { family: 'Montserrat, sans-serif', color: mutedColor, size: 10 },
            gridcolor: gridColor,
            automargin: true,
          },
          yaxis: {
            tickfont: { family: 'Montserrat, sans-serif', color: mutedColor, size: 10 },
            gridcolor: gridColor,
            automargin: true,
          },
          height: 270,
        };

        window.Plotly.react(salaryChartRef.current, salaryData, salaryLayout, {
          responsive: true,
          displayModeBar: false,
        });
      }

      // 3. Gender Distribution Horizontal Bar / Donut Chart
      if (genderChartRef.current) {
        const genderLabels = Object.keys(genderCounts).filter((k) => genderCounts[k] > 0);
        const genderValues = genderLabels.map((k) => genderCounts[k]);

        const genderData = [
          {
            values: genderValues.length > 0 ? genderValues : [1],
            labels: genderLabels.length > 0 ? genderLabels : ['No Data'],
            type: 'pie',
            hole: 0.6,
            marker: { colors: ['#38bdf8', '#ec4899', '#94a3b8'] },
            hoverinfo: 'label+value+percent',
            textinfo: 'label+percent',
            automargin: true,
          },
        ];

        const genderLayout = {
          font: { family: 'Montserrat, sans-serif', size: 12, color: textColor },
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          showlegend: false,
          margin: { l: 20, r: 20, t: 15, b: 20 },
          height: 270,
        };

        window.Plotly.react(genderChartRef.current, genderData, genderLayout, {
          responsive: true,
          displayModeBar: false,
        });
      }
    };

    // Render when Plotly is ready
    if (window.Plotly) {
      renderCharts();
    } else {
      const interval = setInterval(() => {
        if (window.Plotly) {
          clearInterval(interval);
          renderCharts();
        }
      }, 200);
      return () => clearInterval(interval);
    }

    const handleResize = () => {
      if (!window.Plotly) return;
      if (deptChartRef.current) window.Plotly.Plots.resize(deptChartRef.current);
      if (salaryChartRef.current) window.Plotly.Plots.resize(salaryChartRef.current);
      if (genderChartRef.current) window.Plotly.Plots.resize(genderChartRef.current);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [employees]);

  const formatPKR = (val: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 border border-sky-500/20 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400">
              <BarChart3 className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-400/30 uppercase tracking-wider">
              Plotly v2.35 Live
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Real-Time Ingestion Sync
          </span>
        </div>
      </div>

      {/* Real-Time KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Users</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white mt-1">{totalEmployees}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Ingested employees in scope</span>
        </GlassCard>

        <GlassCard className="p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Departments</span>
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-indigo-400 mt-1">{deptLabels.length}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Active operational units</span>
        </GlassCard>

        <GlassCard className="p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Avg Monthly Gross</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-1">{formatPKR(avgSalary)}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Base + statutory allowances</span>
        </GlassCard>

        <GlassCard className="p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Monthly Payroll</span>
            <Banknote className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-purple-400 mt-1">{formatPKR(totalPayroll)}</p>
          <span className="text-[11px] text-slate-500 mt-1 block">Total gross compensation</span>
        </GlassCard>
      </div>

      {/* Plotly Interactive Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <GlassCard className="p-4 lg:col-span-1">
          <div className="mb-2">
            <h4 className="text-xs sm:text-sm font-bold text-white light:text-slate-900 tracking-tight">
              Department Headcount Distribution
            </h4>
            <p className="text-[11px] text-slate-400 light:text-slate-500">Live employee ratio by department</p>
          </div>
          <div ref={deptChartRef} className="w-full" />
        </GlassCard>

        <GlassCard className="p-4 lg:col-span-1">
          <div className="mb-2">
            <h4 className="text-xs sm:text-sm font-bold text-white light:text-slate-900 tracking-tight">
              Avg Monthly Gross by Dept (PKR)
            </h4>
            <p className="text-[11px] text-slate-400 light:text-slate-500">Mean compensation distribution</p>
          </div>
          <div ref={salaryChartRef} className="w-full" />
        </GlassCard>

        <GlassCard className="p-4 lg:col-span-1">
          <div className="mb-2">
            <h4 className="text-xs sm:text-sm font-bold text-white light:text-slate-900 tracking-tight">
              Workforce Gender Distribution
            </h4>
            <p className="text-[11px] text-slate-400 light:text-slate-500">Demographic diversity breakdown</p>
          </div>
          <div ref={genderChartRef} className="w-full" />
        </GlassCard>
      </div>
    </div>
  );
};

export default PlotlyWorkforceDashboard;
