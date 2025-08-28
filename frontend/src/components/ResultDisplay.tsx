import React, { useState } from 'react';
import type { ProcessingResult } from '../types';
import { cn } from '../utils';

interface ResultDisplayProps {
  readonly result: ProcessingResult;
  readonly onReset?: () => void;
}

export function ResultDisplay({ result, onReset }: ResultDisplayProps) {
  const [activeTab, setActiveTab] = useState<'formatted' | 'json'>('formatted');

  const formatJSON = (obj: unknown): string => {
    return JSON.stringify(obj, null, 2);
  };

  const highlightJSON = (json: string): React.JSX.Element => {
    const lines = json.split('\n');
    return (
      <pre className="text-sm overflow-x-auto">
        {lines.map((line, lineIndex) => (
          <div key={`line-${lineIndex}-${line.substring(0, 10)}`} className="leading-relaxed">
            <span className="text-gray-500 mr-4 select-none">
              {String(lineIndex + 1).padStart(3, ' ')}
            </span>
            <span className="font-mono">
              {line.split(/(\s+)/).map((part, partIndex) => {
                const key = `part-${lineIndex}-${partIndex}`;
                if (part.trim() === '') return part;

                // Simple syntax highlighting
                if (part.startsWith('"') && part.endsWith('"')) {
                  return (
                    <span key={key} className="text-green-600">
                      {part}
                    </span>
                  );
                }
                if (part === '{' || part === '}' || part === '[' || part === ']') {
                  return (
                    <span key={key} className="text-blue-600 font-bold">
                      {part}
                    </span>
                  );
                }
                if (part === ':' || part === ',') {
                  return (
                    <span key={key} className="text-gray-600">
                      {part}
                    </span>
                  );
                }
                if ((/^\d+$/.test(part)) || (/^(true|false|null)$/.test(part))) {
                  return (
                    <span key={key} className="text-purple-600">
                      {part}
                    </span>
                  );
                }
                return <span key={key}>{part}</span>;
              })}
            </span>
          </div>
        ))}
      </pre>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200" data-testid="result">
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between p-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Processing Results
          </h3>
          <div className="flex items-center space-x-2">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('formatted')}
                className={cn(
                  'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                  activeTab === 'formatted'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                Formatted
              </button>
              <button
                onClick={() => setActiveTab('json')}
                className={cn(
                  'px-3 py-1 text-sm font-medium rounded-md transition-colors',
                  activeTab === 'json'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                )}
              >
                JSON
              </button>
            </div>
            {onReset && (
              <button
                onClick={onReset}
                className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                New Request
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'formatted' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">
                  Base URL
                </h4>
                <p className="text-lg font-mono text-blue-600 break-all">
                  {result.baseURL}
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">
                  Auth Mode
                </h4>
                <p className="text-lg font-mono text-green-600">
                  {result.authMode}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2 uppercase tracking-wide">
                Token Hint
              </h4>
              <div className="bg-white border rounded p-3 font-mono text-sm text-gray-800 break-all">
                {result.tokenHint}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">
                Configuration
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(result.config).map(([key, value]) => (
                  <div key={key} className="bg-white border rounded p-3">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                      {key}
                    </div>
                    <div className="font-mono text-sm text-gray-900 break-all">
                      {String(value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <div className="text-gray-300">
              {highlightJSON(formatJSON(result))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
