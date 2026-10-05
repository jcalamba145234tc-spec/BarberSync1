/**
 * Read-only detail popup for one barber's profile, shown from the admin
 * Barbers screen - contact info, specialties, and basic stats.
 */
import React from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  Chip,
  Dialog,
  Divider,
  IconButton,
  Portal,
  Text,
} from 'react-native-paper';
import { Colors } from '../../constants/colors';
import { AppUser } from '../../types/auth';
import { BarberPerformance } from '../../types/report';
import { Transaction } from '../../types/transaction';
import { formatCurrency } from '../../utils/calculations';
import { formatDate } from '../../utils/dateUtils';
import { StatusBadge } from '../ui/StatusBadge';

interface BarberDetailsDialogProps {
  visible: boolean;
  barber: AppUser | null;
  performance?: BarberPerformance;
  transactions?: Transaction[];
  shopPercentage: number;
  onDismiss: () => void;
  onEdit: (barber: AppUser) => void;
  onToggleActive: (barber: AppUser) => void;
  onDelete: (barber: AppUser) => void;
}

export function BarberDetailsDialog({
  visible,
  barber,
  performance,
  transactions = [],
  shopPercentage,
  onDismiss,
  onEdit,
  onToggleActive,
  onDelete,
}: BarberDetailsDialogProps) {
  if (!barber) return null;

  const initials = barber.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  const commission = barber.commissionRate !== undefined
    ? Math.round(barber.commissionRate * 100)
    : Math.round((1 - shopPercentage) * 100);

  const barberTransactions = transactions
    .filter((t) => t.barberId === barber.id && t.status === 'COMPLETED')
    .slice(0, 5);

  const handleCall = () => {
    if (barber.phone) {
      Linking.openURL(`tel:${barber.phone}`);
    }
  };

  const handleEmail = () => {
    if (barber.email) {
      Linking.openURL(`mailto:${barber.email}`);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} style={styles.dialog}>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Header info */}
            <View style={styles.header}>
              <Avatar.Text
                size={56}
                label={initials || 'B'}
                style={[
                  styles.avatar,
                  { backgroundColor: barber.active ? Colors.primary : Colors.textMuted },
                ]}
              />
              <View style={styles.headerText}>
                <View style={styles.titleRow}>
                  <Text variant="titleLarge" style={styles.name}>
                    {barber.name}
                  </Text>
                  <StatusBadge
                    status={barber.active ? 'ACTIVE' : 'INACTIVE'}
                    customLabel={barber.active ? 'Active' : 'Inactive'}
                  />
                </View>
                <Text variant="bodySmall" style={styles.roleSub}>
                  Barber Staff · Joined {formatDate(barber.createdAt)}
                </Text>
              </View>
            </View>

            <Divider style={styles.divider} />

            {/* Contact details */}
            <Text variant="labelLarge" style={styles.sectionLabel}>
              Contact Information
            </Text>
            <View style={styles.infoRow}>
              <View style={styles.infoCol}>
                <Text variant="labelSmall" style={styles.fieldLabel}>
                  Email
                </Text>
                <Text variant="bodyMedium" style={styles.fieldValue}>
                  {barber.email || 'None'}
                </Text>
              </View>
              {barber.email ? (
                <IconButton icon="email-outline" size={20} onPress={handleEmail} />
              ) : null}
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoCol}>
                <Text variant="labelSmall" style={styles.fieldLabel}>
                  Phone
                </Text>
                <Text variant="bodyMedium" style={styles.fieldValue}>
                  {barber.phone || 'No phone recorded'}
                </Text>
              </View>
              {barber.phone ? (
                <IconButton icon="phone-outline" size={20} onPress={handleCall} />
              ) : null}
            </View>

            <Divider style={styles.divider} />

            {/* Professional profile */}
            <Text variant="labelLarge" style={styles.sectionLabel}>
              Staff Profile & Split
            </Text>

            <View style={styles.statGrid}>
              <View style={styles.statCard}>
                <Text variant="labelSmall" style={styles.fieldLabel}>
                  Commission Split
                </Text>
                <Text variant="titleMedium" style={styles.statValueHighlight}>
                  {commission}%
                </Text>
                <Text variant="bodySmall" style={styles.subtext}>
                  Shop gets {100 - commission}%
                </Text>
              </View>

              <View style={styles.statCard}>
                <Text variant="labelSmall" style={styles.fieldLabel}>
                  Customers Served
                </Text>
                <Text variant="titleMedium" style={styles.statValue}>
                  {performance?.serviceCount ?? 0}
                </Text>
                <Text variant="bodySmall" style={styles.subtext}>
                  Completed services
                </Text>
              </View>
            </View>

            <View style={styles.statGrid}>
              <View style={styles.statCard}>
                <Text variant="labelSmall" style={styles.fieldLabel}>
                  Revenue Generated
                </Text>
                <Text variant="titleMedium" style={styles.statValue}>
                  {formatCurrency(performance?.revenue ?? 0)}
                </Text>
              </View>

              <View style={styles.statCard}>
                <Text variant="labelSmall" style={styles.fieldLabel}>
                  Barber Earnings
                </Text>
                <Text variant="titleMedium" style={styles.earningsValue}>
                  {formatCurrency(performance?.earnings ?? 0)}
                </Text>
              </View>
            </View>

            {/* Specialties */}
            <Text variant="labelMedium" style={[styles.fieldLabel, { marginTop: 12 }]}>
              Specialties & Skills
            </Text>
            <View style={styles.chipsRow}>
              {barber.specialties && barber.specialties.length > 0 ? (
                barber.specialties.map((item) => (
                  <Chip key={item} style={styles.chip} textStyle={styles.chipText}>
                    {item}
                  </Chip>
                ))
              ) : (
                <Text variant="bodySmall" style={styles.emptyText}>
                  No specific specialties listed.
                </Text>
              )}
            </View>

            {/* Notes */}
            {barber.notes ? (
              <View style={styles.notesBox}>
                <Text variant="labelSmall" style={styles.fieldLabel}>
                  Notes / Schedule
                </Text>
                <Text variant="bodyMedium" style={styles.notesText}>
                  {barber.notes}
                </Text>
              </View>
            ) : null}

            {/* Recent Completed Services */}
            {barberTransactions.length > 0 && (
              <>
                <Divider style={styles.divider} />
                <Text variant="labelLarge" style={styles.sectionLabel}>
                  Recent Activity
                </Text>
                {barberTransactions.map((tx) => (
                  <View key={tx.id} style={styles.txRow}>
                    <View style={styles.txInfo}>
                      <Text variant="bodyMedium" style={styles.txCustomer}>
                        {tx.customerName}
                      </Text>
                      <Text variant="bodySmall" style={styles.txMeta}>
                        {tx.serviceName} · {formatDate(tx.createdAt)}
                      </Text>
                    </View>
                    <View style={styles.txAmounts}>
                      <Text variant="labelMedium" style={styles.txTotal}>
                        {formatCurrency(tx.amount)}
                      </Text>
                      <Text variant="bodySmall" style={styles.txShare}>
                        Earned: {formatCurrency(tx.barberShare)}
                      </Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </ScrollView>
        </Dialog.ScrollArea>

        {/* Action buttons */}
        <Dialog.Actions style={styles.actions}>
          <Button
            textColor={Colors.danger}
            icon="delete-outline"
            onPress={() => onDelete(barber)}
          >
            Delete
          </Button>

          <Button
            mode="outlined"
            icon={barber.active ? 'account-off-outline' : 'account-check-outline'}
            onPress={() => onToggleActive(barber)}
          >
            {barber.active ? 'Deactivate' : 'Activate'}
          </Button>

          <Button
            mode="contained"
            icon="pencil-outline"
            onPress={() => onEdit(barber)}
            style={styles.editBtn}
          >
            Edit Details
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    maxHeight: '88%',
    borderRadius: 16,
  },
  scrollArea: {
    paddingHorizontal: 0,
    marginTop: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    elevation: 2,
  },
  headerText: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: {
    fontWeight: '700',
    color: Colors.text,
  },
  roleSub: {
    color: Colors.textMuted,
    marginTop: 2,
  },
  divider: {
    marginVertical: 12,
  },
  sectionLabel: {
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  infoCol: {
    flex: 1,
  },
  fieldLabel: {
    color: Colors.textMuted,
  },
  fieldValue: {
    fontWeight: '600',
    color: Colors.text,
  },
  statGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  statCard: {
    flex: 1,
    padding: 10,
    backgroundColor: '#F7F8FA',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  statValueHighlight: {
    fontWeight: '800',
    color: Colors.primary,
    marginTop: 2,
  },
  earningsValue: {
    fontWeight: '800',
    color: Colors.success,
    marginTop: 2,
  },
  subtext: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  chip: {
    backgroundColor: '#ECEFF1',
  },
  chipText: {
    fontSize: 12,
  },
  emptyText: {
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  notesBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#FFF9E6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  notesText: {
    color: '#5D4037',
    marginTop: 2,
  },
  txRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  txInfo: {
    flex: 1,
  },
  txCustomer: {
    fontWeight: '600',
    color: Colors.text,
  },
  txMeta: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  txAmounts: {
    alignItems: 'flex-end',
  },
  txTotal: {
    fontWeight: '700',
    color: Colors.text,
  },
  txShare: {
    color: Colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  editBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
  },
});

