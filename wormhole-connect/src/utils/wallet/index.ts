import { Context, ChainConfig } from 'sdklegacy';
import {
  NotSupported,
  Wallet,
  WalletState,
} from '@xlabs-libs/wallet-aggregator-core';
import {
  connectReceivingWallet,
  connectWallet as connectSourceWallet,
  clearWallet,
} from 'store/wallet';

import config from 'config';
import { getChainByChainId } from 'utils';

import { RootState } from 'store';
import { Dispatch } from 'redux';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { Network, Chain, UnsignedTransaction } from '@wormhole-foundation/sdk';

import {
  EvmUnsignedTransaction,
  EvmChains,
} from '@wormhole-foundation/sdk-evm';

export enum TransferWallet {
  SENDING = 'sending',
  RECEIVING = 'receiving',
}

const walletConnection = {
  sending: undefined as Wallet | undefined,
  receiving: undefined as Wallet | undefined,
};

export const walletAcceptedChains = (context: Context | undefined): Chain[] => {
  if (!context) {
    return config.chainsArr.map((c) => c.key);
  }
  return config.chainsArr
    .filter((c) => c.context === context)
    .map((c) => c.key);
};

export const setWalletConnection = (type: TransferWallet, wallet: Wallet) => {
  walletConnection[type] = wallet;
};

export const connectWallet = async (
  type: TransferWallet,
  chain: Chain,
  walletInfo: WalletData,
  dispatch: Dispatch<any>,
) => {
  const { wallet, name } = walletInfo;

  setWalletConnection(type, wallet);

  const chainConfig = config.chains[chain];
  if (!chainConfig) {
    throw new Error(`Unable to find wallets for chain ${chain}`);
  }

  const { chainId, context } = chainConfig;
  await wallet.connect({ chainId });

  config.triggerEvent({
    type: 'wallet.connect',
    details: {
      side: type,
      chain: chain,
      wallet: walletInfo.name.toLowerCase(),
    },
  });

  const address = wallet.getAddress()!;
  const payload = {
    address,
    type: walletInfo.type,
    icon: wallet.getIcon(),
    name: wallet.getName(),
  };

  if (type === TransferWallet.SENDING) {
    dispatch(connectSourceWallet(payload));
  } else {
    dispatch(connectReceivingWallet(payload));
  }

  // clear wallet when the user manually disconnects from outside the app
  wallet.on('disconnect', () => {
    wallet.removeAllListeners();
    dispatch(clearWallet(type));
    localStorage.removeItem(`wormhole-connect:wallet:${context}`);
  });

  // when the user has multiple wallets connected and either changes
  // or disconnects the current wallet, clear the wallet
  wallet.on('accountsChanged', (accs: string[]) => {
    // disconnect only if there are no accounts, or if the new account is different from the current
    const shouldDisconnect =
      accs.length === 0 || (accs.length && address && accs[0] !== address);

    if (shouldDisconnect) {
      wallet.disconnect();
    }
  });

  localStorage.setItem(`wormhole-connect:wallet:${context}`, name);
};

// Checks localStorage for previously used wallet for this chain
// and connects to it automatically if it exists.
export const connectLastUsedWallet = async (
  type: TransferWallet,
  chain: Chain,
  dispatch: Dispatch<any>,
) => {
  const chainConfig = config.chains[chain!]!;
  const lastUsedWallet = localStorage.getItem(
    `wormhole-connect:wallet:${chainConfig.context}`,
  );
  // if the last used wallet is not WalletConnect, try to connect to it
  if (lastUsedWallet && lastUsedWallet !== 'WalletConnect') {
    const options = await getWalletOptions(chainConfig);
    const wallet = options.find((w) => w.name === lastUsedWallet);
    if (wallet) {
      await connectWallet(type, chain, wallet, dispatch);
    }
  }
};

export const useConnectToLastUsedWallet = (): void => {
  const dispatch = useDispatch();
  const { toChain, fromChain } = useSelector(
    (state: RootState) => state.transferInput,
  );

  useEffect(() => {
    if (fromChain)
      connectLastUsedWallet(TransferWallet.SENDING, fromChain, dispatch);
    if (toChain)
      connectLastUsedWallet(TransferWallet.RECEIVING, toChain, dispatch);
  }, [fromChain, toChain]);
};

export const getWalletConnection = (type: TransferWallet) => {
  return walletConnection[type];
};

export const swapWalletConnections = () => {
  const temp = walletConnection.sending;
  walletConnection.sending = walletConnection.receiving;
  walletConnection.receiving = temp;
};

export const registerWalletSigner = async (
  chain: Chain,
  type: TransferWallet,
) => {
  const w = walletConnection[type]! as any;
  if (!w) throw new Error('must connect wallet');
  const signer = await w.getSigner();
  config.whLegacy.registerSigner(chain, signer);
};

export const switchChain = async (
  chainId: number | string,
  type: TransferWallet,
): Promise<string | undefined> => {
  const w: Wallet = walletConnection[type]! as any;
  if (!w) throw new Error('must connect wallet');

  const config = getChainByChainId(chainId)!;
  const currentChain = w.getNetworkInfo().chainId;
  if (currentChain === chainId) return;
  if (config.context === Context.ETH) {
    try {
      // some wallets may not support chain switching
      const evm = await import('utils/wallet/evm');
      await evm.switchChain(w, chainId as number);
    } catch (e) {
      if (e instanceof NotSupported) return;
      throw e;
    }
  }
  return w.getAddress();
};

export const disconnect = async (type: TransferWallet) => {
  const w = walletConnection[type]! as any;
  if (!w) return;
  await w.disconnect();
};

export const signAndSendTransaction = async (
  chain: Chain,
  request: UnsignedTransaction<Network, Chain>,
  walletType: TransferWallet,
  options: any = {},
): Promise<string> => {
  const chainConfig = config.chains[chain]!;

  const wallet = walletConnection[walletType];
  if (!wallet) {
    throw new Error('wallet is undefined');
  }

  if (chainConfig.context === Context.ETH) {
    const evm = await import('utils/wallet/evm');
    const tx = await evm.signAndSendTransaction(
      request as EvmUnsignedTransaction<Network, EvmChains>,
      wallet,
      chain,
      options,
    );
    return tx;
  } else {
    throw new Error('unimplemented');
  }
};

const getReady = (wallet: Wallet) => {
  const ready = wallet.getWalletState();
  return ready !== WalletState.Unsupported && ready !== WalletState.NotDetected;
};

export type WalletData = {
  name: string;
  type: Context;
  icon: string;
  isReady: boolean;
  wallet: Wallet;
};

const mapWallets = (
  wallets: Record<string, Wallet>,
  type: Context,
  skip: string[] = [],
): WalletData[] => {
  return Object.values(wallets)
    .filter(
      (wallet, index, self) =>
        index === self.findIndex((o) => o.getName() === wallet.getName()),
    )
    .filter((wallet) => !skip.includes(wallet.getName()))
    .map((wallet) => ({
      wallet,
      type,
      name: wallet.getName(),
      icon: wallet.getIcon(),
      isReady: getReady(wallet),
    }));
};

export const getWalletOptions = async (
  config: ChainConfig | undefined,
): Promise<WalletData[]> => {
  if (config === undefined) {
    return [];
  } else if (config.context === Context.ETH) {
    const evm = await import('utils/wallet/evm');
    return Object.values(mapWallets(evm.wallets, Context.ETH));
  }
  return [];
};
