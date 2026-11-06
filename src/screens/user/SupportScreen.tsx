import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import { Header } from '../../components/common/Header';
import { CustomInput } from '../../components/inputs/CustomInput';
import { PrimaryButton } from '../../components/buttons/PrimaryButton';

export const SupportScreen = () => {
  const navigation = useNavigation();

  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSubmitted, setTicketSubmitted] = useState(false);

  const faqs = [
    {
      q: 'How does the 5% Deposit Bonus work?',
      a: 'Every time you deposit funds into VF Wallet, our active 5% bonus promotion is automatically calculated. Once our administrative team verifies your payment screenshot, both your principal deposit and the 5% bonus are credited together into your available wallet balance.',
    },
    {
      q: 'Why is my deposit or withdrawal in "Pending" status?',
      a: 'All deposits and withdrawals require manual reconciliation against bank statements to protect against unauthorized transactions. Verification is typically completed within 15–30 minutes during business hours.',
    },
    {
      q: 'How do I withdraw funds to my Bank or UPI?',
      a: 'Navigate to the Withdraw screen, specify your desired payout amount (up to your available balance), choose UPI or Bank Account, and submit. The withdrawal will be disbursed after admin approval.',
    },
    {
      q: 'Is there any minimum deposit or withdrawal limit?',
      a: 'The minimum deposit amount is ₹100, and the minimum withdrawal amount is ₹100. Withdrawals cannot exceed your current available wallet balance.',
    },
    {
      q: 'What should I do if my payment screenshot was rejected?',
      a: 'If a deposit is rejected, open the transaction details to view the specific rejection reason. You can resubmit a new deposit request with a clear, readable screenshot showing the bank UTR reference number.',
    },
  ];

  const handleSendTicket = () => {
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      Alert.alert('Required', 'Please enter a subject and message description.');
      return;
    }
    setTicketSubmitted(true);
    setTimeout(() => {
      Alert.alert(
        'Support Ticket Created',
        'Your demo support query has been logged. Our priority fintech desk will reply shortly.'
      );
      setTicketSubject('');
      setTicketMessage('');
      setTicketSubmitted(false);
    }, 600);
  };

  return (
    <ScreenContainer scrollable backgroundColor={colors.background}>
      <Header
        title="Help & Support"
        subtitle="24/7 Priority Customer Assistance"
        showBack
        onBackPress={() => navigation.goBack()}
      />

      <View style={styles.content}>
        {/* Contact Helpline Channels */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Direct Helplines</Text>

          <View style={styles.channelRow}>
            <View style={styles.iconCircle}>
              <Ionicons name="mail" size={20} color={colors.primary} />
            </View>
            <View style={styles.channelInfo}>
              <Text style={styles.channelLabel}>Email Support Desk</Text>
              <Text style={styles.channelValue}>support@vfwallet.com</Text>
            </View>
          </View>

          <View style={styles.channelRow}>
            <View style={[styles.iconCircle, { backgroundColor: '#E6F8EF' }]}>
              <Ionicons name="logo-whatsapp" size={20} color="#16A36A" />
            </View>
            <View style={styles.channelInfo}>
              <Text style={styles.channelLabel}>WhatsApp Helpline</Text>
              <Text style={styles.channelValue}>+91 98201 00000</Text>
            </View>
          </View>

          <View style={styles.channelRow}>
            <View style={[styles.iconCircle, { backgroundColor: '#FFF0B3' }]}>
              <Ionicons name="call" size={20} color="#B76E00" />
            </View>
            <View style={styles.channelInfo}>
              <Text style={styles.channelLabel}>Toll-Free Customer Care</Text>
              <Text style={styles.channelValue}>1800-200-8800 (9 AM - 9 PM)</Text>
            </View>
          </View>
        </View>

        {/* Frequently Asked Questions */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Frequently Asked Questions</Text>

          {faqs.map((item, index) => {
            const isExpanded = expandedFaq === index;
            return (
              <View key={index} style={styles.faqItem}>
                <TouchableOpacity
                  style={styles.faqQuestionRow}
                  onPress={() => setExpandedFaq(isExpanded ? null : index)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.faqQuestion}>{item.q}</Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.primary}
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <Text style={styles.faqAnswer}>{item.a}</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Submit Ticket */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Open a Support Ticket</Text>

          <CustomInput
            label="Subject"
            placeholder="e.g. Deposit screenshot inquiry"
            value={ticketSubject}
            onChangeText={setTicketSubject}
          />

          <CustomInput
            label="Message"
            placeholder="Describe your issue with reference numbers..."
            value={ticketMessage}
            onChangeText={setTicketMessage}
            multiline
            numberOfLines={4}
          />

          <PrimaryButton
            title="Submit Support Request"
            onPress={handleSendTicket}
            loading={ticketSubmitted}
            fullWidth
            size="md"
          />
        </View>
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
  cardHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 14,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  channelInfo: {
    flex: 1,
  },
  channelLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  channelValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    paddingVertical: 12,
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    paddingRight: 8,
  },
  faqAnswer: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 8,
  },
});

export default SupportScreen;

