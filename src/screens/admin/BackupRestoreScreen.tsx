import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  Modal,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { SecondaryButton } from '../../components/buttons/SecondaryButton';
import { adminApi } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useWallet } from '../../hooks/useWallet';
import { BackupSnapshot } from '../../types';
import { formatPaiseToINR } from '../../utils/currency';

export const BackupRestoreScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { isSuperAdmin } = useAuth();
  const { refreshData } = useWallet();

  const [snapshots, setSnapshots] = useState<BackupSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'FULL_RESET' | 'SINGLE_CLIENT' | 'SINGLE_TRANSACTION'>('all');

  // Action states
  const [isResettingApp, setIsResettingApp] = useState(false);
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);

  // Modals
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [selectedSnapshotForView, setSelectedSnapshotForView] = useState<BackupSnapshot | null>(null);
  const [modalTab, setModalTab] = useState<'clients' | 'transactions'>('clients');

  // Live timer tick for 5-minute undo countdown
  const [, setTimerTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTimerTick((t) => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadSnapshots = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await adminApi.getBackupSnapshots();
      if (res.success && Array.isArray(res.snapshots)) {
        setSnapshots(res.snapshots);
      }
    } catch (err) {
      console.error('Error loading backup snapshots:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSnapshots();
  }, [loadSnapshots]);

  // Handle Full App Reset (One-click zero state reset)
  const handleConfirmResetApp = async () => {
    setResetModalVisible(false);
    setIsResettingApp(true);
    try {
      const res = await adminApi.resetApplicationData();
      if (res.success) {
        Alert.alert(
          'Application Reset to Zero State 📦',
          'All clients, transactions, and points balances have been archived into a backup file. The live app is now in a clean zero state (0 clients, 0 transactions). You can restore this data at any time from Backup & Restore.'
        );
        await Promise.all([loadSnapshots(true), refreshData()]);
      } else {
        Alert.alert('Reset Failed', res.error || 'Could not reset application.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'An error occurred during reset.');
    } finally {
      setIsResettingApp(false);
    }
  };

  // Handle Restore
  const handleRestore = async (snapshot: BackupSnapshot) => {
    setActionInProgressId(snapshot.id);
    try {
      const res = await adminApi.restoreBackupSnapshot(snapshot.id);
      if (res.success) {
        Alert.alert(
          'Data Restored ✅',
          `"${snapshot.title}" has been restored to the live application. Live data has been preserved without overwriting new data.\n\n⏱️ You have 5 minutes to Undo this restore if needed.`
        );
        await Promise.all([loadSnapshots(true), refreshData()]);
      } else {
        Alert.alert('Restore Failed', res.error || 'Could not restore backup.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to restore snapshot.');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Handle Undo Restore (within 5 minutes)
  const handleUndoRestore = async (snapshot: BackupSnapshot) => {
    setActionInProgressId(snapshot.id);
    try {
      const res = await adminApi.undoRestoreBackupSnapshot(snapshot.id);
      if (res.success) {
        Alert.alert(
          'Restore Undone ↩️',
          `The restore operation has been undone. Data has been safely returned to its archived backup state.`
        );
        await Promise.all([loadSnapshots(true), refreshData()]);
      } else {
        Alert.alert('Undo Failed', res.error || 'Could not undo restore.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to undo restore.');
    } finally {
      setActionInProgressId(null);
    }
  };

  // Handle Permanent Hard Delete from DB & Images
  const handlePermanentDelete = (snapshot: BackupSnapshot) => {
    Alert.alert(
      'Permanent Hard Delete ⚠️',
      `Are you sure you want to PERMANENTLY delete "${snapshot.title}"?\n\nThis will permanently delete all client records and transaction records from MongoDB and delete all associated screenshot images from storage.\n\nThis action CANNOT be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setActionInProgressId(snapshot.id);
            try {
              const res = await adminApi.deleteBackupPermanently(snapshot.id);
              if (res.success) {
                Alert.alert(
                  'Permanently Deleted 🗑️',
                  res.message || 'Records and screenshot images have been permanently deleted from database.'
                );
                await loadSnapshots(true);
              } else {
                Alert.alert('Delete Failed', res.error || 'Could not permanently delete.');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to permanently delete.');
            } finally {
              setActionInProgressId(null);
            }
          },
        },
      ]
    );
  };

  const filteredSnapshots = useMemo(() => {
    if (activeFilter === 'all') return snapshots;
    return snapshots.filter((s) => s.backupType === activeFilter);
  }, [snapshots, activeFilter]);

  const renderSnapshotItem = ({ item }: { item: BackupSnapshot }) => {
    const isFullReset = item.backupType === 'FULL_RESET';
    const isSingleClient = item.backupType === 'SINGLE_CLIENT';
    const isSingleTxn = item.backupType === 'SINGLE_TRANSACTION';
    const now = Date.now();
    let canUndo = false;
    let secondsLeft = 0;

    if (item.isRestored && item.canUndoUntil) {
      const untilMs = new Date(item.canUndoUntil).getTime();
      if (untilMs > now) {
        canUndo = true;
        secondsLeft = Math.max(0, Math.round((untilMs - now) / 1000));
      }
    }

    const minutes = Math.floor(secondsLeft / 60);
    const secs = secondsLeft % 60;
    const timeFormatted = `${minutes}:${secs < 10 ? '0' : ''}${secs}`;

    const isProcessing = actionInProgressId === item.id;
    const clientCount = item.clientCount ?? (item.clientIds ? item.clientIds.length : (item.clients ? item.clients.length : 0));

    return (
      <View style={styles.snapshotCard}>
        {/* Top Badges */}
        <View style={styles.cardHeaderRow}>
          <View
            style={[
              styles.typeBadge,
              isFullReset
                ? styles.fullResetBadge
                : isSingleClient
                ? styles.singleClientBadge
                : styles.singleTxnBadge,
            ]}
          >
            <Ionicons
              name={isFullReset ? 'archive' : isSingleClient ? 'person' : 'document-text'}
              size={12}
              color={isFullReset ? '#92400E' : isSingleClient ? '#6B21A8' : '#1E40AF'}
            />
            <Text
              style={[
                styles.typeBadgeText,
                isFullReset
                  ? { color: '#92400E' }
                  : isSingleClient
                  ? { color: '#6B21A8' }
                  : { color: '#1E40AF' },
              ]}
            >
              {isFullReset
                ? 'FULL APP RESET'
                : isSingleClient
                ? 'DELETED CLIENT'
                : 'DELETED TRANSACTION'}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              item.isRestored ? styles.restoredBadge : styles.archivedBadge,
            ]}
          >
            <Ionicons
              name={item.isRestored ? 'checkmark-circle' : 'file-tray-full-outline'}
              size={12}
              color={item.isRestored ? '#15803D' : colors.textSecondary}
            />
            <Text
              style={[
                styles.statusBadgeText,
                item.isRestored ? { color: '#15803D' } : { color: colors.textSecondary },
              ]}
            >
              {item.isRestored ? 'Restored to App' : 'Archived in Backup'}
            </Text>
          </View>
        </View>

        {/* Title & Metadata */}
        <Text style={styles.snapshotTitle}>{item.title}</Text>
        <Text style={styles.snapshotMeta}>
          Created by <Text style={{ fontWeight: '700', color: colors.text }}>{item.createdByName}</Text> •{' '}
          {new Date(item.createdAt).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>

        {/* Metrics Grid */}
        <View style={styles.metricsBox}>
          {isFullReset && (
            <View style={styles.metricItem}>
              <Text style={styles.metricSub}>Clients</Text>
              <Text style={[styles.metricVal, { color: '#6B21A8' }]}>
                {clientCount} Clients
              </Text>
            </View>
          )}

          {isSingleClient && (
            <View style={styles.metricItem}>
              <Text style={styles.metricSub}>Client</Text>
              <Text style={[styles.metricVal, { color: '#6B21A8' }]}>
                1 Client
              </Text>
            </View>
          )}

          <View style={styles.metricItem}>
            <Text style={styles.metricSub}>Transactions</Text>
            <Text style={styles.metricVal}>{item.transactionCount} Txns</Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricSub}>Deposits</Text>
            <Text style={[styles.metricVal, { color: colors.success }]}>
              {formatPaiseToINR(item.totalDepositPaise)}
            </Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricSub}>Withdrawals</Text>
            <Text style={[styles.metricVal, { color: '#B45309' }]}>
              {formatPaiseToINR(item.totalWithdrawPaise)}
            </Text>
          </View>
        </View>

        {/* Undo Timer Strip if Restored recently */}
        {canUndo && (
          <View style={styles.undoNoticeStrip}>
            <Ionicons name="timer-outline" size={16} color="#D97706" />
            <Text style={styles.undoNoticeText}>
              Restored recently. Undo window active:{' '}
              <Text style={{ fontWeight: '800', color: '#B45309' }}>{timeFormatted} remaining</Text>
            </Text>
          </View>
        )}

        {/* Actions Row */}
        <View style={styles.actionButtonsRow}>
          {/* View Details */}
          <TouchableOpacity
            style={styles.viewDetailsBtn}
            onPress={() => {
              setSelectedSnapshotForView(item);
              setModalTab(item.clients && item.clients.length > 0 ? 'clients' : 'transactions');
            }}
          >
            <Ionicons name="eye-outline" size={15} color={colors.primary} />
            <Text style={styles.viewDetailsText}>View Items</Text>
          </TouchableOpacity>

          {/* Restore or Undo */}
          {!item.isRestored ? (
            <TouchableOpacity
              style={[styles.restoreBtn, isProcessing && { opacity: 0.6 }]}
              disabled={isProcessing}
              onPress={() => handleRestore(item)}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="refresh-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.restoreBtnText}>Restore Data</Text>
                </>
              )}
            </TouchableOpacity>
          ) : canUndo ? (
            <TouchableOpacity
              style={[styles.undoBtn, isProcessing && { opacity: 0.6 }]}
              disabled={isProcessing}
              onPress={() => handleUndoRestore(item)}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#92400E" />
              ) : (
                <>
                  <Ionicons name="arrow-undo-outline" size={15} color="#92400E" />
                  <Text style={styles.undoBtnText}>Undo Restore ({timeFormatted})</Text>
                </>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.restoredDoneChip}>
              <Ionicons name="checkmark-done" size={14} color="#15803D" />
              <Text style={styles.restoredDoneText}>Active in App</Text>
            </View>
          )}

          {/* Hard Permanent Delete (Super Admin only) */}
          {isSuperAdmin && (
            <TouchableOpacity
              style={styles.deletePermBtn}
              disabled={isProcessing}
              onPress={() => handlePermanentDelete(item)}
            >
              <Ionicons name="trash-outline" size={15} color="#DC2626" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer backgroundColor={colors.background}>
      <Header
        title="Backup & Restore"
        subtitle="Manage App Resets & Archived Snapshots"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Super Admin One-Click App Reset Card */}
        {isSuperAdmin && (
          <View style={styles.resetCard}>
            <View style={styles.resetHeaderRow}>
              <View style={styles.resetIconBox}>
                <Ionicons name="warning" size={24} color="#DC2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resetTitle}>Reset Application to Zero State</Text>
                <Text style={styles.resetSub}>
                  One-click action archives all live clients, transactions, and points to zero state.
                  Deleted data disappears completely from the live app, but is safely kept in MongoDB and can be restored anytime from the backup list below.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.resetButton, isResettingApp && { opacity: 0.6 }]}
              disabled={isResettingApp}
              onPress={() => setResetModalVisible(true)}
            >
              {isResettingApp ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="archive-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.resetButtonText}>
                    Reset Live Application (Archive to Backup)
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Filter Chips */}
        <View style={styles.filterSection}>
          <Text style={styles.filterSectionTitle}>Archived Snapshots & Deleted Items</Text>
          <View style={styles.chipsRow}>
            <TouchableOpacity
              style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
              onPress={() => setActiveFilter('all')}
            >
              <Text style={[styles.filterChipText, activeFilter === 'all' && styles.filterChipTextActive]}>
                All ({snapshots.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, activeFilter === 'FULL_RESET' && styles.filterChipActive]}
              onPress={() => setActiveFilter('FULL_RESET')}
            >
              <Text style={[styles.filterChipText, activeFilter === 'FULL_RESET' && styles.filterChipTextActive]}>
                App Resets ({snapshots.filter((s) => s.backupType === 'FULL_RESET').length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, activeFilter === 'SINGLE_CLIENT' && styles.filterChipActive]}
              onPress={() => setActiveFilter('SINGLE_CLIENT')}
            >
              <Text style={[styles.filterChipText, activeFilter === 'SINGLE_CLIENT' && styles.filterChipTextActive]}>
                Deleted Clients ({snapshots.filter((s) => s.backupType === 'SINGLE_CLIENT').length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterChip, activeFilter === 'SINGLE_TRANSACTION' && styles.filterChipActive]}
              onPress={() => setActiveFilter('SINGLE_TRANSACTION')}
            >
              <Text style={[styles.filterChipText, activeFilter === 'SINGLE_TRANSACTION' && styles.filterChipTextActive]}>
                Deleted Txns ({snapshots.filter((s) => s.backupType === 'SINGLE_TRANSACTION').length})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Snapshots List */}
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading backup snapshots...</Text>
          </View>
        ) : filteredSnapshots.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="file-tray-outline" size={48} color={colors.textLight} />
            <Text style={styles.emptyTitle}>No Backup Snapshots Found</Text>
            <Text style={styles.emptySub}>
              When you reset the application or delete clients/transactions, restorable backup archives will be stored here.
            </Text>
          </View>
        ) : (
          filteredSnapshots.map((snapshot) => (
            <React.Fragment key={snapshot.id}>
              {renderSnapshotItem({ item: snapshot })}
            </React.Fragment>
          ))
        )}
      </ScrollView>

      {/* Confirmation Modal for Resetting App */}
      <Modal
        visible={resetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setResetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalAlertIcon}>
              <Ionicons name="alert-circle" size={48} color="#DC2626" />
            </View>
            <Text style={styles.modalTitle}>Confirm Application Reset</Text>
            <Text style={styles.modalDesc}>
              This will archive all current clients, transactions, and points balances to zero state.
              {'\n\n'}
              <Text style={{ fontWeight: '700', color: colors.success }}>
                ✅ Your data will NOT be deleted from the database.
              </Text>{' '}
              It will be saved as a restorable backup archive right here in this screen.
            </Text>

            <View style={styles.modalButtonRow}>
              <SecondaryButton
                title="Cancel"
                onPress={() => setResetModalVisible(false)}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                title="Yes, Reset App"
                onPress={handleConfirmResetApp}
                style={{ flex: 1, backgroundColor: '#DC2626' }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Snapshot Items Viewer Modal */}
      <Modal
        visible={Boolean(selectedSnapshotForView)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSnapshotForView(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={[styles.modalTitle, { marginBottom: 0 }]}>
                {selectedSnapshotForView?.backupType === 'FULL_RESET'
                  ? 'App Reset Archive Items'
                  : selectedSnapshotForView?.backupType === 'SINGLE_CLIENT'
                  ? 'Deleted Client Archive'
                  : 'Deleted Transaction'}
              </Text>
              <TouchableOpacity onPress={() => setSelectedSnapshotForView(null)}>
                <Ionicons name="close-circle" size={26} color={colors.textLight} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>
              {selectedSnapshotForView?.title}
            </Text>

            {/* Toggle Tabs if both clients and transactions are present */}
            {selectedSnapshotForView?.clients && selectedSnapshotForView.clients.length > 0 && selectedSnapshotForView?.transactions && (
              <View style={styles.modalTabsRow}>
                <TouchableOpacity
                  style={[styles.modalTabBtn, modalTab === 'clients' && styles.modalTabBtnActive]}
                  onPress={() => setModalTab('clients')}
                >
                  <Ionicons
                    name="people-outline"
                    size={14}
                    color={modalTab === 'clients' ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.modalTabText, modalTab === 'clients' && styles.modalTabTextActive]}>
                    Clients ({selectedSnapshotForView.clients.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalTabBtn, modalTab === 'transactions' && styles.modalTabBtnActive]}
                  onPress={() => setModalTab('transactions')}
                >
                  <Ionicons
                    name="receipt-outline"
                    size={14}
                    color={modalTab === 'transactions' ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.modalTabText, modalTab === 'transactions' && styles.modalTabTextActive]}>
                    Transactions ({selectedSnapshotForView.transactions.length})
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <ScrollView style={{ maxHeight: 360 }}>
              {modalTab === 'clients' && selectedSnapshotForView?.clients && selectedSnapshotForView.clients.length > 0 ? (
                selectedSnapshotForView.clients.map((c: any, idx: number) => (
                  <View key={c.id || idx} style={styles.miniClientItem}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                        {c.name}
                      </Text>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.primary }}>
                        {formatPaiseToINR(c.totalBalancePaise || 0)} Points
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        📞 {c.phone} {c.bonusPercentage ? `• ${c.bonusPercentage}% Bonus` : ''}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-IN') : '—'}
                      </Text>
                    </View>
                  </View>
                ))
              ) : selectedSnapshotForView?.transactions && selectedSnapshotForView.transactions.length > 0 ? (
                selectedSnapshotForView.transactions.map((t: any, idx: number) => (
                  <View key={t.id || idx} style={styles.miniTxnItem}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                        {t.userName || 'Client'} ({t.userPhone || '—'})
                      </Text>
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '800',
                          color: t.type === 'DEPOSIT' ? colors.success : '#B45309',
                        }}
                      >
                        {t.type === 'DEPOSIT' ? '+' : '-'} {formatPaiseToINR(t.amountPaise)}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        {t.type} • UTR: {t.utr || 'N/A'}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textMuted }}>
                        {new Date(t.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={{ fontSize: 12, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', marginVertical: 20 }}>
                  No item details embedded in this snapshot.
                </Text>
              )}
            </ScrollView>

            <View style={{ marginTop: 14 }}>
              <PrimaryButton
                title="Close"
                onPress={() => setSelectedSnapshotForView(null)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  resetCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 20,
  },
  resetHeaderRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  resetIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#991B1B',
    marginBottom: 3,
  },
  resetSub: {
    fontSize: 12,
    color: '#7F1D1D',
    lineHeight: 17,
  },
  resetButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  filterSection: {
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    backgroundColor: colors.white,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  snapshotCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  fullResetBadge: {
    backgroundColor: '#FEF3C7',
  },
  singleClientBadge: {
    backgroundColor: '#F3E8FF',
  },
  singleTxnBadge: {
    backgroundColor: '#DBEAFE',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  restoredBadge: {
    backgroundColor: '#DCFCE7',
  },
  archivedBadge: {
    backgroundColor: '#F1F5F9',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  snapshotTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 3,
  },
  snapshotMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  metricsBox: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 2,
  },
  metricVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  undoNoticeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 12,
  },
  undoNoticeText: {
    fontSize: 12,
    color: '#92400E',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  restoreBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  restoreBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  undoBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  undoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  restoredDoneChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#DCFCE7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  restoredDoneText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803D',
  },
  deletePermBtn: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  emptySub: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 420,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  modalAlertIcon: {
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 10,
  },
  modalDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 4,
  },
  modalTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalTabBtnActive: {
    backgroundColor: colors.white,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  modalTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalTabTextActive: {
    fontWeight: '700',
    color: colors.primary,
  },
  miniClientItem: {
    backgroundColor: '#FAF5FF',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  miniTxnItem: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});

export default BackupRestoreScreen;
