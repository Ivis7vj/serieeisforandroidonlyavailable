export interface AwardItem {
    id: string;
    name: string;
    year: string;
    category?: string;
    count?: string;
    isWinner: boolean;
    icon?: 'trophy' | 'star' | 'medal';
}

// Map of TMDB Series ID -> Awards List
export const REAL_AWARDS_CACHE: Record<number, AwardItem[]> = {
    // Breaking Bad
    1396: [
        { id: 'bb-1', name: 'Primetime Emmy', year: '2014', category: 'Outstanding Drama Series', isWinner: true, icon: 'trophy' },
        { id: 'bb-2', name: 'Golden Globe', year: '2014', category: 'Best Television Series - Drama', isWinner: true, icon: 'star' },
        { id: 'bb-3', name: 'SAG Award', year: '2014', category: 'Outstanding Performance by an Ensemble', isWinner: true, icon: 'medal' },
    ],
    // Game of Thrones
    1399: [
        { id: 'got-1', name: 'Primetime Emmy', year: '2019', category: 'Outstanding Drama Series', isWinner: true, icon: 'trophy' },
        { id: 'got-2', name: 'Golden Globe', year: '2012', category: 'Best Supporting Actor', isWinner: true, icon: 'star' },
        { id: 'got-3', name: 'BAFTA TV', year: '2013', category: 'Audience Award', isWinner: true, icon: 'medal' },
    ],
    // Succession
    76331: [
        { id: 'suc-1', name: 'Primetime Emmy', year: '2024', category: 'Outstanding Drama Series', isWinner: true, icon: 'trophy' },
        { id: 'suc-2', name: 'Golden Globe', year: '2024', category: 'Best Television Series - Drama', isWinner: true, icon: 'star' },
        { id: 'suc-3', name: 'Critics Choice', year: '2024', category: 'Best Drama Series', isWinner: true, icon: 'medal' },
    ],
    // The Bear
    114479: [
        { id: 'tb-1', name: 'Primetime Emmy', year: '2024', category: 'Outstanding Comedy Series', isWinner: true, icon: 'trophy' },
        { id: 'tb-2', name: 'Golden Globe', year: '2024', category: 'Best Television Series - Musical or Comedy', isWinner: true, icon: 'star' },
        { id: 'tb-3', name: 'SAG Award', year: '2024', category: 'Outstanding Performance by an Ensemble', isWinner: true, icon: 'medal' },
    ],
    // Stranger Things
    66732: [
        { id: 'st-1', name: 'Primetime Emmy', year: '2017', category: 'Outstanding Main Title Design', isWinner: true, icon: 'trophy' },
        { id: 'st-2', name: 'SAG Award', year: '2017', category: 'Outstanding Performance by an Ensemble', isWinner: true, icon: 'medal' },
        { id: 'st-3', name: 'MTV Movie & TV', year: '2018', category: 'Show of the Year', isWinner: true, icon: 'star' },
    ],
    // The Crown
    65494: [
        { id: 'tc-1', name: 'Primetime Emmy', year: '2021', category: 'Outstanding Drama Series', isWinner: true, icon: 'trophy' },
        { id: 'tc-2', name: 'Golden Globe', year: '2017', category: 'Best Television Series - Drama', isWinner: true, icon: 'star' },
    ],
    // Ted Lasso
    97546: [
        { id: 'tl-1', name: 'Primetime Emmy', year: '2022', category: 'Outstanding Comedy Series', isWinner: true, icon: 'trophy' },
        { id: 'tl-2', name: 'Golden Globe', year: '2021', category: 'Best Actor - Television Series Musical or Comedy', isWinner: true, icon: 'star' },
    ],
    // Squid Game
    93405: [
        { id: 'sg-1', name: 'Primetime Emmy', year: '2022', category: 'Outstanding Lead Actor in a Drama Series', isWinner: true, icon: 'trophy' },
        { id: 'sg-2', name: 'SAG Award', year: '2022', category: 'Outstanding Action Performance by a Stunt Ensemble', isWinner: true, icon: 'medal' },
    ],
};
