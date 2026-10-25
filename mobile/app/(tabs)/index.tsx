import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Clock, Calendar, FileText, CheckCircle2, AlertTriangle, LogOut } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { apiFetch } from '../../src/services/api';
import GlassCard from '../../src/components/GlassCard';

export default function EmployeeDashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = async () => {
    try {
      const res = await apiFetch<any>('/analytics/dashboard/employee');
      setData(res);
    } catch {
      // fallback or error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#38bdf8" />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.full_name || user?.email?.split('@')[0] || 'Employee'}</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            logout();
            router.replace('/login');
          }}
          style={styles.logoutBtn}
        >
          <LogOut size={18} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* Today's Shift Card */}
      <GlassCard style={styles.shiftCard}>
        <View style={styles.shiftHeader}>
          <Clock size={18} color="#38bdf8" />
          <Text style={styles.shiftTitle}>Today's Shift Status</Text>
        </View>

        <View style={styles.shiftTimes}>
          <View style={styles.timeBlock}>
            <Text style={styles.timeLabel}>Check-In</Text>
            <Text style={styles.timeValue}>
              {data?.today_check_in
                ? new Date(data.today_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '--:--'}
            </Text>
          </View>
          <View style={styles.timeDivider} />
          <View style={styles.timeBlock}>
            <Text style={styles.timeLabel}>Check-Out</Text>
            <Text style={styles.timeValue}>
              {data?.today_check_out
                ? new Date(data.today_check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '--:--'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => router.push('/(tabs)/attendance')}
          style={styles.actionPill}
          activeOpacity={0.8}
        >
          <Text style={styles.actionPillText}>
            {data?.today_check_in ? 'Camera Check-Out' : 'Camera + GPS Check-In'}
          </Text>
        </TouchableOpacity>
      </GlassCard>

      {/* Quick Stats Grid */}
      <View style={styles.statsGrid}>
        <GlassCard style={styles.statBox}>
          <Text style={styles.statLabel}>Weekly Hours</Text>
          <Text style={styles.statNum}>{data?.hours_this_week?.toFixed(1) || '0.0'}h</Text>
          <Text style={styles.statSub}>Target: 40 hrs</Text>
        </GlassCard>

        <GlassCard style={styles.statBox}>
          <Text style={styles.statLabel}>Leave Balance</Text>
          <Text style={[styles.statNum, { color: '#34d399' }]}>{data?.remaining_leave_balance || 0}</Text>
          <Text style={styles.statSub}>Days Remaining</Text>
        </GlassCard>
      </View>

      {/* Quick Navigation Cards */}
      <Text style={styles.sectionTitle}>Quick Operations</Text>

      <TouchableOpacity
        onPress={() => router.push('/(tabs)/leaves')}
        activeOpacity={0.8}
        style={{ marginBottom: 12 }}
      >
        <GlassCard style={styles.navRow}>
          <Calendar size={20} color="#a855f7" />
          <View style={styles.navTextContainer}>
            <Text style={styles.navTitle}>Apply for Leave</Text>
            <Text style={styles.navSubtitle}>Smart leave in plain words with AI</Text>
          </View>
        </GlassCard>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/(tabs)/payslips')}
        activeOpacity={0.8}
      >
        <GlassCard style={styles.navRow}>
          <FileText size={20} color="#38bdf8" />
          <View style={styles.navTextContainer}>
            <Text style={styles.navTitle}>Verified Payslips</Text>
            <Text style={styles.navSubtitle}>Gross salary, tax, and deductions</Text>
          </View>
        </GlassCard>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0d14',
  },
  loadingContainer: {
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 13,
    color: '#94a3b8',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  shiftCard: {
    marginBottom: 20,
  },
  shiftHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  shiftTitle: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
  },
  shiftTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  timeBlock: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#38bdf8',
    fontFamily: 'monospace',
  },
  timeDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  actionPill: {
    backgroundColor: '#0284c7',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionPillText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 6,
  },
  statNum: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  statSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 12,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  navTextContainer: {
    marginLeft: 14,
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f8fafc',
  },
  navSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
});
