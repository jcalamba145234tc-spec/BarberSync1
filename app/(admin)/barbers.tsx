/**
 * Admin staff directory: lists every barber, lets the admin add/edit/
 * deactivate a barber, and shows each one's current-period earnings. This is
 * the one screen where the full barbers list from AppDataContext is actually
 * used (barbers themselves never fetch this list - see AppDataContext.tsx).
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  Chip,
  Dialog,
  Divider,
  FAB,
  IconButton,
  Portal,
  Searchbar,
  SegmentedButtons,
  Switch,
  Text,
} from 'react-native-paper';
import { BarberDetailsDialog } from '../../components/barbers/BarberDetailsDialog';
import { BarberFormDialog } from '../../components/barbers/BarberFormDialog';
import { BarberPerformanceTable } from '../../components/dashboard/BarberPerformanceTable';
import { AppSnackbar } from '../../components/ui/AppSnackbar';
import { EmptyState } from '../../components/ui/EmptyState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Screen } from '../../components/ui/Screen';
import { SectionCard } from '../../components/ui/SectionCard';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Colors } from '../../constants/colors';
import { useAppData } from '../../context/AppDataContext';
import { useAuth } from '../../hooks/useAuth';
import { useTransactions } from '../../hooks/useTransactions';
import {
  barberHasTransactions,
  deleteBarber,
  saveBarber,
  setBarberActive,
} from '../../services/barberService';
import { AppUser, BarberInput } from '../../types/auth';
import { buildBarberPerformance, formatCurrency } from '../../utils/calculations';
import { buildRange } from '../../utils/dateUtils';
import type { RangePreset } from '../../utils/dateUtils';

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export default function BarbersScreen() {
  const { user } = useAuth();
  const { barbers, settings, refreshBarbers } = useAppData();

  const [preset, setPreset] = useState<RangePreset>('MONTH');
  const range = useMemo(() => buildRange(preset), [preset]);
  const { transactions, loading, refresh } = useTransactions({ from: range.from, to: range.to });

  // FIX: pass the real staff list so each transaction is matched to a current
  // barber. This prevents duplicate rows (e.g. "Juan Dela Cruz" twice) caused
  // by a transaction saved with a stray/old barberId.
  const performance = useMemo(
    () => buildBarberPerformance(transactions, barbers),
    [transactions, barbers]
  );

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [showPerformanceTable, setShowPerformanceTable] = useState(false);

  // Dialog states
  const [formVisible, setFormVisible] = useState(false);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<AppUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleteHasHistory, setDeleteHasHistory] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Guard: Only ADMIN can configure barbers
  const isAdmin = user?.role === 'ADMIN';

  // Counts
  const activeCount = useMemo(() => barbers.filter((b) => b.active !== false).length, [barbers]);
  const inactiveCount = useMemo(() => barbers.filter((b) => b.active === false).length, [barbers]);

  // Filtered barber list
  const filteredBarbers = useMemo(() => {
    let result = barbers;

    if (statusFilter === 'ACTIVE') {
      result = result.filter((b) => b.active !== false);
    } else if (statusFilter === 'INACTIVE') {
      result = result.filter((b) => b.active === false);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.email.toLowerCase().includes(q) ||
          (b.phone && b.phone.includes(q)) ||
          (b.specialties && b.specialties.some((s) => s.toLowerCase().includes(q)))
      );
    }

    return result;
  }, [barbers, statusFilter, searchQuery]);

  // Handle Save (Add or Update)
  const handleSave = async (input: BarberInput, id?: string) => {
    if (!isAdmin) {
      setMessage('Admin authorization is required.');
      return;
    }
    setSaving(true);
    try {
      const saved = await saveBarber(input, id);
      await refreshBarbers();
      setFormVisible(false);

      // If we were viewing details, update the selected barber
      if (selectedBarber && selectedBarber.id === saved.id) {
        setSelectedBarber(saved);
      } else {
        setSelectedBarber(null);
      }

      setMessage(id ? `${saved.name}'s details updated.` : `${saved.name} added to staff.`);
    } catch {
      setMessage('Could not save barber details.');
    } finally {
      setSaving(false);
    }
  };

  // Handle Toggle Active
  const handleToggleActive = async (barber: AppUser) => {
    if (!isAdmin) {
      setMessage('Admin authorization is required.');
      return;
    }
    const nextStatus = !barber.active;
    try {
      await setBarberActive(barber.id, nextStatus);
      await refreshBarbers();

      if (selectedBarber && selectedBarber.id === barber.id) {
        setSelectedBarber({ ...selectedBarber, active: nextStatus });
      }

      setMessage(
        nextStatus ? `${barber.name} activated.` : `${barber.name} marked inactive.`
      );
    } catch {
      setMessage('Could not update barber status.');
    }
  };

  // Open Delete Confirmation
  const confirmDelete = async (barber: AppUser) => {
    if (!isAdmin) {
      setMessage('Admin authorization is required.');
      return;
    }
    const hasHistory = await barberHasTransactions(barber.id);
    setDeleteHasHistory(hasHistory);
    setDeleteTarget(barber);
  };

  // Execute Delete
  const handleExecuteDelete = async () => {
    if (!deleteTarget || !isAdmin) return;
    setDeleting(true);
    try {
      await deleteBarber(deleteTarget.id);
      await refreshBarbers();

      if (selectedBarber?.id === deleteTarget.id) {
        setDetailsVisible(false);
        setSelectedBarber(null);
      }

      setMessage(`${deleteTarget.name} has been removed.`);
      setDeleteTarget(null);
    } catch {
      setMessage('Could not delete barber.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !transactions.length && !barbers.length) {
    return <LoadingState message="Loading barbers…" />;
  }

  return (
    <>
      <Screen refreshing={loading} onRefresh={refresh}>
        {/* Header Stats Overview */}
        <View style={styles.statsRow}>
          <View style={styles.statMiniCard}>
            <Text variant="labelSmall" style={styles.statMiniLabel}>
              TOTAL STAFF
            </Text>
            <Text variant="headlineSmall" style={styles.statMiniValue}>
              {barbers.length}
            </Text>
          </View>
          <View style={styles.statMiniCard}>
            <Text variant="labelSmall" style={styles.statMiniLabel}>
              ACTIVE
            </Text>
            <Text variant="headlineSmall" style={[styles.statMiniValue, { color: Colors.success }]}>
              {activeCount}
            </Text>
          </View>
          <View style={styles.statMiniCard}>
            <Text variant="labelSmall" style={styles.statMiniLabel}>
              INACTIVE
            </Text>
            <Text variant="headlineSmall" style={[styles.statMiniValue, { color: Colors.textMuted }]}>
              {inactiveCount}
            </Text>
          </View>
        </View>

        {/* Search & Status Filters */}
        <Searchbar
          placeholder="Search by name, email, skill…"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
        />

        <View style={styles.filterRow}>
          <Chip
            selected={statusFilter === 'ALL'}
            onPress={() => setStatusFilter('ALL')}
            style={styles.filterChip}
          >
            All ({barbers.length})
          </Chip>
          <Chip
            selected={statusFilter === 'ACTIVE'}
            onPress={() => setStatusFilter('ACTIVE')}
            style={styles.filterChip}
          >
            Active ({activeCount})
          </Chip>
          <Chip
            selected={statusFilter === 'INACTIVE'}
            onPress={() => setStatusFilter('INACTIVE')}
            style={styles.filterChip}
          >
            Inactive ({inactiveCount})
          </Chip>
        </View>

        {/* Performance Period & Toggle */}
        <SectionCard
          title={`Barber Earnings · ${range.label}`}
          subtitle="Revenue calculations based on completed services"
          right={
            <Button
              compact
              onPress={() => setShowPerformanceTable((prev) => !prev)}
            >
              {showPerformanceTable ? 'Hide Table' : 'Show Table'}
            </Button>
          }
        >
          <SegmentedButtons
            value={preset}
            onValueChange={(value) => setPreset(value as RangePreset)}
            buttons={[
              { value: 'TODAY', label: 'Today' },
              { value: 'WEEK', label: 'Week' },
              { value: 'MONTH', label: 'Month' },
            ]}
            style={styles.segmented}
          />

          {showPerformanceTable && (
            <View style={styles.tableWrapper}>
              <BarberPerformanceTable rows={performance} />
            </View>
          )}
        </SectionCard>

        {/* Staff Management List */}
        <SectionCard
          title="Staff Directory"
          subtitle={
            isAdmin
              ? 'Admin access: Add, view details, update, or remove barbers.'
              : 'Barber staff list'
          }
        >
          {filteredBarbers.length === 0 ? (
            <EmptyState
              icon="💈"
              title={searchQuery ? 'No barbers found' : 'No barbers registered'}
              message={
                searchQuery
                  ? 'Try a different search query or clear the filter.'
                  : 'Tap the "+" button below to add your first barber.'
              }
              actionLabel={searchQuery ? 'Clear Search' : 'Add Barber'}
              onAction={() => {
                if (searchQuery) {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                } else {
                  setSelectedBarber(null);
                  setFormVisible(true);
                }
              }}
            />
          ) : (
            filteredBarbers.map((barber) => {
              const stats = performance.find((p) => p.barberId === barber.id);
              const initials = barber.name
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0].toUpperCase())
                .join('');

              return (
                <Card
                  key={barber.id}
                  style={[
                    styles.barberCard,
                    !barber.active && styles.inactiveCard,
                  ]}
                  onPress={() => {
                    setSelectedBarber(barber);
                    setDetailsVisible(true);
                  }}
                >
                  <Card.Content style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <Avatar.Text
                        size={44}
                        label={initials || 'B'}
                        style={[
                          styles.cardAvatar,
                          {
                            backgroundColor: barber.active
                              ? Colors.primary
                              : Colors.textMuted,
                          },
                        ]}
                      />
                      <View style={styles.cardInfo}>
                        <View style={styles.cardTitleRow}>
                          <Text variant="titleMedium" style={styles.barberName}>
                            {barber.name}
                          </Text>
                          <StatusBadge
                            status={barber.active ? 'ACTIVE' : 'INACTIVE'}
                            customLabel={barber.active ? 'Active' : 'Inactive'}
                          />
                        </View>
                        <Text variant="bodySmall" style={styles.barberEmail}>
                          {barber.email}
                          {barber.phone ? ` · ${barber.phone}` : ''}
                        </Text>
                      </View>
                    </View>

                    {/* Specialties tags */}
                    {barber.specialties && barber.specialties.length > 0 && (
                      <View style={styles.cardSpecialties}>
                        {barber.specialties.slice(0, 3).map((s) => (
                          <Chip key={s} compact style={styles.cardChip} textStyle={styles.cardChipText}>
                            {s}
                          </Chip>
                        ))}
                        {barber.specialties.length > 3 && (
                          <Text variant="bodySmall" style={styles.moreChips}>
                            +{barber.specialties.length - 3} more
                          </Text>
                        )}
                      </View>
                    )}

                    <Divider style={styles.cardDivider} />

                    {/* Earnings & Action Buttons */}
                    <View style={styles.cardFooter}>
                      <View style={styles.earningsBox}>
                        <Text variant="labelSmall" style={styles.earningsLabel}>
                          {range.label} Earnings
                        </Text>
                        <Text variant="titleMedium" style={styles.earningsValue}>
                          {formatCurrency(stats?.earnings ?? 0)}
                        </Text>
                        <Text variant="bodySmall" style={styles.customerCount}>
                          {stats?.serviceCount ?? 0} {stats?.serviceCount === 1 ? 'service' : 'services'}
                        </Text>
                      </View>

                      {isAdmin && (
                        <View style={styles.actionButtons}>
                          <Button
                            mode="outlined"
                            compact
                            icon="account-details"
                            onPress={() => {
                              setSelectedBarber(barber);
                              setDetailsVisible(true);
                            }}
                            style={styles.actionBtn}
                          >
                            Details
                          </Button>

                          <IconButton
                            icon="pencil-outline"
                            size={20}
                            mode="contained-tonal"
                            onPress={() => {
                              setSelectedBarber(barber);
                              setFormVisible(true);
                            }}
                          />

                          <IconButton
                            icon="delete-outline"
                            iconColor={Colors.danger}
                            size={20}
                            mode="contained-tonal"
                            onPress={() => confirmDelete(barber)}
                          />

                          <Switch
                            value={barber.active}
                            onValueChange={() => handleToggleActive(barber)}
                          />
                        </View>
                      )}
                    </View>
                  </Card.Content>
                </Card>
              );
            })
          )}
        </SectionCard>
      </Screen>

      {/* Floating Action Button to Add Barber (Admin only) */}
      {isAdmin && (
        <FAB
          icon="plus"
          label="Add Barber"
          style={styles.fab}
          onPress={() => {
            setSelectedBarber(null);
            setFormVisible(true);
          }}
        />
      )}

      {/* Barber Form Dialog (Add / Edit) */}
      <BarberFormDialog
        visible={formVisible}
        barber={selectedBarber}
        saving={saving}
        shopPercentage={settings.shopPercentage}
        onDismiss={() => {
          setFormVisible(false);
          setSelectedBarber(null);
        }}
        onSave={handleSave}
      />

      {/* Barber Full Details Dialog */}
      <BarberDetailsDialog
        visible={detailsVisible}
        barber={selectedBarber}
        performance={performance.find((p) => p.barberId === selectedBarber?.id)}
        transactions={transactions}
        shopPercentage={settings.shopPercentage}
        onDismiss={() => {
          setDetailsVisible(false);
          setSelectedBarber(null);
        }}
        onEdit={(barber) => {
          setDetailsVisible(false);
          setSelectedBarber(barber);
          setFormVisible(true);
        }}
        onToggleActive={handleToggleActive}
        onDelete={(barber) => {
          setDetailsVisible(false);
          confirmDelete(barber);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Portal>
        <Dialog
          visible={Boolean(deleteTarget)}
          onDismiss={() => setDeleteTarget(null)}
          style={styles.deleteDialog}
        >
          <Dialog.Title style={styles.deleteTitle}>
            {deleteHasHistory ? 'Deactivate or Delete Barber?' : 'Delete Barber?'}
          </Dialog.Title>

          <Dialog.Content>
            {deleteHasHistory ? (
              <Text variant="bodyMedium" style={styles.deleteText}>
                <Text style={{ fontWeight: '700' }}>{deleteTarget?.name}</Text> has recorded
                transactions in BarberSync. Deleting this barber will remove their account, but we
                strongly recommend{' '}
                <Text style={{ fontWeight: '700', color: Colors.primary }}>deactivating</Text> instead
                so past financial and revenue reports remain accurate.
              </Text>
            ) : (
              <Text variant="bodyMedium" style={styles.deleteText}>
                Are you sure you want to permanently delete{' '}
                <Text style={{ fontWeight: '700' }}>{deleteTarget?.name}</Text>? This staff record
                will be completely removed.
              </Text>
            )}
          </Dialog.Content>

          <Dialog.Actions style={styles.deleteActions}>
            <Button onPress={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>

            {deleteHasHistory && (
              <Button
                mode="outlined"
                onPress={async () => {
                  if (deleteTarget) {
                    await handleToggleActive(deleteTarget);
                    setDeleteTarget(null);
                  }
                }}
                disabled={deleting}
              >
                Deactivate Instead
              </Button>
            )}

            <Button
              mode="contained"
              buttonColor={Colors.danger}
              onPress={handleExecuteDelete}
              loading={deleting}
              disabled={deleting}
            >
              {deleting ? 'Deleting…' : deleteHasHistory ? 'Delete Anyway' : 'Delete'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <AppSnackbar message={message} onDismiss={() => setMessage(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  statMiniCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  statMiniLabel: {
    color: Colors.textMuted,
    fontWeight: '700',
    fontSize: 10,
    letterSpacing: 0.5,
  },
  statMiniValue: {
    fontWeight: '800',
    color: Colors.text,
    marginTop: 2,
  },
  searchbar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 0,
    marginTop: 4,
    marginBottom: 8,
  },
  searchInput: {
    minHeight: 44,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
  },
  segmented: {
    marginBottom: 10,
  },
  tableWrapper: {
    marginTop: 8,
  },
  barberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 10,
    elevation: 1,
  },
  inactiveCard: {
    opacity: 0.75,
    backgroundColor: '#FAFAFA',
  },
  cardContent: {
    padding: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardAvatar: {
    elevation: 1,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  barberName: {
    fontWeight: '700',
    color: Colors.text,
  },
  barberEmail: {
    color: Colors.textMuted,
    marginTop: 2,
  },
  cardSpecialties: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  cardChip: {
    backgroundColor: '#F0F4F8',
    height: 24,
  },
  cardChipText: {
    fontSize: 11,
    lineHeight: 14,
  },
  moreChips: {
    color: Colors.textMuted,
    fontSize: 11,
    marginLeft: 4,
  },
  cardDivider: {
    marginVertical: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsBox: {
    flex: 1,
  },
  earningsLabel: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  earningsValue: {
    fontWeight: '800',
    color: Colors.success,
  },
  customerCount: {
    color: Colors.textMuted,
    fontSize: 11,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    borderRadius: 8,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 20,
    backgroundColor: Colors.accent,
  },
  deleteDialog: {
    borderRadius: 16,
  },
  deleteTitle: {
    fontWeight: '700',
    color: Colors.text,
  },
  deleteText: {
    color: Colors.text,
    lineHeight: 20,
  },
  deleteActions: {
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
});
