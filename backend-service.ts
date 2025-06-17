
/// <reference types="node" />
import dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import { RateCaster, DappRegistered as SDKDappRegistered, DappReview as SDKDappReview } from './RateCasterSDK/src';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express'; // Keep the default import for app creation
// import { Request, Response, NextFunction, ErrorRequestHandler } from 'express'; // Remove these individual imports
import { Server, Socket as SocketIOSocket } from 'socket.io';
import cors from 'cors';
import {
    DappRegistered as FrontendDappRegistered,
    DappReview as FrontendDappReview,
    UserProfile as FrontendUserProfile,
    ProjectStats as FrontendProjectStats,
    CategoryId,
    TaskDefinition,
    TaskType,
    TaskCadence,
    UserTaskProgressEntry
} from './types';

// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RPC_URL = 'https://polygon-rpc.com';
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'wss://polygon-mainnet.g.alchemy.com/v2/8df5Ufs4d85WriX-pY383TTWk740Q0P0';
const CHAIN_ID = 137;
const PORT = Number(process.env.PORT) || 3001;
const DB_FILE_PATH = process.env.DB_FILE_PATH || path.join(__dirname, 'user_profiles.json');
const TASKS_DEFINITIONS_PATH = path.join(__dirname, 'tasks-definitions.json');
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "SUPER_SECRET_ADMIN_KEY";

const POINTS_STREAK_BONUS_PER_DAY = 5;
const CONTRACT_ADDRESS = process.env.RATECASTER_CONTRACT_ADDRESS || 'YOUR_CONTRACT_ADDRESS';

// --- In-memory Data Stores (Cache) ---
let dappsStore: FrontendDappRegistered[] = [];
let reviewsByDappStore: Record<string, FrontendDappReview[]> = {};
let allReviewsStore: FrontendDappReview[] = [];
let taskDefinitionsStore: TaskDefinition[] = [];
let userTaskProgressStore: Record<string, Record<string, UserTaskProgressEntry>> = {};

let userProfilesDB: Record<string, FrontendUserProfile> = {};
let ratecasterSDKInstance: RateCaster | null = null;
let sdkInitialized = false;
let wsProviderInitialized = false; // Track WebSocket provider status
let io: Server | null = null;

const logger = {
    info: (message: string, ...args: any[]) => console.log(`[INFO] ${new Date().toISOString()} ${message}`, ...args),
    error: (message: string, ...args: any[]) => console.error(`[ERROR] ${new Date().toISOString()} ${message}`, ...args),
    debug: (message: string, ...args: any[]) => console.debug(`[DEBUG] ${new Date().toISOString()} ${message}`, ...args),
    warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${new Date().toISOString()} ${message}`, ...args),
};

async function loadTasksDefinitions() {
    try {
        const data = await fs.readFile(TASKS_DEFINITIONS_PATH, 'utf-8');
        taskDefinitionsStore = JSON.parse(data);
        logger.info(`Successfully loaded ${taskDefinitionsStore.length} task definitions.`);
    } catch (error) {
        logger.error('Error loading task definitions:', error);
        taskDefinitionsStore = [];
    }
}

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

async function getOrCreateUserProfile(userAddress: string): Promise<FrontendUserProfile> {
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

async function updateUserProfileInDB(profile: FrontendUserProfile): Promise<void> {
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
    if (!WEBSOCKET_URL || WEBSOCKET_URL.includes('YOUR_ALCHEMY_KEY_HERE') || WEBSOCKET_URL.trim() === '') {
        logger.warn('WebSocket URL not configured, is a placeholder, or empty. Real-time event listening will be impaired.');
        wsProviderInitialized = false;
    }
    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === 'YOUR_CONTRACT_ADDRESS') {
        logger.warn('Contract address not configured. Ensure RATECASTER_CONTRACT_ADDRESS is set in .env.');
    }

    const httpProvider = new ethers.JsonRpcProvider(RPC_URL);
    let wsProvider;
    if (WEBSOCKET_URL && !WEBSOCKET_URL.includes('YOUR_ALCHEMY_KEY_HERE') && WEBSOCKET_URL.trim() !== '') {
        try {
            logger.info(`Attempting to initialize WebSocket provider with URL: ${WEBSOCKET_URL}`);
            wsProvider = new ethers.WebSocketProvider(WEBSOCKET_URL);

            // Test connection
            await wsProvider.getBlockNumber(); // This will throw an error if connection fails
            logger.info('WebSocket provider initialized and connected successfully.');
            wsProviderInitialized = true;
        } catch (error) {
            logger.error('Failed to initialize or connect WebSocket provider:', error);
            wsProvider = null; // Ensure wsProvider is null if initialization fails
            wsProviderInitialized = false;
        }
    } else {
        logger.warn('WebSocket provider not initialized due to missing or placeholder URL.');
        wsProviderInitialized = false;
    }


    const sdk = new RateCaster(httpProvider, wsProvider); // Pass potentially null wsProvider
    try {
        // Log contract address if available (it's set in constructor)
        logger.info('RateCaster SDK instance created with contract address:', CONTRACT_ADDRESS);
    } catch (error) {
        logger.error('SDK instance creation failed:', error);
        throw error; // Rethrow if constructor itself fails
    }

    ratecasterSDKInstance = sdk;
    sdkInitialized = true;
    return sdk;
}

function calculateDappAggregates(dapp: SDKDappRegistered | FrontendDappRegistered, reviewsForThisDapp: FrontendDappReview[]): { totalReviews: number; averageRating: number } {
    const totalReviews = reviewsForThisDapp.length;
    const averageRating = totalReviews > 0
        ? reviewsForThisDapp.reduce((sum, r) => sum + r.starRating, 0) / totalReviews
        : 0;
    return { totalReviews: Number(totalReviews), averageRating: Number(averageRating.toFixed(2)) };
}


async function fetchInitialData(sdk: RateCaster) {
    logger.info('Fetching initial dApp and review data using SDK...');
    try {
        const sdkDappsNoAggregates = await sdk.getAllDapps(false);
        logger.info(`Fetched ${sdkDappsNoAggregates.length} dApp shells from SDK.`);

        const allSDKReviews = await sdk.getAllReviews();
        logger.info(`Fetched ${allSDKReviews.length} total reviews from SDK.`);

        allReviewsStore = allSDKReviews.map(sdkReview => ({
            ...sdkReview,
            timestamp: sdkReview.timestamp || Date.now(), // Ensure timestamp exists
            dappName: sdkDappsNoAggregates.find(d => d.dappId === sdkReview.dappId)?.name || 'Unknown Dapp',
        }));

        reviewsByDappStore = {};
        for (const review of allReviewsStore) {
            if (!reviewsByDappStore[review.dappId]) reviewsByDappStore[review.dappId] = [];
            reviewsByDappStore[review.dappId].push(review);
        }

        dappsStore = sdkDappsNoAggregates.map(dappShell => {
            const reviewsForThisDapp = reviewsByDappStore[dappShell.dappId] || [];
            const aggregates = calculateDappAggregates(dappShell, reviewsForThisDapp);
            return {
                ...dappShell,
                category: dappShell.category,
                totalReviews: aggregates.totalReviews,
                averageRating: aggregates.averageRating,
            };
        });
        logger.info(`Processed ${dappsStore.length} dApps with calculated aggregates.`);

    } catch (error) {
        logger.error('Failed to fetch initial data from SDK:', error);
        throw error;
    }
}

// --- Task System Logic ---
function getUtcDateString(timestamp: number = Date.now()): string {
    return new Date(timestamp).toISOString().split('T')[0];
}

async function awardPointsAndNotify(userAddress: string, points: number, reason: string): Promise<FrontendUserProfile> {
    const profile = await getOrCreateUserProfile(userAddress);
    profile.points += points;
    await updateUserProfileInDB(profile);
    logger.info(`Awarded ${points} points to ${userAddress} for ${reason}. Total: ${profile.points}`);
    if (io) io.to(userAddress.toLowerCase()).emit('userProfileUpdate', profile);
    return profile;
}

function getUserTaskProgress(userAddress: string, taskId: string): UserTaskProgressEntry {
    const lowerUserAddress = userAddress.toLowerCase();
    if (!userTaskProgressStore[lowerUserAddress]) {
        userTaskProgressStore[lowerUserAddress] = {};
    }
    if (!userTaskProgressStore[lowerUserAddress][taskId]) {
        userTaskProgressStore[lowerUserAddress][taskId] = {
            taskId,
            currentCount: 0,
            lastProgressTimestamp: 0,
            isCompletedThisPeriod: false,
        };
    }
    return userTaskProgressStore[lowerUserAddress][taskId];
}

function isDailyTaskCompletedToday(userAddress: string, taskId: string): boolean {
    const progress = getUserTaskProgress(userAddress, taskId);
    const todayUtc = getUtcDateString();
    const lastProgressUtc = getUtcDateString(progress.lastProgressTimestamp);

    if (todayUtc !== lastProgressUtc) {
        progress.isCompletedThisPeriod = false;
        progress.currentCount = 0;
    }
    return progress.isCompletedThisPeriod;
}

async function markTaskCompleted(userAddress: string, task: TaskDefinition): Promise<boolean> {
    const progress = getUserTaskProgress(userAddress, task.taskId);
    let justCompleted = false;

    if (task.cadence === TaskCadence.DAILY) {
        if (isDailyTaskCompletedToday(userAddress, task.taskId)) {
            logger.debug(`Task ${task.taskId} already completed today by ${userAddress}.`);
            return false;
        }
    }

    progress.currentCount += 1;
    progress.lastProgressTimestamp = Date.now();

    if (progress.currentCount >= task.targetCount) {
        progress.isCompletedThisPeriod = true;
        justCompleted = true;
        await awardPointsAndNotify(userAddress, task.pointsReward, `Completing Task: ${task.title}`);
        logger.info(`User ${userAddress} completed task ${task.taskId} (${task.title}).`);
        if (io) io.to(userAddress.toLowerCase()).emit('taskUpdate', { taskId: task.taskId, progress });
    }
    return justCompleted;
}

async function processLoginTasks(userAddress: string) {
    const loginTasks = taskDefinitionsStore.filter(t => t.isActive && t.type === TaskType.DAILY_LOGIN && t.cadence === TaskCadence.DAILY);
    for (const task of loginTasks) {
        await markTaskCompleted(userAddress, task);
    }
    const profile = await getOrCreateUserProfile(userAddress);
    const now = Date.now();
    const todayStart = new Date(now).setHours(0, 0, 0, 0);
    if (profile.lastLoginTimestamp < todayStart) {
        profile.lastLoginTimestamp = now;
        await updateUserProfileInDB(profile);
    }
}

async function processReviewAndRatingTasks(userAddress: string, isReviewTextPresent: boolean) {
    const rateDappTasks = taskDefinitionsStore.filter(t => t.isActive && t.type === TaskType.DAILY_RATE_ANY_DAPP && t.cadence === TaskCadence.DAILY);
    for (const task of rateDappTasks) {
        await markTaskCompleted(userAddress, task);
    }

    if (isReviewTextPresent) {
        const reviewTextTasks = taskDefinitionsStore.filter(t => t.isActive && t.type === TaskType.DAILY_REVIEW_ANY_DAPP && t.cadence === TaskCadence.DAILY);
        for (const task of reviewTextTasks) {
            await markTaskCompleted(userAddress, task);
        }

        const profile = await getOrCreateUserProfile(userAddress);
        const now = Date.now();
        const lastReviewDayStart = new Date(profile.lastReviewTimestamp).setHours(0, 0, 0, 0);
        const todayStart = new Date(now).setHours(0, 0, 0, 0);
        const MS_PER_DAY = 24 * 60 * 60 * 1000;
        const daysDifference = Math.floor((todayStart - lastReviewDayStart) / MS_PER_DAY);

        if (profile.lastReviewTimestamp > 0 && daysDifference === 1) profile.reviewStreak += 1;
        else if (daysDifference !== 0) profile.reviewStreak = 1;
        else if (profile.lastReviewTimestamp === 0) profile.reviewStreak = 1;

        if (profile.reviewStreak > 0) {
            await awardPointsAndNotify(userAddress, profile.reviewStreak * POINTS_STREAK_BONUS_PER_DAY, `Review Streak Bonus (Day ${profile.reviewStreak})`);
        }
        profile.lastReviewTimestamp = now;
        await updateUserProfileInDB(profile);
    }
}
// --- End Task System Logic ---

async function processNewReview(reviewFromSDK: SDKDappReview) {
    logger.info(`Processing new review event: ID ${reviewFromSDK.id} for dApp ${reviewFromSDK.dappId}`);

    const serializedSDKReview = serializeBigInt(reviewFromSDK) as FrontendDappReview;
    // Ensure timestamp exists after serialization
    if (!serializedSDKReview.timestamp) serializedSDKReview.timestamp = Date.now();


    let dapp = dappsStore.find(d => d.dappId === serializedSDKReview.dappId);
    if (!dapp && ratecasterSDKInstance) {
        logger.warn(`DApp ${serializedSDKReview.dappId} not in local store. Fetching from SDK (without aggregates).`);
        try {
            const newDappSDKShell = await ratecasterSDKInstance.getDapp(serializedSDKReview.dappId, false);
            if (newDappSDKShell) {
                const reviewsForThisDapp = reviewsByDappStore[newDappSDKShell.dappId] || [];
                if (!reviewsForThisDapp.find(r => r.id === serializedSDKReview.id)) {
                    reviewsForThisDapp.push({ ...serializedSDKReview, dappName: newDappSDKShell.name });
                }
                const aggregates = calculateDappAggregates(newDappSDKShell, reviewsForThisDapp);
                const newDappFrontend: FrontendDappRegistered = {
                    ...newDappSDKShell,
                    category: newDappSDKShell.category,
                    totalReviews: aggregates.totalReviews,
                    averageRating: aggregates.averageRating
                };
                dappsStore = dappsStore.filter(d => d.dappId !== newDappFrontend.dappId);
                dappsStore.push(newDappFrontend);
                dapp = newDappFrontend;
                logger.info(`Fetched and updated dApp ${newDappFrontend.name} in store.`);
                if (io) io.emit('dappUpdate', serializeBigInt(newDappFrontend));
            }
        } catch (fetchErr) {
            logger.error(`Error fetching dApp ${serializedSDKReview.dappId}:`, fetchErr);
        }
    }

    const fullReview: FrontendDappReview = {
        ...serializedSDKReview,
        dappName: dapp?.name || 'Unknown Dapp',
        timestamp: serializedSDKReview.timestamp, // Carry over the timestamp
    };

    allReviewsStore = [fullReview, ...allReviewsStore.filter(r => r.id !== fullReview.id)]
        .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));

    if (!reviewsByDappStore[fullReview.dappId]) reviewsByDappStore[fullReview.dappId] = [];
    reviewsByDappStore[fullReview.dappId] = [fullReview, ...reviewsByDappStore[fullReview.dappId].filter(r => r.id !== fullReview.id)]
        .sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));

    const dappIndex = dappsStore.findIndex(d => d.dappId === fullReview.dappId);
    if (dappIndex !== -1) {
        const currentReviewsForDapp = reviewsByDappStore[fullReview.dappId];
        const aggregates = calculateDappAggregates(dappsStore[dappIndex], currentReviewsForDapp);

        dappsStore[dappIndex] = {
            ...dappsStore[dappIndex],
            totalReviews: aggregates.totalReviews,
            averageRating: aggregates.averageRating
        };
        const updatedDappForEmit = dappsStore[dappIndex];
        logger.debug(`Updated dApp ${dappsStore[dappIndex].name} aggregates: ${aggregates.totalReviews} reviews, ${aggregates.averageRating.toFixed(2)} avg rating.`);
        if (io) io.emit('dappUpdate', serializeBigInt(updatedDappForEmit));
    }

    const hasReviewText = Boolean(serializedSDKReview.reviewText && serializedSDKReview.reviewText.trim().length > 0);
    await processReviewAndRatingTasks(fullReview.rater, hasReviewText);

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
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                 result[key] = serializeBigInt(obj[key]);
            }
        }
        return result;
    }
    return obj;
}

async function startReviewListener(sdk: RateCaster) {
    logger.info('Attempting to start SDK review listener...');

    if (!wsProviderInitialized) {
        logger.warn('WebSocket provider was not initialized. Real-time review listening will not function. Check WEBSOCKET_URL and provider logs.');
        return;
    }

    if (!sdk || typeof sdk.listenToReviews !== 'function') {
        logger.error('SDK instance is not available or listenToReviews method is missing. Cannot start listener.');
        return;
    }
    logger.info('SDK instance and listenToReviews method found. Proceeding with subscription attempt for DappRatingSubmitted events...');

    const eventName = "DappRatingSubmitted";

    try {
        await sdk.listenToReviews((review: SDKDappReview) => {
            // This is the callback that receives events from the SDK
            logger.debug(`Backend received raw ${eventName} event from SDK:`, review);
            processNewReview(review).catch(error => {
                logger.error(`Error processing review event from SDK callback for ${eventName}:`, error);
            });
        });
        logger.info(`Successfully subscribed to ${eventName} events via SDK.`);
    } catch (error) {
        logger.error(`Failed to subscribe to ${eventName} events via SDK:`, error);
        logger.info(`Attempting to stop any existing listener for ${eventName} and will retry in 5 seconds...`);
        try {
            if (typeof sdk.stopListening === 'function') {
                await sdk.stopListening(eventName); // Pass eventName if SDK supports it
            }
        } catch (stopError) {
            logger.error(`Error trying to stop listener for ${eventName} before retry:`, stopError);
        }
        setTimeout(() => startReviewListener(sdk), 5000);
    }
}

export async function startBackendApplication() {
    try {
        await loadTasksDefinitions();
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

        io.on('connection', (socket: SocketIOSocket) => {
            logger.info(`Socket.IO: Client connected: ${socket.id}`);
            socket.on('authenticate', (userAddress: string) => {
                if(userAddress && ethers.isAddress(userAddress)) {
                    socket.join(userAddress.toLowerCase());
                    logger.info(`Socket ${socket.id} joined room for address ${userAddress.toLowerCase()}`);
                }
            });
            socket.on('disconnect', (reason: string) => {
                logger.info(`Socket.IO: Client disconnected: ${socket.id}, Reason: ${reason}`);
            });
        });


        await startReviewListener(sdk);

        app.get('/api/health', (req: express.Request, res: express.Response) => res.status(200).json({
            status: 'UP',
            timestamp: new Date().toISOString(),
            sdkInitialized,
            wsProviderInitialized,
            chain: ratecasterSDKInstance?.getCurrentChain()?.name || "N/A"
        }));

        app.get('/api/dapps', (req: express.Request, res: express.Response) => {
            res.json(serializeBigInt(dappsStore));
        });

        app.get('/api/dapps/:dappId', (req: express.Request<{ dappId: string }>, res: express.Response) => {
            const dappId = req.params.dappId;
            const dapp = dappsStore.find(d => d.dappId === dappId);
            if (dapp) {
                res.json(serializeBigInt(dapp));
            } else {
                res.status(404).json({ error: 'DApp not found' });
            }
        });

        app.get('/api/reviews/dapp/:dappId', (req: express.Request<{ dappId: string }>, res: express.Response) => {
            const reviewsForDapp = reviewsByDappStore[req.params.dappId] || [];
            res.json(serializeBigInt(reviewsForDapp));
        });

        app.get('/api/stats/dapp/:dappId', (req: express.Request<{ dappId: string }>, res: express.Response) => {
            const dappId = req.params.dappId;
            const reviewsForDapp = reviewsByDappStore[dappId] || [];

            const aggregates = calculateDappAggregates({ dappId } as SDKDappRegistered, reviewsForDapp);

            const ratingDistribution: FrontendProjectStats['ratingDistribution'] = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
            for (const review of reviewsForDapp) {
                const ratingKey = review.starRating.toString() as keyof FrontendProjectStats['ratingDistribution'];
                if (ratingDistribution.hasOwnProperty(ratingKey)) ratingDistribution[ratingKey]++;
            }
            const projectStats: FrontendProjectStats = {
                dappId,
                averageRating: aggregates.averageRating,
                totalReviews: aggregates.totalReviews,
                ratingDistribution
            };
            res.json(serializeBigInt(projectStats));
        });

        app.get('/api/reviews/user/:userAddress', (req: express.Request<{ userAddress: string }>, res: express.Response) => {
            const userAddr = req.params.userAddress.toLowerCase();
            const userReviews = allReviewsStore.filter(r => r.rater.toLowerCase() === userAddr);
            res.json(serializeBigInt(userReviews));
        });

        app.get('/api/categories', (req: express.Request, res: express.Response) => {
            try {
                if (!ratecasterSDKInstance) throw new Error("SDK not initialized");
                const categories = ratecasterSDKInstance.getCategoryOptions();
                res.json(categories);
            } catch (e: any) {
                res.status(500).json({ error: "Could not fetch categories." });
            }
        });

        app.post('/api/actions/wallet-connected', async (req: express.Request<{}, {}, { userAddress: string }>, res: express.Response) => {
            const { userAddress } = req.body;
            if (!userAddress || !ethers.isAddress(userAddress)) return res.status(400).json({ error: 'Valid userAddress is required.' });
            try {
                await processLoginTasks(userAddress);
                const profile = await getOrCreateUserProfile(userAddress);
                res.json(serializeBigInt(profile));
            } catch (e: any) {
                logger.error('Error in /api/actions/wallet-connected:', e);
                res.status(500).json({ error: 'Failed to process wallet connection.' });
            }
        });

        app.get('/api/users/profile/:userAddress', async (req: express.Request<{userAddress: string}>, res: express.Response) => {
            if (!ethers.isAddress(req.params.userAddress)) return res.status(400).json({ error: 'Invalid address.' });
            try {
                const profile = await getOrCreateUserProfile(req.params.userAddress);
                res.json(serializeBigInt(profile));
            } catch (e: any) {
                 logger.error('Error in /api/users/profile/:userAddress:', e);
                res.status(500).json({ error: 'Failed to fetch profile.' });
            }
        });

        app.get('/api/leaderboard/top-reviewers', (req: express.Request, res: express.Response) => {
            const leaderboard = Object.values(userProfilesDB)
                .sort((a, b) => b.points - a.points).slice(0, 20).map((p, i) => ({ ...p, rank: i + 1 }));
            res.json(serializeBigInt(leaderboard));
        });
        app.get('/api/leaderboard/top-streaks', (req: express.Request, res: express.Response) => {
            const leaderboard = Object.values(userProfilesDB)
                .filter(p => p.reviewStreak > 0).sort((a, b) => b.reviewStreak - a.reviewStreak)
                .slice(0, 20).map((p, i) => ({ ...p, rank: i + 1 }));
            res.json(serializeBigInt(leaderboard));
        });

        app.get('/api/tasks/active', (req: express.Request, res: express.Response) => {
            const activeTasks = taskDefinitionsStore.filter(t => t.isActive);
            res.json(activeTasks);
        });

        app.get('/api/tasks/progress', async (req: express.Request<{}, {}, {}, { userAddress?: string }>, res: express.Response) => {
            const userAddress = req.query.userAddress as string | undefined;
            if (!userAddress || !ethers.isAddress(userAddress)) {
                return res.status(400).json({ error: 'Valid userAddress query parameter is required.' });
            }
            const activeTasks = taskDefinitionsStore.filter(t => t.isActive);
            const progressList: UserTaskProgressEntry[] = [];

            for (const task of activeTasks) {
                const userProgress = getUserTaskProgress(userAddress, task.taskId);
                if (task.cadence === TaskCadence.DAILY) {
                    isDailyTaskCompletedToday(userAddress, task.taskId);
                }
                progressList.push(userProgress);
            }
            res.json(serializeBigInt(progressList));
        });

        app.post('/admin/tasks/define', async (req: express.Request<{}, {}, TaskDefinition>, res: express.Response) => {
            const adminKey = req.headers['x-admin-key'] as string;
            if (adminKey !== ADMIN_API_KEY) {
                return res.status(403).json({ error: 'Forbidden: Invalid admin key.' });
            }
            const newTaskDefinition = req.body;
            if (!newTaskDefinition.taskId || !newTaskDefinition.title || !newTaskDefinition.type || !newTaskDefinition.cadence) {
                return res.status(400).json({ error: 'Invalid task definition payload.' });
            }

            const existingIndex = taskDefinitionsStore.findIndex(t => t.taskId === newTaskDefinition.taskId);
            if (existingIndex !== -1) {
                taskDefinitionsStore[existingIndex] = newTaskDefinition;
                logger.info(`Admin updated task definition: ${newTaskDefinition.taskId}`);
            } else {
                taskDefinitionsStore.push(newTaskDefinition);
                logger.info(`Admin added new task definition: ${newTaskDefinition.taskId}`);
            }
            try {
                await fs.writeFile(TASKS_DEFINITIONS_PATH, JSON.stringify(taskDefinitionsStore, null, 2));
                logger.info('Task definitions saved to file by admin update.');
            } catch (e) {
                logger.error('Failed to save task definitions to file after admin update:', e);
            }
            res.status(200).json({ message: 'Task definition processed.', task: newTaskDefinition });
        });

        app.post('/api/actions/refresh-dapp-from-chain', async (req: express.Request<{}, {}, { dappId: string }>, res: express.Response) => {
            const { dappId } = req.body;
            if (!dappId || typeof dappId !== 'string') return res.status(400).json({ error: 'Valid dappId required.' });
            if (ratecasterSDKInstance) {
                try {
                    logger.info(`Attempting to refresh dApp ${dappId} from chain (core data only)...`);
                    const fetchedDappSDKShell = await ratecasterSDKInstance.getDapp(dappId, false);
                    if (fetchedDappSDKShell) {
                        const reviewsForThisDapp = reviewsByDappStore[dappId] || [];
                        const aggregates = calculateDappAggregates(fetchedDappSDKShell, reviewsForThisDapp);

                        const fetchedDappFrontend: FrontendDappRegistered = {
                            ...serializeBigInt(fetchedDappSDKShell),
                            category: fetchedDappSDKShell.category,
                            totalReviews: aggregates.totalReviews,
                            averageRating: aggregates.averageRating,
                        };

                        const idx = dappsStore.findIndex(d => d.dappId === fetchedDappFrontend.dappId);
                        if (idx !== -1) dappsStore[idx] = fetchedDappFrontend; else dappsStore.push(fetchedDappFrontend);

                        if (io) io.emit('dappUpdate', fetchedDappFrontend);
                        logger.info(`DApp ${dappId} refreshed and update emitted.`);
                        res.status(200).json({ message: 'DApp data refreshed/added.', dapp: fetchedDappFrontend });
                    } else {
                        res.status(404).json({ error: 'DApp not found via SDK.' });
                    }
                } catch (e: any) {
                    logger.error('Error in /api/actions/refresh-dapp-from-chain:', e);
                    res.status(500).json({ error: `Failed to process dApp refresh: ${e.message}` });
                }
            } else {
                res.status(503).json({ error: 'SDK not available.' });
            }
        });

        const generalErrorHandler: express.ErrorRequestHandler = (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
            logger.error('Unhandled Express error:', err.stack || err.message || err);
            if (res.headersSent) return next(err);
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
    if (io) io.close(() => logger.info('Socket.IO server closed.'));
    if (ratecasterSDKInstance && typeof ratecasterSDKInstance.stopListening === 'function') {
        try {
            await ratecasterSDKInstance.stopListening("DappRatingSubmitted"); // Specify event if method supports it
            logger.info('SDK review listener stopped.');
        } catch (e: any) {
            logger.warn('Error stopping SDK listener:', e.message);
        }
    }
    await saveUserProfilesToDB();
    logger.info('User profiles saved.');
    setTimeout(() => process.exit(0), 2000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('unhandledRejection', (reason, promise) => logger.error('Unhandled Rejection:', { promise, reason }));
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException').finally(() => process.exit(1));
});

startBackendApplication();
