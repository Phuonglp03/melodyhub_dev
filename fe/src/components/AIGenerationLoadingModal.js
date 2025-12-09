import React from 'react';
import { FaMusic, FaSpinner } from 'react-icons/fa';

/**
 * Loading Modal for AI Generation
 * Shows animated music notes and generation status
 */
const AIGenerationLoadingModal = ({ isOpen, message = "Generating your AI backing track..." }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-8 max-w-md w-full mx-4 border-2 border-purple-500 shadow-2xl">
        {/* Animated Music Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <FaMusic className="text-6xl text-purple-500 animate-bounce" />
            <div className="absolute -top-2 -right-2">
              <FaSpinner className="text-2xl text-pink-500 animate-spin" />
            </div>
          </div>
        </div>

        {/* Message */}
        <h2 className="text-xl font-bold text-white text-center mb-4">
          {message}
        </h2>

        {/* Progress Info */}
        <div className="space-y-3 text-sm text-gray-400 text-center">
          <p>🎵 Analyzing chord progression...</p>
          <p>🎹 Setting up instruments...</p>
          <p>🎼 Creating professional arrangement...</p>
          <p className="text-purple-400 font-medium mt-4">This may take 30-60 seconds</p>
        </div>

        {/* Animated Loading Bar */}
        <div className="mt-6">
          <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 animate-pulse"
                 style={{ width: '100%' }}>
            </div>
          </div>
        </div>

        {/* Tip */}
        <p className="text-xs text-gray-500 text-center mt-4 italic">
          💡 Tip: While waiting, you can adjust other track settings
        </p>
      </div>
    </div>
  );
};

export default AIGenerationLoadingModal;
