import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Calendar, Plus, Sparkles, Check, X } from 'lucide-react-native';
import { apiFetch } from '../../src/services/api';
import GlassCard from '../../src/components/GlassCard';

export default function LeavesScreen() {
  const [balances, setBalances] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Apply Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedType, setSelectedType] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Smart Leave Prompt
  const [smartInput, setSmartInput] = useState('');
  const [smartLoading, setSmartLoading] = useState(false);

  const fetchData = async () => {
    try {
      const [b, l, t] = await Promise.all([
        apiFetch<any[]>('/leave/my-balances'),
        apiFetch<any[]>('/leave/my-requests'),
        apiFetch<any[]>('/leave/types'),
      ]);
      setBalances(b || []);
      setLeaves(l || []);
      setLeaveTypes(t || []);
      if (t && t.length > 0) setSelectedType(t[0].id);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApply = async () => {
    if (!selectedType || !reason.trim()) {
      Alert.alert('Required', 'Please fill in all leave details.');
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch('/leave/apply', {
        method: 'POST',
        body: JSON.stringify({
          leave_type_id: selectedType,
          start_date: startDate,
          end_date: endDate,
          reason: reason.trim(),
        }),
      });
      Alert.alert('Applied', 'Your leave request has been submitted for HR approval.');
      setModalVisible(false);
      setReason('');
      fetchData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to submit leave.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSmartLeave = async () => {
    if (!smartInput.trim()) return;
    try {
      setSmartLoading(true);
      const res = await apiFetch<any>('/ai/smart-leave', {
        method: 'POST',
        body: JSON.stringify({ prompt: smartInput.trim() }),
      });
      if (res.start_date) setStartDate(res.start_date);
      if (res.end_date) setEndDate(res.end_date);
      if (res.reason) setReason(res.reason);
      Alert.alert('AI Parsed', `Leave dates: ${res.start_date} to ${res.end_date}`);
      setSmartInput('');
    } catch (err: any) {
      Alert.alert('AI Error', err.message || 'Could not parse text.');
    } finally {
      setSmartLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>My Leave Balances</Text>
          <TouchableOpacity style={styles.applyBtn} onPress={() => setModalVisible(true)}>
            <Plus size={16} color="#fff" />
            <Text style={styles.applyBtnText}>Apply</Text>
          </TouchableOpacity>
        </View>

        {/* Balances Carousel / Grid */}
        <View style={styles.balancesRow}>
          {balances.map((b) => (
            <GlassCard key={b.code} style={styles.balanceCard}>
              <Text style={styles.balanceCode}>{b.code}</Text>
              <Text style={styles.balanceNum}>{b.is_unpaid ? '∞' : b.remaining}</Text>
              <Text style={styles.balanceLabel}>{b.name}</Text>
            </GlassCard>
          ))}
        </View>

        {/* Leave Requests Table */}
        <Text style={styles.sectionTitle}>Request History</Text>
        {leaves.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyText}>No leave requests recorded.</Text>
          </GlassCard>
        ) : (
          leaves.map((l) => (
            <GlassCard key={l.id} style={styles.leaveItem}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemType}>{l.leave_type_name}</Text>
                <View
                  style={[
                    styles.badge,
                    l.status === 'APPROVED'
                      ? styles.badgeApproved
                      : l.status === 'REJECTED'
                      ? styles.badgeRejected
                      : styles.badgePending,
                  ]}
                >
                  <Text style={styles.badgeText}>{l.status}</Text>
                </View>
              </View>
              <Text style={styles.itemDates}>
                {l.start_date} → {l.end_date} ({l.working_days} working days)
              </Text>
              <Text style={styles.itemReason}>{l.reason}</Text>
            </GlassCard>
          ))
        )}
      </ScrollView>

      {/* Apply Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Apply for Leave</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Smart AI helper */}
            <View style={styles.smartBox}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Sparkles size={14} color="#a855f7" />
                <Text style={styles.smartTitle}>Smart Leave Assistant</Text>
              </View>
              <TextInput
                value={smartInput}
                onChangeText={setSmartInput}
                placeholder="e.g. Taking 2 days off from tomorrow for fever"
                placeholderTextColor="#64748b"
                style={styles.smartInput}
              />
              <TouchableOpacity
                onPress={handleSmartLeave}
                disabled={smartLoading}
                style={styles.smartBtn}
              >
                {smartLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.smartBtnText}>Auto-Fill with AI</Text>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              value={startDate}
              onChangeText={setStartDate}
              style={styles.input}
            />

            <Text style={styles.label}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              value={endDate}
              onChangeText={setEndDate}
              style={styles.input}
            />

            <Text style={styles.label}>Reason</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Reason for absence"
              placeholderTextColor="#64748b"
              style={[styles.input, { height: 70 }]}
              multiline
            />

            <TouchableOpacity
              onPress={handleApply}
              disabled={submitting}
              style={styles.submitBtn}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Submit Leave Application</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0284c7',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  applyBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  balancesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  balanceCard: {
    width: '48%',
    padding: 14,
  },
  balanceCode: {
    fontSize: 10,
    color: '#38bdf8',
    fontWeight: 'bold',
  },
  balanceNum: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginVertical: 4,
  },
  balanceLabel: {
    fontSize: 11,
    color: '#94a3b8',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 12,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 13,
  },
  leaveItem: {
    marginBottom: 10,
    padding: 14,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f8fafc',
  },
  itemDates: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  itemReason: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgePending: {
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
  },
  badgeApproved: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
  },
  badgeRejected: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0f172a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  smartBox: {
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.25)',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
  },
  smartTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#c084fc',
  },
  smartInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    padding: 8,
    color: '#fff',
    fontSize: 12,
    marginBottom: 8,
  },
  smartBtn: {
    backgroundColor: '#9333ea',
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  smartBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  label: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 10,
    color: '#fff',
    fontSize: 13,
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: '#0284c7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
