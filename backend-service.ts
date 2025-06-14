/// <reference types="node" />
import dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import { RateCaster, DappRegistered as SDKDappRegistered, DappReview as SDKDappReview } from './RateCasterSDK/src'; // Assuming SDK exports ProjectStats
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import express, { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import cors from 'cors';
import { Server, Socket } from 'socket.io';
import {
    DappRegistered as FrontendDappRegistered,
    DappReview as FrontendDappReview,
    UserProfile as FrontendUserProfile,
    ProjectStats as FrontendProjectStats, // Use Frontend type for consistency
    CategoryId
} from './types';

// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RPC_URL = 'https://polygon-rpc.com';
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'wss://polygon-mainnet.g.alchemy.com/v2/8df5Ufs4d85WriX-pY383TTWk740Q0P0';
const CHAIN_ID = 137;
const PORT = Number(process.env.PORT) || 3001; // Ensure PORT is a number
const DB_FILE_PATH = process.env.DB_FILE_PATH || path.join(__dirname, 'user_profiles.json');
const POINTS_DAILY_LOGIN = 10;
const POINTS_PER_REVIEW = 25;
const POINTS_STREAK_BONUS_PER_DAY = 5;
const CONTRACT_ADDRESS = process.env.RATECASTER_CONTRACT_ADDRESS || 'YOUR_CONTRACT_ADDRESS'; // Replace with actual address

// --- In-memory Data Stores (Cache) ---
let dappsStore: FrontendDappRegistered[] = [];
let reviewsByDappStore: Record<string, FrontendDappReview[]> = {};
let allReviewsStore: FrontendDappReview[] = [];

// --- User Profile (DB Interaction Layer) ---
interface UserProfile extends FrontendUserProfile {}
let userProfilesDB: Record<string, UserProfile> = {};

let ratecasterSDKInstance: RateCaster | null = null;
let sdkInitialized = false;
let io: Server | null = null;

const logger = {
    info: (message: string, ...args: any[]) => console.log(`[INFO] ${new Date().toISOString()} ${message}`, ...args),
    error: (message: string, ...args: any[]) => console.error(`[ERROR] ${new Date().toISOString()} ${message}`, ...args),
    debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${new Date().toISOString()} ${message}`, ...args),
    warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${new Date().toISOString()} ${message}`, ...args),
};

async function loadUserProfilesFromDB() {
    try {
        await fs.access(DB_FILE_PATH);
        const data = await fs.readFile(DB_FILE_PATH, 'utf-8');
        if (data) {
            userProfilesDB = JSON.parse(data);
            logger.info(`Successfully loaded ${Object.keys(userProfilesDB).length} user profiles from ${DB_FILE_PATH}`);
        } else {
            userProfilesDB = {};
        }
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            logger.warn(`User profiles DB file (${DB_FILE_PATH}) not found. Creating.`);
            userProfilesDB = {};
            await saveUserProfilesToDB();
        } else {
            logger.error('Error loading user profiles from DB:', error);
            userProfilesDB = {};
        }
    }
}

async function saveUserProfilesToDB() {
    try {
        await fs.writeFile(DB_FILE_PATH, JSON.stringify(userProfilesDB, null, 2), 'utf-8');
        logger.debug('User profiles saved to DB.');
    } catch (error) {
        logger.error('Error saving user profiles to DB:', error);
    }
}

async function getOrCreateUserProfile(userAddress: string): Promise<UserProfile> {
    const lowerAddress = userAddress.toLowerCase();
    if (!userProfilesDB[lowerAddress]) {
        userProfilesDB[lowerAddress] = {
            address: userAddress,
            points: 0,
            reviewStreak: 0,
            lastLoginTimestamp: 0,
            lastReviewTimestamp: 0,
        };
        await saveUserProfilesToDB();
    }
    return userProfilesDB[lowerAddress];
}

async function updateUserProfileInDB(profile: UserProfile): Promise<void> {
    userProfilesDB[profile.address.toLowerCase()] = profile;
    await saveUserProfilesToDB();
}

async function initializeSDK(): Promise<RateCaster> {
    if (ratecasterSDKInstance && sdkInitialized) return ratecasterSDKInstance;
    logger.info('Initializing RateCaster SDK...');
    if (!RPC_URL) {
        const msg = 'CRITICAL: RPC_URL must be configured.';
        logger.error(msg);
        throw new Error(msg);
    }
    if (!WEBSOCKET_URL || WEBSOCKET_URL.includes('YOUR_ALCHEMY_KEY_HERE')) {
        logger.warn('WebSocket URL not configured or is a placeholder. Real-time event listening may be impaired.');
    }
    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === 'YOUR_CONTRACT_ADDRESS') {
        logger.warn('Contract address not configured. Ensure RATECASTER_CONTRACT_ADDRESS is set in .env.');
    }

    const httpProvider = new ethers.JsonRpcProvider(RPC_URL);
    let wsProvider;
    try {
        wsProvider = WEBSOCKET_URL && !WEBSOCKET_URL.includes('YOUR_ALCHEMY_KEY_HERE')
            ? new ethers.WebSocketProvider(WEBSOCKET_URL)
            : null;
        if (!wsProvider) {
            logger.warn('WebSocket provider not initialized. Falling back to HTTP polling for events.');
        }
    } catch (error) {
        logger.error('Failed to initialize WebSocket provider:', error);
        wsProvider = null;
    }

    const sdk = new RateCaster(httpProvider, wsProvider);
    try {
        logger.info('RateCaster SDK initialized successfully with contract address:', CONTRACT_ADDRESS);
    } catch (error) {
        logger.error('SDK initialization failed:', error);
        throw error;
    }

    ratecasterSDKInstance = sdk;
    sdkInitialized = true;
    return sdk;
}

async function fetchInitialData(sdk: RateCaster) {
    logger.info('Fetching initial dApp and review data using SDK...');
    try {
        const sdkDapps = await sdk.getAllDapps(true); // Fetch with aggregates initially for dappsStore
        dappsStore = sdkDapps.map(dapp => ({
            ...dapp,
            category: dapp.category
        }));
        logger.info(`Fetched ${dappsStore.length} dApps from SDK.`);

        const allSDKReviews = await sdk.getAllReviews();
        allReviewsStore = allSDKReviews.map(sdkReview => ({
            ...sdkReview,
            dappName: dappsStore.find(d => d.dappId === sdkReview.dappId)?.name || 'Unknown Dapp',
        }));

        reviewsByDappStore = {};
        for (const review of allReviewsStore) {
            if (!reviewsByDappStore[review.dappId]) reviewsByDappStore[review.dappId] = [];
            reviewsByDappStore[review.dappId].push(review);
        }
        logger.info(`Fetched and processed ${allReviewsStore.length} total reviews from SDK.`);
    } catch (error) {
        logger.error('Failed to fetch initial data from SDK:', error);
        throw error;
    }
}

async function awardPoints(userAddress: string, points: number, reason: string) {
    const profile = await getOrCreateUserProfile(userAddress);
    profile.points += points;
    await updateUserProfileInDB(profile);
    logger.info(`Awarded ${points} points to ${userAddress} for ${reason}. Total: ${profile.points}`);
    if (io) io.emit('userProfileUpdate', profile);
}

async function handleDailyLogin(userAddress: string) {
    const profile = await getOrCreateUserProfile(userAddress);
    const now = Date.now();
    const todayStart = new Date(now).setHours(0, 0, 0, 0);
    if (profile.lastLoginTimestamp < todayStart) {
        await awardPoints(userAddress, POINTS_DAILY_LOGIN, 'Daily Login');
        profile.lastLoginTimestamp = now;
        await updateUserProfileInDB(profile);
    }
}

async function handleReviewPoints(userAddress: string) {
    const profile = await getOrCreateUserProfile(userAddress);
    const now = Date.now();
    await awardPoints(userAddress, POINTS_PER_REVIEW, 'Submitting a Review');
    const lastReviewDayStart = new Date(profile.lastReviewTimestamp).setHours(0, 0, 0, 0);
    const todayStart = new Date(now).setHours(0, 0, 0, 0);
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const daysDifference = Math.floor((todayStart - lastReviewDayStart) / MS_PER_DAY);
    if (profile.lastReviewTimestamp > 0 && daysDifference === 1) profile.reviewStreak += 1;
    else if (daysDifference !== 0) profile.reviewStreak = 1;
    else if (profile.lastReviewTimestamp === 0) profile.reviewStreak = 1;

    if (profile.reviewStreak > 0) {
        await awardPoints(userAddress, profile.reviewStreak * POINTS_STREAK_BONUS_PER_DAY, `Review Streak (Day ${profile.reviewStreak})`);
    }
    profile.lastReviewTimestamp = now;
    await updateUserProfileInDB(profile);
}

async function processNewReview(reviewFromSDK: SDKDappReview) { // Use SDKDappReview
    logger.info(`Processing new review event: ID ${reviewFromSDK.id} for dApp ${reviewFromSDK.dappId}`);

    let dapp = dappsStore.find(d => d.dappId === reviewFromSDK.dappId);
    if (!dapp && ratecasterSDKInstance) {
        logger.warn(`DApp ${reviewFromSDK.dappId} not in local store. Fetching from SDK (with aggregates).`);
        try {
            // Fetch with aggregates to update the dappsStore correctly
            const newDappSDK = await ratecasterSDKInstance.getDapp(reviewFromSDK.dappId, true);
            if (newDappSDK) {
                const newDappFrontend: FrontendDappRegistered = {
                    ...newDappSDK,
                    category: newDappSDK.category, // Keep using SDK's category string
                };
                dappsStore = dappsStore.filter(d => d.dappId !== newDappFrontend.dappId); // Remove old if exists
                dappsStore.push(newDappFrontend); // Add/update
                dapp = newDappFrontend;
                logger.info(`Fetched and updated dApp ${newDappFrontend.name} in store.`);
                if (io) io.emit('dappUpdate', serializeBigInt(newDappFrontend));
            }
        } catch (fetchErr) {
            logger.error(`Error fetching dApp ${reviewFromSDK.dappId}:`, fetchErr);
        }
    }

    const fullReview: FrontendDappReview = {
        ...(reviewFromSDK as any), // Cast to any if SDKDappReview is not directly assignable
        dappName: dapp?.name || 'Unknown Dapp',
    };

    allReviewsStore = [fullReview, ...allReviewsStore.filter(r => r.id !== fullReview.id)]
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    if (!reviewsByDappStore[fullReview.dappId]) reviewsByDappStore[fullReview.dappId] = [];
    reviewsByDappStore[fullReview.dappId] = [fullReview, ...reviewsByDappStore[fullReview.dappId].filter(r => r.id !== fullReview.id)]
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Update aggregates in dappsStore if dapp exists
    const dappIndex = dappsStore.findIndex(d => d.dappId === fullReview.dappId);
    if (dappIndex !== -1) {
        const currentReviewsForDapp = reviewsByDappStore[fullReview.dappId];
        const newTotalReviews = currentReviewsForDapp.length;
        const newAverageRating = newTotalReviews > 0
            ? currentReviewsForDapp.reduce((sum, r) => sum + r.starRating, 0) / newTotalReviews
            : 0;

        dappsStore[dappIndex] = {
            ...dappsStore[dappIndex],
            totalReviews: newTotalReviews,
            averageRating: newAverageRating
        };
        const updatedDappForEmit = dappsStore[dappIndex];
        logger.debug(`Updated dApp ${dappsStore[dappIndex].name} aggregates: ${newTotalReviews} reviews, ${newAverageRating.toFixed(2)} avg rating.`);
        if (io) io.emit('dappUpdate', serializeBigInt(updatedDappForEmit));
    }


    await handleReviewPoints(fullReview.rater);
    if (io) {
        io.emit('newReview', serializeBigInt(fullReview));
        logger.info(`Emitted 'newReview' for review ${fullReview.id}`);
    }
}

function serializeBigInt(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'bigint') return obj.toString();
    if (Array.isArray(obj)) return obj.map(serializeBigInt);
    if (typeof obj === 'object') {
        const result: Record<string, any> = {};
        for (const key in obj) {
            result[key] = serializeBigInt(obj[key]);
        }
        return result;
    }
    return obj;
}

async function startReviewListener(sdk: RateCaster) {
    logger.info('Starting SDK review listener for DappRatingSubmitted events...');
    try {
        await sdk.listenToReviews((review: SDKDappReview) => { // Use SDKDappReview
            logger.debug('Received DappRatingSubmitted event:', review);
            processNewReview(review).catch(error => {
                logger.error('Error processing review event:', error);
            });
        });
        logger.info('Successfully subscribed to DappRatingSubmitted events.');
    } catch (error) {
        logger.error('Failed to subscribe to DappRatingSubmitted events:', error);
        setTimeout(() => startReviewListener(sdk), 5000);
    }
}

export async function startBackendApplication() {
    try {
        await loadUserProfilesFromDB();
        const sdk = await initializeSDK();
        if (!sdkInitialized || !ratecasterSDKInstance) {
            throw new Error("SDK could not be initialized. Backend cannot start.");
        }
        await fetchInitialData(sdk);

        const app = express();
        app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
        app.use(express.json());

        const httpServer = http.createServer(app);
        io = new Server(httpServer, {
            cors: { origin: process.env.FRONTEND_URL || "*", methods: ["GET", "POST"] },
            pingTimeout: 60000,
            pingInterval: 25000,
            transports: ['websocket', 'polling']
        });

        io.on('connection', (socket: Socket) => {
            logger.info(`Socket.IO: Client connected: ${socket.id}`);
            socket.on('disconnect', (reason: string) => {
                logger.info(`Socket.IO: Client disconnected: ${socket.id}, Reason: ${reason}`);
            });
        });

        if (sdk.listenToReviews && typeof sdk.listenToReviews === 'function') {
            await startReviewListener(sdk);
        } else {
            logger.warn("SDK does not support listenToReviews or WebSocket provider missing; real-time updates disabled.");
        }

        app.get('/api/health', (req: Request, res: Response) => res.status(200).json({
            status: 'UP',
            timestamp: new Date().toISOString(),
            sdkInitialized,
            chain: ratecasterSDKInstance?.getCurrentChain()?.name || "N/A"
        }));

        app.get('/api/dapps', (req: Request, res: Response) => {
            logger.debug(`Serving /api/dapps request with ${dappsStore.length} dapps.`);
            res.json(serializeBigInt(dappsStore));
        });

        app.get('/api/reviews/all', (req: Request, res: Response) => {
            logger.debug(`Serving /api/reviews/all request with ${allReviewsStore.length} reviews.`);
            res.json(allReviewsStore);
        });

        app.get('/api/reviews/dapp/:dappId', (req: Request, res: Response) => {
            const reviewsForDapp = reviewsByDappStore[req.params.dappId] || [];
            logger.debug(`Serving /api/reviews/dapp/${req.params.dappId} with ${reviewsForDapp.length} reviews.`);
            res.json(reviewsForDapp);
        });
        
        // NEW Endpoint for DApp Statistics
        app.get('/api/stats/dapp/:dappId', (req: Request, res: Response) => {
            const dappId = req.params.dappId;
            const reviewsForDapp = reviewsByDappStore[dappId] || [];
            
            if (reviewsForDapp.length === 0) {
                logger.debug(`No reviews found for dApp ${dappId}, returning zero stats.`);
                const zeroStats: FrontendProjectStats = {
                    dappId: dappId,
                    averageRating: 0,
                    totalReviews: 0,
                    ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
                };
                return res.json(zeroStats);
            }

            const totalReviews = reviewsForDapp.length;
            const sumOfRatings = reviewsForDapp.reduce((sum, review) => sum + review.starRating, 0);
            const averageRating = totalReviews > 0 ? sumOfRatings / totalReviews : 0;
            
            const ratingDistribution: FrontendProjectStats['ratingDistribution'] = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
            for (const review of reviewsForDapp) {
                const ratingKey = review.starRating.toString() as keyof FrontendProjectStats['ratingDistribution'];
                if (ratingDistribution.hasOwnProperty(ratingKey)) {
                    ratingDistribution[ratingKey]++;
                }
            }

            const projectStats: FrontendProjectStats = {
                dappId,
                averageRating,
                totalReviews,
                ratingDistribution,
            };
            logger.debug(`Serving /api/stats/dapp/${dappId} with calculated stats:`, projectStats);
            res.json(projectStats);
        });


        app.get('/api/reviews/user/:userAddress', (req: Request, res: Response) => {
            const userAddr = req.params.userAddress.toLowerCase();
            const userReviews = allReviewsStore.filter(r => r.rater.toLowerCase() === userAddr);
            logger.debug(`Serving /api/reviews/user/${userAddr} with ${userReviews.length} reviews.`);
            res.json(userReviews);
        });

        app.get('/api/categories', (req: Request, res: Response) => {
            try {
                if (!ratecasterSDKInstance) throw new Error("SDK not initialized");
                const categories = ratecasterSDKInstance.getCategoryOptions();
                logger.debug(`Serving /api/categories with ${categories.length} options.`);
                res.json(categories);
            } catch (e: any) {
                logger.error("Error serving /api/categories:", e.message);
                res.status(500).json({ error: "Could not fetch categories." });
            }
        });

        app.post('/api/actions/wallet-connected', async (req: Request, res: Response) => {
            const { userAddress } = req.body;
            if (!userAddress || !ethers.isAddress(userAddress)) return res.status(400).json({ error: 'Valid userAddress is required.' });
            try {
                await handleDailyLogin(userAddress);
                const profile = await getOrCreateUserProfile(userAddress);
                logger.info(`Wallet connected action processed for ${userAddress}`);
                res.json(profile);
            } catch (e: any) {
                logger.error(`Error processing wallet-connected for ${userAddress}:`, e.message);
                res.status(500).json({ error: 'Failed to process wallet connection.' });
            }
        });

        app.get('/api/users/profile/:userAddress', async (req: Request, res: Response) => {
            if (!ethers.isAddress(req.params.userAddress)) return res.status(400).json({ error: 'Invalid address.' });
            try {
                const profile = await getOrCreateUserProfile(req.params.userAddress);
                logger.debug(`Serving profile for ${req.params.userAddress}`);
                res.json(profile);
            } catch (e: any) {
                logger.error(`Error fetching profile for ${req.params.userAddress}:`, e.message);
                res.status(500).json({ error: 'Failed to fetch profile.' });
            }
        });

        app.get('/api/leaderboard/top-reviewers', (req: Request, res: Response) => {
            const leaderboard = Object.values(userProfilesDB)
                .sort((a, b) => b.points - a.points)
                .slice(0, 20)
                .map((p, i) => ({ ...p, rank: i + 1 }));
            logger.debug(`Serving top reviewers leaderboard with ${leaderboard.length} entries.`);
            res.json(leaderboard);
        });

        app.get('/api/leaderboard/top-streaks', (req: Request, res: Response) => {
            const leaderboard = Object.values(userProfilesDB)
                .filter(p => p.reviewStreak > 0)
                .sort((a, b) => b.reviewStreak - a.reviewStreak)
                .slice(0, 20)
                .map((p, i) => ({ ...p, rank: i + 1 }));
            logger.debug(`Serving top streaks leaderboard with ${leaderboard.length} entries.`);
            res.json(leaderboard);
        });

        app.post('/api/actions/refresh-dapp-from-chain', async (req: Request, res: Response) => {
            const { dappId } = req.body;
            if (!dappId || typeof dappId !== 'string') return res.status(400).json({ error: 'Valid dappId required.' });
            if (ratecasterSDKInstance) {
                try {
                    logger.info(`Attempting to refresh dApp ${dappId} from chain...`);
                    // Fetch with aggregates (true) to update the main dappsStore correctly.
                    const fetchedDappSDK = await ratecasterSDKInstance.getDapp(dappId, true); 
                    if (fetchedDappSDK) {
                        const fetchedDappFrontend: FrontendDappRegistered = {
                            ...fetchedDappSDK,
                            category: fetchedDappSDK.category,
                        };
                        const idx = dappsStore.findIndex(d => d.dappId === fetchedDappFrontend.dappId);
                        if (idx !== -1) dappsStore[idx] = fetchedDappFrontend; else dappsStore.push(fetchedDappFrontend);

                        // Also refresh individual reviews for this dApp in reviewsByDappStore
                        const reviewsForDappSDK = await ratecasterSDKInstance.getProjectReviews(fetchedDappSDK.dappId);
                        const frontendReviewsForDapp = reviewsForDappSDK.map(sdkRev => ({
                            ...(sdkRev as any), // Cast if SDKDappReview is not directly assignable
                            dappName: fetchedDappFrontend.name,
                        }));
                        reviewsByDappStore[fetchedDappSDK.dappId] = frontendReviewsForDapp;
                        
                        // Update allReviewsStore as well
                        allReviewsStore = allReviewsStore.filter(r => r.dappId !== dappId);
                        allReviewsStore.push(...frontendReviewsForDapp);
                        allReviewsStore.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

                        if (io) io.emit('dappUpdate', fetchedDappFrontend);
                        logger.info(`DApp ${dappId} refreshed and update emitted.`);
                        res.status(200).json({ message: 'DApp data refreshed/added.', dapp: fetchedDappFrontend });
                    } else {
                        res.status(404).json({ error: 'DApp not found via SDK.' });
                    }
                } catch (e: any) {
                    logger.error(`Failed to process dApp refresh for ${dappId}:`, e.message);
                    res.status(500).json({ error: `Failed to process dApp refresh: ${e.message}` });
                }
            } else {
                res.status(503).json({ error: 'SDK not available.' });
            }
        });

        const generalErrorHandler: ErrorRequestHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
            logger.error('Unhandled Express error:', err.stack || err.message || err);
            if (res.headersSent) {
                return next(err);
            }
            res.status(500).json({ error: 'An unexpected server error occurred.' });
        };
        app.use(generalErrorHandler);


        httpServer.listen(PORT, () => logger.info(`Backend server listening on http://localhost:${PORT}`));
    } catch (error) {
        logger.error('FATAL ERROR during backend startup:', error);
        process.exit(1);
    }
}

async function gracefulShutdown(signal: string) {
    logger.info(`${signal} received. Shutting down...`);
    if (io) {
        io.close(() => {
            logger.info('Socket.IO server closed.');
        });
    }
    if (ratecasterSDKInstance && typeof ratecasterSDKInstance.stopListening === 'function') {
        try {
            await ratecasterSDKInstance.stopListening();
            logger.info('SDK review listener stopped.');
        } catch (e: any) {
            logger.warn('Error stopping SDK listener:', e.message);
        }
    }
    await saveUserProfilesToDB();
    logger.info('User profiles saved.');
    setTimeout(() => process.exit(0), 2000); // Exit after a delay
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('unhandledRejection', (reason, promise) => logger.error('Unhandled Rejection:', { promise, reason }));
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException').finally(() => process.exit(1)); // Exit after shutdown attempt
});

startBackendApplication();
