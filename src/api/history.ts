const BASE = import.meta.env.VITE_API_BASE_URL; // 예: http://localhost:8080

export type HistoryListItem = {
    historyId: string;
    lastRevisionISO: string; // ex) "2025-03-26T15:00:00"
};

export async function fetchHistoryList(presentationId: string): Promise<HistoryListItem[]> {
    // 서버 문서에 presentation(s) 혼용이 있어 둘 다 대응
    const urls = [
        `${BASE}/api/presentations/${presentationId}/histories`,
        `${BASE}/api/presentation/${presentationId}/histories`,
    ];

    let res: Response | null = null;
    for (const u of urls) {
        res = await fetch(u, { credentials: "include", headers: { Accept: "application/json" } });
        if (res.ok) break;
    }
    if (!res || !res.ok) throw new Error("Failed to load histories");

    const json = await res.json();
    const list = (json?.historyList ?? []) as any[];

    // 스펙 예시에 오타(hitory_id) 가능성 있어서 방어
    const mapped: HistoryListItem[] = list.map((it) => ({
        historyId: it.history_id ?? it.hitory_id, // 둘 다 체크
        lastRevisionISO: it.lastRevision_date,
    }));

    // 최신순 정렬
    mapped.sort(
        (a, b) => new Date(b.lastRevisionISO).getTime() - new Date(a.lastRevisionISO).getTime()
    );
    return mapped;
}
