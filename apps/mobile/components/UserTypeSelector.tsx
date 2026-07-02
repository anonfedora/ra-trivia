import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { CheckCircle, Circle } from 'lucide-react-native';

export type UserType = 
    | 'AMBASSADOR_RANK_EXAMS'
    | 'EXTRAORDINARY_RANK_EXAMS' 
    | 'PRE_PLENIPOTENTIARY_RANK_EXAMS'
    | 'PLENIPOTENTIARY_RANK_EXAMS';

interface UserTypeSelectorProps {
    value: UserType | null;
    onChange: (userType: UserType) => void;
    error?: string;
}

const userTypeOptions = [
    {
        value: 'AMBASSADOR_RANK_EXAMS' as UserType,
        label: 'Ambassador Rank Exams'
    },
    {
        value: 'EXTRAORDINARY_RANK_EXAMS' as UserType,
        label: 'Extraordinary Rank Exams'
    },
    {
        value: 'PRE_PLENIPOTENTIARY_RANK_EXAMS' as UserType,
        label: 'Pre-Plenipotentiary Exams'
    },
    {
        value: 'PLENIPOTENTIARY_RANK_EXAMS' as UserType,
        label: 'Plenipotentiary Rank Exams'
    }
];

export default function UserTypeSelector({ value, onChange, error }: UserTypeSelectorProps) {
    return (
        <View>
            <Text className="text-sm font-semibold text-slate-300 mb-3 ml-1">
                Examination Type
            </Text>
            <View className="space-y-3">
                {userTypeOptions.map((option) => (
                    <TouchableOpacity
                        key={option.value}
                        onPress={() => onChange(option.value)}
                        className={`p-5 rounded-2xl border ${
                            value === option.value
                                ? 'border-primary bg-primary/10'
                                : 'border-slate-800 bg-slate-900'
                        }`}
                    >
                        <View className="flex-row items-center justify-between">
                            <Text className={`font-bold text-base ${
                                value === option.value
                                    ? 'text-primary'
                                    : 'text-slate-50'
                            }`}>
                                {option.label}
                            </Text>
                            {value === option.value ? (
                                <CheckCircle size={24} color="#3b82f6" />
                            ) : (
                                <Circle size={24} color="#475569" />
                            )}
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
            {error && (
                <View className="mt-2 ml-1">
                    <Text className="text-rose-600 text-sm font-medium">{error}</Text>
                </View>
            )}
        </View>
    );
}