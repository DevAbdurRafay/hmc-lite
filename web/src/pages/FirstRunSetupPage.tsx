import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Shield, Clock, MapPin, Sparkles, ArrowRight, Eye, EyeOff, Check, X } from 'lucide-react';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';

export const FirstRunSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [companyName, setCompanyName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [officeLat, setOfficeLat] = useState(24.8607);
  const [officeLng, setOfficeLng] = useState(67.0011);
  const [officeRadius, setOfficeRadius] = useState(150);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password validation checks
  const passwordChecks = [
    { id: 'spec', label: 'Special character (!@#$%^&*...)', valid: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(adminPassword) },
    { id: 'num', label: 'Number (0-9)', valid: /[0-9]/.test(adminPassword) },
    { id: 'upper', label: 'Uppercase letter (A-Z)', valid: /[A-Z]/.test(adminPassword) },
    { id: 'lower', label: 'Lowercase letter (a-z)', valid: /[a-z]/.test(adminPassword) },
    { id: 'len', label: 'Minimum 8 characters', valid: adminPassword.length >= 8 },
  ];
  const isPasswordValid = passwordChecks.every((c) => c.valid);

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setOfficeLat(parseFloat(pos.coords.latitude.toFixed(6)));
          setOfficeLng(parseFloat(pos.coords.longitude.toFixed(6)));
        },
        () => alert('Unable to retrieve current location. Using default coordinates.')
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid) {
      setError('Please fulfill all password security requirements in the checklist below.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiFetch<any>('/auth/setup', {
        method: 'POST',
        body: JSON.stringify({
          company_name: companyName,
          admin_email: adminEmail,
          admin_password: adminPassword,
          office_start_time: startTime,
          grace_period_minutes: Number(graceMinutes),
          half_day_threshold_hours: 5.0,
          weekend_days: '5,6',
          office_latitude: Number(officeLat),
          office_longitude: Number(officeLng),
          office_radius_meters: Number(officeRadius),
        }),
      });

      login(response.access_token, {
        id: response.user_id,
        email: response.email,
        role: response.role,
        is_active: true,
        must_change_password: response.must_change_password,
        employee_id: response.employee_id,
        employee_name: response.employee_name,
      });

      navigate('/admin');
    } catch (err: any) {
      setError(err.message || 'Setup failed. Please check your inputs.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-2xl animate-in fade-in duration-300">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-violet-600 text-white font-bold text-2xl shadow-xl shadow-sky-500/20 mb-3">
            HL
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white light:text-slate-900 tracking-tight">
            First-Run Company Setup
          </h1>
          <p className="text-sm text-slate-400 light:text-slate-500 max-w-md mx-auto mt-1">
            Initialize your organization profile, primary administrator credentials, and office geofence.
          </p>
        </div>

        <GlassCard variant="panel" className="border-white/15 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Section 1: Company & Admin */}
            <div>
              <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Building2 className="w-4 h-4" /> Company & Superadmin Account
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Company Legal Name</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full glass-input px-3.5 py-2.5 text-sm"
                    placeholder="e.g. Saylani Tech Solutions"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Admin Email</label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full glass-input px-3.5 py-2.5 text-sm"
                    placeholder="admin@company.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Admin Password</label>
                  <div className="relative">
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full glass-input px-3.5 pr-11 py-2.5 text-sm"
                      placeholder="Create a strong password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
                    >
                      {showAdminPassword ? (
                        <EyeOff className="w-4 h-4 text-sky-400" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Password Requirements Checklist with green/red ticks */}
                  <div className="mt-2.5 p-3 rounded-xl bg-black/30 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Password Requirements Checklist
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isPasswordValid
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {isPasswordValid ? 'All Met' : 'Incomplete'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                      {passwordChecks.map((chk) => (
                        <div
                          key={chk.id}
                          className={`flex items-center gap-2 text-xs transition-colors py-0.5 ${
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
                </div>
              </div>
            </div>

            {/* Section 2: Shift Rules */}
            <div className="pt-4 border-t border-white/10">
              <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Shift & Grace Timing
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Official Shift Start</label>
                  <input
                    type="text"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full glass-input px-3.5 py-2.5 text-sm"
                    placeholder="09:00"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Grace Period (Minutes)</label>
                  <input
                    type="number"
                    required
                    value={graceMinutes}
                    onChange={(e) => setGraceMinutes(Number(e.target.value))}
                    className="w-full glass-input px-3.5 py-2.5 text-sm"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Arrivals after 09:15 AM marked LATE.</p>
                </div>
              </div>
            </div>

            {/* Section 3: Geofence */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" /> Office Location & Geofence
                </h3>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="text-xs text-sky-400 hover:text-sky-300 font-medium"
                >
                  Use My Current Location
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={officeLat}
                    onChange={(e) => setOfficeLat(parseFloat(e.target.value))}
                    className="w-full glass-input px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={officeLng}
                    onChange={(e) => setOfficeLng(parseFloat(e.target.value))}
                    className="w-full glass-input px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Radius (Meters)</label>
                  <input
                    type="number"
                    required
                    value={officeRadius}
                    onChange={(e) => setOfficeRadius(parseInt(e.target.value))}
                    className="w-full glass-input px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={isLoading}
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Complete Setup & Open Dashboard
            </Button>
          </form>
        </GlassCard>
      </div>
    </div>
  );
};
