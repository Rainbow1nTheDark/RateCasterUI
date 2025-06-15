
import React, { useEffect, useState, useCallback } from 'react';
import { ethers } from 'ethers';
// import { RateCaster } from '../RateCasterSDK/src'; // SDK no longer directly used for data fetching here
import { DappRegistered, DappReview, ProjectStats, getCategoryNameById } from '../types';
import Spinner from './Spinner';
import StarRating from './StarRating';
import ReviewCard from './ReviewCard';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { ExternalLinkIcon } from './icons/ExternalLinkIcon';
import { ChatBubbleOvalLeftEllipsisIcon } from './icons/ChatBubbleOvalLeftEllipsisIcon';

const API_BASE_URL = 'http://localhost:3001/api';
// const FRONTEND_RPC_URL = 'https://polygon-rpc.com'; // No longer needed for SDK init here

interface DappDetailPageProps {
  dappId: string;
  onBack: () => void;
  openRatingModal: (dappId: string) => void;
  userAddress: string | null;
}

const DappDetailPage: React.FC<DappDetailPageProps> = ({
  dappId,
  onBack,
  openRatingModal,
  userAddress,
}) => {
  const [dapp, setDapp] = useState<DappRegistered | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [reviews, setReviews] = useState<DappReview[]>([]);
  const [isPageLoading, setIsPageLoading] = useState<boolean>(true);
  const [pageError, setPageError] = useState<string>('');

  const fetchData = useCallback(async () => {
    if (!dappId) return;
    setIsPageLoading(true);
    setPageError('');
    setDapp(null);
    setStats(null);
    setReviews([]);

    try {
      // 1. Fetch DApp details from backend API
      const dappRes = await fetch(`${API_BASE_URL}/dapps/${dappId}`);
      if (!dappRes.ok) {
        const dappErrorText = await dappRes.text();
        console.error('DApp detail fetch error response:', dappErrorText);
        throw new Error(`Failed to fetch dApp details: ${dappRes.statusText} (Status: ${dappRes.status})`);
      }
      const dappData: DappRegistered = await dappRes.json();
      // Ensure category name is populated using getCategoryNameById if not already a string
      if (dappData.categoryId && typeof dappData.category !== 'string') {
        dappData.category = getCategoryNameById(dappData.categoryId);
      }
      setDapp(dappData);

      // 2. Fetch DApp statistics from backend API
      const statsRes = await fetch(`${API_BASE_URL}/stats/dapp/${dappId}`);
      if (!statsRes.ok) {
        const statsErrorText = await statsRes.text();
        console.error('Stats fetch error response:', statsErrorText);
        throw new Error(`Failed to fetch dApp statistics: ${statsRes.statusText} (Status: ${statsRes.status})`);
      }
      const statsData: ProjectStats = await statsRes.json();
      setStats(statsData);

      // 3. Fetch DApp reviews from backend API
      const reviewsRes = await fetch(`${API_BASE_URL}/reviews/dapp/${dappId}`);
      console.log('Fetching reviews from:', `${API_BASE_URL}/reviews/dapp/${dappId}`);
      if (!reviewsRes.ok) {
        const reviewErrorText = await reviewsRes.text();
        console.error('Review fetch error response:', reviewErrorText);
        throw new Error(`Failed to fetch dApp reviews: ${reviewsRes.statusText} (Status: ${reviewsRes.status})`);
      }
      const reviewsData: DappReview[] = await reviewsRes.json();
      setReviews(reviewsData.map(r => ({ ...r, dappName: dappData.name }))); // Use name from fetched dappData

    } catch (err: any) {
      console.error('Error fetching dApp page data:', err);
      setPageError(err.message || 'Failed to load dApp information.');
      setDapp(null); 
      setStats(null);
      setReviews([]);
    } finally {
      setIsPageLoading(false);
    }
  }, [dappId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isPageLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-200px)] p-4">
        <Spinner size="lg" />
        <p className="mt-4 text-xl text-neutral-400">Loading dApp details...</p>
      </div>
    );
  }

  if (pageError || !dapp) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[calc(100vh-200px)] p-4 text-center">
        <p className="text-xl text-red-500">{pageError || 'DApp data could not be loaded.'}</p>
        <button
          onClick={onBack}
          className="mt-6 px-6 py-2 bg-yellow-500 hover:bg-yellow-600 text-neutral-900 rounded-lg font-medium flex items-center transition-colors"
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2" />
          Back to Browse
        </button>
      </div>
    );
  }

  const ratingDistributionOrder: (keyof ProjectStats['ratingDistribution'])[] = ['5', '4', '3', '2', '1'];

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header & Back Button */}
      <div className="flex justify-between items-center mb-6 sm:mb-8">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-yellow-500 tracking-tight break-all">
          {dapp.name}
        </h1>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-neutral-200 rounded-lg text-sm font-medium flex items-center transition-colors whitespace-nowrap"
          aria-label="Back to browse dApps"
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Back
        </button>
      </div>

      {/* Dapp Info Section */}
      <section className="mb-8 sm:mb-12 p-4 sm:p-6 bg-neutral-800 rounded-xl shadow-xl">
        <div className="flex flex-col md:flex-row gap-6">
          <div className="md:w-1/3 flex-shrink-0">
            <img
              src={dapp.imageUrl || `https://picsum.photos/seed/${dapp.dappId}/400/300`}
              alt={`${dapp.name} cover image`}
              className="w-full aspect-[4/3] object-contain rounded-lg bg-neutral-700 border-2 border-neutral-600"
              onError={(e) => (e.currentTarget.src = `https://picsum.photos/seed/${dapp.dappId}/400/300`)}
            />
          </div>
          <div className="md:w-2/3 flex flex-col">
            <p className="text-sm text-neutral-400 mb-2 uppercase tracking-wide">{dapp.category || 'Uncategorized'}</p>
            <p className="text-neutral-300 mb-4 text-sm leading-relaxed flex-grow">{dapp.description}</p>
            <div className="mt-auto flex flex-col sm:flex-row gap-3">
              <a
                href={dapp.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-initial justify-center px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 text-neutral-900 rounded-lg font-medium flex items-center transition-colors text-sm"
                aria-label={`Visit ${dapp.name} website`}
              >
                <ExternalLinkIcon className="w-4 h-4 mr-2" />
                Visit Website
              </a>
              <button
                onClick={() => openRatingModal(dapp.dappId)}
                disabled={!userAddress}
                className="flex-1 sm:flex-initial justify-center px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-neutral-100 rounded-lg font-medium flex items-center transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`Rate ${dapp.name}`}
              >
                <ChatBubbleOvalLeftEllipsisIcon className="w-4 h-4 mr-2" />
                Rate this Dapp
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Rating Statistics Section */}
      {stats && (
        <section className="mb-8 sm:mb-12 p-4 sm:p-6 bg-neutral-800 rounded-xl shadow-xl">
          <h2 className="text-xl sm:text-2xl font-semibold text-neutral-100 mb-6 text-center">Rating Statistics</h2>
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
            <div className="md:w-1/3 text-center md:text-left flex-shrink-0">
              <p className="text-5xl font-bold text-yellow-500">
                {(stats.averageRating || 0).toFixed(1)}
              </p>
              <div className="my-2 flex justify-center md:justify-start">
                <StarRating rating={stats.averageRating || 0} size="lg" />
              </div>
              <p className="text-neutral-400 text-sm">
                Based on {stats.totalReviews} review{stats.totalReviews !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="md:w-2/3 w-full">
              {ratingDistributionOrder.map((starKey) => {
                const count = stats.ratingDistribution[starKey] || 0;
                const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0;
                return (
                  <div key={starKey} className="flex items-center gap-2 mb-1.5 text-sm">
                    <span className="text-neutral-300 w-6 text-right">{starKey}★</span>
                    <div className="flex-grow bg-neutral-700 rounded-full h-2.5 sm:h-3">
                      <div
                        className="bg-yellow-500 h-full rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${percentage}%` }}
                        aria-label={`${percentage.toFixed(0)}% for ${starKey} stars`}
                      ></div>
                    </div>
                    <span className="text-neutral-400 w-10 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* User Reviews Section */}
      <section>
        <h2 className="text-xl sm:text-2xl font-semibold text-neutral-100 mb-6 text-center">
          User Reviews ({reviews.length})
        </h2>
        {reviews.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {reviews.map((review) => (
              <ReviewCard key={review.id || review.attestationId} review={review} />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 px-4 bg-neutral-800 rounded-lg shadow">
            <p className="text-lg text-neutral-400">No reviews yet for this dApp.</p>
            {userAddress && <p className="text-neutral-500 mt-1">Be the first to share your thoughts!</p>}
          </div>
        )}
      </section>
    </div>
  );
};

export default DappDetailPage;