// App.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi';
import { QueryClient } from '@tanstack/react-query';
import { DappRegistered, DappReview, CategoryOption, UserProfile, LeaderboardEntry, ProjectStats } from './types';
import DappCard from './components/DappCard';
import DappForm from './components/DappForm';
import RatingModal from './components/RatingModal';
import StatusBar from './components/StatusBar';
import Tabs, { ActiveTab } from './components/Tabs';
import ReviewCard from './components/ReviewCard';
import Spinner from './components/Spinner';
import Notification from './components/Notification';
import UserProfileDisplay from './components/UserProfileDisplay';
import LeaderboardTab from './components/LeaderboardTab';
import DappDetailPage from './components/DappDetailPage'; // Import new component
import { connectWallet as connectWalletService } from './services/walletService';
import { ExclamationTriangleIcon } from './components/icons/ExclamationTriangleIcon';
import { RateCaster } from './RateCasterSDK/src';
import { getSocket } from './socket';
import '@rainbow-me/rainbowkit/styles.css';
import { polygon } from 'wagmi/chains';

const API_BASE_URL = 'http://localhost:3001/api';
const FRONTEND_RPC_URL = 'https://polygon-rpc.com';

const queryClient = new QueryClient();

const App: React.FC = () => {
  const [appStatus, setAppStatus] = useState<string>('Initializing...');
  const [currentChainName, setCurrentChainName] = useState<string | undefined>();
  const [dapps, setDapps] = useState<DappRegistered[]>([]);
  const [userReviews, setUserReviews] = useState<DappReview[]>([]);
  const [allReviews, setAllReviews] = useState<DappReview[]>([]);
  const [error, setError] = useState<string>('');

  const [sdk, setSdk] = useState<RateCaster | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [categoriesForFilter, setCategoriesForFilter] = useState<CategoryOption[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const [activeTab, setActiveTab] = useState<ActiveTab>('browse');
  const [selectedDapp, setSelectedDapp] = useState<DappRegistered | null>(null); // For edit form
  const [selectedDappIdForDetailPage, setSelectedDappIdForDetailPage] = useState<string | null>(null); // For detail page
  const [ratingModalOpen, setRatingModalOpen] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true); // General loading for initial data, dapps list
  const [isTxLoading, setIsTxLoading] = useState<boolean>(false); // For blockchain transactions
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(false); // For user profile specific fetches

  const [newDappData, setNewDappData] = useState<Partial<DappRegistered>>({
    name: '', description: '', url: '', imageUrl: '', categoryId: 0,
  });
  const [reviewData, setReviewData] = useState<{ dappId: string; rating: number; reviewText: string }>({
    dappId: '', rating: 5, reviewText: '',
  });
  const [newReviewNotification, setNewReviewNotification] = useState<DappReview | null>(null);

  const logger = {
    info: (...args: any[]) => console.log('%c[FE INFO]', 'color: #60a5fa; font-weight: bold;', ...args),
    error: (...args: any[]) => console.error('%c[FE ERROR]', 'color: #f87171; font-weight: bold;', ...args),
    warn: (...args: any[]) => console.warn('%c[FE WARN]', 'color: #facc15;', ...args),
    debug: (...args: any[]) => console.debug('%c[FE DEBUG]', 'color: #9ca3af;', ...args)
  };

const { address, isConnected, chain, connector } = useAccount();
const { data: walletClient } = useWalletClient();
const { switchChain } = useSwitchChain();

useEffect(() => {
  if (isConnected && address && connector && walletClient) {
    logger.info('Wallet connected via Wagmi:', address, connector.name);
    setUserAddress(address);
    setAppStatus('Connecting wallet...');
    const connectWalletAsync = async () => {
      try {
        // Reverted: Use walletClient directly
        const provider = new ethers.BrowserProvider(walletClient as any);
        const signer = await provider.getSigner();
        setSigner(signer);
        const network = await provider.getNetwork();
        const chainName = (!network.name || network.name === 'unknown') ? `ChainID ${network.chainId}` : network.name;
        setCurrentChainName(chainName);

        if (Number(network.chainId) !== 137) {
          try {
            setAppStatus('Requesting network switch to Polygon...');
            await switchChain({ chainId: polygon.id });
            setAppStatus(`Wallet Connected: Polygon`);
            setCurrentChainName('Polygon');
            setError('');
             // After successful switch, re-initialize provider and signer with the new chain context from walletClient
            // Reverted: Use walletClient directly
            const newProvider = new ethers.BrowserProvider(walletClient as any);
            const newSigner = await newProvider.getSigner();
            setSigner(newSigner);

          } catch (switchError: any) {
            logger.error('Failed to switch to Polygon network:', switchError);
            setError('Failed to switch to Polygon network. Please switch manually in your wallet.');
            setAppStatus('Error: Wrong network');
            setUserAddress(null);
            setSigner(null);
            setCurrentChainName(undefined);
            return;
          }
        } else {
          setAppStatus(`Wallet Connected: ${chainName}`);
          setError('');
        }
      } catch (err: any) {
        logger.error('Error during wallet connection:', err);
        setError(err.message || 'Failed to connect wallet');
        setAppStatus('Error: Wallet connection failed');
        setUserAddress(null);
        setSigner(null);
        setCurrentChainName(undefined);
      }
    };
    connectWalletAsync();
  } else if (!isConnected) {
    logger.info('Wallet disconnected');
    setUserAddress(null);
    setSigner(null);
    setUserProfile(null);
    setCurrentChainName(undefined);
    setAppStatus('Services Connected.'); // Or 'Wallet Disconnected'
    setError('');
  }
}, [isConnected, address, connector, walletClient, switchChain]);


  useEffect(() => {
    try {
      const httpProvider = new ethers.JsonRpcProvider(FRONTEND_RPC_URL);
      const sdkInstance = new RateCaster(httpProvider);
      setSdk(sdkInstance);
      logger.info('RateCaster SDK instance configured for frontend operations.');
    } catch (e) {
      logger.error('Failed to initialize frontend SDK instance:', e);
      setError('Failed to initialize SDK for submissions.');
    }
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/categories`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data: CategoryOption[] = await response.json();
      setCategoryOptions(data);
      setCategoriesForFilter(data);
    } catch (e: any) {
      logger.error('Failed to fetch categories:', e);
      setError(prev => `${prev} Failed to load categories. `);
    }
  };

  const fetchUserSpecificData = useCallback(async (currentAddress: string) => {
    if (!currentAddress) {
      setUserReviews([]);
      setUserProfile(null);
      return;
    }
    setIsProfileLoading(true);
    try {
      const profileRes = await fetch(`${API_BASE_URL}/actions/wallet-connected`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: currentAddress }),
      });
      if (!profileRes.ok) throw new Error(`Backend profile fetch failed: ${profileRes.statusText}`);
      const profileData = await profileRes.json();
      setUserProfile(profileData);

      const reviewsRes = await fetch(`${API_BASE_URL}/reviews/user/${currentAddress}`);
      if (!reviewsRes.ok) throw new Error(`Backend user reviews fetch failed: ${reviewsRes.statusText}`);
      const userReviewsData: DappReview[] = await reviewsRes.json();
      setUserReviews(userReviewsData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));

      setError('');
    } catch (err: any) {
      logger.error("Error fetching user specific data:", err.message);
      setError(prev => `${prev ? prev + '; ' : ''}User data fetch error: ${err.message}`);
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  const refreshDappsAndReviews = useCallback(async (showLoadingIndicator: boolean = true) => {
    if (showLoadingIndicator) setIsLoading(true);
    const oldStatus = appStatus;
    setAppStatus('Refreshing data from backend...');
    try {
      const dappsResponse = await fetch(`${API_BASE_URL}/dapps`);
      if (!dappsResponse.ok) throw new Error(`Failed to fetch dApps: ${dappsResponse.statusText}`);
      const dappsData: DappRegistered[] = await dappsResponse.json();
      setDapps(dappsData);

      if (userAddress) { // Refresh user reviews as well if user is connected
        const userReviewsResponse = await fetch(`${API_BASE_URL}/reviews/user/${userAddress}`);
        if (!userReviewsResponse.ok) throw new Error(`Failed to fetch user reviews: ${userReviewsResponse.statusText}`);
        const userReviewsData: DappReview[] = await userReviewsResponse.json();
        setUserReviews(userReviewsData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
      }
      setAppStatus('Data refreshed');
      setError('');
    } catch (err: any) {
      logger.error('Data refresh failed:', err);
      setAppStatus(oldStatus); // Revert to old status on failure
      setError(err.message || 'Failed to refresh data');
    } finally {
      if (showLoadingIndicator) setIsLoading(false);
    }
  }, [userAddress, appStatus]); // Added appStatus to dependencies for oldStatus

  useEffect(() => {
    setIsLoading(true);
    setAppStatus('Connecting to services...');

    const socket = getSocket();

    socket.on('connect', () => {
      logger.info(`Socket.IO: Connected with id ${socket.id}`);
      setAppStatus('Services Connected.');
      refreshDappsAndReviews(true).catch(err => {
        logger.error('Initial data fetch failed:', err);
        setError(`Failed to load initial data: ${err.message}`);
        setIsLoading(false); // Ensure loading stops on error
      });
      fetchCategories();
    });

    socket.on('disconnect', (reason) => {
      logger.warn(`Socket.IO: Disconnected. Reason: ${reason}`);
      setAppStatus('Connection lost. Attempting to reconnect...');
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.on('connect_error', (err) => {
      logger.error('Socket.IO: Connection error:', err.message);
      setError(`Failed to connect to real-time service: ${err.message}.`);
      setAppStatus('Error: Real-time service connection failed');
      setIsLoading(false); // Stop loading on connection error
    });

    const handleProfileUpdate = (profile: UserProfile) => {
      logger.info('Socket.IO: User profile update received:', profile);
      if (userAddress && profile.address.toLowerCase() === userAddress.toLowerCase()) {
        setUserProfile(profile);
      }
    };

    const handleNewReviewEvent = async (reviewFromSocket: DappReview) => {
      logger.info('Socket.IO: New review event received:', reviewFromSocket);
      setNewReviewNotification(reviewFromSocket);

      // Optimistically update allReviews (not currently displayed but good for consistency)
      setAllReviews(prev => [
        reviewFromSocket,
        ...prev.filter(r => r.id !== reviewFromSocket.id)
      ].sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)));

      // Update user-specific reviews if it's their review
      if (userAddress && reviewFromSocket.rater.toLowerCase() === userAddress.toLowerCase()) {
        setUserReviews(prev => [
          reviewFromSocket,
          ...prev.filter(r => r.id !== reviewFromSocket.id)
        ].sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0)));
      }
      
      // Refresh dApp list to get new average ratings and review counts
      // Consider a more targeted update if performance becomes an issue
      try {
        const dappsResponse = await fetch(`${API_BASE_URL}/dapps`);
        if (!dappsResponse.ok) throw new Error(`Failed to fetch dApps: ${dappsResponse.statusText}`);
        const dappsData: DappRegistered[] = await dappsResponse.json();
        setDapps(dappsData);
        logger.debug('Fetched updated dApps with new aggregates after new review:', dappsData);
      } catch (err: any) {
        logger.error('Failed to fetch updated dApps after new review:', err.message);
        setError(prev => `${prev ? prev + '; ' : ''}Failed to update dApp data: ${err.message}`);
      }
    };

    const handleDappUpdateEvent = (updatedDappFromSocket: DappRegistered) => {
      logger.info('Socket.IO: DApp update event received:', updatedDappFromSocket);
      setDapps(prevDapps =>
        prevDapps.map(d => d.dappId === updatedDappFromSocket.dappId ? updatedDappFromSocket : d)
      );
       // If the currently viewed detail page dApp is updated, we might need to refresh it.
      // This is handled by DappDetailPage's own useEffect for now, but a direct refresh could be an optimization.
    };

    socket.on('userProfileUpdate', handleProfileUpdate);
    socket.on('newReview', handleNewReviewEvent);
    socket.on('dappUpdate', handleDappUpdateEvent);

    return () => {
      logger.info('Socket.IO: Removing event listeners on cleanup...');
      socket.off('userProfileUpdate', handleProfileUpdate);
      socket.off('newReview', handleNewReviewEvent);
      socket.off('dappUpdate', handleDappUpdateEvent);
      // socket.disconnect(); // Consider if disconnect is always desired on App unmount
    };
  }, [userAddress, refreshDappsAndReviews]); // Added refreshDappsAndReviews to dependency array

  useEffect(() => {
    if (userAddress) {
      fetchUserSpecificData(userAddress);
    } else {
      setUserReviews([]); // Clear user-specific data when disconnected
      setUserProfile(null);
    }
  }, [userAddress, fetchUserSpecificData]);


  const handleDappFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const parsedValue = name === 'categoryId' ? parseInt(value, 10) : value;
    if (activeTab === 'edit' && selectedDapp) {
      setSelectedDapp(prev => prev ? { ...prev, [name]: parsedValue } : null);
    } else {
      setNewDappData(prev => ({ ...prev, [name]: parsedValue }));
    }
  };

  const handleReviewFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setReviewData(prev => ({ ...prev, [name]: name === 'rating' ? parseInt(value, 10) : value }));
  };

  const handleStarRatingChange = (rating: number) => setReviewData(prev => ({ ...prev, rating }));

  const ensureWalletConnected = async (): Promise<ethers.Signer | null> => {
    if (signer && userAddress && (await signer.getAddress()).toLowerCase() === userAddress.toLowerCase()) {
      // Check if current signer network matches required (Polygon)
      const network = await (signer.provider as ethers.BrowserProvider).getNetwork();
      if (Number(network.chainId) === polygon.id) {
        return signer;
      } else {
        setError('Wallet is not on Polygon. Please switch network.');
        setAppStatus('Error: Wrong network');
        // Attempt to switch, or guide user.
         try {
            setAppStatus('Requesting network switch to Polygon...');
            if (switchChain && walletClient) { // Ensure switchChain and walletClient are available
                 await switchChain({ chainId: polygon.id });
                 // Re-fetch signer after switch
                 // Reverted: Use walletClient directly
                 const provider = new ethers.BrowserProvider(walletClient as any);
                 const newSigner = await provider.getSigner();
                 setSigner(newSigner);
                 const newNetwork = await provider.getNetwork();
                 setCurrentChainName((!newNetwork.name || newNetwork.name === 'unknown') ? `ChainID ${newNetwork.chainId}` : newNetwork.name);
                 setAppStatus(`Wallet Connected: ${currentChainName}`);
                 setError(''); // Clear previous error
                 return newSigner;
            } else {
                 setError('Network switch function not available or walletClient missing. Please switch manually.');
                 setAppStatus('Error: Manual network switch required');
            }
        } catch (switchError: any) {
            logger.error('Failed to switch to Polygon during action:', switchError);
            setError('Failed to switch to Polygon. Please switch manually in your wallet.');
            setAppStatus('Error: Wrong network');
        }
        return null;
      }
    }
    // If no signer, or address mismatch, or network mismatch after attempt, try full connection/re-connection
    setError('Wallet not connected or on wrong network. Please connect/switch and try again.');
    // Trigger connect modal if available or prompt user. For now, relies on user clicking ConnectButton.
    return null;
  };


  const handleRegisterDapp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDappData.name || !newDappData.description || !newDappData.url || !newDappData.imageUrl || !newDappData.categoryId) {
      setError('All dApp information fields, including category, are required.');
      return;
    }

    const currentSigner = await ensureWalletConnected();
    if (!currentSigner) {
      setError(prev => `${prev} Wallet not ready for DApp registration.`);
      return;
    }

    if (!sdk) {
      setError("SDK not available. Cannot register DApp.");
      return;
    }

    setIsTxLoading(true);
    setError('');
    try {
      const txResponse = await sdk.registerDapp(
        newDappData.name!, newDappData.description!, newDappData.url!,
        newDappData.imageUrl!, Number(newDappData.categoryId), currentSigner
      );
      logger.info(`DApp Registration transaction sent: ${txResponse.hash}. Waiting for confirmation...`);
      setAppStatus(`Registering ${newDappData.name}...`);
      await txResponse.wait();
      logger.info(`DApp Registration successful.`);
      setAppStatus(`DApp ${newDappData.name} registered!`);
      setNewDappData({ name: '', description: '', url: '', imageUrl: '', categoryId: 0 });
      setActiveTab('browse'); // Switch to browse tab
      // refreshDappsAndReviews will be triggered by socket event 'dappUpdate'
    } catch (err: any) {
      logger.error(`DApp Registration Failed:`, err);
      const readableError = err.reason || err.data?.message || err.message || (err.error?.message) || 'Transaction failed. Check console.';
      setError(readableError);
      setAppStatus('DApp registration failed.');
    } finally {
      setIsTxLoading(false);
    }
  };

  const startEditDapp = async (dappToEdit: DappRegistered) => {
    const currentSigner = await ensureWalletConnected();
     if (!currentSigner || !userAddress) { // Also check userAddress explicitly
      setError("Please connect your wallet and ensure it's on Polygon to edit dApps.");
      return;
    }
    if (userAddress.toLowerCase() !== dappToEdit.owner.toLowerCase()){
      setError("You are not the owner of this dApp.");
      return;
    }
    setSelectedDapp({ ...dappToEdit, categoryId: Number(dappToEdit.categoryId) });
    setActiveTab('edit');
  };

  const handleUpdateDapp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDapp) {
      setError("No DApp selected for update.");
      return;
    }

    const currentSigner = await ensureWalletConnected();
    if (!currentSigner) {
      setError(prev => `${prev} Wallet not ready for DApp update.`);
      return;
    }
     if (!sdk) {
      setError("SDK not available. Cannot update DApp.");
      return;
    }

    setIsTxLoading(true);
    setError('');
    try {
      const txResponse = await sdk.updateDapp(
        selectedDapp.dappId, selectedDapp.name, selectedDapp.description,
        selectedDapp.url, selectedDapp.imageUrl, Number(selectedDapp.categoryId), currentSigner
      );
      logger.info(`DApp Update transaction sent: ${txResponse.hash}. Waiting for confirmation...`);
      setAppStatus(`Updating ${selectedDapp.name}...`);
      await txResponse.wait();
      logger.info(`DApp Update successful.`);
      setAppStatus(`DApp ${selectedDapp.name} updated!`);
      setSelectedDapp(null);
      setActiveTab('browse');
      // refreshDappsAndReviews will be triggered by socket event 'dappUpdate'
    } catch (err: any) {
      logger.error(`DApp Update Failed:`, err);
      const readableError = err.reason || err.data?.message || err.message || (err.error?.message) || 'Transaction failed. Check console.';
      setError(readableError);
      setAppStatus('DApp update failed.');
    } finally {
      setIsTxLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewData.dappId || reviewData.rating < 1 || reviewData.rating > 5) {
      setError('Invalid review data. Select a dApp and rating.');
      return;
    }
    const currentSigner = await ensureWalletConnected();
    if (!currentSigner) {
      setError(prev => `${prev} Wallet not ready for review submission.`);
      return;
    }
    if (!sdk) {
      setError("SDK not available. Cannot submit review.");
      return;
    }

    setIsTxLoading(true);
    setError('');
    try {
      const txResponse = await sdk.submitReview(
        reviewData.dappId, reviewData.rating, reviewData.reviewText, currentSigner
      );
      logger.info(`Review Submission transaction sent: ${txResponse.hash}. Waiting for confirmation...`);
      setAppStatus(`Submitting review for ${dapps.find(d => d.dappId === reviewData.dappId)?.name || 'dApp'}...`);
      await txResponse.wait();
      logger.info(`Review Submission successful.`);
      setAppStatus(`Review submitted!`);
      setReviewData({ dappId: '', rating: 5, reviewText: '' }); // Reset form
      setRatingModalOpen(false);
      // Data refresh (user profile, dApp aggregates) handled by socket events 'userProfileUpdate' and 'newReview'
    } catch (err: any) {
      logger.error(`Review Submission Failed:`, err);
      const readableError = err.reason || err.data?.message || err.message || (err.error?.message) || 'Transaction failed. Check console.';
      setError(readableError);
      setAppStatus('Review submission failed.');
    } finally {
      setIsTxLoading(false);
    }
  };

  const openRatingModal = async (dappId: string) => {
    const currentSigner = await ensureWalletConnected();
    if (!currentSigner) { // Check if ensureWalletConnected returned a signer
      setError("Please connect your wallet and ensure it's on Polygon to rate dApps.");
      return;
    }
    // If wallet is connected and on the right network, proceed to open modal
    setReviewData(prev => ({ ...prev, dappId, rating: prev.dappId === dappId ? prev.rating : 5, reviewText: prev.dappId === dappId ? prev.reviewText : '' }));
    setRatingModalOpen(true);
  };

  const handleNavigateToDappDetail = (dappId: string) => {
    setSelectedDappIdForDetailPage(dappId);
  };

  const handleBackFromDetailPage = () => {
    setSelectedDappIdForDetailPage(null);
    // Optionally, ensure the browse tab is active or based on previous state
    setActiveTab('browse'); 
  };


  const CombinedLoading = isLoading || isTxLoading; // For disabling tabs etc.

  const dappsToDisplay = selectedCategory
    ? dapps.filter(dapp => dapp.categoryId === Number(selectedCategory))
    : dapps;

  const uniqueCategoryGroupsForFilter = Array.from(new Set(categoriesForFilter.map(opt => opt.group)))
    .sort((a: string, b: string) => a.localeCompare(b));

  // Main Render Logic
  if (selectedDappIdForDetailPage) {
    return (
      <div className="min-h-screen bg-neutral-900 text-neutral-200 flex justify-center p-2 sm:p-4 md:p-6">
         <Notification review={newReviewNotification} onClose={() => setNewReviewNotification(null)} />
        <DappDetailPage
          dappId={selectedDappIdForDetailPage}
          onBack={handleBackFromDetailPage}
          openRatingModal={openRatingModal}
          userAddress={userAddress}
        />
        {/* RatingModal needs to be available globally if DappDetailPage triggers it */}
        <RatingModal
            ratingModalOpen={ratingModalOpen}
            dapps={dapps} // Pass all dapps so modal can find selected one by ID
            reviewData={reviewData}
            isLoading={isTxLoading}
            handleReviewChange={handleReviewFormChange}
            handleStarRatingChange={handleStarRatingChange}
            handleSubmitReview={handleSubmitReview}
            setRatingModalOpen={setRatingModalOpen}
        />
      </div>
    );
  }

return (
  <div className="min-h-screen bg-neutral-900 text-neutral-200 flex justify-center p-2 sm:p-4 md:p-6">
    <Notification review={newReviewNotification} onClose={() => setNewReviewNotification(null)} />
    <div className="w-full max-w-screen-xl">
      <header className="text-center mb-6 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-yellow-500 tracking-tight">
          RateCaster
        </h1>
        <p className="text-neutral-400 mt-1 text-xs sm:text-sm md:text-base">Discover and Review Decentralized Applications</p>
      </header>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <div className="md:col-span-2">
          <StatusBar
            sdkStatus={appStatus}
            userAddress={userAddress}
            isLoading={isLoading && (appStatus.includes("wallet") || appStatus.includes("Connecting to services") || appStatus.includes("Initializing") || appStatus.includes("Fetching"))}
            connectWallet={async () => { await ensureWalletConnected(); }} // StatusBar connect button can use this
            currentChainName={currentChainName}
          />
        </div>
        <div className="md:col-span-1">
          <UserProfileDisplay profile={userProfile} isLoading={isProfileLoading} />
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-6 p-3 sm:p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg shadow-md flex items-center justify-between">
          <div className="flex items-center">
            <ExclamationTriangleIcon className="w-5 h-5 sm:w-6 sm:h-6 mr-2 sm:mr-3 text-red-400 flex-shrink-0" />
            <span className="text-xs sm:text-sm break-all">{error}</span>
          </div>
          <button onClick={() => setError('')} className="ml-2 text-red-300 hover:text-red-100 text-lg sm:text-xl font-bold flex-shrink-0">×</button>
        </div>
      )}

      <Tabs activeTab={activeTab} setActiveTab={setActiveTab} isLoading={CombinedLoading || isProfileLoading} />

      <main className="mt-6">
        {activeTab === 'browse' && (
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-neutral-100">
                Explore Dapps <span className="text-neutral-500 text-lg sm:text-xl">({dappsToDisplay.length})</span>
              </h2>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full sm:w-auto px-4 py-2.5 bg-neutral-700 border border-neutral-600 rounded-lg text-neutral-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition-colors text-sm"
                  aria-label="Filter by category"
                >
                  <option value="">All Categories</option>
                  {uniqueCategoryGroupsForFilter.map(groupName => (
                    <optgroup key={groupName} label={groupName} className="bg-neutral-800 text-neutral-300 font-semibold">
                      {categoriesForFilter
                        .filter(option => option.group === groupName)
                        .map(option => (
                          <option key={option.value} value={option.value} className="bg-neutral-700 text-neutral-100">
                            {option.label}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  onClick={() => refreshDappsAndReviews(true)}
                  disabled={isLoading}
                  className="w-full sm:w-auto px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-neutral-900 rounded-lg text-sm font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                >
                  {isLoading && appStatus.includes("Refreshing") ? <Spinner size="sm" color="border-neutral-900" /> : 'Refresh Dapps'}
                </button>
              </div>
            </div>
            {isLoading && dappsToDisplay.length === 0 ? (
              <div className="flex flex-col justify-center items-center h-64">
                <Spinner size="lg" /> <span className="ml-4 text-lg sm:text-xl text-neutral-400">Loading dApps...</span>
              </div>
            ) : dappsToDisplay.length === 0 ? (
              <div className="text-center py-10 px-4 sm:px-6 bg-neutral-800 rounded-lg shadow">
                <p className="text-lg sm:text-xl text-neutral-400">
                  {selectedCategory ? 'No dApps found in this category.' : 'No dApps registered yet.'}
                </p>
                <p className="text-neutral-500 mt-1 text-sm sm:text-base">
                  {selectedCategory ? 'Try a different category or show all.' : 'Be the first to register a new dApp!'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {dappsToDisplay.map((dapp) => (
                  <DappCard
                    key={dapp.dappId}
                    dapp={dapp}
                    isLoading={isTxLoading}
                    userAddress={userAddress}
                    startEditDapp={startEditDapp}
                    openRatingModal={openRatingModal}
                    onNavigateToDetail={handleNavigateToDappDetail} // Pass navigation handler
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {(activeTab === 'add' || activeTab === 'edit') && (
          <DappForm
            activeTab={activeTab}
            selectedDapp={selectedDapp}
            newDapp={newDappData}
            categoryOptions={categoryOptions}
            isLoading={isTxLoading}
            handleDappFormChange={handleDappFormChange}
            handleRegisterDapp={handleRegisterDapp}
            handleUpdateDapp={handleUpdateDapp}
            setActiveTab={setActiveTab}
            setSelectedDapp={setSelectedDapp}
          />
        )}

        {activeTab === 'reviews' && (
          <div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-neutral-100 mb-6">
              My Reviews <span className="text-neutral-500 text-lg sm:text-xl">({userReviews.length})</span>
            </h2>
            {!userAddress ? (
              <div className="text-center py-10 px-4 sm:px-6 bg-neutral-800 rounded-lg shadow">
                <p className="text-lg sm:text-xl text-neutral-400">Please connect your wallet to view your reviews.</p>
              </div>
            ) : isProfileLoading && userReviews.length === 0 ? ( // Show spinner if profile loading and no reviews yet
              <div className="flex flex-col justify-center items-center h-64">
                <Spinner size="lg" /> <span className="ml-4 text-lg sm:text-xl text-neutral-400">Loading your reviews...</span>
              </div>
            ) : userReviews.length === 0 ? (
              <div className="text-center py-10 px-4 sm:px-6 bg-neutral-800 rounded-lg shadow">
                <p className="text-lg sm:text-xl text-neutral-400">You haven't submitted any reviews yet.</p>
                <p className="text-neutral-500 mt-1 text-sm sm:text-base">Find a dApp and share your thoughts!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {userReviews.map((review) => (
                  <ReviewCard key={review.id || review.attestationId} review={review} />
                ))}
              </div>
            )}
          </div>
        )}
        {activeTab === 'leaderboard' && <LeaderboardTab />}
      </main>

      <RatingModal
        ratingModalOpen={ratingModalOpen}
        dapps={dapps}
        reviewData={reviewData}
        isLoading={isTxLoading}
        handleReviewChange={handleReviewFormChange}
        handleStarRatingChange={handleStarRatingChange}
        handleSubmitReview={handleSubmitReview}
        setRatingModalOpen={setRatingModalOpen}
      />
    </div>
  </div>
);
};

export default App;