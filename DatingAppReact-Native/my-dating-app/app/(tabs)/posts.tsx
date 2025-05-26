import { View, Text, FlatList, StyleSheet } from 'react-native';

const mockPosts = [
    { id: '1', user: 'Friend 1', content: 'Having a great day!', date: '2025-05-26' },
    { id: '2', user: 'Friend 2', content: 'Just matched with someone awesome!', date: '2025-05-25' },
];

export default function PostsScreen() {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Posts from Matched Friends</Text>
            <FlatList
                data={mockPosts}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <View style={styles.post}>
                        <Text style={styles.postUser}>{item.user}</Text>
                        <Text style={styles.postContent}>{item.content}</Text>
                        <Text style={styles.postDate}>{item.date}</Text>
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
    post: {
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
    postUser: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    postContent: {
        fontSize: 14,
        marginVertical: 4,
    },
    postDate: {
        fontSize: 12,
        color: '#666',
    },
});