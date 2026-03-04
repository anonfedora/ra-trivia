"use client";

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordInputProps {
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    className?: string;
    required?: boolean;
    disabled?: boolean;
}

export default function PasswordInput({
    value,
    onChange,
    placeholder = "••••••••",
    className = "",
    required = false,
    disabled = false
}: PasswordInputProps) {
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="relative">
            <input
                type={showPassword ? "text" : "password"}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className={`w-full px-6 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-900 dark:text-slate-50 font-medium pr-14 ${className}`}
                required={required}
                disabled={disabled}
            />
            <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                tabIndex={-1}
            >
                {showPassword ? (
                    <EyeOff size={18} />
                ) : (
                    <Eye size={18} />
                )}
            </button>
        </div>
    );
}
