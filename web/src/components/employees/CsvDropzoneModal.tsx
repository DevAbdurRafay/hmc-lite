import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
  Trash2,
  Play,
  ArrowRight,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { apiFetch } from '../../services/api';

interface CsvDropzoneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (importedRows?: any[]) => void;
  onPreviewParsed?: (parsedRows: any[]) => void;
}

export const CsvDropzoneModal: React.FC<CsvDropzoneModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onPreviewParsed,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewRows, setPreviewRows] = useState<any[]>([]);
  const [dryRunResult, setDryRunResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setFile(null);
    setPreviewRows([]);
    setDryRunResult(null);
    setError(null);
    setLoading(false);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const parseCsvTextLocally = (text: string) => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      if (parts.length >= headers.length) {
        const rowObj: any = {};
        headers.forEach((h, idx) => {
          rowObj[h] = parts[idx];
        });
        rows.push(rowObj);
      }
    }
    return rows;
  };

  const processFile = (uploadedFile: File) => {
    if (!uploadedFile.name.endsWith('.csv')) {
      setError('Please upload a valid .csv file.');
      return;
    }
    setError(null);
    setFile(uploadedFile);
    setDryRunResult(null);

    // Read client-side preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsvTextLocally(text);
      setPreviewRows(parsed);
      if (onPreviewParsed) {
        onPreviewParsed(parsed);
      }
    };
    reader.readAsText(uploadedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDryRun = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await apiFetch<any>('/employees/csv-dry-run', {
        method: 'POST',
        body: formData,
      });
      setDryRunResult(result);
    } catch (err: any) {
      setError(err.message || 'Dry-run analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const result = await apiFetch<any>('/employees/csv-import', {
        method: 'POST',
        body: formData,
      });
      alert(`Success! Imported ${result.imported_count || previewRows.length} employees.`);
      onSuccess(previewRows);
      resetState();
      onClose();
    } catch (err: any) {
      setError(err.message || 'CSV commit failed.');
    } finally {
      setLoading(false);
    }
  };

  const downloadSampleTemplate = () => {
    const sampleCsv = `employee_code,first_name,last_name,email,gender,department,designation,basic_salary,joining_date
EMP001,Ahmed,Khan,ahmed.khan@company.com,Male,Engineering,Senior Software Engineer,120000,2024-01-15
EMP002,Sara,Ali,sara.ali@company.com,Female,Human Resources,HR Generalist,85000,2024-03-01
EMP003,Bilal,Tariq,bilal.tariq@company.com,Male,Marketing,Growth Lead,95000,2024-02-10
EMP004,Fatima,Noor,fatima.noor@company.com,Female,Finance,Financial Analyst,90000,2024-04-01
EMP005,Zain,Abbas,zain.abbas@company.com,Male,Engineering,Backend Developer,105000,2024-05-15`;

    const blob = new Blob([sampleCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sample_hcm_employees_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        resetState();
        onClose();
      }}
      title="Employee CSV Ingestion Center"
      subtitle="Drag and drop or browse CSV files to validate and onboard staff into HCM Lite."
      maxWidth="2xl"
    >
      <div className="space-y-5">
        {/* Sample Download Bar */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Need the official CSV format schema?</span>
          </div>
          <button
            type="button"
            onClick={downloadSampleTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-medium transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Sample CSV</span>
          </button>
        </div>

        {/* Drag & Drop Zone */}
        {!file ? (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer relative flex flex-col items-center justify-center p-8 sm:p-10 rounded-2xl border-2 border-dashed transition-all duration-300 ${
              dragActive
                ? 'border-sky-400 bg-sky-500/15 shadow-lg shadow-sky-500/20 scale-[1.01]'
                : 'border-white/20 hover:border-sky-400/60 bg-white/[0.02] hover:bg-white/[0.04]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-4 shadow-inner">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-white mb-1">
              Drag & Drop your Employee CSV here
            </h4>
            <p className="text-xs text-slate-400 max-w-sm text-center mb-4">
              Supports standard UTF-8 CSV with employee details, department, designation, and salary.
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              icon={<UploadCloud className="w-4 h-4" />}
            >
              Browse CSV Files
            </Button>
          </div>
        ) : (
          /* File Selected Card */
          <div className="p-4 rounded-xl bg-white/[0.04] border border-white/15 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/15 text-sky-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{file.name}</h4>
                  <p className="text-[11px] text-slate-400">
                    {(file.size / 1024).toFixed(1)} KB • {previewRows.length} detected rows
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetState}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Remove file"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Local Preview Sample */}
            {previewRows.length > 0 && (
              <div className="rounded-lg border border-white/10 overflow-hidden">
                <div className="bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-slate-300 flex justify-between">
                  <span>Client-Side Preview ({previewRows.length} total records)</span>
                  <span className="text-sky-400">Showing first 3 rows</span>
                </div>
                <div className="overflow-x-auto text-[11px]">
                  <table className="w-full text-left">
                    <thead className="bg-white/[0.02] text-slate-400 border-b border-white/10">
                      <tr>
                        <th className="p-2">Code</th>
                        <th className="p-2">Name</th>
                        <th className="p-2">Email</th>
                        <th className="p-2">Department</th>
                        <th className="p-2">Salary</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-200">
                      {previewRows.slice(0, 3).map((r, i) => (
                        <tr key={i}>
                          <td className="p-2 font-mono text-sky-300">{r.employee_code}</td>
                          <td className="p-2 font-medium">{r.first_name} {r.last_name}</td>
                          <td className="p-2 text-slate-400">{r.email}</td>
                          <td className="p-2">{r.department}</td>
                          <td className="p-2 font-mono">PKR {Number(r.basic_salary || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Validation Action */}
            {!dryRunResult && (
              <Button
                type="button"
                variant="primary"
                onClick={handleDryRun}
                isLoading={loading}
                className="w-full"
                icon={<Play className="w-4 h-4" />}
              >
                Execute Dry-Run Validation Analysis
              </Button>
            )}
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Dry-Run Result Report */}
        {dryRunResult && (
          <div className="p-4 rounded-xl bg-white/[0.04] border border-white/15 space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white">Validation Analysis Report:</span>
              <Badge variant={dryRunResult.is_valid ? 'success' : 'danger'} size="sm">
                {dryRunResult.is_valid
                  ? 'All Records Validated'
                  : `${dryRunResult.error_count} Issues Detected`}
              </Badge>
            </div>

            {/* Error List if invalid */}
            {dryRunResult.errors?.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {dryRunResult.errors.map((err: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Row {err.row}:</span> Field{' '}
                      <span className="underline font-mono">{err.field}</span> — {err.reason}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Success Import Ready */}
            {dryRunResult.is_valid && (
              <div className="pt-2 space-y-3">
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Ready to onboard <b>{dryRunResult.valid_rows_count}</b> employees with system login credentials.
                  </span>
                </div>
                <Button
                  type="button"
                  variant="success"
                  onClick={handleCommit}
                  isLoading={loading}
                  className="w-full py-3 font-bold"
                  icon={<ArrowRight className="w-4 h-4" />}
                >
                  Commit Ingestion to Database ({dryRunResult.valid_rows_count} Records)
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default CsvDropzoneModal;
