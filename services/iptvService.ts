import { IPTVChannel } from '../types';

let channelsCache: IPTVChannel[] | null = null;
const CHANNEL_LIST_URL = 'https://raw.githubusercontent.com/vuminhthanh12/vuminhthanh12/refs/heads/main/vmttv';

function parseM3U(m3uString: string): IPTVChannel[] {
    const lines = m3uString.split('\n');
    const channels: IPTVChannel[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('#EXTINF:')) {
            const infoLine = lines[i];
            const urlLine = lines[i + 1];
            if (urlLine && !urlLine.startsWith('#')) {
                const nameMatch = infoLine.match(/tvg-name="([^"]+)"/);
                const logoMatch = infoLine.match(/tvg-logo="([^"]+)"/);
                const fallbackNameMatch = infoLine.match(/,(.+)$/);
                
                const name = nameMatch ? nameMatch[1].trim() : (fallbackNameMatch ? fallbackNameMatch[1].trim() : 'Unknown');
                const logo = logoMatch ? logoMatch[1].trim() : '';
                const url = urlLine.trim();
                
                if (name !== 'Unknown' && url) {
                    channels.push({ name, logo, url });
                }
            }
        }
    }
    return channels;
}

export const fetchChannels = async (): Promise<IPTVChannel[]> => {
    if (channelsCache) {
        return channelsCache;
    }
    try {
        const response = await fetch(CHANNEL_LIST_URL);
        if (!response.ok) {
            throw new Error(`Lỗi mạng: ${response.statusText}`);
        }
        const m3uData = await response.text();
        const parsedChannels = parseM3U(m3uData);
        channelsCache = parsedChannels;
        return parsedChannels;
    } catch (error) {
        console.error("Không thể tải danh sách kênh TV:", error);
        return [];
    }
};

/**
 * Calculates the Levenshtein distance between two strings.
 * A measure of the difference between two sequences.
 * @param a The first string.
 * @param b The second string.
 * @returns The Levenshtein distance.
 */
function levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) {
        matrix[0][i] = i;
    }
    for (let j = 0; j <= b.length; j++) {
        matrix[j][0] = j;
    }

    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j][i - 1] + 1,          // deletion
                matrix[j - 1][i] + 1,          // insertion
                matrix[j - 1][i - 1] + cost  // substitution
            );
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Normalizes a string for better search comparison.
 * - Converts to lowercase.
 * - Replaces written-out numbers with digits.
 * - Removes common filler words.
 * - Removes "HD" variants and extra whitespace.
 * @param query The input string.
 * @returns The normalized string.
 */
function normalizeQuery(query: string): string {
    const fillerWords = ['mở', 'kênh', 'xem', 'cho', 'tôi', 'hd'];
    const numberMap: { [key: string]: string } = {
        'một': '1', 'hai': '2', 'ba': '3', 'bốn': '4', 'tư': '4', 'năm': '5', 
        'sáu': '6', 'bảy': '7', 'tám': '8', 'chín': '9', 'mười': '10'
    };

    let normalized = query.toLowerCase();
    
    // Replace written-out numbers with digits
    for (const word in numberMap) {
        normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), numberMap[word]);
    }

    // Remove filler words
    for (const word of fillerWords) {
        normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
    }

    // Remove all non-alphanumeric characters except spaces, then collapse spaces
    return normalized.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

export const findChannel = async (query: string): Promise<IPTVChannel | null> => {
    const channels = await fetchChannels();
    if (channels.length === 0) return null;

    const normalizedQuery = normalizeQuery(query);

    // --- Tier 1: Exact and Substring Match (Fast and Accurate) ---
    for (const channel of channels) {
        const normalizedName = normalizeQuery(channel.name);
        if (normalizedName === normalizedQuery) {
            return channel; // Perfect match
        }
    }
    for (const channel of channels) {
        const normalizedName = normalizeQuery(channel.name);
        if (normalizedName.includes(normalizedQuery)) {
            return channel; // Substring match
        }
    }

    // --- Tier 2: Fuzzy Search (Slower but more flexible) ---
    let bestMatch: IPTVChannel | null = null;
    let minDistance = Infinity;

    for (const channel of channels) {
        const normalizedName = normalizeQuery(channel.name);
        const distance = levenshteinDistance(normalizedQuery, normalizedName);

        if (distance < minDistance) {
            minDistance = distance;
            bestMatch = channel;
        }
    }

    // Set a reasonable threshold to avoid nonsensical matches.
    // A distance of less than 3 suggests a very close match (e.g., minor typo/mispronunciation).
    // Allow a more lenient threshold for longer queries.
    const threshold = Math.floor(normalizedQuery.length / 3);
    if (bestMatch && minDistance <= Math.max(2, threshold)) {
        return bestMatch;
    }

    return null; // No confident match found
};