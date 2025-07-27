/// <reference types="node" />
import dotenv from 'dotenv';
dotenv.config();

import { ethers } from 'ethers';
import { RateCaster, DappRegistered as SDKDappRegistered, DappReview as SDKDappReview } from '@ratecaster/sdk';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
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
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, Type, GenerateContentResponse, Chat, Part } from '@google/genai';
// --- NEW ---
// Import the SQLite library
import Database from 'better-sqlite3';


// --- Configuration ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const RPC_URL = process.env.RPC_URL || 'https://polygon-rpc.com'; // Default to Polygon mainnet RPC
const WEBSOCKET_URL = process.env.WEBSOCKET_URL || 'wss://polygon-mainnet.g.alchemy.com/v2/8df5Ufs4d85WriX-pY383TTWk740Q0P0';
const PORT = Number(process.env.PORT) || 3001;
const DB_FILE_PATH = process.env.DB_FILE_PATH || path.join(__dirname, 'user_profiles.json');
// --- NEW ---
// Add the path to your reviews database. Assumes it's in the project root.
const REVIEW_DB_PATH = process.env.REVIEW_DB_PATH || path.join('etherscan-reviews copy.db');
const TASKS_DEFINITIONS_PATH = path.join(__dirname, 'tasks-definitions.json');
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "SUPER_SECRET_ADMIN_KEY";

const POINTS_STREAK_BONUS_PER_DAY = 5;

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
// --- NEW ---
// State for the durable listener
let isListenerRunning = false;


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

    const httpProvider = new ethers.JsonRpcProvider(RPC_URL);
    let wsProvider;
    if (WEBSOCKET_URL && !WEBSOCKET_URL.includes('YOUR_ALCHEMY_KEY_HERE') && WEBSOCKET_URL.trim() !== '') {
        try {
            logger.info(`Attempting to initialize WebSocket provider with URL: ${WEBSOCKET_URL}`);
            wsProvider = new ethers.WebSocketProvider(WEBSOCKET_URL);

            await wsProvider.getBlockNumber();
            logger.info('WebSocket provider initialized and connected successfully.');
            wsProviderInitialized = true;
        } catch (error) {
            logger.error('Failed to initialize or connect WebSocket provider:', error);
            wsProvider = null;
            wsProviderInitialized = false;
        }
    } else {
        logger.warn('WebSocket provider not initialized due to missing or placeholder URL.');
        wsProviderInitialized = false;
    }


    const sdk = new RateCaster(httpProvider, wsProvider); 

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

async function fetchInitialDataFromDb(sdk: RateCaster) {
    logger.info('DB-FIRST DATA LOAD: Starting initial data load from SQLite...');
    let db: Database.Database | null = null;
    try {
        // Step 1: Fetch dApp shells from the SDK. Their IDs will be our reference.
        const sdkDappsNoAggregates = await sdk.getAllDapps(false);
        logger.info(`DB-FIRST DATA LOAD: Fetched ${sdkDappsNoAggregates.length} dApp shells from SDK.`);

        // Create a fast lookup map with lowercase IDs
        const dappInfoMap = new Map<string, SDKDappRegistered>();
        for (const dapp of sdkDappsNoAggregates) {
            dappInfoMap.set(dapp.dappId.toLowerCase(), dapp);
        }

        // Step 2: Read all reviews from our reliable SQLite database.
        logger.info(`DB-FIRST DATA LOAD: Reading reviews from SQLite database at: ${REVIEW_DB_PATH}`);
        db = new Database(REVIEW_DB_PATH, { readonly: true, fileMustExist: true });
        
        const rows = db.prepare('SELECT * FROM etherscan_reviews').all() as any[];
        logger.info(`DB-FIRST DATA LOAD: Found ${rows.length} reviews in the local database.`);

        // Step 3: Initialize stores and map DB rows to our frontend review type.
        const newAllReviewsStore: FrontendDappReview[] = [];
        const newReviewsByDappStore: Record<string, FrontendDappReview[]> = {};

        for (const row of rows) {
            const rowDappIdLower = row.dappId.toLowerCase();
            const dappInfo = dappInfoMap.get(rowDappIdLower);

            const review: FrontendDappReview = {
                id: row.txHash,
                attestationId: row.txHash,
                dappId: rowDappIdLower,
                starRating: row.starRating,
                reviewText: row.reviewText,
                rater: row.fromAddress,
                timestamp: row.blockNumber,
                dappName: dappInfo?.name || 'Unknown Dapp',
            };
            
            newAllReviewsStore.push(review);

            if (!newReviewsByDappStore[rowDappIdLower]) {
                newReviewsByDappStore[rowDappIdLower] = [];
            }
            newReviewsByDappStore[rowDappIdLower].push(review);
        }
        
        // Atomically update the global stores
        allReviewsStore = newAllReviewsStore;
        reviewsByDappStore = newReviewsByDappStore;

        // Step 4: Create the final dappsStore with fresh aggregates.
        const newDappsStore: FrontendDappRegistered[] = [];
        for (const dappShell of sdkDappsNoAggregates) {
            const key = dappShell.dappId.toLowerCase();
            const reviewsForThisDapp = reviewsByDappStore[key] || [];
            const aggregates = calculateDappAggregates(dappShell, reviewsForThisDapp);
            
            newDappsStore.push({
                ...dappShell,
                dappId: key, // Ensure final ID is also lowercase
                category: dappShell.category,
                totalReviews: aggregates.totalReviews,
                averageRating: aggregates.averageRating,
            });
        }
        
        // Atomically update the global dapps store
        dappsStore = newDappsStore;

        logger.info(`<<<<< DATA LOAD COMPLETE >>>>> Processed ${dappsStore.length} dApps with ${allReviewsStore.length} reviews from local DB.`);

    } catch (error) {
        logger.error('FATAL: Failed to fetch initial data from the database:', error);
        throw error;
    } finally {
        if (db) {
            db.close();
        }
    }
}


// --- Task System Logic (No changes needed here) ---
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

// --- NEW ---
/**
 * Saves a single review to the SQLite database.
 * This is the primary point of persistence for new reviews.
 * It uses 'INSERT OR IGNORE' to prevent duplicates on the primary key (txHash).
 * @param review The review object to save.
 */
async function saveReviewToDb(review: FrontendDappReview): Promise<void> {
    let db: Database.Database | null = null;
    logger.info(`DATABASE: Attempting to save review ${review.id} to SQLite.`);
    try {
        db = new Database(REVIEW_DB_PATH);
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO etherscan_reviews (dappId, txHash, fromAddress, starRating, reviewText, blockNumber) 
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            review.dappId,
            review.id, // txHash is the review's unique ID
            review.rater,
            review.starRating,
            review.reviewText,
            review.timestamp
        );
        logger.info(`DATABASE: Successfully persisted review ${review.id}.`);
    } catch (error) {
        logger.error(`DATABASE: Failed to save review ${review.id} to SQLite:`, error);
        // Depending on requirements, you might want to throw the error
        // to be handled by the caller, but for now, we just log it.
    } finally {
        if (db) {
            db.close();
        }
    }
}


// --- MODIFIED ---
/**
 * Processes a new review event from the SDK.
 * 1. Persists the review to the database.
 * 2. Updates the in-memory cache for fast access.
 * 3. Notifies connected clients via WebSockets.
 */
async function processNewReview(reviewFromSDK: SDKDappReview) {
    logger.info(`Processing new review event: ID ${reviewFromSDK.id} for dApp ${reviewFromSDK.dappId}`);

    const serializedSDKReview = serializeBigInt(reviewFromSDK) as FrontendDappReview;
    if (!serializedSDKReview.timestamp) serializedSDKReview.timestamp = Date.now();
    
    // --- Step 1: Immediately persist the new review to the database ---
    await saveReviewToDb(serializedSDKReview);
    
    // --- Step 2: Update the in-memory cache for performance and real-time updates ---

    // Avoid processing duplicates in the cache if the listener fires multiple times
    if (allReviewsStore.some(r => r.id === serializedSDKReview.id)) {
        logger.warn(`Review ${serializedSDKReview.id} is already in the in-memory store. Skipping cache update.`);
        return;
    }
    
    let dapp = dappsStore.find(d => d.dappId === serializedSDKReview.dappId);
    if (!dapp && ratecasterSDKInstance) {
        logger.warn(`DApp ${serializedSDKReview.dappId} not in local store. Fetching from SDK.`);
        try {
            // Fetching without aggregates as we will calculate them locally
            const newDappSDKShell = await ratecasterSDKInstance.getDapp(serializedSDKReview.dappId, false);
            if (newDappSDKShell) {
                const newDappFrontend: FrontendDappRegistered = {
                    ...newDappSDKShell,
                    category: newDappSDKShell.category,
                    totalReviews: 0, // Will be updated below
                    averageRating: 0 // Will be updated below
                };
                dappsStore.push(newDappFrontend);
                dapp = newDappFrontend;
                logger.info(`Fetched and added dApp ${newDappFrontend.name} to in-memory store.`);
            }
        } catch (fetchErr) {
            logger.error(`Error fetching dApp ${serializedSDKReview.dappId}:`, fetchErr);
        }
    }

    const fullReview: FrontendDappReview = {
        ...serializedSDKReview,
        dappName: dapp?.name || 'Unknown Dapp',
        timestamp: serializedSDKReview.timestamp,
    };

    // Update caches
    allReviewsStore = [fullReview, ...allReviewsStore].sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));

    if (!reviewsByDappStore[fullReview.dappId]) {
        reviewsByDappStore[fullReview.dappId] = [];
    }
    reviewsByDappStore[fullReview.dappId].unshift(fullReview);

    // Recalculate aggregates for the affected dApp
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
    
    // --- Step 3: Trigger game mechanics and notify clients ---
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

// --- MODIFIED ---
/**
 * Starts and maintains a durable listener for new reviews.
 * Uses an exponential backoff strategy for reconnection attempts.
 * This function will run indefinitely, trying to keep the listener active.
 * @param sdk The RateCaster SDK instance.
 */
async function startReviewListener(sdk: RateCaster) {
    if (isListenerRunning) {
        logger.warn('Listener is already running. Aborting duplicate start call.');
        return;
    }
    isListenerRunning = true;
    logger.info('Starting durable SDK review listener...');

    if (!wsProviderInitialized) {
        logger.error('CRITICAL: WebSocket provider not initialized. Real-time review listening cannot function.');
        isListenerRunning = false;
        return;
    }

    if (!sdk || typeof sdk.listenToReviews !== 'function') {
        logger.error('CRITICAL: SDK instance or listenToReviews method is missing. Cannot start listener.');
        isListenerRunning = false;
        return;
    }

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10; // After this, it will keep trying but at a max delay.
    const baseDelay = 1000; // 1 second
    const maxDelay = 60000; // 1 minute

    const eventName = "DappRatingSubmitted";

    const connect = async () => {
        try {
            logger.info(`Attempting to subscribe to "${eventName}" events...`);
            await sdk.listenToReviews((review: SDKDappReview) => {
                // On a new review, reset the reconnect counter as we have a healthy connection.
                if (reconnectAttempts > 0) {
                    logger.info('Successfully received an event. Resetting reconnect timer.');
                    reconnectAttempts = 0;
                }
                processNewReview(review).catch(error => {
                    logger.error('Error processing a new review:', error);
                });
            });
            logger.info(`Successfully subscribed to "${eventName}" events. Listening for new reviews.`);
            // The listener is now active. The promise from listenToReviews may not resolve
            // if it's a continuous listener, so we rely on events coming in.
        } catch (error) {
            logger.error(`Failed to subscribe to "${eventName}" events:`, error);
            
            // Clean up existing listeners before retrying
            if (typeof sdk.stopListening === 'function') {
                await sdk.stopListening(eventName).catch(stopErr => logger.warn('Minor error while stopping listener during reconnect:', stopErr));
            }

            reconnectAttempts++;
            const delay = Math.min(baseDelay * Math.pow(2, reconnectAttempts), maxDelay);
            logger.info(`Will attempt to reconnect in ${delay / 1000} seconds...`);
            
            setTimeout(connect, delay);
        }
    };

    await connect();
}

export async function startBackendApplication() {
    try {
        await loadTasksDefinitions();
        await loadUserProfilesFromDB();
        const sdk = await initializeSDK();
        if (!sdkInitialized || !ratecasterSDKInstance) {
            throw new Error("SDK could not be initialized. Backend cannot start.");
        }

        await fetchInitialDataFromDb(sdk);

        const app = express();
        app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
        app.use(express.json());

        const httpServer = http.createServer(app);
        io = new Server(httpServer, {
            cors: { origin: process.env.FRONTEND_URL || "*", methods: ["GET", "POST"] },
            // These settings help keep the connection alive and detect dead connections faster.
            pingTimeout: 60000,
            pingInterval: 25000,
            transports: ['websocket', 'polling']
        });

        io.on('connection', (socket: SocketIOSocket) => {
            logger.info(`Socket.IO: Client connected: ${socket.id}`);
            // Client is expected to send 'authenticate' with their address
            // to join a room for targeted updates (e.g., profile changes).
            socket.on('authenticate', (userAddress: string) => {
                if(userAddress && ethers.isAddress(userAddress)) {
                    socket.join(userAddress.toLowerCase());
                    logger.info(`Socket ${socket.id} joined room for address ${userAddress.toLowerCase()}`);
                }
            });
            socket.on('disconnect', (reason: string) => {
                logger.info(`Socket.IO: Client disconnected: ${socket.id}, Reason: ${reason}`);
            });
             // The Socket.IO client library has built-in reconnection logic.
             // The server is already set up to handle these reconnections gracefully.
             // No special server-side code is needed for this.
        });


        // Start the durable listener.
        await startReviewListener(sdk);

        // --- All API endpoints below this line remain unchanged ---

        app.get('/api/health', (req: express.Request, res: express.Response) => res.status(200).json({
            status: 'UP',
            timestamp: new Date().toISOString(),
            sdkInitialized,
            wsProviderInitialized,
            chain: ratecasterSDKInstance?.getCurrentChain()?.name || "N/A"
        }));

        app.get('/api/dapps', (req: express.Request, res: express.Response) => {
            // Returns data from the fast in-memory cache, which is kept in sync with the DB.
            res.json(serializeBigInt(dappsStore));
        });

        app.get('/api/dapps/:dappId', (req: express.Request<{ dappId: string }>, res: express.Response) => {
            const dappId = req.params.dappId.toLowerCase();
            const dapp = dappsStore.find(d => d.dappId === dappId);
            if (dapp) {
                res.json(serializeBigInt(dapp));
            } else {
                res.status(404).json({ error: 'DApp not found' });
            }
        });

        app.get('/api/reviews/dapp/:dappId', (req: express.Request<{ dappId: string }>, res: express.Response) => {
            const reviewsForDapp = reviewsByDappStore[req.params.dappId.toLowerCase()] || [];
            res.json(serializeBigInt(reviewsForDapp));
        });

        app.get('/api/stats/dapp/:dappId', (req: express.Request<{ dappId: string }>, res: express.Response) => {
            const dappId = req.params.dappId.toLowerCase();
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

        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

        app.post('/api/chatbot', async (req: express.Request, res: express.Response) => {
            const { message, history } = req.body;
        
            if (!message) {
                return res.status(400).json({ error: 'Message is required.' });
            }
        
            try {
                const sanitizedHistory = history?.map((item: any) => ({
                    role: item.role,
                    parts: item.parts
                })) || [];

                const chat: Chat = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    history: sanitizedHistory,
                    config: {
                        systemInstruction: `You are a helpful assistant for the RateCaster platform. Your goal is to help users find the best dApp. When a user asks for dapps, you MUST call the 'getDapps' tool. After receiving the list of dapps from the tool, you MUST format your entire response as a single, valid, stringified JSON object. This JSON object must have a key 'dapps' which is an array of the dapp data. For each dapp, you MUST include ALL of the following fields from the tool's response: 'name', 'description', 'averageRating', 'totalReviews', 'dappId', 'category', and 'url'. Do not summarize, alter, or omit any fields for any dapp. The response must also include a 'hasMore' boolean key. Do not add ANY other text, greetings, or explanations outside of this JSON structure. Your entire response must be ONLY the JSON.`,
                        tools: [{
                            functionDeclarations: [
                                {
                                    name: "getDapps",
                                    description: "Get the list of dapps available on the platform, filtered by a query.",
                                    parameters: {
                                        type: Type.OBJECT,
                                        properties: {
                                            query: {
                                                type: Type.STRING,
                                                description: "The search query to filter dapps by name, description, or category. This is a required field."
                                            },
                                            offset: {
                                                type: Type.NUMBER,
                                                description: "The starting index of the dapps to return. Defaults to 0."
                                            }
                                        },
                                        required: ["query"]
                                    }
                                },
                            ],
                        }],
                    }
                });
        
                let response: GenerateContentResponse = await chat.sendMessage({ message });
                let functionCalls = response.functionCalls;
        
                if (functionCalls && functionCalls.length > 0) {
                    for (const call of functionCalls) {
                        if (call.name === 'getDapps') {
                            const { query, offset = 0 } = call.args as { query: string; offset?: number; };
                            
                            const lowerCaseQuery = query.toLowerCase();
                            const filteredDapps = dappsStore.filter(dapp =>
                                dapp.name.toLowerCase().includes(lowerCaseQuery) ||
                                dapp.description.toLowerCase().includes(lowerCaseQuery) ||
                                (dapp.category || '').toLowerCase().includes(lowerCaseQuery)
                            );
                            
                            const dapps = filteredDapps.slice(offset, offset + 5).map(dapp => ({ name: dapp.name, description: dapp.description, averageRating: dapp.averageRating, totalReviews: dapp.totalReviews, dappId: dapp.dappId, category: dapp.category, url: dapp.url }));
                            const hasMore = filteredDapps.length > offset + 5;
                            
                            const functionResponsePart: Part = {
                                functionResponse: {
                                  name: 'getDapps',
                                  response: { dapps, hasMore },
                                },
                            };

                            const toolResponse = await chat.sendMessage({
                                message: [functionResponsePart]
                            });

                            return res.json({ response: toolResponse.text });
                        }
                    }
                }
        
                return res.json({ response: response.text });
        
            } catch (error) {
                logger.error('Error in /api/chatbot:', error);
                res.status(500).json({ error: 'Failed to get response from chatbot.' });
            }
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
    isListenerRunning = false; // Stop listener from attempting to reconnect
    if (ratecasterSDKInstance && typeof ratecasterSDKInstance.stopListening === 'function') {
        try {
            await ratecasterSDKInstance.stopListening("DappRatingSubmitted");
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
process.on('unhandledRejection', (reason: any, promise: any) => logger.error('Unhandled Rejection:', { promise, reason }));
process.on('uncaughtException', (error: any) => {
    logger.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException').finally(() => process.exit(1));
});

startBackendApplication();