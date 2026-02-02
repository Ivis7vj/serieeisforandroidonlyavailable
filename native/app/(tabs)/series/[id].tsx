import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Dimensions,
    Pressable,
    ActivityIndicator,
    Alert,
    Linking,
    Modal as NativeModal,
    LayoutAnimation,
    Platform,
    Share,
    Animated,
    Easing
} from 'react-native';
import { OneSignal } from 'react-native-onesignal';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, useFocusEffect, useNavigation } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import {
    ChevronLeft,
    Star,
    MoreHorizontal,
    Check,
    Plus,
    Eye,
    EyeOff,
    Share as ShareIcon,
    ChevronDown,
    Play,
    Edit3,
    Heart,
    HeartCrack,
    Smile,
    Meh,
    Frown,
    Edit2,
    AlertCircle
} from 'lucide-react-native';
import MobileIndicator from '@/components/MobileIndicator';
import TabsHeader from '@/components/series/TabsHeader';
import ReviewsTab from '@/components/series/ReviewsTab';
import { CastCrewTab } from '@/components/series/SeasonsTab';
import SeasonTrending from '@/components/series/SeasonTrending';
import WatchedBy from '@/components/series/WatchedBy';
import AwardsRow from '@/components/series/AwardsRow';
import CharactersRow from '@/components/series/CharactersRow';
import EpisodesTab from '@/components/series/EpisodesTab';
import ContentAdvisory from '@/components/series/ContentAdvisory';


import { useOnboarding } from '@/context/onboarding-context';

import { useAuth } from '@/context/auth-context';
import { tmdbApi } from '@/utils/tmdb';
import { getResolvedPosterUrl } from '@/utils/poster-resolver';
import * as watchedService from '@/utils/watched-service';
import * as watchlistService from '@/utils/watchlist-service';
import * as likesService from '@/utils/likes-service';
import * as reviewService from '@/utils/review-service';
import * as ratingService from '@/utils/rating-service';
import { triggerImpact, triggerNotification, triggerSelection } from '@/utils/haptics';
import ViewShot from 'react-native-view-shot';
import Skeleton from '@/components/skeleton';
import ReviewDrawer from '@/components/review/ReviewDrawer';
import { NewsSection } from '@/components/series/NewsSection';

const { width, height } = Dimensions.get('window');

// MATCHING WEB CONSTRAINTS
const CONTENT_WIDTH = width;
const POSTER_WIDTH = width * 0.55;
const POSTER_HEIGHT = POSTER_WIDTH * 1.5;

export default function SeriesDetailsScreen() {
    const params = useLocalSearchParams();
    const { id, seasonNumber } = params;
    const router = useRouter();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { currentUser, userData, globalPosters, isGuest, refreshUserData } = useAuth();

    // DATA STATE
    const [details, setDetails] = useState<any>(null);
    const [seasonDetails, setSeasonDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [episodes, setEpisodes] = useState<any[]>([]);
    const [cast, setCast] = useState<any[]>([]);
    const [crew, setCrew] = useState<any[]>([]);
    const [reviewsData, setReviewsData] = useState<any[]>([]);
    const [watchProviders, setWatchProviders] = useState<any>(null);
    const [allSeasonCredits, setAllSeasonCredits] = useState<any[]>([]);

    const [activeTab, setActiveTab] = useState('Episodes');

    // UI STATE
    const [selectedSeason, setSelectedSeason] = useState(() => {
        const sn = params.selectedSeason || params.seasonNumber;
        return sn ? parseInt(sn as string) : 1;
    });
    const [isSeasonPopupOpen, setIsSeasonPopupOpen] = useState(false);
    const [showRatingPopup, setShowRatingPopup] = useState(false);
    const [actionLoading, setActionLoading] = useState<{ watchlist: boolean; watched: boolean }>({ watchlist: false, watched: false });
    const [posterUrl, setPosterUrl] = useState<string | null>(null);
    const [reviewDrawerVisible, setReviewDrawerVisible] = useState(false);
    const [selectedReviewData, setSelectedReviewData] = useState<any>(null);
    const scrollY = useRef(new Animated.Value(0)).current;
    const [showHeaderTitle, setShowHeaderTitle] = useState(false);
    const titleY = useRef(0);

    // USER INTERACTION STATE
    const [inWatchlist, setInWatchlist] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [isWatched, setIsWatched] = useState(false);
    const [episodeWatchedIDs, setEpisodeWatchedIDs] = useState(new Set<string>());
    const [episodeWatchlistIDs, setEpisodeWatchlistIDs] = useState<number[]>([]);

    // Memoize following list to prevent re-renders
    const followingList = useMemo(() => userData?.following || [], [userData?.following]);

    const [showCeleb, setShowCeleb] = useState(false);
    const [showEditHint, setShowEditHint] = useState(false);
    const [isEditButtonGlowing, setIsEditButtonGlowing] = useState(false);
    const [prevId, setPrevId] = useState(id);
    const [activeBarIdx, setActiveBarIdx] = useState<number | null>(null);



    // RATINGS SWIPE STATE
    const [isSwipingRatings, setIsSwipingRatings] = useState(false);
    const [ratingsPage, setRatingsPage] = useState(0);
    const ratingsListRef = useRef<ScrollView>(null);
    const nudgeAnim = useRef(new Animated.Value(0)).current;

    // NUDGE ANIMATION ON MOUNT
    useEffect(() => {
        setTimeout(() => {
            Animated.sequence([
                Animated.timing(nudgeAnim, { toValue: -5, duration: 200, useNativeDriver: true }),
                Animated.timing(nudgeAnim, { toValue: 5, duration: 200, useNativeDriver: true }),
                Animated.timing(nudgeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            ]).start();
        }, 1000); // 1s delay
    }, []);

    // Immediate state reset on ID change to prevent stale data
    if (id !== prevId) {
        setPrevId(id);
        setLoading(true);
        setDetails(null);
        setSeasonDetails(null);
        setEpisodes([]);
        setAllSeasonCredits([]);
        // Reset season selection if id changes
        const sn = params.selectedSeason || params.seasonNumber;
        setSelectedSeason(sn ? parseInt(sn as string) : 1);
    }

    const scrollRef = useRef<ScrollView>(null);
    const tabsY = useRef<number>(0);
    const likeScale = useRef(new Animated.Value(1)).current;

    // SYNC HEADER TITLE PARAMS
    useEffect(() => {
        const title = details?.translations?.translations?.find((t: any) => t.iso_639_1 === 'en')?.data?.name || details?.name;
        if (title && paramsRef.current.scTitle !== title) {
            // Small delay to ensure route stability on Android
            const timer = setTimeout(() => {
                if (paramsRef.current.scTitle !== title) {
                    router.setParams({ scTitle: title });
                }
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [details?.name]);

    const showHeaderTitleRef = useRef(false);

    useEffect(() => {
        const listener = scrollY.addListener(({ value }) => {
            const threshold = titleY.current > 0 ? titleY.current : 300;
            const shouldShow = value > threshold;

            if (shouldShow !== showHeaderTitleRef.current) {
                showHeaderTitleRef.current = shouldShow;
                setShowHeaderTitle(shouldShow);
                // Update route params for the Header component to see, 
                // but we use a local ref to avoid effect recursion.
                router.setParams({ showHeaderTitle: String(shouldShow) });
            }
        });
        return () => scrollY.removeListener(listener);
    }, [details?.name]); // Removed showHeaderTitle from deps to break the recursion

    // RESOLVE POSTER & COUNTS
    const currentSeasonTMDBPoster = useMemo(() => {
        if (!details || !details.seasons) return details?.poster_path;
        const season = details.seasons.find((s: any) => s.season_number === Number(selectedSeason));
        return season?.poster_path || details?.poster_path;
    }, [details, selectedSeason]);

    const currentSeasonEpisodeCount = useMemo(() => {
        if (!details || !details.seasons) return 0;
        const season = details.seasons.find((s: any) => s.season_number === Number(selectedSeason));
        return season?.episode_count || 0;
    }, [details, selectedSeason]);

    const contentRating = useMemo(() => {
        if (!details?.content_ratings?.results) return null;
        const results = details.content_ratings.results;
        // Search for IN rating first, then US, then any
        const india = results.find((r: any) => r.iso_3166_1 === 'IN');
        if (india && india.rating) return india.rating;
        const us = results.find((r: any) => r.iso_3166_1 === 'US');
        if (us && us.rating) return us.rating;
        return results[0]?.rating || null;
    }, [details]);

    const ratingReason = useMemo(() => {
        if (!contentRating) return "";
        const r = contentRating.toUpperCase();
        if (r === 'U') return "Universal: Suitable for all ages. Contains no offensive content.";
        if (r.includes('U/A 7')) return "Parental Guidance: Suitable for children above 7 years. May contain mild themes.";
        if (r.includes('U/A 13')) return "Parental Guidance: Suitable for children above 13 years. May contain moderate violence or language.";
        if (r.includes('U/A 16')) return "Parental Guidance: Suitable for children above 16 years. May contain intense violence, mature themes, or strong language.";
        if (r === 'A' || r === '18' || r === 'TV-MA') return "Adults Only: Restricted to audiences aged 18 and over. Contains strong adult content.";
        if (r === 'TV-14') return "Parents Strongly Cautioned: Contains content that most parents would find unsuitable for children under 14 years of age.";
        if (r === 'TV-PG' || r === 'PG') return "Parental Guidance Suggested: This program contains material that parents may find unsuitable for younger children.";
        return "This certification indicates the recommended age group and content suitability for this series.";
    }, [contentRating]);

    // NEW RELATIONSHIP: Rated implies Watched
    const userSeasonReview = useMemo(() => {
        if (!currentUser) return null;
        return reviewsData.find((r: any) =>
            r.userId === currentUser.uid &&
            Number(r.seasonNumber) === Number(selectedSeason) &&
            r.isSeason === true
        );
    }, [reviewsData, currentUser, selectedSeason]);

    const isSeasonRated = !!userSeasonReview;

    // SYNC SELECTED SEASON FROM PARAMS
    useEffect(() => {
        const snParam = params.selectedSeason || params.seasonNumber;
        if (snParam) {
            const sn = parseInt(snParam as string);
            if (!isNaN(sn) && sn !== selectedSeason) {
                console.log("[SeriesDetails] Syncing season from params:", sn);
                handleSeasonChange(sn, true);
            }
        }
    }, [params.selectedSeason, params.seasonNumber]);



    // LISTEN FOR HEADER TRIGGER TO OPEN SEASON PICKER
    useEffect(() => {
        if (params.openSeasonPicker) {
            console.log("[SeriesDetails] Header triggered season picker");
            setIsSeasonPopupOpen(true);
            // Clear the trigger param
            router.setParams({ openSeasonPicker: undefined } as any);
        }
    }, [params.openSeasonPicker]);

    const [showHeartPopup, setShowHeartPopup] = useState(false);
    const [isUnlikingPopup, setIsUnlikingPopup] = useState(false);
    const centerHeartScale = useRef(new Animated.Value(0)).current;
    const centerHeartOpacity = useRef(new Animated.Value(0)).current;
    const centerHeartRotate = useRef(new Animated.Value(0)).current;
    const centerHeartY = useRef(new Animated.Value(0)).current;

    const handleCelebClose = () => {
        setShowCeleb(false);
        setShowEditHint(true);
        setIsEditButtonGlowing(true);

        // Auto-scroll to top (where poster is)
        scrollRef.current?.scrollTo({ y: 0, animated: true });

        // Clear glow after 5s
        setTimeout(() => {
            setIsEditButtonGlowing(false);
            setShowEditHint(false);
        }, 5000);
    };
    // PROGRESS STATE
    const [seasonProgress, setSeasonProgress] = useState({
        completed: false,
        rated: false
    });

    // SKELETON ON FOCUS (Smooth Back Navigation)
    const isFirstLoad = useRef(true);
    const syncUser = useCallback(async (currentDetails: any) => {
        if (!currentUser || !currentDetails) return;
        // Watchlist
        const userWatchlist = await watchlistService.getWatchlist(currentUser.uid);

        // Check Season Watchlist Status
        const isInWatch = userWatchlist.some((i: any) =>
            i.seriesId === currentDetails.id &&
            i.isSeason &&
            i.seasonNumber === selectedSeason
        );
        setInWatchlist(isInWatch);

        // Check Episode Watchlist IDs
        const watchlistEps = userWatchlist
            .filter((i: any) => i.seriesId === currentDetails.id && i.isEpisode)
            .map((i: any) => i.id || i.tmdb_id);
        setEpisodeWatchlistIDs(watchlistEps);

        // Likes (Season)
        const liked = await likesService.isLiked(currentUser.uid, currentDetails.id, 'SEASON', selectedSeason);
        setIsLiked(liked);

        // Watched Episodes
        const watchedList = await watchedService.getWatchedEpisodes(currentUser.uid, currentDetails.id);
        const newSet = new Set<string>(watchedList.map((w: any) => `${w.season}-${w.episode}`));
        setEpisodeWatchedIDs(newSet);
        return newSet; // Return for sync checks
    }, [currentUser, selectedSeason]);

    // Track latest params without triggering effects
    const paramsRef = useRef(params);
    useEffect(() => {
        paramsRef.current = params;
    }, [params]);

    useFocusEffect(
        useCallback(() => {
            // ALWAYS REFRESH DATA ON FOCUS (RELOAD REQUIREMENT - V2)
            // We removed !isFirstLoad check to ensure strict consistency on every navigation.

            // Check if we posted a review using Ref
            const currentParams = paramsRef.current;
            const action = (currentParams as any)?.action;
            const isUpdate = (currentParams as any)?.isUpdate === 'true';

            // RESET TO EPISODES TAB ON BACK NAVIGATION (General rule)
            // Only if coming fresh (optional, but requested behavior implies "reset")
            if (isFirstLoad.current) setActiveTab('Episodes');

            if (id) {
                // Re-sync reviews AND user status (Parallel Fetch)
                if (currentUser && details) {
                    setLoading(true); // Optional: Trigger skeleton if we want "heavy" reload feel, or silent if false.
                    // User asked for "reload the series details page everytime", so let's be explicit
                    // But blocking UI completely every time might be jarring. Let's do silent refresh + loading state safely.

                    Promise.all([
                        reviewService.getSeriesReviews(parseInt(id as string)),
                        syncUser(details)
                    ]).then(([revs, watchedSet]) => {
                        setReviewsData(revs);

                        // AUTO-TRIGGER CELEB IF JUST RATED (User requirement)
                        if (action === 'review_posted') {
                            // 1. Check if Rated (Immediate)
                            const isNowRated = revs.some((r: any) =>
                                r.userId === currentUser.uid &&
                                Number(r.seasonNumber) === Number(selectedSeason) &&
                                r.isSeason === true
                            );

                            // TRIGGER ONLY if Rated (AND NOT an update)
                            if (isNowRated && !isUpdate) {
                                console.log("[Rating Sync] Season rated and NOT update! Triggering celebration.");
                                setShowCeleb(true);
                                setTimeout(() => {
                                    scrollRef.current?.scrollTo({ y: 0, animated: true });
                                }, 500);
                            } else if (isUpdate) {
                                console.log("[Rating Sync] isUpdate=true, skipping celebration.");
                            }
                        }
                    }).finally(() => {
                        setLoading(false); // Only if we set it to true
                    });
                }
            }

            // Hack to clear params so it doesn't persist forever
            if (action === 'review_posted') {
                try {
                    router.setParams({ action: undefined, scTitle: undefined, showHeaderTitle: undefined });
                } catch (e) {
                    console.warn("Could not clear params", e);
                }
            }

            isFirstLoad.current = false;
        }, [id, currentUser, details, syncUser]) // Removed params from deps
    );

    // FETCH SERIES DATA
    useEffect(() => {
        const fetchSeries = async () => {
            if (!id) return;
            setLoading(true);
            setDetails(null);
            setSeasonDetails(null);
            try {
                const data = await tmdbApi.getSeriesDetails(parseInt(id as string));
                setDetails(data);

                // Process Cast & Crew
                if (data.credits) {
                    setCast(data.credits.cast?.slice(0, 20) || []);
                    setCrew(data.created_by || []);
                }

                // Fetch All Seasons Credits in Parallel
                if (data.seasons && data.seasons.length > 0) {
                    const creditsPromises = data.seasons.map(async (s: any) => {
                        try {
                            const credits = await tmdbApi.getSeasonAggregateCredits(data.id, s.season_number);
                            return {
                                seasonName: s.name,
                                seasonNumber: s.season_number,
                                cast: credits.cast || [],
                                crew: credits.crew || []
                            };
                        } catch (err) {
                            console.error(`Error fetching credits for Season ${s.season_number}`, err);
                            return { seasonName: s.name, seasonNumber: s.season_number, cast: [], crew: [] };
                        }
                    });
                    const results = await Promise.all(creditsPromises);

                    // Add Series Creators to the top (as Season 0 or Series)
                    const seriesCredits = {
                        seasonName: 'Series Credits',
                        seasonNumber: 0,
                        cast: [],
                        crew: data.created_by?.map((c: any) => ({ ...c, job: 'Creator' })) || []
                    };

                    setAllSeasonCredits([seriesCredits, ...results]);
                }

                // Watch Providers (Prioritize IN, then US)
                const providersData = data['watch/providers'] || {};
                setWatchProviders(providersData.results?.IN || providersData.results?.US || null);

                checkUser(data);
            } catch (e) {
                console.error("Series fetch failed", e);
            }
        };
        fetchSeries();
    }, [id]);

    // FETCH SEASON DATA
    useEffect(() => {
        const loadSeasonDetails = async () => {
            if (!id || !details) return;

            setLoading(true);
            setEpisodes([]);
            // Default to 1 if no seasons (rare)
            const seasonToFetch = selectedSeason || 1;

            try {
                const data = await tmdbApi.getSeasonDetails(parseInt(details.id as string), seasonToFetch);
                setSeasonDetails(data);
                setEpisodes(data.episodes || []);

                // Reset to Episodes tab (Index 0) on season change
                setTimeout(() => {
                    setActiveTab('Episodes');
                }, 100);
            } catch (error) {
                console.error("Error loading season details:", error);
            } finally {
                setLoading(false);
            }
        };
        loadSeasonDetails();
    }, [details?.id, selectedSeason]);

    // FETCH REVIEWS
    useEffect(() => {
        if (!id) return;
        const loadReviews = async () => {
            const seriesName = details?.name || details?.original_name || null;
            const reviews = await reviewService.getSeriesReviews(parseInt(id as string), seriesName);
            setReviewsData(reviews);
        };
        // Trigger when details loads so we have the name
        if (details) {
            loadReviews();
        }

        // EVENT LISTENER
        const { reviewEvents } = require('@/utils/review-events');
        const onReviewChange = ({ type, data }: { type: string, data: any }) => {
            // ROBUST CHECK: Handle both tmdbId and tmdb_id
            const eventTmdbId = data.tmdbId || data.tmdb_id;
            if (String(eventTmdbId) !== String(id)) return;

            if (type === 'create') {
                setReviewsData(prev => [data, ...prev]);
                loadReviews(); // Force fresh fetch
            } else if (type === 'update') {
                setReviewsData(prev => prev.map(r =>
                    (r.userId === data.userId &&
                        Number(r.seasonNumber) === Number(data.seasonNumber) &&
                        Number(r.episodeNumber || 0) === Number(data.episodeNumber || 0))
                        ? { ...r, ...data }
                        : r
                ));
                loadReviews(); // Force fresh fetch
            } else if (type === 'delete') {
                setReviewsData(prev => prev.filter(r =>
                    !(r.userId === currentUser?.uid &&
                        Number(r.seasonNumber) === Number(data.seasonNumber) &&
                        Number(r.episodeNumber || 0) === Number(data.episodeNumber || 0))
                ));
                loadReviews(); // Force fresh fetch
            }
        };

        reviewEvents.on('review_change', onReviewChange);
        return () => {
            reviewEvents.off('review_change', onReviewChange);
        };
    }, [id, details, currentUser]);

    // SYNC USER STATE
    useEffect(() => {
        if (currentUser && details) {
            syncUser(details);
        }
    }, [currentUser, details, syncUser]);

    // WATCHED STATUS EFFECT
    useEffect(() => {
        // RELATIONSHIP: Rated implies Watched (User Requirement)
        if (isSeasonRated) {
            setIsWatched(true);
            return;
        }

        if (episodes.length > 0) {
            const allWatched = episodes.every(ep =>
                episodeWatchedIDs.has(`${ep.season_number}-${ep.episode_number}`)
            );
            setIsWatched(allWatched);
        } else if (currentSeasonEpisodeCount > 0) {
            // FALLBACK: If episodes haven't loaded yet, check count of watched in this season
            const watchedInSeason = Array.from(episodeWatchedIDs).filter(key => {
                const [s] = key.split('-');
                return Number(s) === Number(selectedSeason);
            });
            setIsWatched(watchedInSeason.length >= currentSeasonEpisodeCount);
        } else {
            setIsWatched(false);
        }
    }, [episodeWatchedIDs, episodes, currentSeasonEpisodeCount, selectedSeason, isSeasonRated]);

    const checkUser = async (data: any) => {
        // Additional checks if needed
    };

    // ACTIONS
    const handleSeasonChange = (seasonNum: number, omitSetParams: boolean = false) => {
        if (seasonNum === selectedSeason) {
            setIsSeasonPopupOpen(false);
            return;
        }

        // Trigger skeleton loading
        setLoading(true);
        setSeasonDetails(null);
        setEpisodes([]);
        setPosterUrl(null); // Assuming reset

        setSelectedSeason(seasonNum);
        setIsSeasonPopupOpen(false);
        triggerSelection();

        // Update params explicitly if not initiated from params
        if (!omitSetParams && id) {
            router.setParams({ selectedSeason: seasonNum.toString() });
        }
    };

    const handleTabPress = (tab: string, index: number) => {
        setActiveTab(tab);
        triggerSelection();
    };

    const toggleWatchlist = async () => {
        if (isGuest) {
            router.replace('/login');
            return;
        }
        if (!currentUser || !details) return;
        triggerImpact();

        const seasonItem = {
            id: seasonDetails?.id || Number(`${details.id}${selectedSeason}`),
            seriesId: details.id,
            name: `${details.name} (Season ${selectedSeason})`,
            poster_path: currentSeasonTMDBPoster,
            vote_average: details.vote_average,
            first_air_date: seasonDetails?.air_date || details.first_air_date,
            type: 'season',
            isSeason: true,
            seasonNumber: selectedSeason
        };

        const episodeItems = episodes.map(ep => ({
            id: ep.id,
            name: `${details.name} - S${ep.season_number}E${ep.episode_number}: ${ep.name}`,
            poster_path: details.poster_path,
            seasonPoster: currentSeasonTMDBPoster,
            still_path: ep.still_path,
            vote_average: ep.vote_average,
            first_air_date: ep.air_date,
            type: 'episode',
            isEpisode: true,
            seriesId: details.id,
            seasonNumber: ep.season_number,
            episodeNumber: ep.episode_number
        }));

        if (inWatchlist) {
            // UNLIST -> Optimistically remove
            setInWatchlist(false);
            setEpisodeWatchlistIDs(prev => prev.filter(id => !episodes.some(e => e.id === id)));
            triggerSelection();

            const idsToRemove = [seasonItem.id, ...episodes.map(e => e.id)];
            await watchlistService.removeFromWatchlistBulk(currentUser.uid, idsToRemove);
        } else {
            // LIST -> Optimistically add
            setInWatchlist(true);
            setEpisodeWatchlistIDs(prev => [...new Set([...prev, ...episodes.map(e => e.id)])]);
            triggerSelection();

            const itemsToAdd = [seasonItem, ...episodeItems];
            await watchlistService.addToWatchlist(currentUser.uid, itemsToAdd);

            // OneSignal Tagging
            OneSignal.User.addTag(`series_${details.id}`, "true");

            // STRICT RELATION CHECK
            // If the season is RATED, we treat this as a "Rewatch" -> Do NOT unmark as watched.
            // If the season is NOT RATED, we apply strict logic -> Unmark as watched.
            const userSeasonReview = reviewsData.find((r: any) => r.userId === currentUser?.uid && Number(r.seasonNumber) === Number(selectedSeason));

            if (!userSeasonReview) {
                // STRICT RELATION: Unmark Season & All Episodes from Watched
                await watchedService.unmarkSeasonWatched(currentUser.uid, details.id, selectedSeason);

                // Update Local Watched State
                setIsWatched(false);
                const newSet = new Set(episodeWatchedIDs);
                episodes.forEach(ep => newSet.delete(`${ep.season_number}-${ep.episode_number}`));
                setEpisodeWatchedIDs(newSet);
            }
        }
    };

    const toggleSeasonWatchedAction = async () => {
        if (isGuest) {
            router.replace('/login');
            return;
        }
        if (!currentUser || !details) return;
        triggerImpact();

        setActionLoading(prev => ({ ...prev, watched: true }));

        try {
            const shouldMark = !isWatched;

            if (shouldMark) {
                // MARK WATCHED -> Add to Watched AND Remove from List (Strict Rule 2)
                await watchedService.markSeasonWatched(currentUser.uid, details.id, selectedSeason, currentSeasonEpisodeCount);

                // STRICT RELATION: Remove Season & All Episodes from Watchlist
                const idsToRemove = [seasonDetails?.id || Number(`${details.id}${selectedSeason}`), ...episodes.map(e => e.id)];
                await watchlistService.removeFromWatchlistBulk(currentUser.uid, idsToRemove);

                // OneSignal Tagging
                OneSignal.User.addTag(`series_${details.id}`, "true");

                // Update Local State Optimistically
                const newSet = new Set(episodeWatchedIDs);
                // If episodes haven't loaded, we can't update local episode IDs individually yet
                // but syncUser will catch it. If they have loaded:
                episodes.forEach(ep => newSet.add(`${ep.season_number}-${ep.episode_number}`));
                setEpisodeWatchedIDs(newSet);
                setIsWatched(true);

                setInWatchlist(false);
                setEpisodeWatchlistIDs(prev => prev.filter(id => !episodes.some(e => e.id === id)));

                // Show Celebration removed per user request (Watched does not unlock editor)
            } else {
                // UNWATCH ATTEMPT
                if (isSeasonRated) {
                    // If Rated, DO NOT unmark. Redirect to Edit Review.
                    console.log("[Watched] Season is rated, redirecting to review update instead of unmarking.");
                    handleRate(); // Opens review screen with existing review data
                    return;
                }

                // UNWATCH -> Just remove from Watched
                await watchedService.unmarkSeasonWatched(currentUser.uid, details.id, selectedSeason);

                const newSet = new Set(episodeWatchedIDs);
                episodes.forEach(ep => newSet.delete(`${ep.season_number}-${ep.episode_number}`));
                setEpisodeWatchedIDs(newSet);
                setIsWatched(false);
            }
        } finally {
            setActionLoading(prev => ({ ...prev, watched: false }));
        }
    };

    const toggleEpisodeWatched = async (ep: any) => {
        if (isGuest) {
            router.replace('/login');
            return;
        }
        if (!currentUser || !details) return;
        triggerSelection();

        const key = `${ep.season_number}-${ep.episode_number}`;

        // Optimistic Update with Functional State to prevent Race Conditions
        setEpisodeWatchedIDs(prev => {
            const next = new Set(prev);
            const isEpWatched = next.has(key);

            if (isEpWatched) {
                next.delete(key);
                // Trigger Async Operation (Non-blocking)
                watchedService.unmarkEpisodeWatched(currentUser.uid, details.id, ep.season_number, ep.episode_number);
            } else {
                next.add(key);
                // Trigger Async Operation (Non-blocking)
                watchedService.markEpisodeWatched(currentUser.uid, details.id, ep.season_number, ep.episode_number);

                // Also remove from watchlist if watching
                watchlistService.removeFromWatchlist(currentUser.uid, ep.id);
                setEpisodeWatchlistIDs(prevList => prevList.filter(pid => pid !== ep.id));

                // OneSignal Tagging
                OneSignal.User.addTag(`series_${details.id}`, "true");

                // MANUAL COMPLETION CHECK (Optional/Simplified)
                if (seasonDetails && seasonDetails.episodes) {
                    const allCheck = seasonDetails.episodes.every((e: any) => {
                        const epKey = `${e.season_number}-${e.episode_number}`;
                        return next.has(epKey);
                    });

                    if (allCheck) {
                        console.log("Season Completed via Episode Toggle! Triggering celebration...");
                        setShowCeleb(true);
                    }
                }
            }
            return next;
        });
    };

    const toggleEpisodeWatchlist = async (ep: any) => {
        if (isGuest) {
            router.replace('/login');
            return;
        }
        if (!currentUser || !details) return;
        triggerSelection();

        const inList = episodeWatchlistIDs.includes(ep.id);

        if (inList) {
            // OPTIMISTIC UPDATE: Remove immediately
            setEpisodeWatchlistIDs(prev => prev.filter(pid => pid !== ep.id));
            await watchlistService.removeFromWatchlist(currentUser.uid, ep.id);
        } else {
            // OPTIMISTIC UPDATE: Add immediately
            setEpisodeWatchlistIDs(prev => [...prev, ep.id]);

            // LIST EPISODE -> Add to List AND Remove from Watched (Strict Rule 4)
            const itemToSave = {
                id: ep.id,
                name: `${details.name} - S${ep.season_number}E${ep.episode_number}: ${ep.name}`,
                poster_path: details.poster_path, // Series poster usually
                seasonPoster: currentSeasonTMDBPoster,
                still_path: ep.still_path,
                vote_average: ep.vote_average,
                first_air_date: ep.air_date,
                type: 'episode',
                isEpisode: true,
                seriesId: details.id,
                seasonNumber: ep.season_number,
                episodeNumber: ep.episode_number
            };

            await watchlistService.addToWatchlist(currentUser.uid, itemToSave);

            // STRICT RELATION: Unmark definition Episode from Watched
            await watchedService.unmarkEpisodeWatched(currentUser.uid, details.id, ep.season_number, ep.episode_number);

            setEpisodeWatchlistIDs(prev => [...prev, ep.id]);

            // Update Local Watched State
            const next = new Set(episodeWatchedIDs);
            const key = `${ep.season_number}-${ep.episode_number}`;
            if (next.has(key)) {
                next.delete(key);
                setEpisodeWatchedIDs(next);
            }
        }
    };

    const handleEpisodeReview = (ep: any) => {
        if (isGuest) {
            router.replace('/login');
            return;
        }
        const userEpReview = reviewsData.find(r =>
            Number(r.seasonNumber) === Number(ep.season_number) &&
            Number(r.episodeNumber) === Number(ep.episode_number) &&
            r.isEpisode &&
            r.userId === currentUser?.uid
        );

        setSelectedReviewData(userEpReview ? { ...userEpReview, seriesName: details.name, name: userEpReview.name || details.name } : {
            type: 'episode',
            userId: currentUser?.uid,
            tmdbId: details.id,
            seasonNumber: ep.season_number,
            episodeNumber: ep.episode_number,
            name: details.name,
            seriesName: details.name,
            poster_path: seasonDetails?.poster_path || details.poster_path,
            isEpisode: true,
            isSeason: false
        });
        setReviewDrawerVisible(true);
    };

    const triggerHeartAnimation = (unliking: boolean = false) => {
        setIsUnlikingPopup(unliking);
        setShowHeartPopup(true);
        centerHeartScale.setValue(0);
        centerHeartOpacity.setValue(0);
        centerHeartRotate.setValue(0);
        centerHeartY.setValue(0);

        if (!unliking) {
            // LIKE ANIMATION (Pop)
            Animated.parallel([
                Animated.timing(centerHeartOpacity, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true
                }),
                Animated.spring(centerHeartScale, {
                    toValue: 2.2,
                    friction: 3,
                    tension: 40,
                    useNativeDriver: true
                })
            ]).start(() => {
                setTimeout(() => {
                    Animated.timing(centerHeartOpacity, {
                        toValue: 0,
                        duration: 300,
                        useNativeDriver: true
                    }).start(() => setShowHeartPopup(false));
                }, 500);
            });
        } else {
            // UNLIKE ANIMATION (Break & Drop)
            Animated.parallel([
                Animated.timing(centerHeartOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
                Animated.timing(centerHeartScale, {
                    toValue: 2.2,
                    duration: 400,
                    easing: Easing.back(1.7),
                    useNativeDriver: true
                })
            ]).start(() => {
                // Shake
                Animated.sequence([
                    Animated.timing(centerHeartRotate, { toValue: -0.2, duration: 50, useNativeDriver: true }),
                    Animated.timing(centerHeartRotate, { toValue: 0.2, duration: 50, useNativeDriver: true }),
                    Animated.timing(centerHeartRotate, { toValue: -0.2, duration: 50, useNativeDriver: true }),
                    Animated.timing(centerHeartRotate, { toValue: 0, duration: 50, useNativeDriver: true }),
                ]).start(() => {
                    // Drop
                    Animated.parallel([
                        Animated.timing(centerHeartY, { toValue: 100, duration: 400, easing: Easing.in(Easing.exp), useNativeDriver: true }),
                        Animated.timing(centerHeartOpacity, { toValue: 0, duration: 400, useNativeDriver: true })
                    ]).start(() => setShowHeartPopup(false));
                });
            });
        }
    };

    const animateLike = (isNowLiked: boolean) => {
        if (isNowLiked) {
            // Elastic Pop (GSAP Elastic style)
            Animated.spring(likeScale, {
                toValue: 1.4,
                friction: 2,
                tension: 60,
                useNativeDriver: true
            }).start(() => {
                Animated.spring(likeScale, {
                    toValue: 1,
                    friction: 4,
                    useNativeDriver: true
                }).start();
            });
        } else {
            // Back/Bounce (GSAP Back style)
            Animated.timing(likeScale, {
                toValue: 1.2,
                duration: 200,
                easing: Easing.back(1.7),
                useNativeDriver: true
            }).start(() => {
                Animated.timing(likeScale, {
                    toValue: 1,
                    duration: 250,
                    easing: Easing.bounce,
                    useNativeDriver: true
                }).start();
            });
        }
    };

    const toggleLike = async () => {
        if (isGuest) {
            router.replace('/login');
            return;
        }
        if (!currentUser || !details) return;

        const previousLikedState = isLiked;
        const nextLikedState = !isLiked;

        // OPTIMISTIC UPDATE
        triggerImpact();
        setIsLiked(nextLikedState);
        animateLike(nextLikedState);
        triggerHeartAnimation(previousLikedState); // if previous was true, we are unliking (true)

        try {
            if (previousLikedState) {
                await likesService.unlikeSeason(currentUser.uid, details.id, selectedSeason);
            } else {
                await likesService.likeSeason(currentUser.uid, details.id, selectedSeason);
                // OneSignal Tagging
                OneSignal.User.addTag(`series_${details.id}`, "true");
            }
            // REFRESH TO SYNC PROFILE REAL-TIME
            await refreshUserData();
        } catch (error) {
            console.error("Failed to toggle like:", error);
            // Revert
            setIsLiked(previousLikedState);
        }
    };

    const seasonStats = useMemo(() => {
        if (!details) return { avg: "0.0", count: 0, distribution: Array(10).fill(0) };
        const relevantReviews = reviewsData.filter(r =>
            (Number(r.tmdbId) === Number(id) || Number(r.tmdb_id) === Number(id)) && // ROBUST ID CHECK
            Number(r.seasonNumber) === Number(selectedSeason) &&
            (r.isEpisode || r.isSeason)
        );

        if (relevantReviews.length === 0) return { avg: "0.0", count: 0, distribution: Array(10).fill(0) };

        // Group by User to ensure "One Account, One Vote"
        const userRatings = new Map<string, number>();
        const userEpisodeReviews = new Map<string, number[]>();

        relevantReviews.forEach(r => {
            const userId = r.userId || r.uid;
            if (!userId) return;

            const rating = parseFloat(r.rating) || 0;
            if (r.isSeason) {
                // Priority 1: Direct Season Rating
                userRatings.set(userId, rating);
            } else if (r.isEpisode) {
                // Collect episode ratings for averaging later if no season rating
                if (!userEpisodeReviews.has(userId)) userEpisodeReviews.set(userId, []);
                userEpisodeReviews.get(userId)!.push(rating);
            }
        });

        // Fill in missing user ratings with episode averages
        userEpisodeReviews.forEach((ratings, userId) => {
            if (!userRatings.has(userId)) {
                const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
                userRatings.set(userId, avg);
            }
        });

        const distribution = Array(10).fill(0);
        let sum = 0;
        const totalUsers = userRatings.size;

        userRatings.forEach(rating => {
            sum += rating;
            const idx = Math.min(Math.max(Math.floor((rating - 0.5) * 2), 0), 9);
            distribution[idx]++;
        });

        return {
            avg: totalUsers > 0 ? (sum / totalUsers).toFixed(1) : "0.0",
            count: totalUsers,
            distribution
        };
    }, [details, reviewsData, id, selectedSeason]);

    const renderStars = (rating: number, size: number = 10, color: string = "#FFCC00") => {
        return Array.from({ length: 5 }).map((_, si) => {
            const starVal = si + 1;
            const isFull = rating >= starVal;
            const isHalf = !isFull && rating >= starVal - 0.5;

            return (
                <View key={si} style={{ width: size, height: size }}>
                    <Star size={size} color={color} fill="transparent" />
                    {isFull ? (
                        <View style={{ position: 'absolute' }}>
                            <Star size={size} color={color} fill={color} />
                        </View>
                    ) : isHalf ? (
                        <View style={{ position: 'absolute', width: size / 2, overflow: 'hidden' }}>
                            <Star size={size} color={color} fill={color} />
                        </View>
                    ) : null}
                </View>
            );
        });
    };

    const getEmoji = (val: number) => {
        // Normalizing 0-5 to 0-10 for web thresholds (7, 4)
        const normalized = val <= 5 ? val * 2 : val;
        if (normalized >= 7) return <Smile color="#000" size={20} />;
        if (normalized >= 4) return <Meh color="#000" size={20} />;
        return <Frown color="#000" size={20} />;
    };

    const lastTap = useRef(0);
    const handlePosterPress = () => {
        const now = Date.now();
        if (lastTap.current && now - lastTap.current < 300) {
            toggleLike(); // Double-tap still works for liking
        } else {
            // SINGLE TAP IS NOW NON-RESPONSIVE (User Req)
            // if (!loading) router.push(`/poster/${details.id}/${selectedSeason}` as any);
        }
        lastTap.current = now;
    };

    // RESOLVE POSTER URL
    const resolvedPosterUrl = getResolvedPosterUrl(
        details?.id,
        currentSeasonTMDBPoster,
        globalPosters,
        'w500',
        selectedSeason,
        false // Disable series fallback for seasons (User Requirement)
    );

    const handleRate = () => {
        if (isGuest) {
            router.replace('/login');
            return;
        }
        const userSeasonReview = reviewsData.find((r: any) =>
            r.userId === currentUser?.uid &&
            Number(r.seasonNumber) === Number(selectedSeason) &&
            r.isSeason === true
        );

        triggerSelection();
        setSelectedReviewData(userSeasonReview ? { ...userSeasonReview, seriesName: details.name, name: userSeasonReview.name || details.name } : {
            type: 'season',
            userId: currentUser?.uid,
            tmdbId: details.id,
            seasonNumber: selectedSeason,
            name: details.name,
            seriesName: details.name,
            poster_path: currentSeasonTMDBPoster,
            episodeCount: currentSeasonEpisodeCount,
            isSeason: true,
            isEpisode: false
        });
        setReviewDrawerVisible(true);
    };

    const renderHeader = () => {
        if (!details) return null;

        // PRIORITIZE LOGO (English -> Original Language -> First Available)
        const logo = details.images?.logos?.find((l: any) => l.iso_639_1 === 'en') ||
            details.images?.logos?.find((l: any) => l.iso_639_1 === details.original_language) ||
            details.images?.logos?.[0];

        return (
            <View style={styles.headerContainer}>
                {/* BACKDROP / LOGO AREA - WEB STYLE */}
                <View style={styles.backdropBox}>
                    {logo?.file_path ? (
                        <Image
                            source={{ uri: `https://image.tmdb.org/t/p/w500${logo.file_path}` }}
                            style={styles.logoImage}
                            contentFit="contain"
                        />
                    ) : null}
                </View>

                {/* POSTER CARD */}
                <View style={styles.posterContainer}>
                    <Pressable
                        style={styles.posterWrapper}
                        onPress={handlePosterPress}
                        pointerEvents={loading ? 'none' : 'auto'}
                    >
                        <Image
                            source={{ uri: resolvedPosterUrl || undefined }}
                            style={styles.posterImage}
                            contentFit="cover"
                            transition={500}
                        />

                        {/* HINT TEXT (Parity: MobileIndicator) */}

                        {/* EDIT BUTTON (Always Visible if Rated) */}
                        {isSeasonRated && (
                            <Pressable
                                style={{
                                    position: 'absolute',
                                    top: 10,
                                    right: 10,
                                    backgroundColor: 'rgba(0,0,0,0.6)',
                                    padding: 8,
                                    borderRadius: 20,
                                    borderWidth: 1,
                                    borderColor: 'rgba(255,255,255,0.2)',
                                    zIndex: 10
                                }}
                                onPress={(e) => {
                                    e.stopPropagation();
                                    triggerSelection();
                                    router.push(`/poster/${details.id}/${selectedSeason}`);
                                }}
                            >
                                <Edit2 size={20} color="#FFF" />
                            </Pressable>
                        )}

                        {/* LIKE BUTTON (Bottom Right - Season Specific) */}
                        <Pressable
                            style={{
                                position: 'absolute',
                                bottom: 10,
                                right: 10,
                                zIndex: 10,
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                padding: 8,
                                borderRadius: 50,
                                justifyContent: 'center',
                                alignItems: 'center'
                            }}
                            onPress={(e) => {
                                e.stopPropagation();
                                toggleLike();
                            }}
                        >
                            <Animated.View style={{ transform: [{ scale: likeScale }] }}>
                                <Heart
                                    size={24}
                                    color={isLiked ? "#FF3B30" : "#FFF"}
                                    fill={isLiked ? "#FF3B30" : "transparent"}
                                />
                            </Animated.View>
                        </Pressable>




                    </Pressable>
                </View>

                {/* TITLE & RATINGS ROW */}
                <View
                    style={[styles.infoRow, { paddingHorizontal: 20 }]}
                    onLayout={(e) => {
                        titleY.current = e.nativeEvent.layout.y;
                    }}
                >
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                            <Text style={styles.mainTitle} numberOfLines={2}>
                                {/* Priority: English Translation -> Original Name */}
                                {details.translations?.translations?.find((t: any) => t.iso_639_1 === 'en')?.data?.name || details.name}
                            </Text>
                            {contentRating && (
                                <Pressable
                                    onPress={() => {
                                        triggerSelection();
                                        setShowRatingPopup(true);
                                    }}
                                    style={styles.certBadge}
                                >
                                    <Text style={styles.certBadgeText}>{contentRating}</Text>
                                </Pressable>
                            )}
                        </View>



                        {/* AVAILABILITY ROW */}
                        <View style={styles.availabilityRow}>
                            <Text style={styles.availText}>AVAILABILITY:</Text>
                            {(watchProviders?.flatrate || watchProviders?.rent || watchProviders?.buy) ? (
                                <View style={{ flexDirection: 'row', gap: 5 }}>
                                    {[...(watchProviders.flatrate || []), ...(watchProviders.rent || []), ...(watchProviders.buy || [])]
                                        .slice(0, 3)
                                        .map((provider: any) => (
                                            <Image
                                                key={provider.provider_id}
                                                source={{ uri: `https://image.tmdb.org/t/p/original${provider.logo_path}` }}
                                                style={{ width: 20, height: 20, borderRadius: 4 }}
                                            />
                                        ))}
                                </View>
                            ) : (
                                <Text style={styles.availVal}>UNAVAILABLE</Text>
                            )}
                        </View>

                        <Pressable
                            onPress={() => {
                                triggerSelection();
                                router.push(`/series/${details.id}/more-details`);
                            }}
                            style={{ marginTop: 4 }}
                        >
                            <Text style={{ color: '#FFCC00', fontSize: 12, fontWeight: '900', letterSpacing: 1 }}>
                                MORE DETAILS ›
                            </Text>
                        </Pressable>

                        {/* CONTENT ADVISORY */}
                        <ContentAdvisory
                            genres={details.genres}
                            keywords={details.keywords?.results || []}
                        />
                    </View>

                    {/* CREATORS SECTION */}
                    {details.created_by && details.created_by.length > 0 && (
                        <View style={styles.creatorContainer}>
                            <Text style={styles.createdByLabel}>CREATED BY</Text>
                            {details.created_by.map((creator: any) => (
                                <Pressable
                                    key={creator.id}
                                    onPress={() => {
                                        if (creator?.id) {
                                            triggerSelection();
                                            router.push(`/person/${creator.id}`);
                                        }
                                    }}
                                >
                                    <Text style={styles.creatorName} numberOfLines={1}>
                                        {creator.name}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    )}
                </View>

                {/* ACTION BAR */}
                {/* ACTION BAR */}
                <View style={styles.actionBar}>
                    {/* 1. LIST (Watchlist) */}
                    <GHTouchableOpacity style={styles.actionItem} onPress={toggleWatchlist} activeOpacity={0.6}>
                        {actionLoading.watchlist ? (
                            <ActivityIndicator size="small" color="#FFD600" />
                        ) : inWatchlist ? (
                            <Check size={24} color="#FFD600" />
                        ) : (
                            <Plus size={24} color="#FFF" />
                        )}
                        <Text style={[styles.actionLabel, inWatchlist && { color: '#FFD600' }]}>List</Text>
                    </GHTouchableOpacity>

                    {/* 2. WATCHED (New Button) */}
                    <GHTouchableOpacity style={styles.actionItem} onPress={toggleSeasonWatchedAction} activeOpacity={0.6}>

                        {actionLoading.watched ? (
                            <ActivityIndicator size="small" color={isWatched ? "#46d369" : "#FFF"} />
                        ) : isWatched ? (
                            <Eye size={24} color="#46d369" />
                        ) : (
                            <EyeOff size={24} color="#FFF" />
                        )}
                        <Text style={[styles.actionLabel, isWatched && { color: '#46d369' }]}>
                            {isWatched ? 'Watched' : 'Watch'}
                        </Text>
                    </GHTouchableOpacity>
                    {/* 3. RATE / RATED */}
                    <GHTouchableOpacity style={styles.actionItem} onPress={handleRate} activeOpacity={0.6}>
                        {isSeasonRated ? (
                            <Star size={24} color="#FFCC00" fill="#FFCC00" />
                        ) : (
                            <Star size={24} color="#FFF" />
                        )}
                        <Text style={[styles.actionLabel, isSeasonRated && { color: '#FFCC00' }]}>
                            {isSeasonRated ? 'Rated' : 'Rate'}
                        </Text>
                    </GHTouchableOpacity>

                    {/* 4. SHARE - VISIBLE ONLY IF RATED */}
                    {isSeasonRated && (
                        <GHTouchableOpacity style={styles.actionItem} onPress={() => {
                            triggerSelection();
                            const stickerDataToPass = {
                                movie: {
                                    id: details.id,
                                    name: details.name,
                                    poster_path: resolvedPosterUrl,
                                    seasonEpisode: `Season ${selectedSeason}`
                                },
                                rating: userSeasonReview?.rating || 0,
                                user: currentUser ? {
                                    username: currentUser.displayName || 'User',
                                    photoURL: currentUser.photoURL || undefined
                                } : null,
                                isEpisodes: false,
                                seasonCompleted: isWatched,
                                resolvedPoster: resolvedPosterUrl
                            };
                            router.push({
                                pathname: '/share-sticker',
                                params: { data: JSON.stringify(stickerDataToPass) }
                            });
                        }} activeOpacity={0.6}>
                            <ShareIcon size={24} color="#FFF" />
                            <Text style={styles.actionLabel}>Share</Text>
                        </GHTouchableOpacity>
                    )}
                </View>

            </View >
        );
    };

    if (loading || !details) {
        return (
            <View style={styles.container}>
                <LinearGradient
                    colors={['rgba(0,0,0,0.8)', '#000']}
                    style={StyleSheet.absoluteFill}
                />
                <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                    <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
                        <View style={{ marginTop: 20, marginBottom: 20 }}>
                            <Skeleton width={width * 0.7} height={40} borderRadius={8} />
                        </View>
                        <View style={styles.posterContainer}>
                            <Skeleton width={POSTER_WIDTH} height={POSTER_HEIGHT} borderRadius={12} />
                        </View>
                        <View style={[styles.infoRow, { paddingHorizontal: 20 }]}>
                            <View>
                                <Skeleton width={width * 0.5} height={36} borderRadius={4} />
                                <View style={{ marginTop: 8 }}>
                                    <Skeleton width={80} height={12} borderRadius={2} />
                                </View>
                            </View>
                            <Skeleton width={80} height={40} borderRadius={20} />
                        </View>
                        <View style={[styles.actionBar, { justifyContent: 'center', gap: 30, width: '100%' }]}>
                            {[1, 2, 3, 4].map(i => (
                                <View key={i} style={{ alignItems: 'center', gap: 8 }}>
                                    <Skeleton width={50} height={50} borderRadius={25} />
                                    <Skeleton width={40} height={10} borderRadius={2} />
                                </View>
                            ))}
                        </View>
                    </View>
                </ScrollView>
            </View>
        );
    }

    if (!details) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={{ color: 'white' }}>Series not found</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['rgba(0,0,0,0.8)', '#000']}
                style={StyleSheet.absoluteFill}
            />

            <Animated.ScrollView
                ref={scrollRef}
                stickyHeaderIndices={[7]} // Index 7 is TabsHeader (0:header, 1:awards, 2:ratings, 3:char, 4:trend, 5:watchedby, 6:news, 7:tabs)
                contentContainerStyle={{ paddingBottom: 100 }} // Restored padding for full visibility
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                )}
            >
                {/* 0. HEADER INFO */}
                {renderHeader()}

                {/* 1. AWARDS RECOGNITION (Real Data via TheTVDB/OMDb) */}
                <AwardsRow
                    seriesId={details.id}
                    imdbId={details.external_ids?.imdb_id}
                    tvdbId={details.external_ids?.tvdb_id}
                    releaseYear={details.first_air_date?.split('-')[0]}
                />

                {/* 2. RATINGS SECTION (Swipeable) */}
                <View style={[styles.ratingsSection]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={[styles.ratingsHeader, { marginBottom: 0 }]}>RATINGS</Text>
                            {/* DOT INDICATORS */}
                            <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
                                <View style={{
                                    width: 4,
                                    height: 4,
                                    borderRadius: 2,
                                    backgroundColor: ratingsPage === 0 ? '#FFF' : '#333'
                                }} />
                                <View style={{
                                    width: 4,
                                    height: 4,
                                    borderRadius: 2,
                                    backgroundColor: ratingsPage === 1 ? '#FFF' : '#333'
                                }} />
                            </View>
                        </View>
                        <Text style={{ color: '#666', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
                            {ratingsPage === 0 ? 'SERIEE' : 'TMDB'}
                        </Text>
                    </View>

                    <Animated.View style={[styles.histogramContainer, { transform: [{ translateX: nudgeAnim }] }]}>
                        <ScrollView
                            ref={ratingsListRef}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            scrollEnabled={true}
                            onScroll={(e) => {
                                const page = Math.round(e.nativeEvent.contentOffset.x / (width - 40));
                                if (page !== ratingsPage) {
                                    setRatingsPage(page);
                                }
                            }}
                            scrollEventThrottle={16}
                            snapToInterval={width - 40}
                            decelerationRate="fast"
                        >
                            {/* PAGE 1: SERIEE (Current) */}
                            <View style={{ width: width - 40, marginRight: 0 }}>
                                {activeBarIdx !== null && (
                                    <View style={[
                                        styles.barIndicator,
                                        {
                                            left: 30 + (activeBarIdx * (width - 140) / 10) + ((width - 140) / 10) / 2
                                        }
                                    ]}>
                                        <Text style={styles.indicatorCount}>
                                            {seasonStats.distribution[activeBarIdx]} users
                                        </Text>
                                        <View style={styles.indicatorStars}>
                                            {renderStars((activeBarIdx + 1) * 0.5)}
                                        </View>
                                    </View>
                                )}

                                <View style={styles.histogramWrapper}>
                                    <View style={styles.histogramLeft}>
                                        <Star size={12} color="#FFCC00" fill="#FFCC00" />
                                    </View>
                                    <View style={styles.histogramBars}>
                                        {(seasonStats.distribution || Array(10).fill(0)).map((count, i) => {
                                            const maxCount = Math.max(...(seasonStats.distribution || []), 1);
                                            const barHeight = Math.max((count / maxCount) * 65, 4);
                                            return (
                                                <Pressable
                                                    key={i}
                                                    onPressIn={() => { triggerSelection(); setActiveBarIdx(i); }}
                                                    onPressOut={() => setActiveBarIdx(null)}
                                                    style={({ pressed }) => [
                                                        {
                                                            height: 70,
                                                            justifyContent: 'flex-end',
                                                            opacity: pressed || activeBarIdx === i ? 0.6 : 1
                                                        }
                                                    ]}
                                                >
                                                    <View
                                                        style={[
                                                            styles.histBar,
                                                            {
                                                                height: barHeight,
                                                                backgroundColor: '#FFCC00',
                                                                width: (width - 140) / 10,
                                                                borderRadius: 0,
                                                                borderWidth: 0.5,
                                                                borderColor: 'rgba(0,0,0,0.5)'
                                                            }
                                                        ]}
                                                    />
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                    <View style={styles.histogramRight}>
                                        <Text style={styles.ratingDisplay}>{seasonStats.avg}</Text>
                                        <View style={styles.ratingStars}>
                                            {renderStars(parseFloat(seasonStats.avg), 12)}
                                        </View>
                                    </View>
                                </View>
                            </View>

                            {/* PAGE 2: TMDB (Mirrored) */}
                            <Pressable
                                style={{ width: width - 40 }}
                                onPress={() => {
                                    if (details?.id) {
                                        Linking.openURL(`https://www.themoviedb.org/tv/${details.id}`);
                                    }
                                }}
                            >
                                <View style={styles.histogramWrapper}>
                                    <View style={styles.histogramLeft}>
                                        <Star size={12} color="#87CEEB" fill="#87CEEB" />
                                    </View>
                                    <View style={styles.histogramBars}>
                                        {Array(10).fill(0).map((_, i) => {
                                            const tmdbRating = details?.vote_average || 0;
                                            const filledSegments = Math.round(tmdbRating); // 0-10
                                            const isFilled = i < filledSegments;

                                            return (
                                                <View
                                                    key={i}
                                                    style={{
                                                        height: 70,
                                                        justifyContent: 'flex-end',
                                                    }}
                                                >
                                                    <View
                                                        style={[
                                                            styles.histBar,
                                                            {
                                                                height: isFilled ? 45 : 4,
                                                                backgroundColor: isFilled ? '#87CEEB' : '#222', // Sky Blue
                                                                width: (width - 140) / 10,
                                                                borderRadius: 0,
                                                                borderWidth: 0.5,
                                                                borderColor: 'rgba(0,0,0,0.5)'
                                                            }
                                                        ]}
                                                    />
                                                </View>
                                            );
                                        })}
                                    </View>
                                    <View style={styles.histogramRight}>
                                        <Text style={[styles.ratingDisplay, { color: '#CCC' }]}>
                                            {details?.vote_average ? (details.vote_average / 2).toFixed(1) : "—"}
                                        </Text>
                                        <View style={styles.ratingStars}>
                                            {/* Green Stars for TMDB */}
                                            {renderStars(details?.vote_average ? details.vote_average / 2 : 0, 12, "#46d369")}
                                        </View>
                                    </View>
                                </View>
                            </Pressable>
                        </ScrollView>
                    </Animated.View>
                </View>

                {/* 1.1 CHARACTERS (Season-wise via TVDB/TMDB) */}
                <CharactersRow
                    tvdbId={details.external_ids?.tvdb_id}
                    tmdbId={details.id}
                    allSeasonCredits={allSeasonCredits}
                    selectedSeason={selectedSeason}
                />

                {/* 2. SEASON TRENDING (YouTube) */}
                <SeasonTrending
                    seriesName={details.name}
                    seasonNumber={selectedSeason}
                    tmdbId={details.id}
                />

                {/* 3. WATCHED BY (Friends) */}
                <WatchedBy
                    reviews={reviewsData}
                    following={followingList}
                    seasonNumber={selectedSeason}
                    currentUserId={currentUser?.uid}
                />

                {/* 4.5 NEWS SECTION */}
                {details && (
                    <NewsSection
                        seriesId={details.id}
                        seriesName={details.name}
                        posterPath={details.poster_path}
                        backdrops={details.images?.backdrops?.map((img: any) => img.file_path)}
                    />
                )}

                {/* 5. TABS STICKY HEADER */}
                <View onLayout={(e) => { tabsY.current = e.nativeEvent.layout.y; }}>
                    <TabsHeader
                        tabs={['Episodes', 'Reviews', 'Cast & Crew']}
                        activeTab={activeTab}
                        onTabPress={(tab) => {
                            const tabs = ['Episodes', 'Reviews', 'Cast & Crew'];
                            handleTabPress(tab, tabs.indexOf(tab));
                        }}
                    />
                </View>

                {/* TAB CONTENT AREA (Reverted from swipeable to static to prevent vertical scroll lock) */}
                <View style={{ flex: 1, backgroundColor: '#000' }}>
                    {activeTab === 'Episodes' && (
                        <View style={{ width: '100%', minHeight: 400 }}>
                            {loading ? (
                                <ActivityIndicator size="large" color="#FFD600" style={{ marginTop: 40 }} />
                            ) : (
                                <EpisodesTab
                                    episodes={episodes}
                                    seriesId={details.id}
                                    seriesName={details.name}
                                    posterPath={seasonDetails?.poster_path || details.poster_path}
                                    userData={userData}
                                    onToggleWatched={toggleEpisodeWatched}
                                    onToggleWatchlist={toggleEpisodeWatchlist}
                                    watchlistIDs={episodeWatchlistIDs}
                                    watchedIDs={episodeWatchedIDs}
                                    reviews={reviewsData}
                                    onReviewPress={handleEpisodeReview}
                                    isSeasonWatched={isWatched}
                                    highlightEpisodeNum={params.highlightEpisode ? parseInt(params.highlightEpisode as string) : undefined}
                                />
                            )}
                        </View>
                    )}

                    {activeTab === 'Reviews' && (
                        <View style={{ width: '100%', minHeight: 400 }}>
                            <ReviewsTab
                                reviews={reviewsData}
                                currentUser={currentUser}
                                userData={userData}
                                selectedSeason={selectedSeason}
                                seriesId={details.id}
                            />
                        </View>
                    )}

                    {activeTab === 'Cast & Crew' && (
                        <View style={{ width: '100%', minHeight: 400 }}>
                            <CastCrewTab
                                seasonCredits={allSeasonCredits}
                                onViewMore={() => {
                                    if (details?.id) {
                                        router.push({
                                            pathname: `/series-credits/${details.id}` as any,
                                            params: {
                                                season: selectedSeason,
                                                seasonName: seasonDetails?.name || `Season ${selectedSeason}`
                                            }
                                        });
                                    }
                                }}
                            />
                        </View>
                    )}
                </View>

            </Animated.ScrollView >

            {/* NEW SEASON PICKER MODAL */}
            < NativeModal
                visible={isSeasonPopupOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIsSeasonPopupOpen(false)}
            >
                <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill}>
                    <Pressable style={styles.modalOverlay} onPress={() => setIsSeasonPopupOpen(false)}>
                        <View style={styles.pickerContent}>
                            <Text style={styles.pickerTitle}>SELECT SEASON</Text>
                            <ScrollView
                                style={{ width: '100%' }}
                                contentContainerStyle={styles.pickerScrollContent}
                                showsVerticalScrollIndicator={false}
                            >
                                {details?.seasons?.map((s: any) => (
                                    <Pressable
                                        key={s.id}
                                        style={styles.pickerItem}
                                        onPress={() => handleSeasonChange(s.season_number)}
                                    >
                                        <Image
                                            source={{ uri: `https://image.tmdb.org/t/p/w200${s.poster_path || details.poster_path}` }}
                                            style={styles.pickerPoster}
                                            contentFit="cover"
                                            transition={200}
                                        />
                                        <View style={styles.pickerItemInfo}>
                                            <Text style={[
                                                styles.pickerSeasonName,
                                                s.season_number === selectedSeason && { color: '#FFCC00' }
                                            ]}>
                                                {s.name || `Season ${s.season_number}`}
                                            </Text>
                                            <Text style={styles.pickerYear}>
                                                {s.air_date ? new Date(s.air_date).getFullYear() : 'N/A'}
                                            </Text>
                                        </View>
                                    </Pressable>
                                ))}
                            </ScrollView>
                        </View>
                    </Pressable>
                </BlurView>
            </ NativeModal >

            <NativeModal
                visible={showCeleb}
                transparent
                animationType="fade"
                onRequestClose={handleCelebClose}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.celebBox}>
                        <Check color="#FFCC00" size={48} style={{ alignSelf: 'center', marginBottom: 10 }} />
                        <Text style={styles.celebTitle}>
                            SEASON COMPLETED!
                        </Text>
                        <Text style={styles.celebText}>
                            Share your stats with friends.
                        </Text>
                        <Pressable style={styles.modalBtn} onPress={() => {
                            setIsSeasonPopupOpen(false); // Close parent usage if any (though usually this is standalone)
                            setShowCeleb(false);
                        }}>
                            <Text style={styles.modalBtnText}>OK</Text>
                        </Pressable>
                    </View>
                </View>
            </NativeModal>

            {/* RATING REASON POPUP */}
            <NativeModal
                visible={showRatingPopup}
                transparent
                animationType="fade"
                onRequestClose={() => setShowRatingPopup(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setShowRatingPopup(false)}>
                    <View style={[styles.celebBox, { width: 280, padding: 20 }]}>
                        <View style={[styles.certBadge, { marginBottom: 10, alignSelf: 'center', borderColor: '#FFCC00' }]}>
                            <Text style={[styles.certBadgeText, { color: '#FFCC00', fontSize: 14 }]}>{contentRating}</Text>
                        </View>
                        <Text style={[styles.celebTitle, { fontSize: 16, marginBottom: 12 }]}>CERTIFICATION REASON</Text>
                        <Text style={[styles.celebText, { color: '#CCC', fontSize: 13, marginBottom: 20 }]}>
                            {ratingReason}
                        </Text>
                        <Pressable
                            style={[styles.modalBtn, { paddingVertical: 8 }]}
                            onPress={() => setShowRatingPopup(false)}
                        >
                            <Text style={[styles.modalBtnText, { fontSize: 14 }]}>CLOSE</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </NativeModal>

            {/* REVIEW DRAWER (IN-PAGE) */}
            <ReviewDrawer
                visible={reviewDrawerVisible}
                onClose={() => setReviewDrawerVisible(false)}
                reviewData={selectedReviewData}
                onReviewChanged={(submittedReview) => {
                    // Refresh reviews locally
                    if (id) {
                        reviewService.getSeriesReviews(parseInt(id as string)).then(setReviewsData);
                    }

                    // AUTO-WATCH LOGIC: If an episode was rated, mark it as watched
                    if (submittedReview && submittedReview.isEpisode && submittedReview.episodeNumber) {
                        const epKey = `${submittedReview.seasonNumber}-${submittedReview.episodeNumber}`;

                        // Optimistic Check before calling service (though service is idempotent)
                        if (!episodeWatchedIDs.has(epKey)) {
                            console.log(`[Auto-Watch] Marking Season ${submittedReview.seasonNumber} Episode ${submittedReview.episodeNumber} as watched due to rating.`);

                            // Construct a minimal episode object for the toggle function
                            // or call service directly + update state. 
                            // Re-using toggleEpisodeWatched is risky if logic flips. 
                            // Safer to duplicate strict "MARK" logic here or extract "mark" function.

                            // DIRECT UPDATE APPROACH (Safer than toggle)
                            const epObj = {
                                season_number: submittedReview.seasonNumber,
                                episode_number: submittedReview.episodeNumber,
                                id: -1 // Id not strictly needed for basic mark, but might be for watchlist removal if lookup fails.
                                // Ideally we need real ID to remove from watchlist properly.
                            };

                            // Since we don't have the full episode ID easily without lookup, 
                            // we can rely on `toggleEpisodeWatched` handling "unwatch" if already watched,
                            // BUT we just checked `!episodeWatchedIDs.has`. So calling toggle is safe to "MARK".
                            // However, fast state updates might make `has` stale? 
                            // Actually, since this runs closely after the drawer closes, user can't race it much.
                            // BUT `toggleEpisodeWatched` uses functional state update now, so it is safer.

                            // Let's find the episode object from `episodes` state to get the real ID for watchlist removal
                            const realEp = episodes.find(e => e.season_number === submittedReview.seasonNumber && e.episode_number === submittedReview.episodeNumber);

                            if (realEp) {
                                toggleEpisodeWatched(realEp);
                            }
                        }
                    }
                }}
            />
        </View >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    loadingContainer: {
        flex: 1,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerContainer: {
        alignItems: 'center',
        paddingTop: 20,
    },
    backdropBox: {
        width: '100%',
        height: 100, // Restored from 60
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20 // Restored from 10
    },
    logoImage: {
        width: '80%',
        height: 80
    },
    textTitle: {
        color: '#FFF',
        fontSize: 32,
        fontWeight: '700',
        letterSpacing: -0.5,
        textTransform: 'uppercase',
        textAlign: 'center'
    },
    posterContainer: {
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 10
    },
    posterWrapper: {
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 12
    },
    posterImage: {
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },
    infoRow: {
        flexDirection: 'row',
        width: '100%',
        paddingHorizontal: 16,
        marginBottom: 20,
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    mainTitle: {
        color: '#FFF',
        fontSize: 42,
        fontFamily: 'Anton-Regular',
        fontWeight: '400',
        textTransform: 'uppercase',
        lineHeight: 46,
        textAlign: 'left',
        alignSelf: 'flex-start',
    },
    certBadge: {
        borderWidth: 1,
        borderColor: '#888',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 2,
        backgroundColor: 'transparent',
        alignSelf: 'center',
    },
    certBadgeText: {
        color: '#888',
        fontSize: 10,
        fontWeight: 'bold',
    },
    availabilityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 5
    },
    availText: {
        color: '#666',
        fontSize: 10,
        fontWeight: 'bold',
        marginRight: 5
    },
    availVal: {
        color: '#444',
        fontSize: 10
    },
    ratingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 5,
        paddingHorizontal: 12,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#333'
    },
    emojiCircle: {
        width: 28,
        height: 28,
        backgroundColor: '#FFCC00',
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8
    },
    ratingValue: {
        color: '#46d369',
        fontSize: 16,
        fontWeight: 'bold'
    },
    actionBar: {
        flexDirection: 'row',
        justifyContent: 'center', // Centered
        alignItems: 'center',
        gap: 32, // approx 1 inch visual gap (32-40px)
        marginTop: 20,
        marginBottom: 20
    },
    actionItem: {
        alignItems: 'center',
        gap: 8 // Spacing between icon and text
    },
    actionLabel: {
        color: '#BBB',
        fontSize: 12,
        fontWeight: '700', // Bold 5px equivalent weight
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    overviewText: {
        color: '#CCC',
        fontSize: 14,
        lineHeight: 20,
        fontWeight: '400',
        letterSpacing: -0.2,
        textAlign: 'center',
        width: CONTENT_WIDTH,
        marginBottom: 30
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    pickerContent: {
        width: '100%',
        maxHeight: '80%',
        alignItems: 'center',
    },
    pickerTitle: {
        color: '#FFF',
        fontSize: 18,
        fontFamily: 'Anton-Regular',
        marginBottom: 30,
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    pickerScrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
        alignItems: 'center',
    },
    pickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
        width: width * 0.85,
    },
    pickerPoster: {
        width: 70,
        height: 100,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    pickerItemInfo: {
        marginLeft: 20,
        flex: 1,
        justifyContent: 'center',
    },
    pickerSeasonName: {
        color: '#FFF',
        fontSize: 18,
        fontFamily: 'Anton-Regular',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    pickerYear: {
        color: '#666',
        fontSize: 14,
        marginTop: 4,
        fontWeight: '600',
    },

    celebBox: {
        width: 260,
        backgroundColor: '#000',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#222',
        padding: 30,
        alignItems: 'center'
    },
    celebTitle: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: -0.5,
        textTransform: 'uppercase',
        marginBottom: 8,
        textAlign: 'center'
    },
    celebText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '400',
        letterSpacing: -0.2,
        marginBottom: 20,
        textAlign: 'center'
    },
    modalBtn: {
        backgroundColor: '#FFD600',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 8,
        width: '100%',
        alignItems: 'center'
    },
    modalBtnText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16
    },
    creatorContainer: {
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        minWidth: 100,
        marginTop: -10
    },
    createdByLabel: {
        color: '#666',
        fontSize: 8,
        fontFamily: 'Anton-Regular',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 2
    },
    creatorName: {
        color: '#FFF',
        fontSize: 11,
        fontFamily: 'Anton-Regular',
        textTransform: 'uppercase',
        letterSpacing: 0.2
    },
    ratingsSection: { //black border for rating
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderTopWidth: 1.5,
        borderTopColor: '#444',
        backgroundColor: '#000',
        width: '100%',
    },
    ratingsHeader: {
        color: '#666',
        fontSize: 12,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 8, // Tighter
    },
    histogramContainer: {
        position: 'relative',
        height: 95, // Reduced from 110
        justifyContent: 'flex-end',
        marginTop: 5
    },
    barIndicator: { //ratings bar indicator
        position: 'absolute',
        top: 0,
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        alignItems: 'center',
        zIndex: 100,
        width: 80, // Fixed width for stable centering
        transform: [{ translateX: -40 }] // Perfectly center the 80px width
    },
    indicatorCount: { //ratings bar indicator count
        color: '#FFF',
        fontSize: 10,
        fontWeight: '700',
        marginBottom: 2
    },
    indicatorStars: {
        flexDirection: 'row',
        gap: 1
    },
    histogramWrapper: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 10,
        height: 65 // Reduced from 70
    },
    histogramLeft: {
        width: 20,
        alignItems: 'center',
        paddingBottom: 2
    },
    histogramBars: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingHorizontal: 0,
        height: 65, // Reduced from 70
        width: width - 140,
    },
    histBar: {
        borderRadius: 0
    },
    histogramRight: {
        width: 60,
        alignItems: 'flex-end',
        justifyContent: 'flex-end',
        gap: 2,
    },
    ratingDisplay: {
        color: '#FFF',
        fontSize: 34, // Slightly larger
        fontWeight: '200', // Much thinner
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-light',
        lineHeight: 38,
    },
    ratingStars: {
        flexDirection: 'row',
        gap: 2 // Small gap
    }
});
