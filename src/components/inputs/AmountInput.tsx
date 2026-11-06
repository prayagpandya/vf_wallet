import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { colors } from '../../theme/colors';
import { formatRupeesToINR } from '../../utils/currency';

interface AmountInputProps {
  label?: string;
  value: string;
  onChangeValue: (text: string) => void;
  quickAmounts?: number[];
  quickPercentages?: { label: string; percentage: number }[];
  maxAvailableRupees?: number;
  error?: string;
  placeholder?: string;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  label = 'Enter Amount',
  value,
  onChangeValue,
  quickAmounts,
  quickPercentages,
  maxAvailableRupees,
  error,
  placeholder = '0',
}) => {
  const handleQuickAmountPress = (amount: number) => {
    onChangeValue(amount.toString());
  };

  const handlePercentagePress = (pct: number) => {
    if (maxAvailableRupees && maxAvailableRupees > 0) {
      const calculated = Math.floor((maxAvailableRupees * pct) / 100);
      onChangeValue(calculated.toString());
    }
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={[styles.inputBox, !!error && styles.inputBoxError]}>
        <Text style={styles.currencySymbol}>₹</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder={placeholder}
          placeholderTextColor={colors.textLight}
          value={value}
          onChangeText={(text) => {
            // Strip any non-numeric characters
            const cleaned = text.replace(/[^0-9]/g, '');
            onChangeValue(cleaned);
          }}
        />
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}

      {/* Quick Amount Chips */}
      {quickAmounts && quickAmounts.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScrollView}
          contentContainerStyle={styles.chipContainer}
        >
          {quickAmounts.map((amt) => {
            const isSelected = value === amt.toString();
            return (
              <TouchableOpacity
                key={amt}
                activeOpacity={0.7}
                onPress={() => handleQuickAmountPress(amt)}
                style={[
                  styles.chip,
                  isSelected && styles.chipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    isSelected && styles.chipTextSelected,
                  ]}
                >
                  +{formatRupeesToINR(amt)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Quick Percentage Chips (for Withdrawal) */}
      {quickPercentages && quickPercentages.length > 0 && (
        <View style={styles.percentageContainer}>
          {quickPercentages.map((item) => (
            <TouchableOpacity
              key={item.label}
              activeOpacity={0.7}
              onPress={() => handlePercentagePress(item.percentage)}
              style={styles.percentageChip}
            >
              <Text style={styles.percentageChipText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 64,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  inputBoxError: {
    borderColor: colors.danger,
    backgroundColor: '#FFF9F8',
  },
  currencySymbol: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    height: '100%',
    padding: 0,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    marginTop: 6,
    fontWeight: '500',
  },
  chipScrollView: {
    marginTop: 10,
  },
  chipContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.lightBlue,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  chipTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  percentageContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  percentageChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.lightBlue,
    borderWidth: 1,
    borderColor: '#CCE0FF',
  },
  percentageChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});

export default AmountInput;

