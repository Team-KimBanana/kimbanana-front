const BASE = import.meta.env.VITE_API_BASE_URL;

export type HistoryListItem = {
    historyId: string;
    lastRevisionISO: string;
};

type HistoryApiItem = {
    historyId: string;
    lastRevisionDate: string;
};

export type HistorySlideApi = {
    slide_id: string;
    order: number;
    data?: unknown;
};

export async function fetchHistoryList(presentationId: string, token: string | null): Promise<HistoryListItem[]> {
    const urls = [
        `${BASE}/presentations/${presentationId}/histories`,
        `${BASE}/presentation/${presentationId}/histories`,
    ];

    const headers: Record<string, string> = {
        'Accept': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    let res: Response | null = null;
    for (const u of urls) {
        res = await fetch(u, { mode: "cors", credentials: "include", headers });
        if (res.ok) break;
    }

    if (res && res.status === 403) {
        throw new Error("인증 실패 (403 Forbidden). 유효한 토큰이 필요합니다.");
    }
    if (!res || !res.ok) throw new Error("Failed to load histories");

    const list = (await res.json()) as HistoryApiItem[];
    const mapped: HistoryListItem[] = list.map((it) => ({
        historyId: it.historyId,
        lastRevisionISO: it.lastRevisionDate,
    }));

    mapped.sort((a, b) => new Date(b.lastRevisionISO).getTime() - new Date(a.lastRevisionISO).getTime());
    return mapped;
}

export async function fetchHistorySlides(
    presentationId: string, historyId: string, token: string | null): Promise<HistorySlideApi[]> {
    const urls = [
        `${BASE}/presentations/${presentationId}/histories/${historyId}`,
        `${BASE}/presentation/${presentationId}/histories/${historyId}`,
    ];

    const headers: Record<string, string> = {
        'Accept': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    let res: Response | null = null;
    for (const u of urls) {
        res = await fetch(u, { mode: "cors", credentials: "include", headers });
        if (res.ok) break;
    }

    if (res && res.status === 403) {
        throw new Error("인증 실패 (403 Forbidden). 히스토리 상세 정보를 불러올 권한이 없습니다.");
    }
    if (!res || !res.ok) throw new Error("Failed to load history detail");

    const json = await res.json();
    const arr: unknown = Array.isArray(json) ? json : json?.slides;
    if (!Array.isArray(arr)) return [];
    return arr as HistorySlideApi[];
}