import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Modal } from 'react-native';
import { router } from 'expo-router';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Suppress console error in production as requested
    }

    private handleOk = () => {
        this.setState({ hasError: false, error: null });
        // Navigate to settings and trigger report drawer
        router.push('/settings?openReport=true');
    };

    public render() {
        if (this.state.hasError) {
            return (
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    {this.props.children}
                    <Modal transparent visible={true} animationType="fade">
                        <View style={styles.overlay}>
                            <View style={styles.popup}>
                                <Text style={styles.errorText}>SOMETHING WENT WRONG</Text>
                                <View style={styles.btnRow}>
                                    <TouchableOpacity style={styles.okButton} onPress={this.handleOk}>
                                        <Text style={styles.okText}>REPORT</Text>
                                    </TouchableOpacity>
                                    <View style={styles.divider} />
                                    <TouchableOpacity style={styles.okButton} onPress={() => this.setState({ hasError: false, error: null })}>
                                        <Text style={[styles.okText, { color: '#666' }]}>SKIP</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </Modal>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    popup: {
        width: 180,
        backgroundColor: '#111',
        padding: 15,
        borderRadius: 4,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
        elevation: 10,
    },
    errorText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1,
        marginBottom: 15,
        textAlign: 'center',
    },
    okButton: {
        paddingHorizontal: 15,
        paddingVertical: 5,
    },
    okText: {
        color: '#FFCC00',
        fontSize: 11,
        fontWeight: 'bold',
    },
    btnRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    divider: {
        width: 1,
        height: 12,
        backgroundColor: '#333',
    }
});
