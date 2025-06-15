// Based on SDK types
export interface ChainInfo {
  chainId: number;
  name: string; 
  graphqlUrl: string;
  contractAddress: string;
  explorer: string;
}

export interface DappReview {
  id: string;
  attestationId: string;
  dappId: string;
  starRating: number;
  rater: string;
  reviewText: string;
  dappName?: string; 
  timestamp?: number; 
}

export interface DappRegistered {
  dappId: string;
  name: string;
  description: string;
  url: string;
  imageUrl: string;
  categoryId: number;
  category?: string;
  owner: string;
  averageRating?: number;
  totalReviews?: number;
}

export interface CategoryOption {
  value: number;
  label: string;
  group: string;
}

// Points System Types
export interface UserProfile {
  address: string;
  points: number;
  reviewStreak: number;
  lastLoginTimestamp: number; 
  lastReviewTimestamp: number; 
  username?: string; 
}

export interface LeaderboardEntry {
  address: string;
  username?: string;
  points?: number;
  reviewStreak?: number;
  rank: number;
}

export interface ProjectStats {
  dappId: string;
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    '1': number;
    '2': number;
    '3': number;
    '4': number;
    '5': number;
  };
}

// --- Enhanced Task System Types ---
export enum TaskType {
  DAILY_LOGIN = 'DAILY_LOGIN',
  DAILY_RATE_ANY_DAPP = 'DAILY_RATE_ANY_DAPP',
  DAILY_REVIEW_ANY_DAPP = 'DAILY_REVIEW_ANY_DAPP',
  // Example for future weekly task
  // WEEKLY_REVIEW_X_DAPPS = 'WEEKLY_REVIEW_X_DAPPS', 
}

export enum TaskCadence {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  ONCE = 'ONCE', // For one-time tasks/achievements
}

export interface TaskDefinition {
  taskId: string;          // Unique identifier for the task
  title: string;           // User-facing title (e.g., "Daily Check-in")
  description: string;     // User-facing description
  type: TaskType;          // Programmatic type for logic
  cadence: TaskCadence;    // How often it resets (DAILY, WEEKLY)
  pointsReward: number;    // Points awarded upon completion
  targetCount: number;     // How many times action needs to be performed (e.g., 1 for daily login, 3 for "review 3 dapps")
  isActive: boolean;       // Whether the task is currently active
  actionUrl?: string;      // Optional URL for the user to perform the task (e.g., '/browse' for rating)
  actionUrlText?: string;  // Text for the action URL button (e.g., "Rate a dApp")
}

export interface UserTaskProgressEntry {
  taskId: string;
  currentCount: number;       // How many times user has performed the action in current period
  lastProgressTimestamp: number; // Timestamp of the last progress update for this period
  isCompletedThisPeriod: boolean; // Has the task been completed in the current period?
  // lastClaimedTimestamp?: number; // If manual claiming is implemented
}


// Category System from SDK
export enum CategoryId {
  // B2B: 100-199
  B2B = 100,
  B2B_DECENTRALISED_STORAGE = 101,
  B2B_DECENTRALISED_COMPUTE = 102,
  B2B_AUTOMATION_BOTS = 103,
  B2B_ON_RAMP_OFF_RAMP = 104,
  B2B_DEV_TOOLS = 105,
  B2B_EXPLORER = 106,
  B2B_WALLET = 107,
  B2B_INFRASTRUCTURE = 108,
  B2B_OTHERS = 199,
  
  // Tools: 200-299
  TOOLS = 200,
  TOOLS_CEX = 201,
  
  // DApps: 300-399
  DAPPS = 300,
  DAPPS_DAO = 301,
  
  // DeFi: 400-499
  DEFI = 400,
  DEFI_BETTING = 401,
  DEFI_LENDING = 402,
  DEFI_PREDICTION_MARKET = 403,
  DEFI_STABLECOIN = 404,
  DEFI_YIELD_AGGREGATOR = 405,
  DEFI_SYNTHETICS = 406,
  DEFI_INSURANCE = 407,
  DEFI_RESERVE_CURRENCY = 408,
  DEFI_ORACLE = 409,
  DEFI_LOTTERY = 410,
  DEFI_STAKING = 411,
  DEFI_DEX = 412,
  DEFI_BRIDGE = 413,
  DEFI_YIELD = 414,
  DEFI_LAUNCHPAD = 415,
  DEFI_TOOLING = 416,
  DEFI_DERIVATIVES = 417,
  DEFI_PAYMENTS = 418,
  DEFI_INDEXES = 419,
  DEFI_PRIVACY = 420,
  
  // Social: 500-599
  SOCIAL = 500,
  SOCIAL_MESSAGING = 501,
  SOCIAL_NOTIFICATION = 502,
  SOCIAL_NETWORK = 503,
  SOCIAL_TOKEN = 504,
  
  // NFT: 600-699
  NFT = 600,
  NFT_GAME = 601,
  NFT_CREATOR_BRAND = 602,
  NFT_MIDDLEWARE = 603,
  NFT_PFP_GAME = 604,
  NFT_PFP_COLLECTIBLES = 605,
  NFT_MARKETPLACE = 606,
  
  // Gaming: 700-799
  GAMING = 700,
  GAMING_TRADING_CARD = 701,
  GAMING_SURVIVAL = 702,
  GAMING_STRATEGY = 703,
  GAMING_SIMULATION = 704,
  GAMING_SHOOTER = 705,
  GAMING_RPG = 706,
  GAMING_RHYTHM_ACTION = 707,
  GAMING_PLATFORMER = 708,
  GAMING_MMO = 709,
  GAMING_METAVERSE = 710,
  GAMING_FIGHTING = 711,
  GAMING_CCG = 712,
  GAMING_BATTLE_ROYALE = 713,
  GAMING_ADVENTURE = 714,
  GAMING_ARCADE = 715,
  GAMING_CARDS_BOARD = 716,
  GAMING_GAMBLING = 717,
  GAMING_CRYPTO_FARMING = 718,
  GAMING_PUZZLE_PARTY = 719,
  GAMING_RACING = 720,
  GAMING_SANDBOX = 721,
  GAMING_SPORTS = 722,
  GAMING_TOWER_DEFENCE = 723,
  GAMING_OTHERS = 799
}

export const CATEGORY_NAMES: Record<number, string> = {
  [CategoryId.B2B]: "B2B",
  [CategoryId.B2B_DECENTRALISED_STORAGE]: "Decentralised Storage",
  [CategoryId.B2B_DECENTRALISED_COMPUTE]: "Decentralised Compute",
  [CategoryId.B2B_AUTOMATION_BOTS]: "Automation/Bots",
  [CategoryId.B2B_ON_RAMP_OFF_RAMP]: "On Ramp/Off Ramp",
  [CategoryId.B2B_DEV_TOOLS]: "Dev Tools",
  [CategoryId.B2B_EXPLORER]: "Explorer",
  [CategoryId.B2B_WALLET]: "Wallet",
  [CategoryId.B2B_INFRASTRUCTURE]: "Infrastructure",
  [CategoryId.B2B_OTHERS]: "Others (B2B)",
  [CategoryId.TOOLS]: "Tools",
  [CategoryId.TOOLS_CEX]: "CEX",
  [CategoryId.DAPPS]: "DApps",
  [CategoryId.DAPPS_DAO]: "DAO",
  [CategoryId.DEFI]: "DeFi",
  [CategoryId.DEFI_BETTING]: "Betting",
  [CategoryId.DEFI_LENDING]: "Lending",
  [CategoryId.DEFI_PREDICTION_MARKET]: "Prediction Market",
  [CategoryId.DEFI_STABLECOIN]: "Stablecoin",
  [CategoryId.DEFI_YIELD_AGGREGATOR]: "Yield Aggregator",
  [CategoryId.DEFI_SYNTHETICS]: "Synthetics",
  [CategoryId.DEFI_INSURANCE]: "Insurance",
  [CategoryId.DEFI_RESERVE_CURRENCY]: "Reserve Currency",
  [CategoryId.DEFI_ORACLE]: "Oracle",
  [CategoryId.DEFI_LOTTERY]: "Lottery",
  [CategoryId.DEFI_STAKING]: "Staking",
  [CategoryId.DEFI_DEX]: "DEX",
  [CategoryId.DEFI_BRIDGE]: "Bridge",
  [CategoryId.DEFI_YIELD]: "Yield",
  [CategoryId.DEFI_LAUNCHPAD]: "Launchpad",
  [CategoryId.DEFI_TOOLING]: "Tooling",
  [CategoryId.DEFI_DERIVATIVES]: "Derivatives",
  [CategoryId.DEFI_PAYMENTS]: "Payments",
  [CategoryId.DEFI_INDEXES]: "Indexes",
  [CategoryId.DEFI_PRIVACY]: "Privacy",
  [CategoryId.SOCIAL]: "Social",
  [CategoryId.SOCIAL_MESSAGING]: "Messaging",
  [CategoryId.SOCIAL_NOTIFICATION]: "Notification",
  [CategoryId.SOCIAL_NETWORK]: "Social Network",
  [CategoryId.SOCIAL_TOKEN]: "Social Token",
  [CategoryId.NFT]: "NFT",
  [CategoryId.NFT_GAME]: "Game",
  [CategoryId.NFT_CREATOR_BRAND]: "Creator/Brand",
  [CategoryId.NFT_MIDDLEWARE]: "Middleware Offerings",
  [CategoryId.NFT_PFP_GAME]: "PFP+Game",
  [CategoryId.NFT_PFP_COLLECTIBLES]: "PFP Project/Collectibles",
  [CategoryId.NFT_MARKETPLACE]: "Marketplace",
  [CategoryId.GAMING]: "Gaming",
  [CategoryId.GAMING_TRADING_CARD]: "Trading Card Game",
  [CategoryId.GAMING_SURVIVAL]: "Survival",
  [CategoryId.GAMING_STRATEGY]: "Strategy",
  [CategoryId.GAMING_SIMULATION]: "Simulation",
  [CategoryId.GAMING_SHOOTER]: "Shooter",
  [CategoryId.GAMING_RPG]: "RPG",
  [CategoryId.GAMING_RHYTHM_ACTION]: "Rhythm Action",
  [CategoryId.GAMING_PLATFORMER]: "Platformer",
  [CategoryId.GAMING_MMO]: "MMO",
  [CategoryId.GAMING_METAVERSE]: "Metaverse",
  [CategoryId.GAMING_FIGHTING]: "Fighting",
  [CategoryId.GAMING_CCG]: "CCG",
  [CategoryId.GAMING_BATTLE_ROYALE]: "Battle Royale",
  [CategoryId.GAMING_ADVENTURE]: "Adventure",
  [CategoryId.GAMING_ARCADE]: "Arcade",
  [CategoryId.GAMING_CARDS_BOARD]: "Cards/Board/Trading",
  [CategoryId.GAMING_GAMBLING]: "Gambling",
  [CategoryId.GAMING_CRYPTO_FARMING]: "Crypto Farming",
  [CategoryId.GAMING_PUZZLE_PARTY]: "Puzzle/Party Games",
  [CategoryId.GAMING_RACING]: "Racing",
  [CategoryId.GAMING_SANDBOX]: "Sandbox/Open World",
  [CategoryId.GAMING_SPORTS]: "Sports",
  [CategoryId.GAMING_TOWER_DEFENCE]: "Tower Defence",
  [CategoryId.GAMING_OTHERS]: "Others (Gaming)"
};

export const getAllCategories = (): Array<{ id: number; name: string; group: string }> => {
  return Object.entries(CATEGORY_NAMES).map(([idStr, name]) => {
    const id = Number(idStr);
    const mainCategoryId = Math.floor(id / 100) * 100;
    const group = CATEGORY_NAMES[mainCategoryId] || "Other";
    return { id, name, group };
  }).sort((a, b) => {
    const groupCompare = a.group.localeCompare(b.group);
    if (groupCompare !== 0) return groupCompare;
    return a.name.localeCompare(b.name);
  });
};

export const getCategoryOptions = (): CategoryOption[] => {
  return getAllCategories()
    .filter(category => category.id % 100 !== 0) // Exclude main category headers
    .map(category => ({
      value: category.id,
      label: category.name,
      group: category.group
    }));
};

export const getCategoryNameById = (categoryId: number): string => {
  const allCategories = getAllCategories();
  const category = allCategories.find(cat => cat.id === categoryId);
  if (category) return `${category.name} (${category.group})`;
  const categoryName = CATEGORY_NAMES[categoryId];
  if (categoryName) return categoryName;
  return `Unknown (${categoryId})`;
};

// --- Rater League System ---
export enum RaterLeague {
  BRONZE = "Bronze",
  SILVER = "Silver",
  GOLD = "Gold",
  PLATINUM = "Platinum",
  DIAMOND = "Diamond",
}

export interface RankInfo {
  league: RaterLeague;
  iconColor: string; // Tailwind color class e.g., 'text-yellow-500'
  minPoints: number;
  nextLeague?: RaterLeague;
  nextLeaguePoints?: number;
  progressPercentage?: number;
}

const LEAGUE_THRESHOLDS: Array<Omit<RankInfo, 'nextLeague' | 'nextLeaguePoints' | 'progressPercentage'>> = [
  { league: RaterLeague.BRONZE, iconColor: 'text-orange-400', minPoints: 0 }, // Adjusted color for bronze
  { league: RaterLeague.SILVER, iconColor: 'text-neutral-400', minPoints: 250 },
  { league: RaterLeague.GOLD, iconColor: 'text-yellow-500', minPoints: 750 },
  { league: RaterLeague.PLATINUM, iconColor: 'text-sky-400', minPoints: 1500 },
  { league: RaterLeague.DIAMOND, iconColor: 'text-purple-500', minPoints: 3000 },
];

export const getRankAndLeague = (points: number): RankInfo => {
  let currentRank: RankInfo = { ...LEAGUE_THRESHOLDS[0] }; // Default to Bronze

  for (let i = LEAGUE_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEAGUE_THRESHOLDS[i].minPoints) {
      currentRank = { ...LEAGUE_THRESHOLDS[i] };
      const nextRankIndex = i + 1;
      if (nextRankIndex < LEAGUE_THRESHOLDS.length) {
        currentRank.nextLeague = LEAGUE_THRESHOLDS[nextRankIndex].league;
        currentRank.nextLeaguePoints = LEAGUE_THRESHOLDS[nextRankIndex].minPoints;
        const pointsInCurrentTier = points - currentRank.minPoints;
        const pointsForNextTier = currentRank.nextLeaguePoints - currentRank.minPoints;
        currentRank.progressPercentage = Math.min(100, Math.max(0, (pointsInCurrentTier / pointsForNextTier) * 100));
      } else { // Highest rank
        currentRank.progressPercentage = 100;
      }
      break;
    }
  }
  return currentRank;
};
