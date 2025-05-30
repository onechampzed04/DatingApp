import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Image, ActivityIndicator, Modal,
  TouchableOpacity, Dimensions, ImageSourcePropType, Platform,
  InteractionManager, Pressable,
} from 'react-native';
import Swiper from 'react-native-deck-swiper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { ColorValue } from 'react-native';
import { FontAwesome } from '@expo/vector-icons'; // Import FontAwesome
import { useRouter, useLocalSearchParams } from 'expo-router'; // Import useRouter and useLocalSearchParams

import {
  ApiUserCard,
  MatchedUserDetails,
  getUsersForSwiping,
  createSwipe,
  SwipeCreateDTO,
  SwipeMatchResponse,
  API_BASE_URL, // Import từ utils/api.ts
  UserFilters, // Import UserFilters
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
  const router = useRouter();
  const params = useLocalSearchParams();

  const [allLoadedUsers, setAllLoadedUsers] = useState<ApiUserCard[]>([]);
  const [currentSwiperIndex, setCurrentSwiperIndex] = useState(0);

  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextPageToFetch, setNextPageToFetch] = useState(1);
  const [hasMoreDataInBackend, setHasMoreDataInBackend] = useState(true);

  const [loggedInUserId, setLoggedInUserId] = useState<number | null>(null);
  const [matchDetails, setMatchDetails] = useState<MatchedUserDetails | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);

  const [activeFilters, setActiveFilters] = useState<UserFilters | null>(null);
  const [initialFetchProcessed, setInitialFetchProcessed] = useState(false); // Renamed and will be used to control the single initial fetch

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
        setIsLoadingInitial(false); // Stop loading if no user ID
        setHasMoreDataInBackend(false); // No data to fetch
      }
    };
    fetchCurrentUserId();
  }, []);


  // 2. Hàm tải User (useCallback)
  const fetchUsers = useCallback(async (page: number, isInitialLoad: boolean, filtersToApply: UserFilters | null = activeFilters) => {
    if (isFetchingUsers.current || (!isInitialLoad && !hasMoreDataInBackend)) {
      if (!hasMoreDataInBackend && !isInitialLoad) console.log(`ExploreScreen: Fetch for page ${page} skipped, no more data and not initial.`);
      if (isFetchingUsers.current) console.log(`ExploreScreen: Fetch for page ${page} skipped, already fetching.`);
      return;
    }

    isFetchingUsers.current = true;
    if (isInitialLoad) setIsLoadingInitial(true);
    else setIsLoadingMore(true);

    console.log(`ExploreScreen: Fetching page ${page} (Initial: ${isInitialLoad}) with pageSize ${isInitialLoad ? INITIAL_PAGE_SIZE : SUBSEQUENT_PAGE_SIZE}. Filters:`, filtersToApply);
    try {
      const pageSizeToFetch = isInitialLoad ? INITIAL_PAGE_SIZE : SUBSEQUENT_PAGE_SIZE;
      const newUsers = await getUsersForSwiping({ pageNumber: page, pageSize: pageSizeToFetch, filters: filtersToApply || undefined });

      if (newUsers.length < pageSizeToFetch) {
        setHasMoreDataInBackend(false);
        console.log(`ExploreScreen: Fetched ${newUsers.length} users, less than pageSize ${pageSizeToFetch}. This is likely the last page with current filters.`);
      } else {
        // If we get a full page, assume there might be more.
        // This will be corrected if the next fetch returns less than pageSize.
        setHasMoreDataInBackend(true);
      }


      setAllLoadedUsers(prevUsers => {
        const existingUserIDs = new Set(prevUsers.map(u => u.userID));
        const uniqueNewUsers = newUsers.filter(u => !existingUserIDs.has(u.userID));
        // If it's an initial load (e.g., after applying filters or first app load),
        // replace the user list. Otherwise, append.
        const updatedUsers = (isInitialLoad) ? uniqueNewUsers : [...prevUsers, ...uniqueNewUsers];
        console.log(`ExploreScreen: Added ${uniqueNewUsers.length} new users. Total loaded: ${updatedUsers.length}. Initial load: ${isInitialLoad}`);
        return updatedUsers;
      });

      if (newUsers.length > 0) {
        setNextPageToFetch(page + 1);
      }

    } catch (error) {
      console.error("ExploreScreen: Failed to fetch users:", error);
      // Potentially set an error state here to show to the user
    } finally {
      if (isInitialLoad) setIsLoadingInitial(false);
      else setIsLoadingMore(false);
      isFetchingUsers.current = false;
    }
  }, [hasMoreDataInBackend, activeFilters]); // Added activeFilters

  // Effect for when loggedInUserId is first available or changes (e.g. re-login)
  useEffect(() => {
    if (loggedInUserId !== null) {
      console.log(`ExploreScreen: UserID ${loggedInUserId} available/changed. Resetting states for new session or initial fetch.`);
      // Reset all relevant states for a new user session or a fresh start
      setAllLoadedUsers([]);
      setCurrentSwiperIndex(0);
      setNextPageToFetch(1);
      setHasMoreDataInBackend(true);
      isFetchingUsers.current = false;
      setActiveFilters(null); // Clear any previous filters

      // Crucially, reset the processing flag for the main fetch effect, allowing it to run
      setInitialFetchProcessed(false);

      // If there are filters in params from a previous navigation, they will be cleared by router.setParams
      // or handled by the next effect if it's a fresh deep link.
      // It's important that this effect runs and resets initialFetchProcessed BEFORE the next effect might run.
      if (params.filters) {
        // Clear params.filters so the next effect doesn't re-use old stale params after a user change.
        // This is a bit of a workaround for router state persisting across user sessions.
        // A better solution might involve a global state reset on logout/login.
        // For now, this helps ensure the params effect evaluates fresh conditions.
        // router.setParams({ filters: undefined } as any); // This might cause a re-render and re-run of the params effect.
        // Let's rely on initialFetchProcessed primarily.
      }
    }
  }, [loggedInUserId]); // Only depends on loggedInUserId


  // Main effect to handle initial data load (with or without filters from params) and filter changes from params
  useEffect(() => {
    if (loggedInUserId === null) {
      return; // Wait for user ID
    }

    let filtersToApplyOnThisRun: UserFilters | null = null;
    let performFetch = false;

    if (params.filters && typeof params.filters === 'string') {
      // Filters are present in params
      try {
        const parsedFilters = JSON.parse(params.filters) as UserFilters;
        console.log("ExploreScreen: Filters found in params:", parsedFilters);
        // Check if these filters are different from current activeFilters or if initial fetch hasn't happened
        if (JSON.stringify(parsedFilters) !== JSON.stringify(activeFilters) || !initialFetchProcessed) {
          filtersToApplyOnThisRun = parsedFilters;
          setActiveFilters(parsedFilters); // Update activeFilters state
          performFetch = true;
          console.log("ExploreScreen: Applying new filters from params or first time with params.");
        } else {
          console.log("ExploreScreen: Filters in params are same as active, no new fetch needed based on params alone unless initial not processed.");
          if (!initialFetchProcessed) { // If params are same but initial fetch wasn't done (e.g. app start with params)
            filtersToApplyOnThisRun = parsedFilters; // or activeFilters, they are the same
            performFetch = true;
          }
        }
      } catch (e) {
        console.error("ExploreScreen: Failed to parse filters from params:", e);
        // Fallback: if parsing fails, and different from current active (which might be null) or initial not done
        if (activeFilters !== null || !initialFetchProcessed) {
          filtersToApplyOnThisRun = null;
          setActiveFilters(null);
          performFetch = true;
          console.log("ExploreScreen: Error parsing filters, falling back to no filters.");
        }
      }
    } else if (!params.filters && !initialFetchProcessed) {
      // No filters in params, and initial fetch for this session hasn't been processed
      console.log("ExploreScreen: No filters in params and initial fetch not processed. Performing clean initial fetch.");
      filtersToApplyOnThisRun = null;
      setActiveFilters(null); // Ensure activeFilters is null
      performFetch = true;
    }

    if (performFetch) {
      console.log("ExploreScreen: Preparing to fetch users. Resetting list for initial load type.", filtersToApplyOnThisRun);
      setAllLoadedUsers([]); // Clear list for a fresh load/filter application
      setCurrentSwiperIndex(0);
      setNextPageToFetch(1);
      setHasMoreDataInBackend(true);
      isFetchingUsers.current = false;

      fetchUsers(1, true, filtersToApplyOnThisRun); // isInitialLoad is true
      setInitialFetchProcessed(true); // Mark that the initial fetch for this session/param-set has been initiated
    }

  }, [loggedInUserId, params, fetchUsers, activeFilters, initialFetchProcessed]); // Dependencies carefully chosen


  // 4. Xử lý Swipe và tăng index
  const handleSwipeActionAndAdvance = useCallback(async (swipedCardAbsoluteIndex: number, isLike: boolean, isSuperLike: boolean = false) => {
    // Ensure that the index is valid for the *currently displayed* batch in the swiper
    // which is `cardsForSwiper`. The `swipedCardAbsoluteIndex` here is actually the
    // index within the `cardsForSwiper` array.
    const actualUserArrayIndex = currentSwiperIndex + swipedCardAbsoluteIndex;

    if (!loggedInUserId || !allLoadedUsers[actualUserArrayIndex]) {
      console.warn(`ExploreScreen: Invalid swipe. UserID: ${loggedInUserId}, CardIndex (absolute): ${actualUserArrayIndex}, SwiperIndex: ${swipedCardAbsoluteIndex}`);
      return;
    }
    const swipedUser = allLoadedUsers[actualUserArrayIndex];
    console.log(`[SWIPE_ACTION] User: ${swipedUser.fullName} (absIndex: ${actualUserArrayIndex}), isLike: ${isLike}, isSuperLike: ${isSuperLike}`);

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
        const newIndex = actualUserArrayIndex + 1;
        console.log(`[SWIPE_ACTION] Advancing currentSwiperIndex from ${prevIndex} to ${newIndex}`);
        return newIndex;
      });
    });
  }, [loggedInUserId, allLoadedUsers, currentSwiperIndex]); // Added currentSwiperIndex

  // 5. Logic tải thêm (Prefetching)
  useEffect(() => {
    const cardsLeftToSwipe = allLoadedUsers.length - currentSwiperIndex;
    if (!isLoadingInitial && !isLoadingMore && hasMoreDataInBackend && !isFetchingUsers.current) {
      if (cardsLeftToSwipe <= LOAD_MORE_THRESHOLD_COUNT && allLoadedUsers.length > 0) {
        console.log(`ExploreScreen: Prefetch threshold met (${cardsLeftToSwipe} <= ${LOAD_MORE_THRESHOLD_COUNT}), fetching page ${nextPageToFetch} with filters:`, activeFilters);
        fetchUsers(nextPageToFetch, false, activeFilters);
      }
    }
  }, [currentSwiperIndex, allLoadedUsers.length, hasMoreDataInBackend, nextPageToFetch, fetchUsers, isLoadingInitial, isLoadingMore, activeFilters]); // Added activeFilters

  // 6. Render Card
  const renderCard = (userCard: ApiUserCard | undefined, _indexWithinSwiperBatch: number): React.ReactElement | null => {
    if (!userCard) {
      // This case should ideally not happen if cardsForSwiper is managed correctly
      return <View style={[styles.card, styles.cardPlaceholder]}><ActivityIndicator color="#fff" /></View>;
    }

    let finalCardAvatarUri: string | null = null;
    if (userCard.avatar) {
      if (userCard.avatar.startsWith('http://') || userCard.avatar.startsWith('https://') || userCard.avatar.startsWith('data:image')) {
        finalCardAvatarUri = userCard.avatar;
      } else {
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
          fadeDuration={0} // Consider removing or adjusting for performance on image load
        />
        <LinearGradient colors={CARD_GRADIENT_COLORS} style={styles.cardGradient} />
        <View style={styles.cardUserInfoContainer}>
          <Text style={styles.cardName}>{userCard.fullName}{userCard.age !== null ? `, ${userCard.age}` : ''}</Text>
          {/* TODO: Add more relevant info like distance or interests if available and filtered */}
          <Text style={styles.cardSecondaryInfo}>
            {userCard.city || 'Somewhere lovely'}
            {activeFilters?.distance && userCard.distance ? ` - ${userCard.distance.toFixed(1)}km away` : ''}
          </Text>
        </View>
      </View>
    );
  };


  // --- UI Rendering ---
  if (isLoadingInitial && allLoadedUsers.length === 0 && loggedInUserId !== null && !params.filters) {
    // Show initial loading only if not coming back from filters screen (which would set params.filters)
    return (
      <LinearGradient colors={[MAIN_GRADIENT_START, MAIN_GRADIENT_END]} style={styles.centered}>
        <ActivityIndicator size="large" color="#fff" />
        <Text style={styles.loadingText}>Finding people...</Text>
      </LinearGradient>
    );
  }

  // `cardsForSwiper` should only contain users from `currentSwiperIndex` onwards.
  const cardsForSwiper = allLoadedUsers.slice(currentSwiperIndex);


  return (
    <LinearGradient colors={[MAIN_GRADIENT_START, MAIN_GRADIENT_END]} style={styles.screenContainer}>
      <View style={styles.headerContainer}>
        {cardsForSwiper.length > 0 && allLoadedUsers[currentSwiperIndex] ? (
          <Pressable 
            onPress={() => {
              const currentUserCard = allLoadedUsers[currentSwiperIndex];
              if (currentUserCard) {
                router.push(`/(tabs)/user-profile/${currentUserCard.userID}`);
              }
            }} 
            style={styles.headerIconLeft}
          >
            <FontAwesome name="info-circle" size={22} color="white" />
          </Pressable>
        ) : (
          <View style={styles.headerIconLeftPlaceholder} /> // Placeholder to keep layout consistent
        )}
        <View style={{ flex: 1 }} /> 
        <Pressable onPress={() => router.push('/filters')} style={styles.filterButton}>
          <FontAwesome name="filter" size={20} color="white" /> 
        </Pressable>
      </View>

      {cardsForSwiper.length > 0 ? (
        <Swiper<ApiUserCard>
          // Regenerate key when filters change to force re-render of Swiper with new cards
          key={`swiper-${loggedInUserId}-${activeFilters ? JSON.stringify(activeFilters) : 'no-filters'}-${currentSwiperIndex}`}
          ref={swiperRef}
          cards={cardsForSwiper} // Pass only the remaining cards
          renderCard={renderCard}
          cardIndex={0} // Swiper always starts from index 0 of the `cards` prop
          onSwipedLeft={(indexInSwiperArray) => handleSwipeActionAndAdvance(indexInSwiperArray, false)}
          onSwipedRight={(indexInSwiperArray) => handleSwipeActionAndAdvance(indexInSwiperArray, true)}
          // onSwipedTop={(indexInSwiperArray) => handleSwipeActionAndAdvance(indexInSwiperArray, true, true)} // Superlike removed
          onSwipedAll={() => {
            console.log('ExploreScreen: Swiped all cards in current Swiper batch.');
            // This condition means all *loaded* users (matching current filters) have been swiped
            // and the backend confirmed no more data for these filters.
            if (!hasMoreDataInBackend && currentSwiperIndex >= allLoadedUsers.length && allLoadedUsers.length > 0) {
              console.log("ExploreScreen: All loaded users swiped, no more from backend for current filters.");
            }
            // If there might be more data, the prefetching logic should handle it.
            // If !hasMoreDataInBackend is false, it means we might still fetch more.
          }}
          backgroundColor={'transparent'}
          stackSize={Math.min(3, cardsForSwiper.length)} // Adjust stack size based on available cards
          infinite={false} // Important: set to false as we manage data fetching
          animateCardOpacity
          animateOverlayLabelsOpacity
          cardVerticalMargin={height * 0.035} // Reduced to push card slightly down and give more space
          containerStyle={styles.swiperContainer}
          disableBottomSwipe // Keep this if you don't have a bottom swipe action
          disableTopSwipe // Disable top swipe since superlike is removed
          overlayLabels={{
            left: { element: <View style={[styles.overlayLabelContainer, styles.overlayNope]}><Text style={styles.overlayLabelText}>NOPE</Text></View>, style: { wrapper: styles.overlayWrapper } },
            right: { element: <View style={[styles.overlayLabelContainer, styles.overlayLike]}><Text style={styles.overlayLabelText}>LIKE</Text></View>, style: { wrapper: styles.overlayWrapper } },
            // top: { element: <View style={[styles.overlayLabelContainer, styles.overlaySuperLike]}><Text style={styles.overlayLabelText}>SUPER</Text></View>, style: { wrapper: styles.overlayWrapper } } // Superlike overlay removed
          }}
        />
      ) : (
        <View style={styles.centeredNoUsers}>
          {isLoadingInitial || isLoadingMore ? ( // Show loading if actively fetching
            <>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.loadingText}>
                {isLoadingInitial && !activeFilters ? "Finding people..." : (isLoadingMore ? "Loading more..." : (activeFilters ? "Applying filters..." : "Preparing cards..."))}
              </Text>
            </>
          ) : (
            // This block shows when not loading AND no cards to show
            <>
              <Text style={styles.noUsersText}>
                {activeFilters ? "No one matches your filters right now. 😢" : "No more profiles right now. 😢"}
              </Text>
              <Text style={styles.subNoUsersText}>
                {activeFilters ? "Try adjusting your filters or check back later!" : "Check back later!"}
              </Text>
              {/* Show restart deck button only if all users (for current filters) were swiped and no more from backend */}
              {allLoadedUsers.length > 0 && !hasMoreDataInBackend && currentSwiperIndex >= allLoadedUsers.length && (
                <TouchableOpacity onPress={() => {
                  console.log("Manual restart deck: Resetting currentSwiperIndex to 0.");
                  // This will re-render the swiper with the same set of `allLoadedUsers` from the beginning
                  setCurrentSwiperIndex(0);
                }} style={styles.restartButton}>
                  <Text style={styles.restartButtonText}>Restart Deck</Text>
                </TouchableOpacity>
              )}
              {activeFilters && (
                <TouchableOpacity onPress={() => {
                  console.log("Clearing filters and reloading.");
                  setActiveFilters(null);
                  // Reset and fetch with no filters
                  setAllLoadedUsers([]);
                  setCurrentSwiperIndex(0);
                  setNextPageToFetch(1);
                  setHasMoreDataInBackend(true);
                  isFetchingUsers.current = false;
                  if (loggedInUserId !== null) {
                    fetchUsers(1, true, null); // Fetch without filters
                  }
                  // Also clear params from router if they exist to avoid re-applying on next mount
                  if (router.canGoBack()) router.setParams({ filters: undefined } as any);


                }} style={[styles.restartButton, { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                  <Text style={styles.restartButtonText}>Clear Filters & Reload</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      {/* Action buttons should only show if there are cards to interact with */}
      {cardsForSwiper.length > 0 && (
        <View style={styles.actionButtonsContainer}>
           <TouchableOpacity style={styles.actionButton} onPress={() => swiperRef.current?.swipeLeft()}>
              <Text style={[styles.actionIcon, styles.actionIconX]}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => swiperRef.current?.swipeRight()}>
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
                      : (matchDetails.avatar ? { uri: `${API_BASE_URL}${matchDetails.avatar.startsWith('/') ? '' : '/'}${matchDetails.avatar}` } : FALLBACK_AVATAR)
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
              onPress={() => {
                setShowMatchModal(false);
                // Optionally navigate to chat screen with matchDetails.userID
                // router.push(`/(tabs)/chat/${matchDetails?.userID}`);
              }}
            >
              <Text style={styles.modalButtonText}>Keep Swiping</Text>
            </TouchableOpacity>
            {/* Optionally add a "Message Now" button */}
            {/* <TouchableOpacity
              style={[styles.modalButton, {marginTop: 10, backgroundColor: '#fff'}]}
              onPress={() => {
                setShowMatchModal(false);
                // router.push(`/(tabs)/chat/${matchDetails?.userID}`);
              }}
            >
              <Text style={[styles.modalButtonText, {color: MATCH_MODAL_GRADIENT_COLORS[1] || '#FF8E53'}]}>Message Now</Text>
            </TouchableOpacity> */}
          </LinearGradient>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screenContainer: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 10, fontSize: 16, textAlign: 'center' },
  centeredNoUsers: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  noUsersText: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, color: '#fff' },
  subNoUsersText: { color: '#eee', textAlign: 'center', fontSize: 15 },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 40, // Adjust for status bar
    paddingBottom: 10,
    // backgroundColor: 'rgba(0,0,0,0.1)', // Optional: slight background for header
    zIndex: 20, // Ensure header is above swiper initially
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  headerIconLeft: {
    padding: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10, // Give some margin from the edge
  },
  headerIconLeftPlaceholder: { // To maintain layout when info button is not shown
    width: 40, // Same width as the button
    height: 40,
    marginLeft: 10,
    padding: 8, // Keep consistent spacing
  },
  filterButton: {
    padding: 8, 
    width: 40, 
    height: 40,
    borderRadius: 20, 
    borderWidth: 1.5,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10, 
  },
  swiperContainer: {
    flex: 1,
    justifyContent: 'center', // This will help center the Swiper vertically
    alignItems: 'center',
    zIndex: 1,
    backgroundColor: 'transparent',
    // Removed marginTop that was pulling it up. We'll rely on flexbox for centering.
    // The cardVerticalMargin in Swiper props will give top/bottom margin to cards themselves.
  },
  card: {
    width: width * 0.9, // 90% of screen width
    height: height * 0.68, // Increased card height
    borderRadius: 20,
    backgroundColor: '#555', // Fallback color
    overflow: 'hidden',
    elevation: Platform.OS === 'android' ? 5 : 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    // marginTop: height * 0.02,
  },
  cardPlaceholder: { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(85,85,85,0.7)' },
  cardImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  cardGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%' },
  cardUserInfoContainer: { position: 'absolute', bottom: 20, left: 20, right: 20 },
  cardName: { fontSize: 26, fontWeight: 'bold', color: 'white', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  cardSecondaryInfo: { fontSize: 16, color: 'rgba(255,255,255,0.9)', marginTop: 5, textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 35 : 25,
    left: 0,
    right: 0,
    paddingHorizontal: 20, // Keep this for overall container padding from screen edges
    height: 80,
    zIndex: 10, // Above swiper cards but can be below modal
    // backgroundColor: 'blue', // Temporary for debugging visibility
  },
  overlayLabelContainer: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, borderWidth: 3, justifyContent: 'center', alignItems: 'center', transform: [{ rotate: '-20deg' }] },
  overlayLabelText: { fontSize: 38, fontWeight: 'bold', color: 'white', textTransform: 'uppercase' },
  overlayNope: { borderColor: '#E74C3C', backgroundColor: 'rgba(231, 76, 60, 0.2)' },
  overlayLike: { borderColor: '#2ECC71', backgroundColor: 'rgba(46, 204, 113, 0.2)' },
  overlaySuperLike: { borderColor: '#3498DB', backgroundColor: 'rgba(52, 152, 219, 0.2)' }, // Kept for reference if re-added, but not used
  overlayWrapper: { position: 'absolute', top: height * 0.15, width: '100%', alignItems: 'center' },
  actionButton: { // Unified style for action buttons
    width: 70, // Slightly larger for two buttons
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8, // Consistent elevation
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    // marginHorizontal: 20, // Let space-evenly handle the main spacing, this adds to it.
                           // If buttons are too far apart, reduce this or container padding.
                           // If too close, increase this.
                           // For two buttons, space-evenly with some margin on buttons is usually good.
                           // Let's try a smaller margin or rely on container padding and space-evenly.
    marginHorizontal: 10, // Reduced margin for potentially tighter packing if needed
  },
  // actionButtonSmall: { width: 65, height: 65, borderRadius: 32.5, backgroundColor: 'rgba(255,255,255,0.95)', justifyContent: 'center', alignItems: 'center', elevation: 7, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, marginHorizontal: 10 },
  // actionButtonLarge: { width: 75, height: 75, borderRadius: 37.5, backgroundColor: 'rgba(255,255,255,0.95)', justifyContent: 'center', alignItems: 'center', elevation: 9, shadowColor: '#8c7ae6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  actionIcon: { fontSize: 32 }, // Base size
  actionIconX: { color: '#E74C3C', fontWeight: 'bold', fontSize: 36 }, // Slightly larger X
  actionIconHeartSimple: { color: '#2ECC71', fontSize: 34 }, // Slightly larger Heart
  // actionIconStar: { color: '#8c7ae6', fontSize: 36 }, // Star icon removed
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
    textAlign: 'center',
  },
});
