import React, { memo, useMemo } from 'react';

interface LazyJsonViewerProps {
  data: any;
  formattedJson: string;
  className?: string;
}

const LazyJsonViewer: React.FC<LazyJsonViewerProps> = memo(({ 
  data, 
  formattedJson, 
  className = '' 
}) => {
  // Memoized syntax highlighting to prevent recalculation
  const highlightedJson = useMemo(() => {
    const lines = formattedJson.split('\n');
    
    return (
      <pre className="text-sm overflow-x-auto">
        {lines.map((line, lineIndex) => (
          <div key={`line-${lineIndex}`} className="leading-relaxed">
            <span className="text-gray-500 mr-4 select-none">
              {String(lineIndex + 1).padStart(3, ' ')}
            </span>
            <span className="font-mono">
              {line.split(/(\s+)/).map((part, partIndex) => {
                const key = `part-${lineIndex}-${partIndex}`;
                if (part.trim() === '') return part;

                // Optimized syntax highlighting
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
  }, [formattedJson]);

  return (
    <div 
      className={className}
      role="region"
      aria-labelledby="raw-data-heading"
      aria-label="JSON formatted response data"
    >
      <div className="text-gray-300 text-sm">
        {highlightedJson}
      </div>
    </div>
  );
});

LazyJsonViewer.displayName = 'LazyJsonViewer';

export default LazyJsonViewer;