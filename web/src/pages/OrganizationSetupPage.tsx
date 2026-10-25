import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Settings,
  Users,
  Briefcase,
  Calendar,
  MapPin,
  Clock,
  Shield,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  Lock,
  Check,
  X,
  Eye,
  EyeOff,
  KeyRound,
  Copy,
  CheckCheck,
  RotateCcw,
  UserCheck,
  UserX,
} from 'lucide-react';
import { api } from '../services/api';
import GlassCard from '../components/common/GlassCard';
import Button from '../components/common/Button';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';

export default function OrganizationSetupPage() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'settings' | 'departments' | 'designations' | 'leave-types' | 'holidays' | 'users'>(
    'settings'
  );

  // 1. Fetch Company Settings
  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ['companySettings'],
    queryFn: () => api.getCompanySettings(),
  });

  // 2. Fetch Departments
  const { data: departments, isLoading: loadingDepts } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.getDepartments(),
  });

  // 3. Fetch Designations
  const { data: designations, isLoading: loadingDesigs } = useQuery({
    queryKey: ['designations'],
    queryFn: () => api.getDesignations(),
  });

  // 4. Fetch Leave Types
  const { data: leaveTypes, isLoading: loadingLeaveTypes } = useQuery({
    queryKey: ['leaveTypes'],
    queryFn: () => api.getLeaveTypes(),
  });

  // 5. Fetch Public Holidays
  const { data: holidays, isLoading: loadingHolidays } = useQuery({
    queryKey: ['holidays'],
    queryFn: () => api.getHolidays(),
  });

  // 6. Fetch Users (HR / Admin list)
  const { data: userAccounts, isLoading: loadingUsers } = useQuery({
    queryKey: ['userAccounts'],
    queryFn: () => api.getUsers(),
  });

  // Local state for settings form
  const [settingsForm, setSettingsForm] = useState<any>(null);

  React.useEffect(() => {
    if (settings && !settingsForm) {
      setSettingsForm(settings);
    }
  }, [settings]);

  // Modals state
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [deptForm, setDeptForm] = useState({ name: '', code: '', description: '' });

  const [showDesigModal, setShowDesigModal] = useState(false);
  const [desigForm, setDesigForm] = useState({ title: '', department_id: '', description: '' });

  const [showLeaveTypeModal, setShowLeaveTypeModal] = useState(false);
  const [leaveTypeForm, setLeaveTypeForm] = useState({
    name: '',
    code: '',
    yearly_quota: 12,
    is_unpaid: false,
    description: '',
  });

  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    date: new Date().toISOString().split('T')[0],
    name: '',
    is_optional: false,
  });

  const [showCreateHRModal, setShowCreateHRModal] = useState(false);
  const [showHrPassword, setShowHrPassword] = useState(false);
  const [hrForm, setHrForm] = useState({
    email: 'hr@hmclite',
    full_name: '',
    password: '',
  });

  const [showResetModal, setShowResetModal] = useState(false);
  const [resetData, setResetData] = useState<{ email: string; temporary_password: string; message: string } | null>(null);
  const [copiedTempPwd, setCopiedTempPwd] = useState(false);
  const [hrError, setHrError] = useState<string | null>(null);

  // HR Email and Password live validations
  const cleanHrEmail = hrForm.email.trim().toLowerCase();
  const hrEndsWithHmclite = cleanHrEmail.endsWith('hmclite') || cleanHrEmail.endsWith('hcmlite');
  const hrEmailPrefix = cleanHrEmail.replace(/@?(hmclite|hcmlite)$/, '').replace(/[@._-]/g, '');
  const hrHasPrefix = hrEmailPrefix.length > 0;

  const hrPasswordChecks = [
    { id: 'num', label: 'Number (0-9)', valid: /[0-9]/.test(hrForm.password) },
    { id: 'spec', label: 'Special character (!@#$%^&*)', valid: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(hrForm.password) },
    { id: 'upper', label: 'Uppercase letter (A-Z)', valid: /[A-Z]/.test(hrForm.password) },
    { id: 'lower', label: 'Lowercase letter (a-z)', valid: /[a-z]/.test(hrForm.password) },
    { id: 'len', label: 'Minimum 8 characters', valid: hrForm.password.length >= 8 },
  ];
  const isHrPasswordValid = hrPasswordChecks.every((c) => c.valid);

  // Mutations
  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => api.updateCompanySettings(data),
    onSuccess: (updated) => {
      alert('Company settings updated successfully! New policies will apply to upcoming records.');
      setSettingsForm(updated);
      queryClient.invalidateQueries({ queryKey: ['companySettings'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to update company settings');
    },
  });

  const createDeptMutation = useMutation({
    mutationFn: (data: any) => api.createDepartment(data),
    onSuccess: () => {
      alert('Department created!');
      setShowDeptModal(false);
      setDeptForm({ name: '', code: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to create department');
    },
  });

  const createDesigMutation = useMutation({
    mutationFn: (data: any) => api.createDesignation(data),
    onSuccess: () => {
      alert('Designation created!');
      setShowDesigModal(false);
      setDesigForm({ title: '', department_id: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['designations'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to create designation');
    },
  });

  const createLeaveTypeMutation = useMutation({
    mutationFn: (data: any) => api.createLeaveType(data),
    onSuccess: () => {
      alert('Leave type created!');
      setShowLeaveTypeModal(false);
      setLeaveTypeForm({ name: '', code: '', yearly_quota: 12, is_unpaid: false, description: '' });
      queryClient.invalidateQueries({ queryKey: ['leaveTypes'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to create leave type');
    },
  });

  const createHolidayMutation = useMutation({
    mutationFn: (data: any) => api.createHoliday(data),
    onSuccess: () => {
      alert('Public holiday added!');
      setShowHolidayModal(false);
      setHolidayForm({ date: new Date().toISOString().split('T')[0], name: '', is_optional: false });
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.detail || 'Failed to add holiday');
    },
  });

  const createHRMutation = useMutation({
    mutationFn: (data: any) => api.createHR(data),
    onSuccess: () => {
      setShowCreateHRModal(false);
      setHrForm({ email: 'hr@hmclite', full_name: '', password: '' });
      setHrError(null);
      queryClient.invalidateQueries({ queryKey: ['userAccounts'] });
    },
    onError: (err: any) => {
      setHrError(err.message || 'Failed to create HR account');
    },
  });

  const deactivateUserMutation = useMutation({
    mutationFn: (id: string | number) => api.deactivateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userAccounts'] });
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to deactivate user');
    },
  });

  const activateUserMutation = useMutation({
    mutationFn: (id: string | number) => api.activateUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userAccounts'] });
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to activate user');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (id: string | number) => api.resetUserPassword(id),
    onSuccess: (data: any) => {
      setResetData(data);
      setShowResetModal(true);
      setCopiedTempPwd(false);
      queryClient.invalidateQueries({ queryKey: ['userAccounts'] });
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to reset password');
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Building2 className="w-7 h-7 text-indigo-500" />
          Organization Setup & Governance
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configure office hours, geofence radius, departments, designations, annual leave quotas, holidays, and HR access.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
        {[
          { key: 'settings', label: 'Workforce Rules & Geofence', icon: Settings },
          { key: 'departments', label: 'Departments', icon: Building2 },
          { key: 'designations', label: 'Designations', icon: Briefcase },
          { key: 'leave-types', label: 'Leave Quotas', icon: Calendar },
          { key: 'holidays', label: 'Public Holidays', icon: Calendar },
          { key: 'users', label: 'Admin & HR Logins', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 pb-3 px-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Company Rules & Geofencing */}
      {activeTab === 'settings' && (
        <GlassCard className="p-6">
          {loadingSettings || !settingsForm ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateSettingsMutation.mutate(settingsForm);
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Company Legal Name
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.company_name || ''}
                    onChange={(e) => setSettingsForm({ ...settingsForm, company_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Office Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={settingsForm.office_start_time || '09:00'}
                    onChange={(e) => setSettingsForm({ ...settingsForm, office_start_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Grace Period (Minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    required
                    value={settingsForm.grace_period_minutes ?? 15}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, grace_period_minutes: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Check-in after 09:15 is marked LATE automatically.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Half-Day Threshold (Hours)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    required
                    value={settingsForm.half_day_threshold_hours ?? 5.0}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, half_day_threshold_hours: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Work time under 5.0 hours triggers HALF_DAY deduction.
                  </p>
                </div>
              </div>

              {/* Geofence & Office Location */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5 mb-3">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  Office Geofence & Coordinates
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Office Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={settingsForm.office_latitude ?? 24.8607}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, office_latitude: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Office Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={settingsForm.office_longitude ?? 67.0011}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, office_longitude: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono text-gray-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Radius Limit (Meters)
                    </label>
                    <input
                      type="number"
                      min="10"
                      max="10000"
                      required
                      value={settingsForm.geofence_radius_meters ?? 150}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, geofence_radius_meters: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-mono text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settingsForm.face_check_required ?? false}
                    onChange={(e) =>
                      setSettingsForm({ ...settingsForm, face_check_required: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Enforce Camera Face Verification
                    </span>
                    <p className="text-xs text-gray-400">
                      When enabled, attendance check-ins require camera face capture.
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <Button
                  variant="primary"
                  type="submit"
                  icon={Save}
                  loading={updateSettingsMutation.isPending}
                >
                  Save Organization Settings
                </Button>
              </div>
            </form>
          )}
        </GlassCard>
      )}

      {/* TAB 2: Departments */}
      {activeTab === 'departments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Company Departments</h2>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setShowDeptModal(true)}>
              Add Department
            </Button>
          </div>

          <GlassCard className="overflow-hidden p-0">
            {loadingDepts ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : departments?.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No departments registered"
                description="Add your company's departments (e.g. Engineering, HR, Sales)."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200/50 dark:border-gray-700/50">
                    <tr>
                      <th className="px-6 py-4">Department Name</th>
                      <th className="px-6 py-4">Code</th>
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/40 dark:divide-gray-800/40">
                    {(Array.isArray(departments) ? departments : []).map((d: any) => (
                      <tr key={d.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{d.name}</td>
                        <td className="px-6 py-4 font-mono text-xs">{d.code}</td>
                        <td className="px-6 py-4 text-xs text-gray-500">{d.description || '-'}</td>
                        <td className="px-6 py-4 text-right">
                          <Badge variant="success">Active</Badge>
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

      {/* TAB 3: Designations */}
      {activeTab === 'designations' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Job Designations</h2>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setShowDesigModal(true)}>
              Add Designation
            </Button>
          </div>

          <GlassCard className="overflow-hidden p-0">
            {loadingDesigs ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : designations?.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title="No designations defined"
                description="Add job roles and designations (e.g. Senior Software Engineer, HR Specialist)."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200/50 dark:border-gray-700/50">
                    <tr>
                      <th className="px-6 py-4">Title</th>
                      <th className="px-6 py-4">Department</th>
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/40 dark:divide-gray-800/40">
                    {(Array.isArray(designations) ? designations : []).map((d: any) => (
                      <tr key={d.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{d.title}</td>
                        <td className="px-6 py-4">{d.department_name || '-'}</td>
                        <td className="px-6 py-4 text-xs text-gray-500">{d.description || '-'}</td>
                        <td className="px-6 py-4 text-right">
                          <Badge variant="success">Active</Badge>
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

      {/* TAB 4: Leave Types & Quotas */}
      {activeTab === 'leave-types' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Leave Types & Yearly Quotas</h2>
              <p className="text-xs text-gray-500">
                Default: Annual 14, Sick 8, Casual 10, Unpaid unlimited.
              </p>
            </div>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setShowLeaveTypeModal(true)}>
              Add Leave Type
            </Button>
          </div>

          <GlassCard className="overflow-hidden p-0">
            {loadingLeaveTypes ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : leaveTypes?.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No leave types found"
                description="Create leave types and set their yearly quotas."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200/50 dark:border-gray-700/50">
                    <tr>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Code</th>
                      <th className="px-6 py-4">Yearly Quota</th>
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/40 dark:divide-gray-800/40">
                    {(Array.isArray(leaveTypes) ? leaveTypes : []).map((t: any) => (
                      <tr key={t.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{t.name}</td>
                        <td className="px-6 py-4 font-mono text-xs">{t.code}</td>
                        <td className="px-6 py-4 font-bold text-gray-800 dark:text-gray-200">
                          {t.is_unpaid ? 'Unlimited' : `${t.yearly_quota} days`}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={t.is_unpaid ? 'secondary' : 'primary'}>
                            {t.is_unpaid ? 'Unpaid' : 'Paid'}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-xs text-gray-500">{t.description || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* TAB 5: Public Holidays */}
      {activeTab === 'holidays' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Public Holidays Calendar</h2>
              <p className="text-xs text-gray-500">
                Official holidays are automatically excluded from employee leave day deductions.
              </p>
            </div>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setShowHolidayModal(true)}>
              Add Holiday
            </Button>
          </div>

          <GlassCard className="overflow-hidden p-0">
            {loadingHolidays ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : holidays?.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No holidays listed"
                description="Add public holidays for the company calendar (e.g. Pakistan Day, Eid-ul-Fitr)."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200/50 dark:border-gray-700/50">
                    <tr>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Holiday Name</th>
                      <th className="px-6 py-4 text-right">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/40 dark:divide-gray-800/40">
                    {(Array.isArray(holidays) ? holidays : []).map((h: any) => (
                      <tr key={h.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-6 py-4 font-mono font-medium text-gray-900 dark:text-white">
                          {h.date}
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-800 dark:text-gray-200">{h.name}</td>
                        <td className="px-6 py-4 text-right">
                          <Badge variant={h.is_optional ? 'secondary' : 'success'}>
                            {h.is_optional ? 'Optional' : 'Public'}
                          </Badge>
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

      {/* TAB 6: Admin & HR User Accounts */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Admin & HR System Accounts</h2>
              <p className="text-xs text-gray-500">
                Manage HR credentials and system access. Employees are created in the Employee Directory.
              </p>
            </div>
            <Button variant="primary" size="sm" icon={Plus} onClick={() => setShowCreateHRModal(true)}>
              Create HR Login
            </Button>
          </div>

          <GlassCard className="overflow-hidden p-0">
            {loadingUsers ? (
              <div className="p-6 space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : userAccounts?.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No user accounts"
                description="Create HR users to allow people operations."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
                  <thead className="bg-gray-50/50 dark:bg-gray-800/50 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider border-b border-gray-200/50 dark:border-gray-700/50">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200/40 dark:divide-gray-800/40">
                    {(Array.isArray(userAccounts) ? userAccounts : []).map((u: any) => (
                      <tr key={u.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">
                          {u.full_name || 'System User'}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs text-gray-600 dark:text-gray-300">{u.email}</td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              u.role === 'admin' ? 'danger' : u.role === 'hr' ? 'primary' : 'secondary'
                            }
                          >
                            {u.role.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant={u.is_active ? 'success' : 'secondary'}>
                              {u.is_active ? 'Active' : 'Deactivated'}
                            </Badge>
                            {u.must_change_password && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                Temp Password
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          {u.role !== 'admin' && (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={Lock}
                                className="text-sky-400 hover:text-sky-300 text-xs"
                                onClick={() => {
                                  if (confirm(`Reset password for ${u.email}? The user will be required to change password on next sign-in.`)) {
                                    resetPasswordMutation.mutate(u.id);
                                  }
                                }}
                              >
                                Reset Password
                              </Button>
                              {u.is_active ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={UserX}
                                  className="text-rose-400 hover:text-rose-300 text-xs"
                                  onClick={() => {
                                    if (confirm(`Deactivate access for ${u.email}?`)) {
                                      deactivateUserMutation.mutate(u.id);
                                    }
                                  }}
                                >
                                  Deactivate
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={UserCheck}
                                  className="text-emerald-400 hover:text-emerald-300 text-xs"
                                  onClick={() => {
                                    activateUserMutation.mutate(u.id);
                                  }}
                                >
                                  Activate
                                </Button>
                              )}
                            </div>
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

      {/* MODALS */}

      {/* Dept Modal */}
      <Modal isOpen={showDeptModal} onClose={() => setShowDeptModal(false)} title="Add Department">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createDeptMutation.mutate(deptForm);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Department Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Engineering"
              value={deptForm.name}
              onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Code</label>
            <input
              type="text"
              required
              placeholder="e.g. ENG"
              value={deptForm.code}
              onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm uppercase font-mono text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              value={deptForm.description}
              onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowDeptModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={createDeptMutation.isPending}>
              Create Department
            </Button>
          </div>
        </form>
      </Modal>

      {/* Desig Modal */}
      <Modal isOpen={showDesigModal} onClose={() => setShowDesigModal(false)} title="Add Designation">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createDesigMutation.mutate(desigForm);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Job Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Full Stack Developer"
              value={desigForm.title}
              onChange={(e) => setDesigForm({ ...desigForm, title: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Department
            </label>
            <select
              required
              value={desigForm.department_id}
              onChange={(e) => setDesigForm({ ...desigForm, department_id: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            >
              <option value="" disabled>
                Select department...
              </option>
              {departments?.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowDesigModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={createDesigMutation.isPending}>
              Create Designation
            </Button>
          </div>
        </form>
      </Modal>

      {/* Leave Type Modal */}
      <Modal
        isOpen={showLeaveTypeModal}
        onClose={() => setShowLeaveTypeModal(false)}
        title="Add Leave Policy Type"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createLeaveTypeMutation.mutate(leaveTypeForm);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Leave Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Annual Leave"
              value={leaveTypeForm.name}
              onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Code</label>
              <input
                type="text"
                required
                placeholder="e.g. AL"
                value={leaveTypeForm.code}
                onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm uppercase font-mono text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Yearly Quota (Days)
              </label>
              <input
                type="number"
                min="0"
                required
                disabled={leaveTypeForm.is_unpaid}
                value={leaveTypeForm.yearly_quota}
                onChange={(e) =>
                  setLeaveTypeForm({ ...leaveTypeForm, yearly_quota: Number(e.target.value) })
                }
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={leaveTypeForm.is_unpaid}
              onChange={(e) =>
                setLeaveTypeForm({
                  ...leaveTypeForm,
                  is_unpaid: e.target.checked,
                  yearly_quota: e.target.checked ? 0 : 14,
                })
              }
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs text-gray-700 dark:text-gray-300">
              Unpaid Leave (deducted directly from monthly payroll)
            </span>
          </label>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowLeaveTypeModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={createLeaveTypeMutation.isPending}>
              Save Leave Type
            </Button>
          </div>
        </form>
      </Modal>

      {/* Holiday Modal */}
      <Modal isOpen={showHolidayModal} onClose={() => setShowHolidayModal(false)} title="Add Public Holiday">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createHolidayMutation.mutate(holidayForm);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Holiday Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Pakistan Day"
              value={holidayForm.name}
              onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
            <input
              type="date"
              required
              value={holidayForm.date}
              onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowHolidayModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={createHolidayMutation.isPending}>
              Add Holiday
            </Button>
          </div>
        </form>
      </Modal>

      {/* HR Login Modal */}
      <Modal isOpen={showCreateHRModal} onClose={() => setShowCreateHRModal(false)} title="Create HR Specialist Account">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setHrError(null);
            if (!hrEndsWithHmclite || !hrHasPrefix) {
              setHrError("HR email must start with a username and end with hmclite (e.g. hr@hmclite).");
              return;
            }
            if (!isHrPasswordValid) {
              setHrError("Please satisfy all password security checklist criteria.");
              return;
            }
            createHRMutation.mutate(hrForm);
          }}
          className="space-y-4"
        >
          {hrError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              {hrError}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Fatima Noor"
              value={hrForm.full_name}
              onChange={(e) => setHrForm({ ...hrForm, full_name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Official Email Address (Must end with hmclite)
            </label>
            <input
              type="text"
              required
              placeholder="hr_officer@hmclite"
              value={hrForm.email}
              onChange={(e) => setHrForm({ ...hrForm, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
            />
            {/* Live Email checklist */}
            <div className="mt-1.5 flex items-center gap-1.5 text-xs">
              {hrEndsWithHmclite && hrHasPrefix ? (
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <Check className="w-3.5 h-3.5" /> Valid hmclite email
                </span>
              ) : (
                <span className="flex items-center gap-1 text-slate-400">
                  <X className="w-3.5 h-3.5 text-rose-400" /> Must end with <strong className="text-white font-mono">hmclite</strong>
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Initial Password
            </label>
            <div className="relative">
              <input
                type={showHrPassword ? 'text' : 'password'}
                required
                value={hrForm.password}
                onChange={(e) => setHrForm({ ...hrForm, password: e.target.value })}
                className="w-full px-3 pr-10 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowHrPassword(!showHrPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
              >
                {showHrPassword ? <EyeOff className="w-4 h-4 text-sky-400" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Dynamic Password checklist with green/red status - ONLY SHOWN WHEN USER ENTERED TEXT */}
            {hrForm.password.length > 0 && (
              <div className="mt-2.5 p-3 rounded-xl bg-black/40 border border-white/10 space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Password Security Checklist
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-xs">
                  {hrPasswordChecks.map((chk) => (
                    <div
                      key={chk.id}
                      className={`flex items-center gap-2 py-0.5 transition-colors ${
                        chk.valid ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'
                      }`}
                    >
                      {chk.valid ? (
                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      ) : (
                        <span className="flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                          <X className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                      )}
                      <span>{chk.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" size="sm" type="button" onClick={() => setShowCreateHRModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={createHRMutation.isPending}
              disabled={!hrEndsWithHmclite || !hrHasPrefix || !isHrPasswordValid}
            >
              Create HR Specialist
            </Button>
          </div>
        </form>
      </Modal>

      {/* Password Reset Result Modal */}
      <Modal
        isOpen={showResetModal}
        onClose={() => setShowResetModal(false)}
        title="Temporary Password Generated"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            A secure temporary password has been set for account <strong className="text-white font-mono">{resetData?.email}</strong>.
            The user must set a new personal password upon their next login.
          </p>

          <div className="p-4 rounded-xl bg-white/[0.04] border border-white/15 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Temporary Password
              </span>
              <span className="text-lg font-mono font-extrabold text-sky-400 select-all tracking-wider">
                {resetData?.temporary_password}
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              icon={copiedTempPwd ? CheckCheck : Copy}
              onClick={() => {
                if (resetData?.temporary_password) {
                  navigator.clipboard.writeText(resetData.temporary_password);
                  setCopiedTempPwd(true);
                  setTimeout(() => setCopiedTempPwd(false), 2500);
                }
              }}
            >
              {copiedTempPwd ? 'Copied!' : 'Copy Password'}
            </Button>
          </div>

          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0 text-amber-400" />
            <span>Shown once for privacy. Please transmit this password directly to the team member.</span>
          </div>

          <div className="flex justify-end pt-3 border-t border-white/10">
            <Button variant="primary" size="sm" onClick={() => setShowResetModal(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
