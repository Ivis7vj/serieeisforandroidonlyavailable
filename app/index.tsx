import { Redirect } from 'expo-router';

export default function Index() {
    // Immediate synchronous redirect ensures the app lands on the entry screen 
    // without waiting for root layout effect hook cycles, fixing the initial black screen.
    return <Redirect href="/(tabs)" />;
}
