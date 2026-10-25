import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  Download,
  Lock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Calendar,
  Users,
  ShieldCheck,
  TrendingDown,
  FileText,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import GlassCard from '../components/common/GlassCard';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import EmptyState from '../components/common/EmptyState';
import Skeleton from '../components/common/Skeleton';

export default function PayrollPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const role = user?.role?.toLowerCase();
  const isEmployee = role === 'employee';
  const isAdmin = role === 'admin';
  const isHR = role === 'hr';

  // Date selection
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // 1. Fetch Payroll Runs (Admin/HR)
  const { data: runs, isLoading: loadingRuns } = useQuery({
    queryKey: ['payrollRuns'],
    queryFn: () => api.getPayrollRuns(),
    enabled: !isEmployee,
  });

  // Current selected run
  const activeRun = runs?.find(
    (r: any) => r.month === selectedMonth && r.year === selectedYear
  );

  // 2. Fetch Run Payslips if active run exists (Admin/HR)
  const { data: runDetails, isLoading: loadingRunDetails } = useQuery({
    queryKey: ['payrollRunDetails', activeRun?.id],
    queryFn: () => api.getPayrollRun(activeRun.id),
    enabled: !!activeRun?.id && !isEmployee,
  });

  // 3. Fetch Employee's Personal Payslips
  const { data: myPayslips, isLoading: loadingMyPayslips } = useQuery({
    queryKey: ['myPayslips'],
    queryFn: () => api.getMyPayslips(),
    enabled: isEmployee,
  });

  // Mutations
  const generateDraftMutation = useMutation({
    mutationFn: (data: { month: number; year: number }) => api.generatePayrollDraft(data),
    onSuccess: () => {
      alert(`Payroll draft for ${selectedMonth}/${selectedYear} generated successfully!`);
      queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to generate payroll draft');
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: (runId: string) => api.finalizePayrollRun(runId),
    onSuccess: () => {
      alert('Payroll finalized and locked! Payslips are now officially released to employees.');
      queryClient.invalidateQueries({ queryKey: ['payrollRuns'] });
      queryClient.invalidateQueries({ queryKey: ['payrollRunDetails'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to finalize payroll');
    },
  });

  const handleDownloadPdf = async (payslipId: string, employeeName?: string) => {
    try {
      const blob = await api.downloadPayslipPdf(payslipId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payslip_${employeeName ? employeeName.replace(/\s+/g, '_') : 'HCM'}_${selectedMonth}_${selectedYear}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Could not download payslip PDF: ' + (err.response?.data?.detail || err.message));
    }
  };

  const formatPKR = (val: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: 'PKR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const months = [
    { num: 1, name: 'January' },
    { num: 2, name: 'February' },
    { num: 3, name: 'March' },
    { num: 4, name: 'April' },
    { num: 5, name: 'May' },
    { num: 6, name: 'June' },
    { num: 7, name: 'July' },
    { num: 8, name: 'August' },
    { num: 9, name: 'September' },
    { num: 10, name: 'October' },
    { num: 11, name: 'November' },
    { num: 12, name: 'December' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Banknote className="w-7 h-7 text-indigo-500" />
            Payroll Lite
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isEmployee
              ? 'View your monthly payslip history, deductions breakdown, and download verified PDFs.'
              : 'Automated gross calculations (1.5x basic), attendance & leave deductions, progressive tax slabs, and Admin locking.'}
          </p>
        </div>

        {/* HR/Admin Actions */}
        {!isEmployee && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              disabled={activeRun?.is_finalized || generateDraftMutation.isPending}
              loading={generateDraftMutation.isPending}
              onClick={() => generateDraftMutation.mutate({ month: selectedMonth, year: selectedYear })}
            >
              {activeRun ? 'Re-generate Draft' : 'Generate Monthly Draft'}
            </Button>

            {isAdmin && activeRun && !activeRun.is_finalized && (
              <Button
                variant="primary"
                size="sm"
                icon={Lock}
                loading={finalizeMutation.isPending}
                onClick={() => {
                  if (
                    confirm(
                      'Are you sure you want to FINALIZE this payroll run? Once finalized, it will be permanently locked and cannot be edited.'
                    )
                  ) {
                    finalizeMutation.mutate(activeRun.id);
                  }
                }}
              >
                Finalize & Lock Payroll
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ADMIN & HR VIEW */}
      {!isEmployee && (
        <div className="space-y-6">
          {/* Controls Bar: Month / Year Picker */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/60 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
            <div className="flex flex-wrap items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <label htmlFor="payroll-month" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Payroll Period:
              </label>
              <select
                id="payroll-month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              >
                {months.map((m) => (
                  <option key={m.num} value={m.num}>
                    {m.name}
                  </option>
                ))}
              </select>

              <select
                id="payroll-year"
                aria-label="Payroll Year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
              >
                {[2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Run Status Pill */}
            <div>
              {activeRun ? (
                <div className="flex items-center gap-2">
                  <Badge variant={activeRun.is_finalized ? 'success' : 'warning'}>
                    {activeRun.is_finalized ? (
                      <span className="flex items-center gap-1">
                        <Lock className="w-3 h-3" /> Finalized & Locked
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <FileSpreadsheet className="w-3 h-3" /> Draft (In Review)
                      </span>
                    )}
                  </Badge>
                  {activeRun.is_finalized && (
                    <span className="text-xs text-gray-400">
                      Locked on {new Date(activeRun.finalized_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ) : (
                <Badge variant="secondary">Not Generated</Badge>
              )}
            </div>
          </div>

          {/* Run Summary KPIs */}
          {activeRun && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <GlassCard className="p-4">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  Total Gross Cost
                </span>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatPKR(activeRun.total_gross)}
                </p>
                <span className="text-xs text-gray-400 mt-1 block">
                  {runDetails?.payslips?.length || 0} employees
                </span>
              </GlassCard>

              <GlassCard className="p-4">
                <span className="text-xs font-semibold text-emerald-500 uppercase">Total Net Payout</span>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {formatPKR(activeRun.total_net)}
                </p>
                <span className="text-xs text-gray-400 mt-1 block">Payable via bank transfer</span>
              </GlassCard>

              <GlassCard className="p-4">
                <span className="text-xs font-semibold text-blue-500 uppercase">Total Income Tax</span>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {formatPKR(activeRun.total_tax)}
                </p>
                <span className="text-xs text-gray-400 mt-1 block">Annualized slab formula</span>
              </GlassCard>

              <GlassCard className="p-4">
                <span className="text-xs font-semibold text-amber-500 uppercase">Attendance Deductions</span>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {formatPKR(activeRun.total_deductions)}
                </p>
                <span className="text-xs text-gray-400 mt-1 block">Absent + unpaid + half-days</span>
              </GlassCard>
            </div>
          )}

          {/* Payslips Table */}
          <GlassCard className="overflow-hidden p-0">
            {loadingRuns || loadingRunDetails ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !activeRun ? (
              <EmptyState
                icon={Banknote}
                title={`No payroll run for ${months.find((m) => m.num === selectedMonth)?.name} ${selectedYear}`}
                description="Click 'Generate Monthly Draft' above to automatically calculate monthly salaries based on registered employees and attendance records."
              />
            ) : runDetails?.payslips?.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No employees found"
                description="Register employees and define their salary structure before generating payroll."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200/50 dark:border-gray-700/50">
                    <tr>
                      <th className="px-6 py-4">Employee</th>
                      <th className="px-6 py-4">Department</th>
                      <th className="px-6 py-4">Basic Pay</th>
                      <th className="px-6 py-4">Gross (1.5x)</th>
                      <th className="px-6 py-4">Deductions</th>
                      <th className="px-6 py-4">Tax</th>
                      <th className="px-6 py-4 font-bold text-gray-900 dark:text-white">Net Pay</th>
                      <th className="px-6 py-4 text-right">Payslip PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/40 dark:divide-gray-800/40">
                    {runDetails?.payslips?.map((p: any) => (
                      <tr key={p.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                          <div>
                            <p className="font-semibold">{p.employee_name}</p>
                            <span className="text-xs text-gray-400">{p.employee_code}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">{p.department_name || '-'}</td>
                        <td className="px-6 py-4 font-mono text-xs">{formatPKR(p.basic_salary)}</td>
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">
                          {formatPKR(p.gross_salary)}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-amber-600 dark:text-amber-400">
                          <div>{formatPKR(p.deductions)}</div>
                          <span className="text-[10px] text-gray-400">
                            {p.absent_days || 0}a, {p.half_days || 0}h, {p.unpaid_leave_days || 0}u
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-blue-600 dark:text-blue-400">
                          {formatPKR(p.tax)}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {formatPKR(p.net_salary)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={Download}
                            onClick={() => handleDownloadPdf(p.id, p.employee_name)}
                            title="Download PDF Payslip"
                          >
                            PDF
                          </Button>
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

      {/* EMPLOYEE VIEW: My Payslips */}
      {isEmployee && (
        <div className="space-y-6">
          <div className="p-4 bg-indigo-50/60 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 text-sm text-indigo-900 dark:text-indigo-200">
            <h3 className="font-bold mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Verified Payroll Self-Service
            </h3>
            <p className="text-xs text-indigo-700 dark:text-indigo-300">
              Salary structure: Gross = Basic + 40% HRA + 10% Medical. Deductions are calculated per-day for
              unapproved absences, unpaid leave, and half-days. Income tax is withheld according to federal tax slabs.
            </p>
          </div>

          <GlassCard className="overflow-hidden p-0">
            {loadingMyPayslips ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : myPayslips?.length === 0 ? (
              <EmptyState
                icon={FileSpreadsheet}
                title="No payslips available"
                description="Your payslips will be available for download once monthly payroll is finalized by Admin."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200/50 dark:border-gray-700/50">
                    <tr>
                      <th className="px-6 py-4">Period</th>
                      <th className="px-6 py-4">Basic Pay</th>
                      <th className="px-6 py-4">Gross Pay</th>
                      <th className="px-6 py-4">Deductions</th>
                      <th className="px-6 py-4">Income Tax</th>
                      <th className="px-6 py-4 font-bold text-gray-900 dark:text-white">Net Salary</th>
                      <th className="px-6 py-4 text-right">Download</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/40 dark:divide-gray-800/40">
                    {myPayslips.map((p: any) => (
                      <tr key={p.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                          {months.find((m) => m.num === p.month)?.name} {p.year}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">{formatPKR(p.basic_salary)}</td>
                        <td className="px-6 py-4 font-mono text-xs">{formatPKR(p.gross_salary)}</td>
                        <td className="px-6 py-4 font-mono text-xs text-amber-600 dark:text-amber-400">
                          {formatPKR(p.deductions)}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-blue-600 dark:text-blue-400">
                          {formatPKR(p.tax)}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          {formatPKR(p.net_salary)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            icon={Download}
                            onClick={() => handleDownloadPdf(p.id, user?.full_name || user?.employee_name || user?.email)}
                          >
                            PDF Payslip
                          </Button>
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
    </div>
  );
}
