import React, { useState, useEffect, useRef } from 'react';
import {
  Users, UserPlus, FileSpreadsheet, Download, Search,
  Filter, Eye, Edit2, AlertCircle, CheckCircle, Shield,
  Phone, Mail, Calendar, DollarSign, ArrowRight, X, Camera, Upload, Check, Power
} from 'lucide-react';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { TableSkeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';
import { Employee, Department, Designation } from '../types';
import { apiFetch } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { PlotlyWorkforceDashboard } from '../components/analytics/PlotlyWorkforceDashboard';
import { CsvDropzoneModal } from '../components/employees/CsvDropzoneModal';

export const EmployeeDirectoryPage: React.FC = () => {
  const { user } = useAuth();
  const isHR = user?.role === 'HR';
  const isAdmin = user?.role === 'ADMIN';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const handleStatusChange = async (empId: number, newStatus: string) => {
    const isTerminating = newStatus === 'TERMINATED' || newStatus === 'RESIGNED';
    const confirmMsg = isTerminating
      ? `Are you sure you want to mark this employee as ${newStatus}? Their account will be deactivated and portal access blocked immediately.`
      : `Change employee status to ${newStatus}?`;
    if (!window.confirm(confirmMsg)) return;

    setActionLoadingId(empId);
    try {
      await apiFetch(`/employees/${empId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchEmployees();
    } catch (err: any) {
      alert(err.message || 'Status update failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  // Modals state
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [profile360Open, setProfile360Open] = useState(false);
  const [selectedEmp360, setSelectedEmp360] = useState<any>(null);
  const [tempCredsModal, setTempCredsModal] = useState<{ email: string; tempPass: string } | null>(null);

  // Registration Form
  const [regForm, setRegForm] = useState({
    employee_code: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    gender: 'MALE',
    department_id: '',
    designation_id: '',
    joining_date: new Date().toISOString().split('T')[0],
    basic_salary: '',
    status: 'ACTIVE',
    face_image_data: '',
  });
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);

  // Camera capture state for biometric face registration
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const startFaceCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch {
      alert('Unable to access camera. Please check browser permissions or upload a photo.');
    }
  };

  const captureFaceSnapshot = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setRegForm(prev => ({ ...prev, face_image_data: dataUrl }));
    }
    stopFaceCamera();
  };

  const stopFaceCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    setCameraActive(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setRegForm(prev => ({ ...prev, face_image_data: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  // CSV Dry Run state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvDryRunResult, setCsvDryRunResult] = useState<any>(null);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedDept) params.append('department_id', selectedDept);
      if (selectedStatus) params.append('status_filter', selectedStatus);

      const res = await apiFetch<any>(`/employees?${params.toString()}`);
      setEmployees(res.items || []);
    } catch {
      //
    } finally {
      setIsLoading(false);
    }
  };

  const loadMetadata = () => {
    apiFetch<Department[]>('/org/departments').then(setDepartments).catch(() => {});
    apiFetch<Designation[]>('/org/designations').then(setDesignations).catch(() => {});
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [search, selectedDept, selectedStatus]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegLoading(true);
    setRegError(null);

    try {
      const res = await apiFetch<any>('/employees', {
        method: 'POST',
        body: JSON.stringify({
          ...regForm,
          department_id: Number(regForm.department_id),
          designation_id: Number(regForm.designation_id),
          basic_salary: parseFloat(regForm.basic_salary),
        }),
      });

      setTempCredsModal({
        email: res.employee.email,
        tempPass: res.temporary_password,
      });

      setRegisterModalOpen(false);
      setRegForm({
        employee_code: '', first_name: '', last_name: '', email: '', phone: '',
        gender: 'MALE', face_image_data: '',
        department_id: '', designation_id: '', joining_date: new Date().toISOString().split('T')[0],
        basic_salary: '', status: 'ACTIVE',
      });
      fetchEmployees();
    } catch (err: any) {
      setRegError(err.message || 'Registration failed');
    } finally {
      setRegLoading(false);
    }
  };

  const handleCsvDryRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    setCsvLoading(true);
    setCsvError(null);

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const result = await apiFetch<any>('/employees/csv-dry-run', {
        method: 'POST',
        body: formData,
      });
      setCsvDryRunResult(result);
    } catch (err: any) {
      setCsvError(err.message || 'CSV dry run analysis failed');
    } finally {
      setCsvLoading(false);
    }
  };

  const handleCommitCsv = async () => {
    if (!csvFile) return;
    setCsvLoading(true);
    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const res = await apiFetch<any>('/employees/csv-import', {
        method: 'POST',
        body: formData,
      });
      alert(res.message || 'CSV Employees imported successfully!');
      setCsvModalOpen(false);
      setCsvDryRunResult(null);
      setCsvFile(null);
      fetchEmployees();
      loadMetadata();
    } catch (err: any) {
      alert(err.message || 'Import execution failed');
    } finally {
      setCsvLoading(false);
    }
  };

  const open360 = async (empId: number) => {
    try {
      const res = await apiFetch<any>(`/employees/${empId}/360`);
      setSelectedEmp360(res);
      setProfile360Open(true);
    } catch (err: any) {
      alert(err.message || 'Failed to load 360 profile');
    }
  };

  const filteredDesignations = regForm.department_id
    ? designations.filter(d => d.department_id === Number(regForm.department_id))
    : designations;

  return (
    <div className="space-y-6">
      {/* Real-Time Plotly Ingestion Analytics Dashboard */}
      <PlotlyWorkforceDashboard employees={employees} />

      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-extrabold text-white light:text-slate-900 tracking-tight">
              Employee Directory & Records
            </h2>
            {isHR && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                HR Lifecycle Authority
              </span>
            )}
            {isAdmin && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/20">
                Admin Audit & View Mode
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 light:text-slate-500">
            {isHR
              ? 'Full personnel lifecycle: onboard staff, manage probation/status, or deactivate profiles.'
              : 'Enterprise workforce directory: view master profiles and organizational structure.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="glass"
            size="sm"
            onClick={() => setCsvModalOpen(true)}
            icon={<FileSpreadsheet className="w-4 h-4 text-emerald-400" />}
          >
            CSV Import
          </Button>
          <a
            href={`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/v1/employees/export/csv`}
            download="employees.csv"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl glass-card text-xs text-slate-300 font-medium hover:text-white"
          >
            <Download className="w-4 h-4 text-sky-400" />
            <span>Export CSV</span>
          </a>
          {isHR && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setRegisterModalOpen(true)}
              icon={<UserPlus className="w-4 h-4" />}
            >
              Register Employee
            </Button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <GlassCard className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, email..."
              className="w-full glass-input pl-10 pr-3 py-2 text-xs"
            />
          </div>
          <div>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full glass-input px-3 py-2 text-xs"
            >
              <option value="">All Departments</option>
              {(departments || []).map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full glass-input px-3 py-2 text-xs"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PROBATION">Probation</option>
              <option value="RESIGNED">Resigned</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Employee Table */}
      <GlassCard variant="panel" className="p-0 overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={6} />
        ) : employees.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No employees registered"
              description="No data yet — records appear as people use the app. Click 'Register Employee' or use 'CSV Import' to add staff."
              action={
                <Button variant="primary" size="sm" onClick={() => setRegisterModalOpen(true)}>
                  Register First Employee
                </Button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5 light:bg-slate-100 text-slate-400 light:text-slate-600 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Department & Role</th>
                  <th className="py-3 px-4">Gross Salary</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {(employees || []).map((emp) => (
                  <tr key={emp.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-bold text-white light:text-slate-900 block">
                          {emp.full_name}
                        </span>
                        <span className="text-slate-400 text-[11px]">{emp.email}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-medium text-sky-400">
                      {emp.employee_code}
                    </td>
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="text-slate-200 light:text-slate-800 font-medium block">
                          {emp.department_name || 'N/A'}
                        </span>
                        <span className="text-slate-400 text-[11px]">{emp.designation_title || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-200 light:text-slate-800">
                      PKR {emp.salary_structure?.gross_salary?.toLocaleString() || '0'}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={emp.status === 'ACTIVE' ? 'success' : emp.status === 'PROBATION' ? 'warning' : 'danger'}
                        size="sm"
                      >
                        {emp.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isHR && (
                          <div className="flex items-center gap-1.5">
                            {/* HR Lifecycle Status Dropdown */}
                            <select
                              value={emp.status}
                              disabled={actionLoadingId === emp.id}
                              onChange={(e) => handleStatusChange(emp.id, e.target.value)}
                              className="bg-black/40 text-white border border-white/15 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-sky-400 font-medium"
                              title="Update Employee Lifecycle Status"
                            >
                              <option value="ACTIVE">Active</option>
                              <option value="PROBATION">Probation</option>
                              <option value="RESIGNED">Resigned</option>
                              <option value="TERMINATED">Terminated</option>
                            </select>

                            {/* 1-Click Quick Deactivate / Reactivate Button */}
                            {emp.status === 'TERMINATED' || emp.status === 'RESIGNED' ? (
                              <button
                                onClick={() => handleStatusChange(emp.id, 'ACTIVE')}
                                disabled={actionLoadingId === emp.id}
                                className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/30 text-[11px] font-semibold transition-colors"
                                title="Reactivate Account"
                              >
                                {actionLoadingId === emp.id ? '...' : 'Reactivate'}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStatusChange(emp.id, 'TERMINATED')}
                                disabled={actionLoadingId === emp.id}
                                className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30 text-[11px] font-semibold transition-colors"
                                title="Deactivate Account & Block Login"
                              >
                                {actionLoadingId === emp.id ? '...' : 'Deactivate'}
                              </button>
                            )}
                          </div>
                        )}

                        <Button
                          variant="glass"
                          size="sm"
                          onClick={() => open360(emp.id)}
                          icon={<Eye className="w-3.5 h-3.5 text-sky-400" />}
                        >
                          360 View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Registration Modal */}
      <Modal
        isOpen={registerModalOpen}
        onClose={() => setRegisterModalOpen(false)}
        title="Register New Employee"
        subtitle="Creates employee profile, salary breakdown, and temporary login credentials."
        maxWidth="lg"
      >
        <form onSubmit={handleRegister} className="space-y-4">
          {regError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {regError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Employee Code</label>
              <input
                type="text"
                required
                value={regForm.employee_code}
                onChange={(e) => setRegForm({ ...regForm, employee_code: e.target.value })}
                className="w-full glass-input px-3 py-2 text-xs font-mono"
                placeholder="e.g. EMP001"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">First Name</label>
              <input
                type="text"
                required
                value={regForm.first_name}
                onChange={(e) => setRegForm({ ...regForm, first_name: e.target.value })}
                className="w-full glass-input px-3 py-2 text-xs"
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Last Name</label>
              <input
                type="text"
                required
                value={regForm.last_name}
                onChange={(e) => setRegForm({ ...regForm, last_name: e.target.value })}
                className="w-full glass-input px-3 py-2 text-xs"
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 light:text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={regForm.email}
                onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
                className="w-full glass-input px-3 py-2 text-xs"
                placeholder="john.doe@company.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 light:text-slate-700 mb-1">Phone Number</label>
              <input
                type="text"
                value={regForm.phone}
                onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                className="w-full glass-input px-3 py-2 text-xs"
                placeholder="+92 300 1234567"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 light:text-slate-700 mb-1">Gender</label>
              <select
                required
                value={regForm.gender}
                onChange={(e) => setRegForm({ ...regForm, gender: e.target.value })}
                className="w-full glass-input px-3 py-2 text-xs"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Department</label>
              <select
                required
                value={regForm.department_id}
                onChange={(e) => setRegForm({ ...regForm, department_id: e.target.value, designation_id: '' })}
                className="w-full glass-input px-3 py-2 text-xs"
              >
                <option value="">Select Department</option>
                {(departments || []).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Designation</label>
              <select
                required
                value={regForm.designation_id}
                onChange={(e) => setRegForm({ ...regForm, designation_id: e.target.value })}
                className="w-full glass-input px-3 py-2 text-xs"
                disabled={!regForm.department_id}
              >
                <option value="">Select Designation</option>
                {(filteredDesignations || []).map(d => (
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Basic Salary (PKR)</label>
              <input
                type="number"
                required
                min="1000"
                value={regForm.basic_salary}
                onChange={(e) => setRegForm({ ...regForm, basic_salary: e.target.value })}
                className="w-full glass-input px-3 py-2 text-xs"
                placeholder="e.g. 100000"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Gross will be 1.5x Basic (HRA 40%, Medical 10%).
              </span>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Joining Date</label>
              <input
                type="date"
                required
                value={regForm.joining_date}
                onChange={(e) => setRegForm({ ...regForm, joining_date: e.target.value })}
                className="w-full glass-input px-3 py-2 text-xs"
              />
            </div>
          </div>

          {/* Biometric Face Template Registration Section */}
          <div className="p-3.5 rounded-xl bg-white/5 light:bg-slate-50 border border-white/10 light:border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-sky-400" />
                <span className="text-xs font-bold text-white light:text-slate-900">
                  Record Employee Face for Biometric Attendance
                </span>
              </div>
              {regForm.face_image_data && (
                <span className="text-[10px] text-emerald-400 light:text-emerald-700 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Template Captured
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 light:text-slate-600 mb-3">
              Enroll the employee's face photo now to securely map face recognition verification to their email & account.
            </p>

            {cameraActive ? (
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-48 h-36 rounded-xl overflow-hidden border-2 border-sky-500 shadow-md">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="primary" type="button" onClick={captureFaceSnapshot}>
                    Snap & Enroll
                  </Button>
                  <Button size="sm" variant="ghost" type="button" onClick={stopFaceCamera}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                {regForm.face_image_data ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={regForm.face_image_data}
                      alt="Enrolled Face"
                      className="w-14 h-14 rounded-xl object-cover border border-emerald-500/50 shadow-sm"
                    />
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-emerald-400 light:text-emerald-700 block">
                        Biometric Face Template Active
                      </span>
                      <button
                        type="button"
                        onClick={() => setRegForm({ ...regForm, face_image_data: '' })}
                        className="text-[11px] text-rose-400 hover:underline"
                      >
                        Remove / Retake Photo
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="glass"
                      type="button"
                      icon={<Camera className="w-3.5 h-3.5 text-sky-400" />}
                      onClick={startFaceCamera}
                    >
                      Open Webcam & Record
                    </Button>
                    <label className="cursor-pointer px-3 py-1.5 rounded-xl border border-white/15 light:border-slate-300 text-xs text-slate-300 light:text-slate-700 hover:bg-white/5 flex items-center gap-1.5 transition-colors">
                      <Upload className="w-3.5 h-3.5 text-purple-400" />
                      <span>Upload Photo File</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <Button variant="ghost" type="button" onClick={() => setRegisterModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" isLoading={regLoading}>
              Save & Generate Credentials
            </Button>
          </div>
        </form>
      </Modal>

      {/* Temporary Credentials Presentation Modal */}
      {tempCredsModal && (
        <Modal
          isOpen={true}
          onClose={() => setTempCredsModal(null)}
          title="Login Credentials Generated"
          subtitle="Please copy these credentials and share them with the employee."
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Email:</span>
                <span className="font-semibold text-white">{tempCredsModal.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Temporary Password:</span>
                <span className="font-mono font-bold text-amber-300 text-sm select-all">
                  {tempCredsModal.tempPass}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              The employee will be forced to set their own permanent password on first sign-in.
            </p>
            <Button variant="primary" className="w-full" onClick={() => setTempCredsModal(null)}>
              Done
            </Button>
          </div>
        </Modal>
      )}

      {/* CSV Drag-and-Drop Ingestion Modal with Dry Run */}
      <CsvDropzoneModal
        isOpen={csvModalOpen}
        onClose={() => setCsvModalOpen(false)}
        onSuccess={() => fetchEmployees()}
      />

      {/* Employee 360 Profile Drawer */}
      {profile360Open && selectedEmp360 && (
        <Modal
          isOpen={true}
          onClose={() => setProfile360Open(false)}
          title={`Employee 360: ${selectedEmp360.employee.full_name}`}
          subtitle={`${selectedEmp360.employee.employee_code} • ${selectedEmp360.employee.department_name} • ${selectedEmp360.employee.designation_title}`}
          maxWidth="xl"
        >
          <div className="space-y-4 text-xs">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-slate-400 block mb-0.5">Present Days</span>
                <span className="text-base font-bold text-emerald-400">
                  {selectedEmp360.attendance_summary.present}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-slate-400 block mb-0.5">Late Days</span>
                <span className="text-base font-bold text-amber-400">
                  {selectedEmp360.attendance_summary.late}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-slate-400 block mb-0.5">Absents</span>
                <span className="text-base font-bold text-rose-400">
                  {selectedEmp360.attendance_summary.absent}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-slate-400 block mb-0.5">Leaves Used</span>
                <span className="text-base font-bold text-purple-400">
                  {selectedEmp360.leave_summary.approved_leave_days_ytd}d
                </span>
              </div>
            </div>

            {/* Attrition Risk Score */}
            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-purple-300">Attrition Risk Score</span>
                <span className="font-bold text-purple-200">
                  {selectedEmp360.attrition_risk.risk_score}/100 ({selectedEmp360.attrition_risk.risk_level})
                </span>
              </div>
              <ul className="space-y-1 text-slate-300">
                {(selectedEmp360.attrition_risk?.factors || []).map((f: string, i: number) => (
                  <li key={i}>• {f}</li>
                ))}
              </ul>
            </div>

            {/* Compensation breakdown */}
            {selectedEmp360.employee.salary_structure && (
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/10">
                <span className="font-semibold text-white block mb-2">Compensation Structure</span>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div>Basic Salary: PKR {selectedEmp360.employee.salary_structure.basic_salary?.toLocaleString()}</div>
                  <div>HRA (40%): PKR {selectedEmp360.employee.salary_structure.hra?.toLocaleString()}</div>
                  <div>Medical (10%): PKR {selectedEmp360.employee.salary_structure.medical_allowance?.toLocaleString()}</div>
                  <div className="font-bold text-emerald-400">Gross Salary: PKR {selectedEmp360.employee.salary_structure.gross_salary?.toLocaleString()}</div>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};
