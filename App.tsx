// App.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { ethers } 
  from 'ethers';
import { useAccount, useSwitchChain, useWalletClient } from 'wagmi';
import { QueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client'; 
import { DappRegistered as AppDappRegistered, DappReview as AppDappReview, CategoryOption, UserProfile as AppUserProfile, LeaderboardEntry, ProjectStats, getCategoryNameById, CategoryId as AppCategoryId } from './types'; 
import DappCard from './components/DappCard';
import DappForm from './components/DappForm';
import RatingModal from './components/RatingModal';
import StatusBar from './components/StatusBar';
import Tabs, { ActiveTab } from './components/Tabs';
import ReviewCard from './components/ReviewCard';
import Spinner from './components/Spinner';
import Notification from './components/Notification';
import LeaderboardTab from './components/LeaderboardTab';
import QuestsTab from './components/QuestsTab'; 
import DappDetailPage from './components/DappDetailPage';
import { ExclamationTriangleIcon } from './components/icons/ExclamationTriangleIcon';
import { RateCaster } from '@ratecaster/sdk';
import { Chatbot } from './components/Chatbot';
import { RobotIconV1 } from './components/icons/RobotIcon';

import '@rainbow-me/rainbowkit/styles.css';
import { polygon as wagmiPolygon } from 'viem/chains'; 

const API_BASE_URL = 'https://app.ratecaster.xyz/api';
const SOCKET_SERVER_URL = 'https://app.ratecaster.xyz';
const FRONTEND_RPC_URL = 'https://polygon-rpc.com'; 

const queryClientTanstack = new QueryClient(); 

// --- THE FIX: STEP 1 ---
// Create the socket instance ONCE, outside of the component.
// This ensures there is only ever one connection for the entire app lifecycle.
const socket: Socket = io(SOCKET_SERVER_URL, {
  autoConnect: true, // Automatically connect on load
  reconnection: true,
  transports: ['websocket', 'polling'],
});


const App: React.FC = () => {
  const [appStatus, setAppStatus] = useState<string>('Initializing...');
  const [currentChainName, setCurrentChainName] = useState<string | undefined>();
  const [dapps, setDapps] = useState<AppDappRegistered[]>([]);
  const [userReviews, setUserReviews] = useState<AppDappReview[]>([]);
  const [allReviews, setAllReviews] = useState<AppDappReview[]>([]); 
  const [error, setError] = useState<string>('');

  const [sdk, setSdk] = useState<RateCaster | null>(null);
  const [currentSigner, setCurrentSigner] = useState<ethers.Signer | null>(null);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<AppUserProfile | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);
  const [categoriesForFilter, setCategoriesForFilter] = useState<CategoryOption[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const [activeTab, setActiveTab] = useState<ActiveTab>('browse');
  const [selectedDapp, setSelectedDapp] = useState<AppDappRegistered | null>(null);
  const [selectedDappIdForDetailPage, setSelectedDappIdForDetailPage] = useState<string | null>(null);
  const [ratingModalOpen, setRatingModalOpen] = useState<boolean>(false);

  const [isCoreDataLoading, setIsCoreDataLoading] = useState<boolean>(true);
  const [hasInitialDataLoadedOnce, setHasInitialDataLoadedOnce] = useState<boolean>(false);
  const [isTxLoading, setIsTxLoading] = useState<boolean>(false);
  const [isProfileLoading, setIsProfileLoading] = useState<boolean>(false);

  const [newDappData, setNewDappData] = useState<Partial<AppDappRegistered>>({ name: '', description: '', url: '', imageUrl: '', categoryId: 0 });
  const [reviewData, setReviewData] = useState<Partial<Pick<AppDappReview, 'dappId' | 'reviewText'>> & { rating: number }>({ rating: 5 });
  const [newReviewNotification, setNewReviewNotification] = useState<AppDappReview | null>(null);
  
  const { address: wagmiAddress, isConnected: isWagmiConnected, chain: wagmiChain } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  const CombinedLoading = isCoreDataLoading || isTxLoading || isProfileLoading;


  const initializeFrontendSDK = useCallback(() => {
    try {
      const provider = new ethers.JsonRpcProvider(FRONTEND_RPC_URL);
      const frontendSDK = new RateCaster(provider); 
      setSdk(frontendSDK);
      console.log('[FE INFO] RateCaster SDK instance configured for frontend operations.');
    } catch (e: any) {
      console.error('[FE ERROR] Failed to initialize frontend SDK:', e);
      setError('Failed to initialize core services. Please refresh.');
      setAppStatus('Error: SDK Init Failed');
    }
  }, []);

  useEffect(() => {
    initializeFrontendSDK();
  }, [initializeFrontendSDK]);


  const refreshDappsAndReviews = useCallback(async (showLoadingIndicator = false) => {
    if (showLoadingIndicator && !hasInitialDataLoadedOnce) {
        setAppStatus('Fetching dApp data...');
        setIsCoreDataLoading(true);
    }
    setError('');
    try {
      const dappsRes = await fetch(`${API_BASE_URL}/dapps`);
      if (!dappsRes.ok) throw new Error('Failed to fetch dApps');
      const dappsData: AppDappRegistered[] = await dappsRes.json();
      
      const populatedDapps = dappsData.map(dapp => ({
        ...dapp,
        category: getCategoryNameById(dapp.categoryId)
      }));
      setDapps(populatedDapps);

      if (userAddress) {
        const reviewsRes = await fetch(`${API_BASE_URL}/reviews/user/${userAddress}`);
        if (!reviewsRes.ok) throw new Error('Failed to fetch user reviews');
        const userReviewsData: AppDappReview[] = await reviewsRes.json();
        setUserReviews(userReviewsData.map(r => ({ ...r, dappName: dappsData.find(d => d.dappId === r.dappId)?.name || 'Unknown Dapp' })));
      }
      if (!hasInitialDataLoadedOnce) setAppStatus('Services Connected.');

    } catch (err: any) {
      setError(`Error fetching data: ${err.message}`);
      setAppStatus('Error: Data Fetch Failed');
      console.error(err);
    } finally {
        if (!hasInitialDataLoadedOnce) {
             setIsCoreDataLoading(false);
             setHasInitialDataLoadedOnce(true);
        } else if (showLoadingIndicator) { 
             setIsCoreDataLoading(false); 
        }
    }
  }, [userAddress, hasInitialDataLoadedOnce]);


  // --- THE FIX: STEP 2 ---
  // This useEffect now ONLY handles setting up and tearing down event listeners.
  // It has an empty dependency array `[]` so it runs ONLY ONCE when the component mounts.
  useEffect(() => {
    const handleConnect = () => {
        console.log('[FE INFO] Socket.IO: Connected with id', socket.id);
        setAppStatus('Services Connected.');
        // Initial data fetch on first connect
        if (!hasInitialDataLoadedOnce) { 
            refreshDappsAndReviews(true);
        }
    };
    
    const handleUserProfileUpdate = (updatedProfile: AppUserProfile) => {
        console.log('[FE INFO] Socket.IO: Received userProfileUpdate', updatedProfile);
        setUserProfile(updatedProfile);
        setIsProfileLoading(false);
    };

    const handleDappUpdate = (updatedDapp: AppDappRegistered) => {
        console.log('[FE INFO] Socket.IO: Received dappUpdate for', updatedDapp.name);
        setDapps(prevDapps => {
            const index = prevDapps.findIndex(d => d.dappId === updatedDapp.dappId);
            const populatedDapp = { ...updatedDapp, category: getCategoryNameById(updatedDapp.categoryId) };
            if (index !== -1) {
                const newDapps = [...prevDapps];
                newDapps[index] = populatedDapp;
                return newDapps;
            }
            return [populatedDapp, ...prevDapps]; 
        });
        if (selectedDapp?.dappId === updatedDapp.dappId) setSelectedDapp({ ...updatedDapp, category: getCategoryNameById(updatedDapp.categoryId) });
    };
    
    const handleNewReviewEvent = (review: AppDappReview) => {
        console.log('[FE INFO] Socket.IO: Received newReview event', review);
        setNewReviewNotification(review);
        setUserReviews(prev => [review, ...prev.filter(r => r.id !== review.id)].sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0)));
        setAllReviews(prev => [review, ...prev.filter(r => r.id !== review.id)].sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0)));
    };

    const handleBackendError = (errorMessage: string) => {
        console.error('[FE ERROR] Socket.IO: Received backend_error:', errorMessage);
        setError(`Backend error: ${errorMessage}`);
        setAppStatus('Error: Backend communication failed');
    };
    
    const handleDisconnect = (reason: string) => {
        console.warn('[FE WARN] Socket.IO: Disconnected. Reason:', reason);
        setAppStatus('Connection Lost. Reconnecting...');
    };

    // If the socket is already connected when the component mounts, run the connect logic.
    if (socket.connected) {
        handleConnect();
    }

    // Attach all event listeners
    socket.on('connect', handleConnect);
    socket.on('userProfileUpdate', handleUserProfileUpdate);
    socket.on('dappUpdate', handleDappUpdate);
    socket.on('newReview', handleNewReviewEvent);
    socket.on('backend_error', handleBackendError);
    socket.on('disconnect', handleDisconnect);

    // Cleanup function to remove listeners when the component unmounts
    return () => {
      console.log('[FE INFO] Socket.IO: Removing event listeners on unmount...');
      socket.off('connect', handleConnect);
      socket.off('userProfileUpdate', handleUserProfileUpdate);
      socket.off('dappUpdate', handleDappUpdate);
      socket.off('newReview', handleNewReviewEvent);
      socket.off('backend_error', handleBackendError);
      socket.off('disconnect', handleDisconnect);
    };
  }, [hasInitialDataLoadedOnce, refreshDappsAndReviews, selectedDapp?.dappId]); // Minimal dependencies


  // --- THE FIX: STEP 3 ---
  // A separate, dedicated useEffect for authenticating the socket when the user address is available.
  useEffect(() => {
      if (socket.connected && wagmiAddress) {
          console.log(`[FE INFO] Authenticating socket for address: ${wagmiAddress}`);
          socket.emit('authenticate', wagmiAddress);
      }
  }, [wagmiAddress, socket.connected]); // Runs only when address or connection status changes


  const connectWalletAsync = useCallback(async () => {
    setAppStatus('Connecting wallet...');
    setError('');
    setIsProfileLoading(true);
    try {
      if (!isWagmiConnected || !wagmiAddress || !walletClient) {
          setError('Wallet not connected via RainbowKit. Please connect your wallet first.');
          setAppStatus('Error: Wallet connection failed');
          setIsProfileLoading(false);
          return;
      }
      
      if (wagmiChain?.id !== wagmiPolygon.id && switchChainAsync) {
        setAppStatus(`Switching to Polygon...`);
        await switchChainAsync({ chainId: wagmiPolygon.id });
        
        const updatedWalletClientAfterSwitch = await queryClientTanstack.fetchQuery({ 
            queryKey: ['walletClient', wagmiAddress, wagmiPolygon.id], 
            queryFn: () => walletClient 
        });

        if (!updatedWalletClientAfterSwitch || updatedWalletClientAfterSwitch.chain.id !== wagmiPolygon.id) {
           throw new Error('Failed to switch to Polygon network or wallet client not updated.');
        }
      } else if (wagmiChain?.id !== wagmiPolygon.id) {
          throw new Error('Please switch to the Polygon network in your wallet.');
      }
      
      const provider = new ethers.BrowserProvider(walletClient as any); 
      const signerInstance = await provider.getSigner();
      setCurrentSigner(signerInstance);
      setUserAddress(wagmiAddress);
      setCurrentChainName(wagmiChain?.name || 'Polygon'); 
      setAppStatus(`Wallet Connected`); 
      console.log(`[FE INFO] Wallet Connected: ${wagmiAddress}`);

      const profileRes = await fetch(`${API_BASE_URL}/actions/wallet-connected`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: wagmiAddress }),
      });
      if (!profileRes.ok) throw new Error('Failed to fetch/create user profile.');
      const profileData: AppUserProfile = await profileRes.json();
      setUserProfile(profileData);
      
      // No need to emit here, the dedicated useEffect will handle it.
      
      const reviewsRes = await fetch(`${API_BASE_URL}/reviews/user/${wagmiAddress}`);
      if (!reviewsRes.ok) throw new Error('Failed to fetch user reviews');
      const userReviewsData: AppDappReview[] = await reviewsRes.json();
      setUserReviews(userReviewsData.map(r => ({ ...r, dappName: dapps.find(d => d.dappId === r.dappId)?.name || 'Unknown Dapp' })));

    } catch (err: any) {
      console.error('Connection/Profile Error:', err);
      const readableError = err.message || 'Connection failed. Check console.';
      setError(readableError);
      setAppStatus('Error: Wallet connection failed');
      setUserAddress(null); setCurrentSigner(null); setUserProfile(null);
    } finally {
      setIsProfileLoading(false);
    }
  }, [isWagmiConnected, wagmiAddress, wagmiChain, walletClient, switchChainAsync, dapps]);

    // ... (rest of the file is unchanged)

  useEffect(() => {
    if (isWagmiConnected && wagmiAddress && walletClient && !userAddress) { 
      connectWalletAsync();
    } else if (!isWagmiConnected && userAddress) { 
      setUserAddress(null);
      setCurrentSigner(null);
      setUserProfile(null);
      setUserReviews([]);
      setAppStatus('Wallet disconnected.');
      setError('');
      setActiveTab('browse');
    }

     if (isWagmiConnected && wagmiChain) {
        setCurrentChainName(wagmiChain.name);
        if (wagmiChain.id !== wagmiPolygon.id) {
            setAppStatus('Error: Wrong network');
            setError(`Please switch to Polygon. Connected to ${wagmiChain.name}.`);
        } else if (error.includes("Polygon") || error.includes("network")) { 
            setError('');
            if(appStatus.startsWith('Error:')) setAppStatus('Wallet Connected'); 
        }
    }
  }, [isWagmiConnected, wagmiAddress, wagmiChain, walletClient, userAddress, connectWalletAsync, error, appStatus]);


  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/categories`);
        if (!response.ok) throw new Error('Failed to fetch categories');
        const data: CategoryOption[] = await response.json();
        setCategoryOptions(data);
        
        const uniqueGroups = Array.from(new Set(data.map(opt => opt.group)))
            .map(groupName => ({ value: AppCategoryId[groupName.toUpperCase() as keyof typeof AppCategoryId] || 0, label: groupName, group: "" })); 
        setCategoriesForFilter(uniqueGroups);
      } catch (err: any) {
        setError('Failed to load categories.');
        console.error(err);
      }
    };
    fetchCategories();
  }, []);

  const ensureWalletConnected = async (): Promise<ethers.Signer | null> => {
    if (currentSigner && userAddress && wagmiChain?.id === wagmiPolygon.id) return currentSigner;
    
    setError('Wallet not connected or on wrong network. Please connect to Polygon.');
    setAppStatus('Error: Wallet connection issue');
        
    if (isWagmiConnected && wagmiAddress && walletClient) {
        if (wagmiChain?.id !== wagmiPolygon.id) {
            if (switchChainAsync) {
                try {
                    setAppStatus('Requesting network switch to Polygon...');
                    await switchChainAsync({ chainId: wagmiPolygon.id });
                    const updatedWC = await queryClientTanstack.fetchQuery({ 
                        queryKey: ['walletClient', wagmiAddress, wagmiPolygon.id], 
                        queryFn: () => walletClient 
                    });
                    if (!updatedWC || updatedWC.chain.id !== wagmiPolygon.id) {
                         throw new Error('Network switch to Polygon not confirmed or wallet client not updated.');
                    }
                    const provider = new ethers.BrowserProvider(updatedWC as any); 
                    const signerInstance = await provider.getSigner();
                    setCurrentSigner(signerInstance);
                    setUserAddress(wagmiAddress); 
                    setCurrentChainName(wagmiPolygon.name);
                    setError(''); 
                    setAppStatus(`Wallet Connected`);
                    console.log(`[FE INFO] Wallet re-verified on ${wagmiPolygon.name}`)
                    return signerInstance;
                } catch (switchError: any) {
                    setError(`Network switch failed: ${switchError.message}`);
                    setAppStatus('Error: Network switch failed');
                    return null;
                }
            } else {
                 setError('Please switch to Polygon network in your wallet.');
                 setAppStatus('Error: Manual network switch required');
                 return null;
            }
        }
        const provider = new ethers.BrowserProvider(walletClient as any); 
        const signerInstance = await provider.getSigner();
        setCurrentSigner(signerInstance);
        setUserAddress(wagmiAddress); 
        setError(''); 
        setAppStatus(`Wallet Connected`);
        console.log(`[FE INFO] Wallet re-verified`);
        return signerInstance;
    }
    if (!isWagmiConnected) setError("Please connect your wallet using the 'Connect Wallet' button.");
    return null; 
  };


  const handleDappFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const data = activeTab === 'edit' ? selectedDapp : newDappData;
    const setter = activeTab === 'edit' ? setSelectedDapp : setNewDappData;
    
    setter({ ...data, [name]: name === 'categoryId' ? Number(value) : value } as any); 
  };

  const handleRegisterDapp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sdk || !newDappData.name || !newDappData.description || !newDappData.url || !newDappData.imageUrl || !newDappData.categoryId) {
      setError('All fields are required for new DApp.');
      return;
    }
    const activeSigner = await ensureWalletConnected();
    if (!activeSigner) return;

    setIsTxLoading(true); setError('');
    try {
      const calculatedDappId = ethers.keccak256(ethers.toUtf8Bytes(newDappData.url!));

      const txResponse = await sdk.registerDapp(
        newDappData.name!, newDappData.description!, newDappData.url!,
        newDappData.imageUrl!, Number(newDappData.categoryId), activeSigner
      );
      setAppStatus(`Registering ${newDappData.name}...`);
      console.log(`Registering ${newDappData.name}... (Tx: ${txResponse.hash})`);
      await txResponse.wait(); 
      setAppStatus(`DApp ${newDappData.name} registered!`);
      
      await fetch(`${API_BASE_URL}/actions/refresh-dapp-from-chain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dappId: calculatedDappId }), 
      });

      setNewDappData({ name: '', description: '', url: '', imageUrl: '', categoryId: 0 });
      setActiveTab('browse'); 
      
    } catch (err: any) {
      const readableError = err.reason || err.data?.message || err.message || (err.error?.message) || 'Transaction failed. Check console.';
      setError(readableError); setAppStatus('DApp registration failed.');
      console.error("Registration error:", err);
    } finally { setIsTxLoading(false); }
  };

  const handleUpdateDapp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sdk || !selectedDapp || !selectedDapp.dappId) {
      setError('No DApp selected for update.');
      return;
    }
    const activeSigner = await ensureWalletConnected();
    if (!activeSigner) return;

    setIsTxLoading(true); setError('');
    try {
      const txResponse = await sdk.updateDapp(
        selectedDapp.dappId, selectedDapp.name, selectedDapp.description,
        selectedDapp.url, selectedDapp.imageUrl, Number(selectedDapp.categoryId), activeSigner
      );
      setAppStatus(`Updating ${selectedDapp.name}...`);
      console.log(`Updating ${selectedDapp.name}... (Tx: ${txResponse.hash})`);
      await txResponse.wait();
      setAppStatus(`DApp ${selectedDapp.name} updated!`);

      await fetch(`${API_BASE_URL}/actions/refresh-dapp-from-chain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dappId: selectedDapp.dappId }),
      });

      setSelectedDapp(null);
      setActiveTab('browse');
      
    } catch (err: any) {
      const readableError = err.reason || err.data?.message || err.message || (err.error?.message) || 'Transaction failed. Check console.';
      setError(readableError); setAppStatus('DApp update failed.');
      console.error("Update error:", err);
    } finally { setIsTxLoading(false); }
  };

  const startEditDapp = (dappToEdit: AppDappRegistered) => {
    setSelectedDapp(dappToEdit);
    setActiveTab('edit');
  };

  const openRatingModalForDapp = (dappId: string) => {
    if (!userAddress) {
      setError("Please connect your wallet to rate dApps.");
      return;
    }
    const dappToRate = dapps.find(d => d.dappId === dappId);
    if (!dappToRate) return;
    setReviewData({ dappId: dappToRate.dappId, rating: 5, reviewText: '' });
    setRatingModalOpen(true);
  };

  const handleReviewChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setReviewData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleStarRatingChange = (newRating: number) => {
    setReviewData(prev => ({ ...prev, rating: newRating }));
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sdk || !reviewData.dappId || !reviewData.rating) {
      setError('DApp ID and rating are required.');
      return;
    }
    const activeSigner = await ensureWalletConnected();
    if (!activeSigner) return;

    setIsTxLoading(true); setError('');
    try {
      const txResponse = await sdk.submitReview(
        reviewData.dappId, reviewData.rating, reviewData.reviewText || '', activeSigner
      );
      setAppStatus(`Submitting review...`);
      console.log(`Submitting review... (Tx: ${txResponse.hash})`);
      await txResponse.wait();
      setAppStatus('Review submitted successfully!');
      setIsTxLoading(false);
      setIsProfileLoading(false);

      setRatingModalOpen(false);
      setReviewData({ rating: 5 }); 

      if (userAddress) { 
          setIsProfileLoading(true);
          try {
            const profileRes = await fetch(`${API_BASE_URL}/users/profile/${userAddress}`);
            if (profileRes.ok) setUserProfile(await profileRes.json());
          } catch (profileFetchError) {
            console.warn("Failed to immediately refetch profile after review submission:", profileFetchError);
          } finally {
            setIsProfileLoading(false);
          }
      }

    } catch (err: any) {
      const readableError = err.reason || err.data?.message || err.message || (err.error?.message) || 'Transaction failed. Check console.';
      setError(readableError); setAppStatus('Review submission failed.');
      console.error("Review submission error:", err);
    } finally { setIsTxLoading(false); }
  };

  const handleNavigateToDappDetail = (dappId: string) => {
    setSelectedDappIdForDetailPage(dappId);
    setIsChatbotOpen(false);
    window.scrollTo(0, 0); 
  };

  const handleBackFromDetailPage = () => {
    setSelectedDappIdForDetailPage(null);
    setActiveTab('browse'); 
  };

  const filteredDapps = selectedCategory
    ? dapps.filter(dapp => getCategoryNameById(dapp.categoryId).includes(selectedCategory)) 
    : dapps;

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-200">
      <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {selectedDappIdForDetailPage ? (
          <DappDetailPage
            dappId={selectedDappIdForDetailPage}
            onBack={handleBackFromDetailPage}
            openRatingModal={openRatingModalForDapp}
            userAddress={userAddress}
          />
        ) : (
          <>
            <header className="mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
                  <h1 className="text-4xl sm:text-5xl font-bold text-yellow-500 mb-2 sm:mb-0">RateCaster</h1>
              </div>
              <StatusBar 
                appStatus={appStatus} 
                userAddress={userAddress} 
                isLoading={isTxLoading} 
                currentChainName={currentChainName}
              />
            </header>

            {error && (
              <div className="mb-4 p-3 bg-red-700/30 border border-red-600 text-red-300 rounded-lg flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 mr-2 text-red-400" />
                <span>{error}</span>
                <button onClick={() => setError('')} className="ml-auto text-red-300 hover:text-red-100 text-lg">×</button>
              </div>
            )}
            
            <Notification review={newReviewNotification} onClose={() => setNewReviewNotification(null)} />

            <Tabs 
              activeTab={activeTab} 
              isLoading={isCoreDataLoading && !hasInitialDataLoadedOnce} 
              setActiveTab={setActiveTab} 
            />
            
            <main>
              {activeTab === 'browse' && (
                <>
                  <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center">
                    <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="flex-grow sm:flex-grow-0 sm:w-1/3 px-4 py-2.5 bg-neutral-700 border border-neutral-600 rounded-lg text-neutral-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none"
                        aria-label="Filter by category group"
                    >
                        <option value="">All Category Groups</option>
                        {categoriesForFilter.map(cat => (
                            <option key={cat.label} value={cat.label}>{cat.label}</option>
                        ))}
                    </select>
                    <div className="flex-grow hidden sm:block"></div>
                  </div>
                  {isCoreDataLoading && dapps.length === 0 && !hasInitialDataLoadedOnce ? ( 
                    <div className="flex flex-col items-center justify-center h-64">
                      <Spinner size="lg" />
                      <p className="mt-4 text-neutral-400">Loading dApps...</p>
                    </div>
                  ) : filteredDapps.length === 0 && hasInitialDataLoadedOnce ? ( 
                    <p className="text-center text-neutral-400 py-10">No dApps found for this category or matching your search.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {filteredDapps.map((dapp) => (
                        <DappCard
                          key={dapp.dappId}
                          dapp={dapp}
                          isLoading={isTxLoading}
                          userAddress={userAddress}
                          startEditDapp={startEditDapp}
                          openRatingModal={openRatingModalForDapp}
                          onNavigateToDetail={handleNavigateToDappDetail}
                        />
                      ))}
                    </div>
                  )}
                </>
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
                userAddress ? (
                  userReviews.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {userReviews.map((review) => (
                        <ReviewCard key={review.id || review.attestationId} review={review} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-neutral-400 py-10">You haven't submitted any reviews yet.</p>
                  )
                ) : (
                  <p className="text-center text-neutral-400 py-10">Connect your wallet to see your reviews.</p>
                )
              )}
              {activeTab === 'leaderboard' && <LeaderboardTab />}
              {activeTab === 'quests' && <QuestsTab userAddress={userAddress} />}
            </main>
          </>
        )}
      </div>

      <RatingModal
        ratingModalOpen={ratingModalOpen}
        dapps={dapps} 
        reviewData={reviewData}
        isLoading={isTxLoading}
        handleReviewChange={handleReviewChange}
        handleStarRatingChange={handleStarRatingChange}
        handleSubmitReview={handleSubmitReview}
        setRatingModalOpen={setRatingModalOpen}
      />

      {isChatbotOpen && <Chatbot onClose={() => setIsChatbotOpen(false)} onNavigateToDetail={handleNavigateToDappDetail} />}

      <button
        onClick={() => setIsChatbotOpen(prev => !prev)}
        className="fixed bottom-4 right-4 bg-yellow-500 text-neutral-900 p-4 rounded-full shadow-lg hover:bg-yellow-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 z-40"
        aria-label="Toggle Chatbot"
      >
        <RobotIconV1 className="w-8 h-8" />
      </button>
    </div>
  );
};
export default App;