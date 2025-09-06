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

export async function fetchHistoryList(presentationId: string): Promise<HistoryListItem[]> {
    const urls = [
        `${BASE}/presentations/${presentationId}/histories`,
        `${BASE}/presentation/${presentationId}/histories`,
    ];

    let res: Response | null = null;
    for (const u of urls) {
        res = await fetch(u, { mode: "cors", credentials: "omit", headers: { Accept: "application/json" } });
        if (res.ok) break;
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
    presentationId: string,
    historyId: string
): Promise<HistorySlideApi[]> {
    const urls = [
        `${BASE}/presentations/${presentationId}/histories/${historyId}`,
        `${BASE}/presentation/${presentationId}/histories/${historyId}`,
    ];

    let res: Response | null = null;
    for (const u of urls) {
        res = await fetch(u, { mode: "cors", credentials: "omit", headers: { Accept: "application/json" } });
        if (res.ok) break;
    }
    if (!res || !res.ok) throw new Error("Failed to load history detail");

    const json = await res.json();
    const arr: unknown = Array.isArray(json) ? json : json?.slides;
    if (!Array.isArray(arr)) return [];
    return arr as HistorySlideApi[];
}