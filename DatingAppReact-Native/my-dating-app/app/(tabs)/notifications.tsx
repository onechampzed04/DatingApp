import { View, Text, FlatList, StyleSheet } from 'react-native';

const mockNotifications = [
    { id: '1', message: 'Friend 1 liked your profile!', time: '10:30 AM' },
    { id: '2', message: 'You have a new match!', time: 'Yesterday' },
];

export default function NotificationsScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Notifications</Text>
            <FlatList
                data={mockNotifications}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={styles.notification}>
                        <Text style={styles.message}>{item.message}</Text>
                        <Text style={styles.time}>{item.time}</Text>
                    </View>
                )}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    notification: {
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    message: {
        fontSize: 14,
    },
    time: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },
});