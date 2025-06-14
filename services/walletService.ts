// services/walletService.ts
import { ethers } from 'ethers';
import { getAccount, getWalletClient } from '@wagmi/core';
import { wagmiConfig } from '../walletConfig';

interface WalletConnectionResult {
  signer: ethers.Signer;
  address: string;
  provider: ethers.BrowserProvider;
}

export const connectWallet = async (): Promise<WalletConnectionResult> => {
  try {
    const account = getAccount(wagmiConfig);
    if (!account.isConnected) {
      throw new Error('No wallet connected. Please connect via RainbowKit.');
    }

    const walletClient = await getWalletClient(wagmiConfig, { chainId: 137 });
    if (!walletClient) {
      throw new Error('Failed to get wallet client.');
    }

    const provider = new ethers.BrowserProvider(walletClient);
    const signer = await provider.getSigner();
    const address = account.address;
    if (!address) {
      throw new Error('Wallet address is undefined');
    }

    const network = await provider.getNetwork();
    if (Number(network.chainId) !== 137) {
      throw new Error('Wallet is not connected to Polygon. Please switch to the Polygon network.');
    }

    return { signer, address, provider };
  } catch (error: any) {
    console.error('Error connecting wallet:', error);
    throw new Error(error.message || 'Failed to connect wallet. Unknown error.');
  }
};