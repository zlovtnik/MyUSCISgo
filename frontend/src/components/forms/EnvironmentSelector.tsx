import type { Environment } from '../../types';
import { ENVIRONMENTS } from '../../types';
import { cn } from '../../utils';

interface EnvironmentSelectorProps {
  readonly value: Environment;
  readonly onChange: (value: Environment) => void;
  readonly error?: string;
  readonly disabled?: boolean;
}

export function EnvironmentSelector({
  value,
  onChange,
  error,
  disabled = false
}: EnvironmentSelectorProps) {
  const selectedEnv = ENVIRONMENTS.find(env => env.value === value);

  return (
    <div className="relative">
      <label
        htmlFor="environment-select"
        className="block text-sm font-medium text-gray-700 mb-2"
      >
        Environment
      </label>

      <select
        id="environment-select"
        value={value}
        onChange={(e) => onChange(e.target.value as Environment)}
        disabled={disabled}
        className={cn(
          "w-full p-3 border rounded-lg transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          error ? "border-red-300 bg-red-50" : "border-gray-300 bg-white",
          disabled ? "opacity-50 cursor-not-allowed" : "hover:border-gray-400",
          selectedEnv?.color
        )}
      >
        {ENVIRONMENTS.map((env) => (
          <option key={env.value} value={env.value}>
            {env.label} - {env.description}
          </option>
        ))}
      </select>

      {error && (
        <p className="mt-1 text-sm text-red-600" role="alert">{error}</p>
      )}
    </div>
  );
}
