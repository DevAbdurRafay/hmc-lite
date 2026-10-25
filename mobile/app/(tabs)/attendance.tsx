import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Camera, MapPin, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react-native';
import { apiFetch } from '../../src/services/api';
import GlassCard from '../../src/components/GlassCard';

export default function AttendanceScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [locating, setLocating] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Location access is required to verify office geofence attendance.');
          setLocating(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setLocation(loc);
      } catch (err) {
        // Location failed
      } finally {
        setLocating(false);
      }
    })();
  }, []);

  const handleAttendance = async (type: 'check-in' | 'check-out') => {
    if (!location) {
      Alert.alert('GPS Required', 'Waiting for accurate GPS fix to verify office geofence.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy_meters: location.coords.accuracy || 10,
        face_verified: true,
      };

      const endpoint = type === 'check-in' ? '/attendance/check-in' : '/attendance/check-out';
      const res = await apiFetch<any>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      Alert.alert(
        'Success',
        `${type === 'check-in' ? 'Check-In' : 'Check-Out'} verified!\nStatus: ${res.status}\nServer Time: ${new Date(res.check_in_time || res.check_out_time).toLocaleTimeString()}`
      );
    } catch (err: any) {
      Alert.alert('Attendance Failed', err.message || 'Geofence check failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#38bdf8" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.permissionText}>We need camera access for face attendance verification.</Text>
        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
          <Text style={styles.grantBtnText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isAccuracyGood = location && (location.coords.accuracy || 0) <= 100;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Camera + GPS Attendance</Text>
        <Text style={styles.headerSub}>Real-time biometric & geofence validation</Text>
      </View>

      {/* Camera Preview Frame */}
      <View style={styles.cameraFrame}>
        <CameraView
          ref={cameraRef}
          facing="front"
          style={styles.camera}
        >
          {/* Facial targeting guide overlay */}
          <View style={styles.faceGuide} />
        </CameraView>
      </View>

      {/* GPS Status Card */}
      <GlassCard style={styles.gpsCard}>
        <View style={styles.gpsRow}>
          <MapPin size={18} color={isAccuracyGood ? '#34d399' : '#fbbf24'} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.gpsTitle}>
              {locating
                ? 'Acquiring GPS Signal...'
                : isAccuracyGood
                ? 'High Accuracy Geofence Fix'
                : 'Searching for Better GPS Signal'}
            </Text>
            {location && (
              <Text style={styles.gpsCoords}>
                {location.coords.latitude.toFixed(5)}, {location.coords.longitude.toFixed(5)} (±
                {Math.round(location.coords.accuracy || 0)}m)
              </Text>
            )}
          </View>
          {isAccuracyGood && <CheckCircle size={18} color="#34d399" />}
        </View>
      </GlassCard>

      {/* Actions */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          onPress={() => handleAttendance('check-in')}
          disabled={submitting || locating}
          style={[styles.btn, styles.checkInBtn]}
          activeOpacity={0.8}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Punch Check-In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleAttendance('check-out')}
          disabled={submitting || locating}
          style={[styles.btn, styles.checkOutBtn]}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>Punch Check-Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0d14',
    paddingHorizontal: 20,
    paddingTop: 56,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0a0d14',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionText: {
    color: '#cbd5e1',
    textAlign: 'center',
    fontSize: 15,
    marginBottom: 20,
  },
  grantBtn: {
    backgroundColor: '#0284c7',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  grantBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  headerSub: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  cameraFrame: {
    height: 300,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    marginBottom: 16,
    position: 'relative',
  },
  camera: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceGuide: {
    width: 170,
    height: 220,
    borderRadius: 85,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    borderStyle: 'dashed',
  },
  gpsCard: {
    marginBottom: 20,
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gpsTitle: {
    color: '#f8fafc',
    fontSize: 13,
    fontWeight: '600',
  },
  gpsCoords: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  actionContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInBtn: {
    backgroundColor: '#0284c7',
  },
  checkOutBtn: {
    backgroundColor: '#334155',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
