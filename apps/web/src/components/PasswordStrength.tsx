"use client";

interface Props {
    password: string;
}

interface StrengthResult {
    score: number;       // 0–4
    label: string;
    color: string;
    bg: string;
}

export function getPasswordStrength(password: string): StrengthResult {
    if (!password) return { score: 0, label: '', color: '', bg: '' };

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    // Cap at 4
    const capped = Math.min(score, 4);

    const levels: StrengthResult[] = [
        { score: 0, label: '', color: '', bg: '' },
        { score: 1, label: 'Weak',   color: 'text-red-500',    bg: 'bg-red-500' },
        { score: 2, label: 'Fair',   color: 'text-orange-500', bg: 'bg-orange-500' },
        { score: 3, label: 'Good',   color: 'text-yellow-500', bg: 'bg-yellow-500' },
        { score: 4, label: 'Strong', color: 'text-emerald-500', bg: 'bg-emerald-500' },
    ];

    return levels[capped];
}

export default function PasswordStrength({ password }: Props) {
    if (!password) return null;

    const { score, label, color, bg } = getPasswordStrength(password);

    return (
        <div className="mt-2 space-y-1.5">
            <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                    <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                            i <= score ? bg : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                    />
                ))}
            </div>
            {label && (
                <p className={`text-xs font-semibold ${color}`}>{label} password</p>
            )}
        </div>
    );
}
