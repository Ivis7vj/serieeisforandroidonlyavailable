import React from 'react';
import { Pressable, Animated, PressableProps } from 'react-native';

interface ScalePressableProps extends PressableProps {
    children: React.ReactNode;
    scaleTo?: number;
}

export default function ScalePressable({ children, scaleTo = 0.95, ...props }: ScalePressableProps) {
    const scale = React.useRef(new Animated.Value(1)).current;

    const onPressIn = (e: any) => {
        Animated.spring(scale, {
            toValue: scaleTo,
            useNativeDriver: true,
        }).start();
        props.onPressIn?.(e);
    };

    const onPressOut = (e: any) => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
        }).start();
        props.onPressOut?.(e);
    };

    return (
        <Pressable {...props} onPressIn={onPressIn} onPressOut={onPressOut}>
            <Animated.View style={{ transform: [{ scale }] }}>
                {children}
            </Animated.View>
        </Pressable>
    );
}
