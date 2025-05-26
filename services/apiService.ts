import { CategoryOption, getCategoryOptions as getCatsOpts, getCategoryNameById as getCatName } from '../types';

// Most of the mock data and SDK simulation logic is now removed from here,
// as the frontend will interact with the actual backend service.
// We can keep utility functions if they are still useful standalone or for testing.

export const apiService = {
  // Example: Category options might still be statically served or fetched if complex
  getCategoryOptions: async (): Promise<CategoryOption[]> => {
    // This could still fetch from a static part of the backend or generate locally
    // For now, uses the local types.ts function
    return Promise.resolve(getCatsOpts());
  },

  getCategoryNameById: (categoryId: number): string => {
    return getCatName(categoryId);
  }

  // Other mock functions like getAllDapps, submitReview, etc., are removed.
  // The frontend's App.tsx will now use `fetch` to call backend API endpoints.
};
