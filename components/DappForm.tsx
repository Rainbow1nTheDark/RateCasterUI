
import React from 'react';
import { DappRegistered, CategoryOption } from '../types';
import Spinner from './Spinner';

interface DappFormProps {
  activeTab: 'add' | 'edit';
  selectedDapp: DappRegistered | null;
  newDapp: Partial<DappRegistered>; // Use Partial for newDapp as it's being built
  categoryOptions: CategoryOption[];
  isLoading: boolean;
  handleDappFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleRegisterDapp: (e: React.FormEvent) => Promise<void>;
  handleUpdateDapp: (e: React.FormEvent) => Promise<void>;
  setActiveTab: (tab: 'browse' | 'add' | 'edit' | 'reviews') => void;
  setSelectedDapp?: (dapp: DappRegistered | null) => void; // Optional for add tab
}

const DappForm: React.FC<DappFormProps> = ({
  activeTab,
  selectedDapp,
  newDapp,
  categoryOptions,
  isLoading,
  handleDappFormChange,
  handleRegisterDapp,
  handleUpdateDapp,
  setActiveTab,
  setSelectedDapp
}) => {
  const currentDappData = activeTab === 'edit' ? selectedDapp : newDapp;
  const handleSubmit = activeTab === 'edit' ? handleUpdateDapp : handleRegisterDapp;

  return (
    <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-neutral-800 rounded-xl shadow-xl">
      <h2 className="text-2xl sm:text-3xl font-semibold text-yellow-500 mb-6 text-center">
        {activeTab === 'edit' ? 'Edit Dapp' : 'Register New Dapp'}
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-neutral-300 mb-1">Name</label>
          <input
            type="text"
            name="name"
            id="name"
            value={currentDappData?.name || ''}
            onChange={handleDappFormChange}
            required
            className="w-full px-4 py-2.5 bg-neutral-700 border border-neutral-600 rounded-lg text-neutral-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition-colors"
            placeholder="Awesome Dapp"
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-neutral-300 mb-1">Description</label>
          <textarea
            name="description"
            id="description"
            value={currentDappData?.description || ''}
            onChange={handleDappFormChange}
            rows={4}
            required
            className="w-full px-4 py-2.5 bg-neutral-700 border border-neutral-600 rounded-lg text-neutral-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition-colors"
            placeholder="Tell us about your dapp..."
          />
        </div>
        <div>
          <label htmlFor="url" className="block text-sm font-medium text-neutral-300 mb-1">URL</label>
          <input
            type="url"
            name="url"
            id="url"
            value={currentDappData?.url || ''}
            onChange={handleDappFormChange}
            required
            className="w-full px-4 py-2.5 bg-neutral-700 border border-neutral-600 rounded-lg text-neutral-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition-colors"
            placeholder="https://example.com"
          />
        </div>
        <div>
          <label htmlFor="imageUrl" className="block text-sm font-medium text-neutral-300 mb-1">Image URL</label>
          <input
            type="url"
            name="imageUrl"
            id="imageUrl"
            value={currentDappData?.imageUrl || ''}
            onChange={handleDappFormChange}
            required
            className="w-full px-4 py-2.5 bg-neutral-700 border border-neutral-600 rounded-lg text-neutral-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition-colors"
            placeholder="https://example.com/image.png"
          />
        </div>
        <div>
          <label htmlFor="categoryId" className="block text-sm font-medium text-neutral-300 mb-1">Category</label>
          <select
            name="categoryId"
            id="categoryId"
            value={currentDappData?.categoryId || ''}
            onChange={handleDappFormChange}
            required
            className="w-full px-4 py-2.5 bg-neutral-700 border border-neutral-600 rounded-lg text-neutral-100 focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 outline-none transition-colors"
          >
            <option value="" disabled>Select a category</option>
            {categoryOptions.map(optgroup => (
              <optgroup key={optgroup.group} label={optgroup.group}>
                 {categoryOptions.filter(option => option.group === optgroup.group).map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                 ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 pt-2">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full sm:w-auto flex-1 bg-yellow-500 hover:bg-yellow-600 text-neutral-900 px-6 py-3 rounded-lg text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors duration-150"
          >
            {isLoading ? <Spinner size="sm" color="border-neutral-900" /> : (activeTab === 'edit' ? 'Update Dapp' : 'Register Dapp')}
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('browse');
              if(activeTab === 'edit' && setSelectedDapp) setSelectedDapp(null);
            }}
            disabled={isLoading}
            className="w-full sm:w-auto flex-1 bg-neutral-600 hover:bg-neutral-500 text-neutral-100 px-6 py-3 rounded-lg text-base font-medium disabled:opacity-50 transition-colors duration-150"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default DappForm;
