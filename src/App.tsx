/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import ConsolidationPage from './pages/ConsolidationPage';
import TargetsPage from './pages/TargetsPage';
import ExchangeRatePage from './pages/ExchangeRatePage';
import { Target, FileSpreadsheet, Calculator } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'consolidation' | 'targets' | 'exchange'>('consolidation');

  return (
    <div className="min-h-screen bg-gray-50/50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-800 tracking-tight">
                  RevenueSync
                </span>
                <span className="ml-2 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">ERP & Channel</span>
              </div>
              <div className="ml-8 flex space-x-8">
                <button
                  onClick={() => setActiveTab('consolidation')}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    activeTab === 'consolidation'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  每日業績彙整
                </button>
                <button
                  onClick={() => setActiveTab('targets')}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    activeTab === 'targets'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <Target className="w-4 h-4 mr-2" />
                  年度目標維護
                </button>
                <button
                  onClick={() => setActiveTab('exchange')}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    activeTab === 'exchange'
                      ? 'border-indigo-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  匯率設定
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={activeTab === 'consolidation' ? 'block' : 'hidden'}>
          <ConsolidationPage />
        </div>
        <div className={activeTab === 'targets' ? 'block' : 'hidden'}>
          <TargetsPage />
        </div>
        <div className={activeTab === 'exchange' ? 'block' : 'hidden'}>
          <ExchangeRatePage />
        </div>
      </main>
    </div>
  );
}

