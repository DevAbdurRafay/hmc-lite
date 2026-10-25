export type UserRole = 'ADMIN' | 'HR' | 'EMPLOYEE' | 'admin' | 'hr' | 'employee';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  employee_id?: number | null;
  employee_name?: string | null;
  full_name?: string | null;
}

export interface Department {
  id: number;
  name: string;
  code: string;
  description?: string;
}

export interface Designation {
  id: number;
  title: string;
  department_id: number;
  department_name?: string;
  description?: string;
}

export interface SalaryStructure {
  id: number;
  employee_id: number;
  basic_salary: number;
  hra: number;
  medical_allowance: number;
  other_allowances: number;
  gross_salary: number;
  effective_date: string;
}

export interface Employee {
  id: number;
  user_id?: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone?: string;
  address?: string;
  gender: string;
  department_id: number;
  department_name?: string;
  designation_id: number;
  designation_title?: string;
  joining_date: string;
  exit_date?: string | null;
  status: 'ACTIVE' | 'PROBATION' | 'RESIGNED' | 'TERMINATED';
  emergency_contact?: string;
  salary_structure?: SalaryStructure;
}

export interface AttendanceRecord {
  id: number;
  employee_id: number;
  employee_name?: string;
  employee_code?: string;
  department_name?: string;
  date: string;
  check_in?: string | null;
  check_out?: string | null;
  working_hours: number;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'MISSING_CHECKOUT' | 'ON_LEAVE';
  source: 'WEB' | 'CAMERA' | 'MOBILE' | 'MANUAL';
  check_in_latitude?: number | null;
  check_in_longitude?: number | null;
  check_in_accuracy?: number | null;
}

export interface AttendanceCorrection {
  id: number;
  attendance_id?: number | null;
  employee_id: number;
  employee_name?: string;
  date: string;
  requested_check_in?: string | null;
  requested_check_out?: string | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewer_id?: number | null;
  review_comment?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface LeaveType {
  id: number;
  name: string;
  code: string;
  yearly_quota: number;
  is_unpaid: boolean;
  description?: string;
}

export interface LeaveBalance {
  leave_type_id: number;
  name: string;
  code: string;
  quota: number;
  used_days: number;
  remaining_balance: number;
  is_unpaid: boolean;
}

export interface LeaveRequest {
  id: number;
  employee_id: number;
  employee_name?: string;
  department_name?: string;
  leave_type_id: number;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  working_days: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  reviewer_id?: number | null;
  review_comment?: string | null;
  reviewed_at?: string | null;
  created_at: string;
}

export interface Payslip {
  id: number;
  payroll_run_id: number;
  employee_id: number;
  employee_code?: string;
  employee_name?: string;
  department_name?: string;
  designation_title?: string;
  month: number;
  year: number;
  basic_salary: number;
  hra: number;
  medical_allowance: number;
  gross_salary: number;
  working_days: number;
  days_worked: number;
  absent_days: number;
  unpaid_leave_days: number;
  half_days: number;
  total_deductions: number;
  taxable_income: number;
  tax_deducted: number;
  net_salary: number;
  pdf_path?: string | null;
  created_at: string;
}

export interface PayrollRun {
  id: number;
  month: number;
  year: number;
  status: 'DRAFT' | 'FINALIZED';
  total_gross: number;
  total_net: number;
  total_tax: number;
  total_deductions: number;
  finalized_by_id?: number | null;
  finalized_at?: string | null;
  created_at: string;
  payslips?: Payslip[];
}

export interface Announcement {
  id: number;
  title: string;
  content: string;
  priority: 'NORMAL' | 'URGENT';
  author_id?: number;
  author_email?: string;
  created_at: string;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  link?: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: number;
  actor_id?: number;
  actor_email?: string;
  actor_role?: string;
  action: string;
  entity: string;
  entity_id?: string;
  before_json?: string;
  after_json?: string;
  client_ip?: string;
  created_at: string;
}

export interface CompanySettings {
  id: number;
  company_name: string;
  office_start_time: string;
  grace_period_minutes: number;
  half_day_threshold_hours: number;
  weekend_days: string;
  office_latitude: number;
  office_longitude: number;
  office_radius_meters: number;
  late_penalty_enabled: boolean;
  is_configured: boolean;
}
