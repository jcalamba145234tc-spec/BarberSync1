/**
 * Admin daily attendance screen: mark each barber present/absent/late/off
 * for the current day. Reads/writes through services/attendanceService.ts -
 * requires firestore.rules to actually include a match block for the
 * attendance/ collection, or every read/write here gets permission-denied.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Divider,
  HelperText,
  IconButton,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';
import { AppSnackbar } from '../../components/ui/AppSnackbar';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Screen } from '../../components/ui/Screen';
import { SectionCard } from '../../components/ui/SectionCard';
import { Colors } from '../../constants/colors';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../hooks/useAuth';
import {
  calculateAttendanceSummary,
  getDailyAttendance,
  saveDailyAttendance,
} from '../../services/attendanceService';
import { AttendanceStatus, BarberAttendanceRecord, DailyAttendance } from '../../types/attendance';
import { formatDate } from '../../utils/dateUtils';

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; color: string; bgColor: string }
> = {
  PRESENT: { label: 'Present', color: Colors.success, bgColor: '#DCFCE7' },
  LATE: { label: 'Late', color: Colors.warning, bgColor: '#FEF3C7' },
  ABSENT: { label: 'Absent', color: Colors.danger, bgColor: '#FEE2E2' },
  OFF: { label: 'Off', color: Colors.textMuted, bgColor: '#F3F4F6' },
};

export default function AttendanceScreen() {
  const { user } = useAuth();
  const { barbers } = useAppData();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const dateStr = useMemo(() => toDateString(currentDate), [currentDate]);
  const isToday = useMemo(() => toDateString(new Date()) === dateStr, [dateStr]);

  const [attendance, setAttendance] = useState<DailyAttendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  // Load attendance
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDailyAttendance(dateStr, barbers);
      setAttendance(data);
    } catch {
      setMessage('Could not load attendance.');
    } finally {
      setLoading(false);
    }
  }, [dateStr, barbers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigate date
  const changeDate = (days: number) => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + days);
    setCurrentDate(next);
  };

  const jumpToToday = () => {
    setCurrentDate(new Date());
  };

  // Update status for a barber
  const handleStatusChange = (barberId: string, status: AttendanceStatus) => {
    if (!attendance) return;
    setAttendance({
      ...attendance,
      records: attendance.records.map((r) =>
        r.barberId === barberId ? { ...r, status } : r
      ),
    });
  };

  // Update notes
  const handleNotesChange = (barberId: string, notes: string) => {
    if (!attendance) return;
    setAttendance({
      ...attendance,
      records: attendance.records.map((r) =>
        r.barberId === barberId ? { ...r, notes } : r
      ),
    });
  };

  // Mark all present
  const handleMarkAllPresent = () => {
    if (!attendance) return;
    setAttendance({
      ...attendance,
      records: attendance.records.map((r) => ({ ...r, status: 'PRESENT' })),
    });
    setMessage('All staff marked as Present.');
  };

  // Save attendance
  const handleSave = async () => {
    if (!attendance) return;
    setSaving(true);
    try {
      await saveDailyAttendance(attendance);
      setMessage(`Attendance saved for ${formatDate(attendance.date)}.`);
    } catch {
      setMessage('Failed to save attendance.');
    } finally {
      setSaving(false);
    }
  };

  const summary = useMemo(
    () => calculateAttendanceSummary(attendance?.records ?? []),
    [attendance?.records]
  );

  if (loading && !attendance) {
    return <LoadingState message="Loading attendance…" />;
  }

  return (
    <>
      <Screen refreshing={loading} onRefresh={loadData}>
        {/* Date Selector Banner */}
        <Card style={styles.dateCard}>
          <Card.Content style={styles.dateContent}>
            <IconButton
              icon="chevron-left"
              size={24}
              onPress={() => changeDate(-1)}
              style={styles.dateNavBtn}
            />

            <View style={styles.dateCenter}>
              <View style={styles.dateTitleRow}>
                <Text variant="titleMedium" style={styles.dateTitle}>
                  {formatDate(dateStr)}
                </Text>
                {isToday && (
                  <Chip compact style={styles.todayChip} textStyle={styles.todayChipText}>
                    Today
                  </Chip>
                )}
              </View>
              {!isToday && (
                <Button compact onPress={jumpToToday} style={styles.jumpBtn}>
                  Return to Today
                </Button>
              )}
            </View>

            <IconButton
              icon="chevron-right"
              size={24}
              onPress={() => changeDate(1)}
              style={styles.dateNavBtn}
            />
          </Card.Content>
        </Card>

        {/* Attendance Summary Stats */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text variant="labelSmall" style={styles.summaryLabel}>
              PRESENT
            </Text>
            <Text variant="titleLarge" style={[styles.summaryValue, { color: Colors.success }]}>
              {summary.present}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text variant="labelSmall" style={styles.summaryLabel}>
              LATE
            </Text>
            <Text variant="titleLarge" style={[styles.summaryValue, { color: Colors.warning }]}>
              {summary.late}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text variant="labelSmall" style={styles.summaryLabel}>
              ABSENT
            </Text>
            <Text variant="titleLarge" style={[styles.summaryValue, { color: Colors.danger }]}>
              {summary.absent}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text variant="labelSmall" style={styles.summaryLabel}>
              DAY OFF
            </Text>
            <Text variant="titleLarge" style={[styles.summaryValue, { color: Colors.textMuted }]}>
              {summary.off}
            </Text>
          </View>
        </View>

        {/* Quick Actions Header */}
        <View style={styles.quickActionHeader}>
          <Text variant="titleMedium" style={styles.listHeaderTitle}>
            Staff Attendance List ({summary.total})
          </Text>

          {isAdmin && (
            <Button
              mode="text"
              compact
              icon="check-all"
              onPress={handleMarkAllPresent}
              style={styles.markAllBtn}
            >
              Mark All Present
            </Button>
          )}
        </View>

        {/* Staff Attendance Records */}
        {(!attendance?.records || attendance.records.length === 0) ? (
          <EmptyState
            icon="💈"
            title="No staff to track"
            message="No active barbers found in the directory. Add barbers in the Barbers tab first."
          />
        ) : (
          attendance.records.map((record) => {
            const initials = record.barberName
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0].toUpperCase())
              .join('');

            const statusStyle = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.PRESENT;
            const isEditingNotes = editingNotesId === record.barberId;

            return (
              <Card key={record.barberId} style={styles.recordCard}>
                <Card.Content style={styles.recordContent}>
                  <View style={styles.recordHeader}>
                    <Avatar.Text
                      size={40}
                      label={initials || 'B'}
                      style={[styles.avatar, { backgroundColor: statusStyle.color }]}
                    />
                    <View style={styles.recordInfo}>
                      <Text variant="titleMedium" style={styles.recordName}>
                        {record.barberName}
                      </Text>
                      <View style={styles.statusBadgeRow}>
                        <View
                          style={[
                            styles.statusPill,
                            { backgroundColor: statusStyle.bgColor, borderColor: statusStyle.color },
                          ]}
                        >
                          <Text style={[styles.statusPillText, { color: statusStyle.color }]}>
                            {statusStyle.label}
                          </Text>
                        </View>
                        {record.notes ? (
                          <Text variant="bodySmall" style={styles.notesPreview} numberOfLines={1}>
                            · {record.notes}
                          </Text>
                        ) : null}
                      </View>
                    </View>

                    <IconButton
                      icon={isEditingNotes ? 'check' : 'note-text-outline'}
                      size={20}
                      onPress={() =>
                        setEditingNotesId(isEditingNotes ? null : record.barberId)
                      }
                    />
                  </View>

                  {/* Status Buttons */}
                  <SegmentedButtons
                    value={record.status}
                    onValueChange={(val) =>
                      handleStatusChange(record.barberId, val as AttendanceStatus)
                    }
                    buttons={[
                      { value: 'PRESENT', label: 'Present' },
                      { value: 'LATE', label: 'Late' },
                      { value: 'ABSENT', label: 'Absent' },
                      { value: 'OFF', label: 'Off' },
                    ]}
                    style={styles.segmented}
                  />

                  {/* Notes editing input */}
                  {isEditingNotes && (
                    <View style={styles.notesInputContainer}>
                      <TextInput
                        mode="outlined"
                        dense
                        placeholder="Add remarks (e.g. Arrived 10:15am, sick leave)"
                        value={record.notes ?? ''}
                        onChangeText={(text) => handleNotesChange(record.barberId, text)}
                        style={styles.notesInput}
                      />
                    </View>
                  )}
                </Card.Content>
              </Card>
            );
          })
        )}

        {/* Save Attendance Button */}
        {isAdmin && attendance?.records && attendance.records.length > 0 && (
          <Button
            mode="contained"
            icon="content-save"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={styles.saveBtn}
          >
            {saving ? 'Saving…' : 'Save Attendance'}
          </Button>
        )}
      </Screen>

      <AppSnackbar message={message} onDismiss={() => setMessage(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  dateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    elevation: 1,
  },
  dateContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  dateNavBtn: {
    margin: 0,
  },
  dateCenter: {
    alignItems: 'center',
  },
  dateTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateTitle: {
    fontWeight: '700',
    color: Colors.text,
  },
  todayChip: {
    backgroundColor: '#DCFCE7',
    height: 22,
  },
  todayChipText: {
    color: Colors.success,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '700',
  },
  jumpBtn: {
    marginTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  summaryLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    fontWeight: '700',
  },
  summaryValue: {
    fontWeight: '800',
    marginTop: 2,
  },
  quickActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  listHeaderTitle: {
    fontWeight: '700',
    color: Colors.text,
  },
  markAllBtn: {
    margin: 0,
  },
  recordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    elevation: 1,
  },
  recordContent: {
    padding: 12,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    elevation: 1,
  },
  recordInfo: {
    flex: 1,
  },
  recordName: {
    fontWeight: '700',
    color: Colors.text,
  },
  statusBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  notesPreview: {
    color: Colors.textMuted,
    flex: 1,
  },
  segmented: {
    marginTop: 4,
  },
  notesInputContainer: {
    marginTop: 8,
  },
  notesInput: {
    backgroundColor: '#FFFFFF',
  },
  saveBtn: {
    marginTop: 12,
    marginBottom: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    paddingVertical: 4,
  },
});