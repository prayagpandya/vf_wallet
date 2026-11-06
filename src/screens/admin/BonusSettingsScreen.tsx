import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';
import { useWallet } from '../../hooks/useWallet';
import { formatPaiseToINR, rupeesToPaise } from '../../utils/currency';
import { calculateDepositPreview } from '../../utils/calculations';

export const BonusSettingsScreen = () => {
  const { bonusConfig, updateBonusConfig } = useWallet();

  const [isEnabled, setIsEnabled] = useState(bonusConfig.isEnabled);
  const [percentageStr, setPercentageStr] = useState(
    bonusConfig.bonusPercentage.toString()
  );
  const [simulatorAmountStr, setSimulatorAmountStr] = useState('10000');
  const [loading, setLoading] = useState(false);

  const percentage = parseFloat(percentageStr) || 0;
  const simAmountPaise = rupeesToPaise(simulatorAmountStr || '0');
  const preview = calculateDepositPreview(
    simAmountPaise,
    isEnabled ? percentage : 0
  );

  const handleSave = async () => {
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
      Alert.alert(
        'Invalid Percentage',
        'Bonus percentage must be a number between 0% and 100%.'
      );
      return;
    }

    setLoading(true);
    await updateBonusConfig(percentage, isEnabled);
    setLoading(false);
    Alert.alert(
      'Settings Updated',
      `Deposit bonus is now ${isEnabled ? `${percentage}% Active` : 'Disabled'}. This will apply to all future deposit requests.`
    );
  };

  const quickPercentages = [2, 5, 10, 15, 20];

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <Header
        title="Bonus Configuration"
        subtitle="Manage platform deposit cashback rates"
      />

      <View style={styles.content}>
        {/* Toggle Bonus Program */}
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchTextCol}>
              <Text style={styles.cardHeading}>Enable Deposit Bonus</Text>
              <Text style={styles.switchSubtitle}>
                When active, eligible user deposits receive automatic cashback credit
              </Text>
            </View>
            <Switch
              value={isEnabled}
              onValueChange={setIsEnabled}
              trackColor={{ false: '#DFE1E6', true: colors.primaryLight }}
              thumbColor={isEnabled ? colors.primary : '#FFFFFF'}
            />
          </View>
        </View>

        {/* Set Bonus Percentage */}
        <View style={[styles.card, !isEnabled && styles.disabledCard]}>
          <Text style={styles.cardHeading}>Bonus Rate Percentage (%)</Text>
          <Text style={styles.cardDescription}>
            Configures the cashback rate applied to user deposits. Default is 5%.
          </Text>

          <View style={styles.rateInputRow}>
            <TextInput
              style={styles.rateInput}
              keyboardType="numeric"
              value={percentageStr}
              editable={isEnabled}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9.]/g, '');
                setPercentageStr(cleaned);
              }}
            />
            <Text style={styles.percentSymbol}>%</Text>
          </View>

          {/* Quick Percentage Chips */}
          <View style={styles.chipsRow}>
            {quickPercentages.map((p) => {
              const isSelected = percentage === p;
              return (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.chip,
                    isSelected && styles.chipSelected,
                    !isEnabled && styles.disabledChip,
                  ]}
                  disabled={!isEnabled}
                  onPress={() => setPercentageStr(p.toString())}
                >
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && styles.chipTextSelected,
                    ]}
                  >
                    {p}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Live Calculation Preview Simulator */}
        <View style={styles.card}>
          <View style={styles.simulatorHeader}>
            <Ionicons name="calculator-outline" size={20} color={colors.primary} />
            <Text style={styles.simulatorTitle}>Live Calculation Simulator</Text>
          </View>

          <Text style={styles.simLabel}>Sample Deposit Amount (₹):</Text>
          <View style={styles.simInputBox}>
            <Text style={styles.simCurrency}>₹</Text>
            <TextInput
              style={styles.simInput}
              keyboardType="numeric"
              value={simulatorAmountStr}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9]/g, '');
                setSimulatorAmountStr(cleaned);
              }}
            />
          </View>

          {/* Simulated Breakdown */}
          <View style={styles.previewBox}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Principal Deposit</Text>
              <Text style={styles.previewVal}>
                {formatPaiseToINR(preview.depositPaise)}
              </Text>
            </View>

            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>
                Bonus Credited ({isEnabled ? `${preview.bonusPercentage}%` : 'Disabled'})
              </Text>
              <Text style={[styles.previewVal, styles.bonusVal]}>
                +{formatPaiseToINR(preview.bonusPaise)}
              </Text>
            </View>

            <View style={styles.previewDivider} />

            <View style={styles.previewRow}>
              <Text style={styles.previewTotalLabel}>Total Wallet Credit</Text>
              <Text style={styles.previewTotalVal}>
                {formatPaiseToINR(preview.totalCreditPaise)}
              </Text>
            </View>
          </View>

          {/* Golden Rule Notice */}
          <View style={styles.noticeBox}>
            <Ionicons name="information-circle-outline" size={16} color={colors.info} />
            <Text style={styles.noticeText}>
              Rule: Newly configured bonus percentages apply only to future
              approved deposits. Past approved transactions strictly retain
              their original bonus amount.
            </Text>
          </View>
        </View>

        {/* Save Button */}
        <PrimaryButton
          title="Save Bonus Settings"
          onPress={handleSave}
          loading={loading}
          fullWidth
          size="lg"
          style={styles.saveBtn}
        />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  disabledCard: {
    opacity: 0.6,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  switchSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  cardDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  rateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    paddingHorizontal: 16,
    height: 56,
  },
  rateInput: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    flex: 1,
    padding: 0,
  },
  percentSymbol: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipSelected: {
    backgroundColor: colors.lightBlue,
    borderColor: colors.primary,
  },
  disabledChip: {
    opacity: 0.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  simulatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  simulatorTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  simLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  simInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  simCurrency: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
    marginRight: 6,
  },
  simInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    padding: 0,
  },
  previewBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  previewLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  previewVal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  bonusVal: {
    color: colors.warningDark,
    fontWeight: '700',
  },
  previewDivider: {
    height: 1,
    backgroundColor: '#FDE68A',
    marginVertical: 6,
  },
  previewTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  previewTotalVal: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.infoLight,
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  noticeText: {
    fontSize: 11,
    color: colors.info,
    marginLeft: 6,
    flex: 1,
    lineHeight: 16,
  },
  saveBtn: {
    marginTop: 4,
    marginBottom: 20,
  },
});

export default BonusSettingsScreen;

