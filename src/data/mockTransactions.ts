import { Transaction } from '../types';

/**
 * INITIAL ZERO TRANSACTION STATE
 * Per specification: No fake transactions, dummy deposits, or sample withdrawals.
 * The system starts completely clean with 0 transactions and ₹0 balance.
 */
export const INITIAL_MOCK_TRANSACTIONS: Transaction[] = [];
