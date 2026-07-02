"use client";

import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export type UserType = 
  | 'AMBASSADOR_RANK_EXAMS'
  | 'EXTRAORDINARY_RANK_EXAMS'
  | 'PRE_PLENIPOTENTIARY_RANK_EXAMS'
  | 'PLENIPOTENTIARY_RANK_EXAMS';

interface UserTypeSelectorProps {
  value: UserType | null;
  onChange: (userType: UserType) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  error?: string;
}

const USER_TYPE_OPTIONS: { value: UserType; label: string }[] = [
  {
    value: 'AMBASSADOR_RANK_EXAMS',
    label: 'Ambassador Rank Exams'
  },
  {
    value: 'EXTRAORDINARY_RANK_EXAMS',
    label: 'Extraordinary Rank Exams'
  },
  {
    value: 'PRE_PLENIPOTENTIARY_RANK_EXAMS',
    label: 'Pre-Plenipotentiary Exams'
  },
  {
    value: 'PLENIPOTENTIARY_RANK_EXAMS',
    label: 'Plenipotentiary Rank Exams'
  }
];

export default function UserTypeSelector({
  value,
  onChange,
  required = false,
  disabled = false,
  className = "",
  error
}: UserTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = USER_TYPE_OPTIONS.find(option => option.value === value);

  const handleSelect = (userType: UserType) => {
    onChange(userType);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        setIsOpen(!isOpen);
        break;
      case 'Escape':
        setIsOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setIsOpen(false);
        }
        break;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls="user-type-listbox"
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={error ? 'user-type-error' : undefined}
        tabIndex={disabled ? -1 : 0}
        className={`
          w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border 
          ${error 
            ? 'border-red-300 dark:border-red-600 focus:border-red-500 focus:ring-red-500/10' 
            : 'border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-primary/10'
          }
          focus:ring-4 transition-all outline-none text-slate-900 dark:text-slate-50 font-medium
          cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          flex items-center justify-between
          ${selectedOption ? '[&>div]:bg-primary/10 [&>div]:border-primary/20 [&>div]:text-primary [&>div]:placeholder:text-primary/40 [&>div]:focus]:border-primary [&>div]:focus]:ring-primary/10' : ''}
        `}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
      >
        <span className={selectedOption ? 'text-slate-900 dark:text-slate-50' : 'text-slate-400 dark:text-slate-500'}>
          {selectedOption ? selectedOption.label : 'Select examination type'}
        </span>
        <ChevronDown 
          className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {isOpen && !disabled && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg z-50 max-h-64 overflow-y-auto">
          <ul id="user-type-listbox" role="listbox" className="py-2">
            {USER_TYPE_OPTIONS.map((option) => (
              <li
                key={option.value}
                role="option"
                aria-selected={value === option.value}
                className={`
                  px-6 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors
                  ${value === option.value ? 'bg-primary/5 dark:bg-primary/10' : ''}
                `}
                onClick={() => handleSelect(option.value)}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-900 dark:text-slate-50">
                    {option.label}
                  </div>
                  {value === option.value && (
                    <Check className="w-5 h-5 text-primary" />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div id="user-type-error" className="mt-2 text-sm text-red-600 dark:text-red-400 font-medium">
          {error}
        </div>
      )}
    </div>
  );
}