import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { COLORS } from '@constants/Colors';

import { MainButton } from '@components/index';
import { Text, View } from '@components/Themed';

import { HttpBreetClient } from '@services/breet/client';
import { type BreetDepositState, useBreetDeposit } from '@services/breet/useBreetDeposit';

/**
 * "Pay with crypto" modal for FundWallet. Calls KaJota backend's
 * /breet/* proxy to generate a deposit address, then polls for
 * settlement.
 *
 * Flow for the Loom demo:
 *   1. User taps "Pay with crypto" on FundWallet
 *   2. Modal opens, calls POST /breet/deposit-address → address shown
 *   3. User sends crypto from any wallet (or scans the QR — TODO,
 *      see comment below)
 *   4. Backend's /webhooks/breet/deposit lands → polling picks it up
 *   5. Modal transitions: awaiting → detected → settled
 *   6. User taps Done → wallet balance reflects the credit
 *
 * Production note: this component receives the backend baseUrl +
 * auth token via props because FundWallet already has those
 * threaded through its existing API client. Keeps the modal
 * declarative.
 */
export interface BreetDepositModalProps {
  visible: boolean;
  /** KaJota backend base URL (typically the existing PAYMENT_BASE_URL or BASE_URL). */
  backendBaseUrl: string;
  /** Bearer token / cookie value forwarded as the Authorization header. */
  authorization: string;
  /** Which coin the user wants to send. */
  coin?: string;
  /** Optional expected amount — useful in OrderPayment, ignored on free FundWallet. */
  amountExpected?: string;
  /** Free-form correlation key (e.g. orderId). */
  reference?: string;
  /** Called when the modal should close. Settlement / cancel / error all hit this. */
  onClose: (settled: boolean) => void;
}

const DEFAULT_COIN = 'USDT-TRC20';

const BreetDepositModal: React.FC<BreetDepositModalProps> = ({
  visible,
  backendBaseUrl,
  authorization,
  coin,
  amountExpected,
  reference,
  onClose,
}) => {
  const client = useMemo(
    () =>
      new HttpBreetClient({
        baseUrl: backendBaseUrl,
        authorization,
      }),
    [backendBaseUrl, authorization],
  );

  // Only kick off the deposit flow once the modal is visible.
  const input = useMemo(
    () =>
      visible
        ? {
            coin: coin ?? DEFAULT_COIN,
            ...(amountExpected !== undefined ? { amountExpected } : {}),
            ...(reference !== undefined ? { reference } : {}),
          }
        : null,
    [visible, coin, amountExpected, reference],
  );

  const state = useBreetDeposit(client, input);

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={() => onClose(state.kind === 'settled')}
    >
      <View style={styles.root}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => onClose(state.kind === 'settled')}
          >
            <Feather color={COLORS.light.text} name="x" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pay with crypto</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <BreetDepositBody state={state} />
        </ScrollView>

        <View style={styles.footer}>
          <FooterAction state={state} onClose={onClose} />
        </View>
      </View>
    </Modal>
  );
};

const BreetDepositBody: React.FC<{ state: BreetDepositState }> = ({ state }) => {
  switch (state.kind) {
    case 'idle':
    case 'creating':
      return (
        <View style={styles.centerBlock}>
          <ActivityIndicator color={COLORS.light.colorOne} size="large" />
          <Text style={styles.statusText}>Generating address…</Text>
        </View>
      );

    case 'awaiting':
      return (
        <View>
          <Text style={styles.label}>Coin</Text>
          <Text style={styles.value}>{state.address.coin}</Text>

          <Text style={styles.label}>Send to address</Text>
          <View style={styles.addressRow}>
            <Text selectable numberOfLines={2} style={styles.address}>
              {state.address.address}
            </Text>
            <TouchableOpacity
              style={styles.copyBtn}
              onPress={async () => {
                await Clipboard.setStringAsync(state.address.address);
                Alert.alert('Copied', 'Address copied to clipboard.');
              }}
            >
              <Feather color={COLORS.light.colorOne} name="copy" size={16} />
              <Text style={styles.copyBtnText}>Copy</Text>
            </TouchableOpacity>
          </View>

          {/*
            TODO(loom): install react-native-qrcode-svg + render
            `state.address.qrCode ?? state.address.address` as a QR.
            Until then the address-text + copy flow is enough for a
            demo where the user pastes into another wallet.
          */}

          <Text style={styles.hint}>
            Settles to {state.address.settlementCurrency} via Breet. Send any amount of{' '}
            {state.address.coin}; this screen updates when the payment lands (usually
            under a minute).
          </Text>

          <View style={styles.waitRow}>
            <ActivityIndicator color={COLORS.light.colorOne} />
            <Text style={styles.statusText}>Waiting for payment…</Text>
          </View>
        </View>
      );

    case 'detected':
      return (
        <View style={styles.centerBlock}>
          <Feather color="#1e6b3a" name="check-circle" size={48} />
          <Text style={styles.statusText}>Payment detected</Text>
          <Text style={styles.hint}>Settling to {state.address.settlementCurrency}…</Text>
        </View>
      );

    case 'settled':
      return (
        <View style={styles.centerBlock}>
          <Feather color="#1e6b3a" name="check-circle" size={48} />
          <Text style={styles.statusText}>
            Wallet credited{' '}
            {state.deposit.amountSettled
              ? `${state.deposit.amountSettled} ${state.deposit.settlementCurrency}`
              : ''}
          </Text>
        </View>
      );

    case 'expired':
      return (
        <View style={styles.centerBlock}>
          <Feather color="#a86a00" name="clock" size={48} />
          <Text style={styles.statusText}>Address expired</Text>
          <Text style={styles.hint}>
            No payment was detected in time. Tap Done and try again to mint a fresh
            address.
          </Text>
        </View>
      );

    case 'error':
      return (
        <View style={styles.centerBlock}>
          <Feather color="#c1272d" name="alert-triangle" size={48} />
          <Text style={styles.statusText}>Something went wrong</Text>
          <Text style={styles.hint}>{state.reason}</Text>
        </View>
      );
  }
};

const FooterAction: React.FC<{
  state: BreetDepositState;
  onClose: (settled: boolean) => void;
}> = ({ state, onClose }) => {
  if (state.kind === 'settled') {
    return <MainButton err={false} title="Done" onPressFunction={() => onClose(true)} />;
  }
  if (state.kind === 'expired' || state.kind === 'error') {
    return (
      <MainButton err={false} title="Close" onPressFunction={() => onClose(false)} />
    );
  }
  return <MainButton err={false} title="Cancel" onPressFunction={() => onClose(false)} />;
};

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20, paddingTop: 48, paddingBottom: 24 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  content: { paddingBottom: 24 },
  footer: { marginTop: 16 },
  centerBlock: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  label: {
    fontSize: 12,
    color: '#6e6e72',
    marginTop: 16,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: { fontSize: 16, fontWeight: '600' },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f5f5f7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  address: { flex: 1, fontFamily: 'Courier', fontSize: 13 },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#eef0ff',
  },
  copyBtnText: { color: COLORS.light.colorOne, fontSize: 12, fontWeight: '600' },
  hint: { fontSize: 12, color: '#6e6e72', marginTop: 12, lineHeight: 16 },
  waitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  statusText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});

export default BreetDepositModal;
