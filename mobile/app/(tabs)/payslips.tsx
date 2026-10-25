import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { FileText, Download, ShieldCheck } from 'lucide-react-native';
import { apiFetch } from '../../src/services/api';
import GlassCard from '../../src/components/GlassCard';

export default function PayslipsScreen() {
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<any[]>('/payroll/my-payslips');
        setPayslips(res || []);
      } catch {
        //
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const formatPKR = (num: number) => {
    return 'PKR ' + (num || 0).toLocaleString();
  };

  const getMonthName = (monthNum: number) => {
    const d = new Date();
    d.setMonth(monthNum - 1);
    return d.toLocaleString('en-US', { month: 'long' });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Verified Payslips</Text>
        <Text style={styles.subtitle}>Statutory calculations & salary breakdowns</Text>
      </View>

      {payslips.length === 0 ? (
        <GlassCard style={styles.emptyCard}>
          <FileText size={32} color="#64748b" />
          <Text style={styles.emptyTitle}>No Payslips Available</Text>
          <Text style={styles.emptyDesc}>
            Monthly payslips will appear here once Admin locks and finalizes the payroll run.
          </Text>
        </GlassCard>
      ) : (
        payslips.map((p) => (
          <GlassCard key={p.id} style={styles.payslipCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.monthText}>
                  {getMonthName(p.month)} {p.year}
                </Text>
                <Text style={styles.periodText}>Status: Finalized & Verified</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <ShieldCheck size={14} color="#34d399" />
                <Text style={styles.verifiedText}>Official</Text>
              </View>
            </View>

            <View style={styles.breakdown}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Basic Salary</Text>
                <Text style={styles.rowVal}>{formatPKR(p.basic_salary)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Gross Salary (1.5x basic)</Text>
                <Text style={[styles.rowVal, { color: '#f8fafc' }]}>{formatPKR(p.gross_salary)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Attendance Deductions</Text>
                <Text style={[styles.rowVal, { color: '#fb7185' }]}>
                  - {formatPKR(p.deductions)}
                </Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Income Tax Withholding</Text>
                <Text style={[styles.rowVal, { color: '#fb7185' }]}>
                  - {formatPKR(p.tax)}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.netLabel}>Net Salary</Text>
                <Text style={styles.netVal}>{formatPKR(p.net_salary)}</Text>
              </View>
            </View>
          </GlassCard>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0d14',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0a0d14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#cbd5e1',
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 240,
  },
  payslipCard: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  periodText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#34d399',
  },
  breakdown: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  rowVal: {
    fontSize: 12,
    color: '#cbd5e1',
    fontFamily: 'monospace',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 4,
  },
  netLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f8fafc',
  },
  netVal: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34d399',
    fontFamily: 'monospace',
  },
});
