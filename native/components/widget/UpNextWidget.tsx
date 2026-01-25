import React from 'react';
import { FlexWidget, TextWidget, ImageWidget, SvgWidget } from 'react-native-android-widget';

interface UpNextWidgetProps {
    seriesName: string;
    episodeInfo: string;
    backdropUri?: string;
}

export function UpNextWidget({ seriesName, episodeInfo, backdropUri }: UpNextWidgetProps) {
    return (
        <FlexWidget
            style={{
                height: 'match_parent',
                width: 'match_parent',
                backgroundColor: '#111111',
                borderRadius: 22,
                flexDirection: 'row',
                alignItems: 'center',
                overflow: 'hidden',
                borderColor: '#222',
                borderWidth: 1.5
            }}
            clickAction="OPEN_APP"
        >
            {/* Left: Backdrop / Image */}
            <FlexWidget
                style={{
                    height: 'match_parent',
                    width: 140, // Fixed width for aspect ratio
                    backgroundColor: '#000'
                }}
                clickAction="OPEN_APP"
            >
                {backdropUri ? (
                    <ImageWidget
                        image={backdropUri as any}
                        imageWidth={300} // Higher res for sharpness
                        imageHeight={170}
                        style={{
                            height: 'match_parent',
                            width: 'match_parent'
                        }}
                    />
                ) : (
                    <FlexWidget
                        style={{
                            height: 'match_parent',
                            width: 'match_parent',
                            backgroundColor: '#1a1a1a',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <TextWidget
                            text="LETTERBOARD"
                            style={{
                                color: '#333',
                                fontSize: 10,
                                fontWeight: '900',
                                letterSpacing: 1
                            }}
                        />
                    </FlexWidget>
                )}

                {/* Gradient Overlay Simulation (since we cant do actual gradients easily, we use a semi-transparent black overlay on the right edge if needed, or just keep it clean) */}
            </FlexWidget>

            {/* Right: Info */}
            <FlexWidget
                style={{
                    flex: 1,
                    height: 'match_parent',
                    paddingHorizontal: 14,
                    justifyContent: 'center',
                    backgroundColor: '#111', // Match card bg
                }}
                clickAction="OPEN_APP"
            >
                <TextWidget
                    text={seriesName}
                    maxLines={1}
                    style={{
                        color: '#FFFFFF',
                        fontSize: 16,
                        fontWeight: 'bold',
                        letterSpacing: -0.5,
                    }}
                />
                <TextWidget
                    text={episodeInfo}
                    maxLines={1}
                    style={{
                        color: '#9A9A9A',
                        fontSize: 13,
                        fontWeight: '500',
                        marginTop: 3,
                    }}
                />

                {/* "UP NEXT" Label */}
                <FlexWidget
                    style={{
                        marginTop: 8,
                        flexDirection: 'row',
                        alignItems: 'center'
                    }}
                    clickAction="OPEN_APP"
                >
                    <TextWidget
                        text="UP NEXT"
                        style={{
                            color: '#666',
                            fontSize: 10,
                            fontWeight: 'bold',
                            letterSpacing: 0.5
                        }}
                    />
                    <TextWidget
                        text="• LIVE"
                        style={{
                            color: '#4CAF50',
                            fontSize: 10,
                            fontWeight: '900',
                            marginLeft: 6
                        }}
                    />
                </FlexWidget>
            </FlexWidget>
        </FlexWidget>
    );
}
