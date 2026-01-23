import React from 'react';
import { Pressable, Text, ActivityIndicator, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ThemedButtonProps {
    onPress: () => void;
    title: string;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    loading?: boolean;
    disabled?: boolean;
    className?: string;
    icon?: React.ReactNode;
}

export function ThemedButton({
    onPress,
    title,
    variant = 'primary',
    loading = false,
    disabled = false,
    className = '',
    icon,
}: ThemedButtonProps) {
    const colorScheme = useColorScheme() ?? 'dark';
    const theme = Colors[colorScheme];

    const getVariantStyles = () => {
        switch (variant) {
            case 'primary':
                return 'bg-[#FFCC00]'; // Accent Color
            case 'secondary':
                return 'bg-[#222222]'; // Tertiary Background
            case 'outline':
                return 'bg-transparent border border-[#333333]';
            case 'ghost':
                return 'bg-transparent';
            default:
                return 'bg-[#FFCC00]';
        }
    };

    const getTextColor = () => {
        if (disabled) return 'text-gray-500';
        if (variant === 'primary') return 'text-black';
        return 'text-white';
    };

    return (
        <Pressable
            onPress={onPress}
            disabled={disabled || loading}
            style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.94 : 1 }],
                opacity: disabled ? 0.5 : (pressed ? 0.8 : 1),
            })}
            className={`min-h-[48px] px-6 rounded-full flex-row items-center justify-center ${getVariantStyles()} ${className}`}
        >
            {loading ? (
                <ActivityIndicator color={variant === 'primary' ? 'black' : 'white'} />
            ) : (
                <View className="flex-row items-center">
                    {icon && <View className="mr-2">{icon}</View>}
                    <Text className={`text-base font-bold ${getTextColor()}`}>
                        {title}
                    </Text>
                </View>
            )}
        </Pressable>
    );
}
