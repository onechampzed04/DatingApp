import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, ActivityIndicator, Modal,
  TouchableOpacity, Dimensions, ImageSourcePropType, Platform,
  InteractionManager,
} from 'react-native';
import Swiper from 'react-native-deck-swiper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { ColorValue } from 'react-native';

import {
  ApiUserCard,
  MatchedUserDetails,
  getUsersForSwiping,
  createSwipe,
  SwipeCreateDTO,
  SwipeMatchResponse,
  API_BASE_URL // Import từ utils/api.ts
} from '../../utils/api';

const { width, height } = Dimensions.get('window');
const FALLBACK_AVATAR: ImageSourcePropType = require('../../assets/images/dating-app.png');

const MAIN_GRADIENT_START = '#EA405A';
const MAIN_GRADIENT_END = '#f8f8f8';
const CARD_GRADIENT_COLORS: [ColorValue, ColorValue, ...ColorValue[]] = ['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.85)'];
const MATCH_MODAL_GRADIENT_COLORS: [ColorValue, ColorValue] = ['#FF6B6B', '#FF8E53'];

const INITIAL_PAGE_SIZE = 10;
const SUBSEQUENT_PAGE_SIZE = 5;
const LOAD_MORE_THRESHOLD_COUNT = 3;

export default function ExploreScreen() {
  const [allLoadedUsers, setAllLoadedUsers] = useState<ApiUserCard[]>([]);
  const [currentSwiperIndex, setCurrentSwiperIndex] = useState(0);

  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextPageToFetch, setNextPageToFetch] = useState(1);
  const [hasMoreDataInBackend, setHasMoreDataInBackend] = useState(true);

  const [loggedInUserId, setLoggedInUserId] = useState<number | null>(null);
  const [matchDetails, setMatchDetails] = useState<MatchedUserDetails | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);

  const swiperRef = useRef<Swiper<ApiUserCard>>(null);
  const isFetchingUsers = useRef(false);

  // 1. Lấy User ID khi component mount
  useEffect(() => {
    const fetchCurrentUserId = async () => {
      const userIdStr = await AsyncStorage.getItem('userId');
      if (userIdStr) {
        setLoggedInUserId(parseInt(userIdStr, 10));
      } else {
        console.error("ExploreScreen: Logged in User ID not found.");
        setIsLoadingInitial(false);
        setHasMoreDataInBackend(false);
      }
    };
    fetchCurrentUserId();
  }, []);

  // 2. Hàm tải User (useCallback)
  const fetchUsers = useCallback(async (page: number, isInitialLoad: boolean) => {
    if (isFetchingUsers.current || (!isInitialLoad && !hasMoreDataInBackend)) {
      if(!hasMoreDataInBackend && !isInitialLoad) console.log(`ExploreScreen: Fetch for page ${page} skipped, no more data and not initial.`);
      if(isFetchingUsers.current) console.log(`ExploreScreen: Fetch for page ${page} skipped, already fetching.`);
      return;
    }

    isFetchingUsers.current = true;
    if (isInitialLoad) setIsLoadingInitial(true);
    else setIsLoadingMore(true);

    console.log(`ExploreScreen: Fetching page ${page} (Initial: ${isInitialLoad}) with pageSize ${isInitialLoad ? INITIAL_PAGE_SIZE : SUBSEQUENT_PAGE_SIZE}`);
    try {
      const pageSizeToFetch = isInitialLoad ? INITIAL_PAGE_SIZE : SUBSEQUENT_PAGE_SIZE;
      const newUsers = await getUsersForSwiping({ pageNumber: page, pageSize: pageSizeToFetch });

      if (newUsers.length < pageSizeToFetch) {
        setHasMoreDataInBackend(false);
        console.log(`ExploreScreen: Fetched ${newUsers.length} users, less than pageSize ${pageSizeToFetch}. This is likely the last page.`);
      } else if (isInitialLoad && newUsers.length === pageSizeToFetch) {
        // If initial load and got full page, ensure hasMoreData is true
        setHasMoreDataInBackend(true);
      }
      // If newUsers.length === 0, and it's not the first page, setHasMoreDataInBackend was already handled by newUsers.length < pageSizeToFetch
      // If newUsers.length === 0 on the first page, it also means no more data.

      setAllLoadedUsers(prevUsers => {
        const existingUserIDs = new Set(prevUsers.map(u => u.userID));
        const uniqueNewUsers = newUsers.filter(u => !existingUserIDs.has(u.userID));
        const updatedUsers = (isInitialLoad) ? uniqueNewUsers : [...prevUsers, ...uniqueNewUsers];
        console.log(`ExploreScreen: Added ${uniqueNewUsers.length} new users. Total loaded: ${updatedUsers.length}. Initial load: ${isInitialLoad}`);
        return updatedUsers;
      });

      if (newUsers.length > 0) {
        setNextPageToFetch(page + 1);
      }

    } catch (error) {
      console.error("ExploreScreen: Failed to fetch users:", error);
    } finally {
      if (isInitialLoad) setIsLoadingInitial(false);
      else setIsLoadingMore(false);
      isFetchingUsers.current = false;
    }
  }, [hasMoreDataInBackend]); // Dependency: hasMoreDataInBackend. Others are stable or constants.

  // 3. Tải User lần đầu hoặc khi User ID thay đổi
  useEffect(() => {
    if (loggedInUserId !== null) {
      console.log(`ExploreScreen: UserID ${loggedInUserId} detected. Resetting and performing initial fetch.`);
      setAllLoadedUsers([]); // Reset
      setCurrentSwiperIndex(0); // Reset
      setNextPageToFetch(1); // Reset
      setHasMoreDataInBackend(true); // QUAN TRỌNG: Luôn reset thành true cho lần tải đầu của user mới
      isFetchingUsers.current = false; // Reset cờ
      // Gọi phiên bản fetchUsers hiện tại mà không đưa nó vào dependencies
      fetchUsers(1, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedInUserId]);// fetchUsers is a dependency here

  // 4. Xử lý Swipe và tăng index
  const handleSwipeActionAndAdvance = useCallback(async (swipedCardAbsoluteIndex: number, isLike: boolean, isSuperLike: boolean = false) => {
    if (!loggedInUserId || !allLoadedUsers[swipedCardAbsoluteIndex]) {
      console.warn(`ExploreScreen: Invalid swipe. UserID: ${loggedInUserId}, CardIndex: ${swipedCardAbsoluteIndex}`);
      return;
    }
    const swipedUser = allLoadedUsers[swipedCardAbsoluteIndex];
    console.log(`[SWIPE_ACTION] User: ${swipedUser.fullName} (absIndex: ${swipedCardAbsoluteIndex}), isLike: ${isLike}, isSuperLike: ${isSuperLike}`);

    const swipeData: SwipeCreateDTO = { toUserID: swipedUser.userID, isLike: isLike || isSuperLike };
    try {
      const response = await createSwipe(swipeData);
      if (response.isMatch && response.matchedWithUser) {
        setMatchDetails(response.matchedWithUser);
        setShowMatchModal(true);
      }
    } catch (error) {
      console.error("ExploreScreen: Error processing swipe:", error);
    }

    InteractionManager.runAfterInteractions(() => {
      setCurrentSwiperIndex(prevIndex => {
        console.log(`[SWIPE_ACTION] Advancing currentSwiperIndex from ${prevIndex} to ${swipedCardAbsoluteIndex + 1}`);
        return swipedCardAbsoluteIndex + 1;
      });
    });
  }, [loggedInUserId, allLoadedUsers]); // createSwipe, setMatchDetails, setShowMatchModal are stable from useState/import

  // 5. Logic tải thêm (Prefetching)
  useEffect(() => {
    const cardsLeftToSwipe = allLoadedUsers.length - currentSwiperIndex;
    if (!isLoadingInitial && !isLoadingMore && hasMoreDataInBackend && !isFetchingUsers.current) {
      if (cardsLeftToSwipe <= LOAD_MORE_THRESHOLD_COUNT && allLoadedUsers.length > 0) {
        console.log(`ExploreScreen: Prefetch threshold met (${cardsLeftToSwipe} <= ${LOAD_MORE_THRESHOLD_COUNT}), fetching page ${nextPageToFetch}.`);
        fetchUsers(nextPageToFetch, false);
      }
    }
  }, [currentSwiperIndex, allLoadedUsers.length, hasMoreDataInBackend, nextPageToFetch, fetchUsers, isLoadingInitial, isLoadingMore]);

  // 6. Render Card
  const renderCard = (userCard: ApiUserCard | undefined, indexWithinSwiperBatch: number): React.ReactElement | null => {
    if (!userCard) {
      return <View style={[styles.card, styles.cardPlaceholder]}><ActivityIndicator color="#fff" /></View>;
    }
    let finalCardAvatarUri: string | null = null;
    if (userCard.avatar) {
      if (userCard.avatar.startsWith('http://') || userCard.avatar.startsWith('https://') || userCard.avatar.startsWith('data:image')) {
        finalCardAvatarUri = userCard.avatar;
      } else {
        // Ensure API_BASE_URL is defined and avatar path is correctly prefixed if needed
        finalCardAvatarUri = `${API_BASE_URL}${userCard.avatar.startsWith('/') ? '' : '/'}${userCard.avatar}`;
      }
    }
    const imageSource: ImageSourcePropType = finalCardAvatarUri ? { uri: finalCardAvatarUri } : FALLBACK_AVATAR;
    return (
      <View style={styles.card} key={userCard.userID}>
        <Image
            source={imageSource}
            style={styles.cardImage}
            onError={(e) => console.warn(`Image load error for user ${userCard.userID} (${userCard.fullName}) with URI '${finalCardAvatarUri || userCard.avatar}': `, e.nativeEvent.error)}
            progressiveRenderingEnabled
            fadeDuration={0}
        />
        <LinearGradient colors={CARD_GRADIENT_COLORS} style={styles.cardGradient} />
        <View style={styles.cardUserInfoContainer}>
          <Text style={styles.cardName}>{userCard.fullName}{userCard.age !== null ? `, ${userCard.age}` : ''}</Text>
          <Text style={styles.cardSecondaryInfo}>Ready to discover!</Text>
        </View>
      </View>
    );
  };

  // --- UI Rendering ---
  if (isLoadingInitial && allLoadedUsers.length === 0 && loggedInUserId !== null) {
    return (
      <LinearGradient colors={[MAIN_GRADIENT_START, MAIN_GRADIENT_END]} style={styles.centered}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Finding people...</Text>
      </LinearGradient>
    );
  }

  const cardsForSwiper = allLoadedUsers.slice(currentSwiperIndex);

  return (
    <LinearGradient colors={[MAIN_GRADIENT_START, MAIN_GRADIENT_END]} style={styles.screenContainer}>
      {cardsForSwiper.length > 0 ? (
        <Swiper<ApiUserCard>
          key={`swiper-${loggedInUserId}-${allLoadedUsers.length > 0 ? allLoadedUsers[0].userID : 'empty'}-${currentSwiperIndex}`}
          ref={swiperRef}
          cards={cardsForSwiper}
          renderCard={renderCard}
          cardIndex={0}
          onSwipedLeft={(indexInSwiperArray) => handleSwipeActionAndAdvance(currentSwiperIndex + indexInSwiperArray, false)}
          onSwipedRight={(indexInSwiperArray) => handleSwipeActionAndAdvance(currentSwiperIndex + indexInSwiperArray, true)}
          onSwipedTop={(indexInSwiperArray) => handleSwipeActionAndAdvance(currentSwiperIndex + indexInSwiperArray, true, true)}
          onSwipedAll={() => {
            console.log('ExploreScreen: Swiped all cards in current Swiper batch.');
            if (!hasMoreDataInBackend && currentSwiperIndex >= allLoadedUsers.length && allLoadedUsers.length > 0) {
              console.log("ExploreScreen: All loaded users swiped, no more from backend.");
            }
          }}
          backgroundColor={'transparent'}
          stackSize={Math.min(3, cardsForSwiper.length)}
          infinite={false}
          animateCardOpacity
          animateOverlayLabelsOpacity
          cardVerticalMargin={height * 0.05}
          containerStyle={styles.swiperContainer}
          disableBottomSwipe
          overlayLabels={{
            left: { element: <View style={[styles.overlayLabelContainer, styles.overlayNope]}><Text style={styles.overlayLabelText}>NOPE</Text></View>, style: { wrapper: styles.overlayWrapper } },
            right: { element: <View style={[styles.overlayLabelContainer, styles.overlayLike]}><Text style={styles.overlayLabelText}>LIKE</Text></View>, style: { wrapper: styles.overlayWrapper } },
            top: { element: <View style={[styles.overlayLabelContainer, styles.overlaySuperLike]}><Text style={styles.overlayLabelText}>SUPER</Text></View>, style: { wrapper: styles.overlayWrapper } }
          }}
        />
      ) : (
        <View style={styles.centeredNoUsers}>
          {isLoadingInitial || isLoadingMore ? (
            <>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>
                {isLoadingInitial ? "Finding people..." : (isLoadingMore ? "Loading more..." : "Preparing cards...")}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.noUsersText}>No more profiles right now. 😢</Text>
              <Text style={styles.subNoUsersText}>Check back later!</Text>
              {allLoadedUsers.length > 0 && !hasMoreDataInBackend && currentSwiperIndex >= allLoadedUsers.length && (
                 <TouchableOpacity onPress={() => {
                    console.log("Manual restart deck: Resetting currentSwiperIndex to 0.");
                    setCurrentSwiperIndex(0);
                 }} style={styles.restartButton}>
                   <Text style={styles.restartButtonText}>Restart Deck</Text>
                 </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      {cardsForSwiper.length > 0 && (
        <View style={styles.actionButtonsContainer}>
           <TouchableOpacity style={styles.actionButtonSmall} onPress={() => swiperRef.current?.swipeLeft()}>
              <Text style={[styles.actionIcon, styles.actionIconX]}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButtonLarge} onPress={() => swiperRef.current?.swipeTop()}>
              <Text style={[styles.actionIcon, styles.actionIconStar]}>★</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButtonSmall} onPress={() => swiperRef.current?.swipeRight()}>
              <Text style={[styles.actionIcon, styles.actionIconHeartSimple]}>♥</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={showMatchModal}
        onRequestClose={() => setShowMatchModal(false)}
      >
        <View style={styles.centeredModal}>
          <LinearGradient colors={MATCH_MODAL_GRADIENT_COLORS} style={styles.modalView}>
            <Text style={styles.matchTitle}>It's a Match! 🎉</Text>
            {matchDetails && (
              <>
                <Image
                  source={
                    matchDetails.avatar && (matchDetails.avatar.startsWith('http') || matchDetails.avatar.startsWith('data:image'))
                      ? { uri: matchDetails.avatar }
                      : (matchDetails.avatar ? {uri: `${API_BASE_URL}${matchDetails.avatar.startsWith('/') ? '' : '/'}${matchDetails.avatar}`} : FALLBACK_AVATAR)
                  }
                  style={styles.matchAvatar}
                  onError={() => console.warn("Error loading match avatar: ", matchDetails.avatar)}
                />
                <Text style={styles.matchName}>
                  You and {matchDetails.fullName}
                  {matchDetails.age !== null ? ` (${matchDetails.age})` : ''}
                  liked each other!
                </Text>
              </>
            )}
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowMatchModal(false)}
            >
              <Text style={styles.modalButtonText}>Keep Swiping</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 10, fontSize: 16 },
  centeredNoUsers: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  noUsersText: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, color: '#fff' },
  subNoUsersText: { color: '#eee', textAlign: 'center', fontSize: 15 },
  swiperContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', zIndex: 1, backgroundColor: 'transparent'},
  card: {
    width: width * 0.9,
    height: height * 0.70,
    borderRadius: 20,
    backgroundColor: '#555',
    overflow: 'hidden',
    elevation: Platform.OS === 'android' ? 5 : 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  cardPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(85,85,85,0.7)'},
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%' },
  cardUserInfoContainer: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  cardName: { fontSize: 26, fontWeight: 'bold', color: 'white', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width:1, height:1}, textShadowRadius:3},
  cardSecondaryInfo: { fontSize: 16, color: 'rgba(255,255,255,0.9)', marginTop: 5, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width:1, height:1}, textShadowRadius:2},
  actionButtonsContainer: { flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center', position: 'absolute', bottom: Platform.OS === 'ios' ? 35 : 25, left: 0, right: 0, paddingHorizontal: 20, height: 80, zIndex: 10 },
  overlayLabelContainer: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 3, justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '-20deg' }] },
  overlayLabelText: { fontSize: 38, fontWeight: 'bold', color: 'white', textTransform: 'uppercase' },
  overlayNope: { borderColor: '#E74C3C', backgroundColor: 'rgba(231, 76, 60, 0.2)' },
  overlayLike: { borderColor: '#2ECC71', backgroundColor: 'rgba(46, 204, 113, 0.2)' },
  overlaySuperLike: { borderColor: '#3498DB', backgroundColor: 'rgba(52, 152, 219, 0.2)' },
  overlayWrapper: { position: 'absolute', top: height * 0.2, width: '100%', alignItems: 'center' },
  actionButtonSmall: { width: 65, height: 65, borderRadius: 32.5, backgroundColor: 'rgba(255,255,255,0.95)', justifyContent: 'center', alignItems: 'center', elevation: 7, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, marginHorizontal: 10 },
  actionButtonLarge: { width: 75, height: 75, borderRadius: 37.5, backgroundColor: 'rgba(255,255,255,0.95)', justifyContent: 'center', alignItems: 'center', elevation: 9, shadowColor: '#8c7ae6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  actionIcon: { fontSize: 32 },
  actionIconX: { color: '#E74C3C', fontWeight: 'bold' },
  actionIconHeartSimple: { color: '#2ECC71', fontSize: 30 },
  actionIconStar: { color: '#8c7ae6', fontSize: 36 },
  centeredModal: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.75)' },
  modalView: { borderRadius: 20, paddingVertical: 30, paddingHorizontal: 25, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5, width: width * 0.85, maxHeight: height * 0.7 },
  matchTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 20, color: 'white', textAlign: 'center' },
  matchAvatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 20, borderWidth: 4, borderColor: 'white' },
  matchName: { fontSize: 20, fontWeight: '600', textAlign: 'center', marginBottom: 25, color: 'white' },
  modalButton: { backgroundColor: 'white', borderRadius: 25, paddingVertical: 12, paddingHorizontal: 30, elevation: 2 },
  modalButtonText: { color: MATCH_MODAL_GRADIENT_COLORS[0] || '#FF6B6B', fontWeight: 'bold', textAlign: 'center', fontSize: 16 },
  restartButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  restartButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});