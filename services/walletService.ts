
import { ethers } from 'ethers';

interface WalletConnectionResult {
  signer: ethers.Signer;
  address: string;
  provider: ethers.BrowserProvider;
}

export const connectWallet = async (): Promise<WalletConnectionResult> => {
  if (!(window as any).ethereum) {
    throw new Error('No Ethereum wallet detected. Please install MetaMask or a compatible wallet.');
  }

  try {
    const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
    await browserProvider.send('eth_requestAccounts', []); // Request account access
    const signer = await browserProvider.getSigner();
    const address = await signer.getAddress();
    
    return { signer, address, provider: browserProvider };
  } catch (error: any) {
    console.error("Error connecting wallet:", error);
    if (error.code === 4001) { // User rejected request
        throw new Error('Wallet connection request rejected by user.');
    }
    throw new Error(error.message || 'Failed to connect wallet. Unknown error.');
  }
};
