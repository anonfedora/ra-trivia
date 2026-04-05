import React from 'react';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TestStyles() {
    return (
        <SafeAreaView className="flex-1 bg-red-500 items-center justify-center">
            <View className="bg-blue-500 p-10 rounded-3xl shadow-2xl">
                <Text className="text-white text-3xl font-black">
                    If this is Blue, Tailwind works!
                </Text>
            </View>
        </SafeAreaView>
    );
}
