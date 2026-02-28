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
                className={`w-full px-6 py-4 rounded-2xl bg-slate-50 border border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none text-slate-900 font-medium pr-14 ${className}`}
                required={required}
                disabled={disabled}
            />
            <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
            >
                {showPassword ? (
                    <EyeOff size={18} className="text-slate-400" />
                ) : (
                    <Eye size={18} className="text-slate-400" />
                )}
            </button>
        </div>
    );
}
