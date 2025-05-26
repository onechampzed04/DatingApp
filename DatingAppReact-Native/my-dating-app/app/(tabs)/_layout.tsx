import { Redirect, Slot, usePathname } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Platform } from 'react-native'; // Thêm Platform
import { Ionicons } from '@expo/vector-icons';
import { getUserByEmail } from '../../utils/api'; // Đảm bảo đường dẫn này chính xác
import { useRouter } from 'expo-router';

type TabConfig = {
    readonly name: 'posts' | 'messages' | 'explore' | 'notifications' | 'profile';
    readonly label: string;
    readonly iconSet: {
        readonly active: keyof typeof Ionicons.glyphMap;
        readonly inactive: keyof typeof Ionicons.glyphMap;
    };
    readonly isSpecial?: boolean;
};

const PRIMARY_COLOR = '#EA405A';
const INACTIVE_COLOR = '#A0A0A0'; // Màu xám nhẹ hơn cho tab không hoạt động
const BACKGROUND_COLOR = '#FFFFFF';

// Helper để lấy tên icon dựa trên tab và trạng thái active (Hiện không dùng trực tiếp trong map nhưng có thể hữu ích)
const getIconName = (tabName: string, isActive: boolean): keyof typeof Ionicons.glyphMap => {
    switch (tabName) {
        case 'posts':
            return isActive ? 'document-text' : 'document-text-outline';
        case 'messages':
            return isActive ? 'chatbubbles' : 'chatbubbles-outline';
        case 'explore':
            return isActive ? 'heart' : 'heart-outline';
        case 'notifications':
            return isActive ? 'notifications' : 'notifications-outline';
        case 'profile':
            return isActive ? 'person' : 'person-outline';
        default:
            return 'alert-circle-outline'; // Icon mặc định nếu có lỗi
    }
};

export default function TabsLayout() {
    const { user } = useAuth();
    const pathname = usePathname();
    const [isVerified, setIsVerified] = useState<boolean | null>(null);
    const router = useRouter();
    // Thêm thông tin label cho từng tab
    const tabs: readonly TabConfig[] = [
        { name: 'posts', label: 'Bài viết', iconSet: { active: 'document-text', inactive: 'document-text-outline'} },
        { name: 'messages', label: 'Tin nhắn', iconSet: { active: 'chatbubbles', inactive: 'chatbubbles-outline'} },
        { name: 'explore', label: 'Khám phá', iconSet: { active: 'heart', inactive: 'heart-outline'}, isSpecial: true }, // Đánh dấu tab explore đặc biệt
        { name: 'notifications', label: 'Thông báo', iconSet: { active: 'notifications', inactive: 'notifications-outline'} },
        { name: 'profile', label: 'Cá nhân', iconSet: { active: 'person', inactive: 'person-outline'} },
    ];

    useEffect(() => {
        const checkVerify = async () => {
            if (user) {
                try {
                    const fullUser = await getUserByEmail(user.email);
                    setIsVerified(fullUser?.isEmailVerified ?? false);
                } catch (err) {
                    console.error('Lỗi kiểm tra email xác thực:', err);
                    setIsVerified(false); // Nên đặt giá trị mặc định nếu có lỗi
                }
            }
        };

        checkVerify();
    }, [user]);

    if (!user) {
        return <Redirect href="/(auth)/login" />;
    }

    if (isVerified === false && pathname !== '/(auth)/otp') {
        return <Redirect href={{ pathname: '/(auth)/otp', params: { email: user.email } }} />;
    }

    if (isVerified === null) {
        return <View style={styles.loadingContainer}><Text>Đang tải...</Text></View>; // Hiển thị gì đó khi đang tải
    }

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Slot />
            </View>

            <View style={styles.footer}>
                {tabs.map((tabInfo) => {
                    const isActive = pathname.includes(`/${tabInfo.name}`); // Kiểm tra active chính xác hơn
                    const iconSize = tabInfo.isSpecial ? 38 : 26; // Kích thước icon cho tab explore và các tab khác
                    const iconColorForNonSpecial = isActive ? PRIMARY_COLOR : INACTIVE_COLOR; // Đổi tên biến để rõ ràng hơn

                    return (
                        <TouchableOpacity
                            key={tabInfo.name}
                            onPress={() => router.replace(`/(tabs)/${tabInfo.name}` as any)}
                            style={[
                                styles.tabItem,
                                tabInfo.isSpecial && styles.exploreTabWrapper, // Style cho wrapper của explore tab
                            ]}
                            activeOpacity={0.7} // Thêm activeOpacity để có phản hồi khi nhấn
                        >
                            <View style={[
                                styles.tabIconContainer,
                                tabInfo.isSpecial && styles.exploreTab,
                            ]}>
                                <Ionicons
                                    name={isActive ? tabInfo.iconSet.active : tabInfo.iconSet.inactive}
                                    size={iconSize}
                                    // === THAY ĐỔI Ở ĐÂY ===
                                    color={tabInfo.isSpecial ? BACKGROUND_COLOR : iconColorForNonSpecial} 
                                    // =======================
                                />
                            </View>
                            {(!tabInfo.isSpecial || (tabInfo.isSpecial && isActive)) && (
                               <Text style={[
                                   styles.tabLabel,
                                   // Đối với label của tab explore khi active, màu sẽ được quyết định bởi activeTabLabel (PRIMARY_COLOR)
                                   // Đối với label của các tab khác, màu sẽ là iconColorForNonSpecial
                                   { color: tabInfo.isSpecial ? (isActive ? PRIMARY_COLOR : INACTIVE_COLOR) : iconColorForNonSpecial },
                                   isActive && styles.activeTabLabel,
                                   tabInfo.isSpecial && styles.exploreLabel 
                               ]}>
                                   {tabInfo.label}
                               </Text>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    loadingContainer: { // Style cho màn hình chờ
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: BACKGROUND_COLOR,
    },
    container: {
        flex: 1,
        backgroundColor: BACKGROUND_COLOR, // Đặt màu nền chung cho container
    },
    content: {
        flex: 1,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'flex-end', // Căn các item xuống dưới để explore tab có không gian "nổi" lên
        paddingVertical: Platform.OS === 'ios' ? 15 : 8, // Tăng padding cho iOS vì có thể bị che
        paddingBottom: Platform.OS === 'ios' ? 30 : 8, // Thêm padding bottom cho iOS
        backgroundColor: BACKGROUND_COLOR,
        borderTopWidth: 1,
        borderColor: '#EEEEEE', // Màu viền nhẹ nhàng hơn
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
        elevation: 8, // Tăng elevation một chút
        zIndex: 100,
    },
    tabItem: {
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        paddingVertical: 5, // Thêm chút padding cho mỗi item
    },
    tabIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 5, // Padding xung quanh icon
    },
    exploreTabWrapper: { // Wrapper để giúp định vị explore tab
        flex: 1.1, // Cho explore tab rộng hơn một chút nếu muốn
        alignItems: 'center', // Cần thiết để exploreTab ở giữa
    },
    exploreTab: {
        backgroundColor: PRIMARY_COLOR, // Màu nền chính cho nút explore
        width: 60,
        height: 60,
        borderRadius: 30, // Bo tròn hoàn hảo
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: -35, // Nâng tab explore lên trên, điều chỉnh cho phù hợp
        shadowColor: PRIMARY_COLOR, // Bóng cùng màu với nút để tạo hiệu ứng "glow" nhẹ
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
        elevation: 10, // Elevation cao hơn để nổi bật
        zIndex: 1, // Đảm bảo nó nổi lên trên
    },
    activeTabBackground: { // Nếu muốn có nền cho tab active (không phải explore)
        backgroundColor: `${PRIMARY_COLOR}20`, // Màu chủ đạo với độ mờ
        borderRadius: 15,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    tabLabel: {
        fontSize: 10, // Giảm kích thước font một chút
        marginTop: 3, // Khoảng cách từ icon đến label
        fontWeight: '500', // Độ đậm vừa phải
    },
    activeTabLabel: {
        fontWeight: '700', // Đậm hơn cho label active
        color: PRIMARY_COLOR, // Màu chủ đạo cho label active
    },
    exploreLabel: { // Nếu muốn style riêng cho label của explore
        marginTop: 5, // Label của explore tab sẽ cách icon một khoảng lớn hơn một chút do icon được nâng lên
        fontSize: 11,
        // color: PRIMARY_COLOR, // Màu của label explore khi active đã được activeTabLabel xử lý
    }
});