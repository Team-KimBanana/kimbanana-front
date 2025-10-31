import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import "./History.css";
import Header from "../components/Header/Header.tsx";
import Sidebar from "../components/Sidebar/Sidebar.tsx";
import HistoryList, { HistoryEntry } from "../components/HistoryList/HistoryList.tsx";
import Canvas from "../components/Canvas/Canvas.tsx";
import ThumbnailRenderer from "../components/ThumbnailRenderer/ThumbnailRenderer.tsx";
import { Shape, TextItem } from "../types/types.ts";
import { useNavigate, useParams } from "react-router-dom";
import { fetchHistoryList, fetchHistorySlides } from "../api/history";
import { useAuth } from "../contexts/AuthContext.tsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

type SlideData = { shapes: Shape[]; texts: TextItem[] };
type SlideOrder = { id: string; order: number };
type Mapping = { target_slide: string; history_slide: string };

const baseHistoryId = (uid: string) => uid.split("__")[0];

const toKoreanDate = (iso: string) => {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const m = d.getMonth() + 1;
    const dd = d.getDate();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return { dateOnly: `${yyyy}년 ${m}월 ${dd}일`, dateTime: `${yyyy}년 ${m}월 ${dd}일 ${hh}:${mm}` };
};

const toSlideData = (raw: unknown): SlideData => {
    let d = raw;
    if (typeof d === "string") {
        try { d = JSON.parse(d); } catch { d = {}; }
    }
    const obj: unknown = d && typeof d === "object" ? d : {};
    const slideObj = obj as { shapes?: unknown, texts?: unknown };

    return {
        shapes: Array.isArray(slideObj.shapes) ? slideObj.shapes as Shape[] : [],
        texts: Array.isArray(slideObj.texts) ? slideObj.texts as TextItem[] : [],
    };
};

const cloneSlideData = (s: SlideData) =>
    (typeof structuredClone === "function" ? structuredClone(s) : JSON.parse(JSON.stringify(s)));

const History: React.FC = () => {
    const navigate = useNavigate();
    const { presentationId } = useParams();

    const { user, getAuthToken } = useAuth?.() ?? ({
        user: null,
        getAuthToken: () => Promise.resolve(null)
    } as never);

    const userId = user?.name || user?.id || "anonymous";

    const [currentSlidesOrder, setCurrentSlidesOrder] = useState<SlideOrder[]>([]);
    const [slideDataMap, setSlideDataMap] = useState<Record<string, SlideData>>({});
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
    const [selectedCurrentSlide, setSelectedCurrentSlide] = useState<string>("");

    const [restoreSlidesOrder, setRestoreSlidesOrder] = useState<SlideOrder[]>([]);
    const [selectedRestoreSlide, setSelectedRestoreSlide] = useState<string | null>(null);

    const [histories, setHistories] = useState<HistoryEntry[]>([]);
    const [selectedHistoryUid, setSelectedHistoryUid] = useState<string | null>(null);

    const [pendingMappings, setPendingMappings] = useState<Mapping[]>([]);

    const restoreIdToHistoryId = useRef<Record<string, string>>({});
    const toHistorySlideId = (prefixedId: string) => restoreIdToHistoryId.current[prefixedId] ?? prefixedId;

    const selectedTitle = useMemo(
        () => histories.find(h => h.historyId === selectedHistoryUid)?.displayDateTime ?? "히스토리",
        [histories, selectedHistoryUid]
    );

    const shownSlideId = useMemo(
        () => selectedRestoreSlide || selectedCurrentSlide || "",
        [selectedRestoreSlide, selectedCurrentSlide]
    );
    const current = shownSlideId ? slideDataMap[shownSlideId] : undefined;

    const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
        const token = await getAuthToken();
        const headers = {
            ...options.headers,
            Accept: "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
        };
        return fetch(url, {
            ...options,
            mode: "cors",
            credentials: "include",
            headers,
        });
    }, [getAuthToken]);

    useEffect(() => {
        if (!presentationId || !getAuthToken) return;
        (async () => {
            try {
                const res = await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides`);
                if (!res.ok) {
                    console.error("슬라이드 목록 로드 실패:", res.status);
                    return;
                }

                const json = await res.json();
                const slideList: { slide_id: string; order: number; data?: unknown }[] =
                    Array.isArray(json.slides) ? json.slides : [];
                if (slideList.length === 0) return;

                const orders = slideList
                    .map(s => ({ id: s.slide_id, order: s.order }))
                    .sort((a, b) => a.order - b.order);

                const entries = await Promise.all(slideList.map(async s => {
                    let d: unknown = s.data;
                    if (d === undefined) {
                        const dRes = await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides/${s.slide_id}`);
                        d = dRes.ok ? (await dRes.json())?.data : undefined;
                    }
                    return [s.slide_id, toSlideData(d)] as [string, SlideData];
                }));

                setCurrentSlidesOrder(orders);
                setSlideDataMap(prev => ({ ...prev, ...Object.fromEntries(entries) }));
                setSelectedCurrentSlide(prev => prev || orders[0].id);
            } catch (e) {
                console.error("현재 슬라이드 불러오기 오류:", e);
            }
        })();
    }, [presentationId, getAuthToken, fetchWithAuth]);

    useEffect(() => {
        if (!presentationId || !getAuthToken) return;
        (async () => {
            try {
                const token = await getAuthToken();
                // fetchHistoryList 함수가 토큰 인수를 받도록 수정되었다고 가정
                const list = await fetchHistoryList(presentationId, token);

                setHistories(
                    list.map(it => {
                        const f = toKoreanDate(it.lastRevisionISO);
                        return { historyId: `${it.historyId}__${it.lastRevisionISO}`, displayDateOnly: f.dateOnly, displayDateTime: f.dateTime };
                    })
                );
            } catch (e) {
                console.error("히스토리 목록 로드 실패:", e);
            }
        })();
    }, [presentationId, getAuthToken]);

    useEffect(() => {
        if (!presentationId || !selectedHistoryUid || !getAuthToken) {
            setRestoreSlidesOrder([]); setSelectedRestoreSlide(null);
            setPendingMappings([]);   restoreIdToHistoryId.current = {};
            return;
        }

        (async () => {
            try {
                const token = await getAuthToken();
                const raw = await fetchHistorySlides(presentationId, baseHistoryId(selectedHistoryUid), token);
                if (raw.length === 0) {
                    setRestoreSlidesOrder([]); setSelectedRestoreSlide(null);
                    return;
                }

                restoreIdToHistoryId.current = {};
                const orders: SlideOrder[] = raw
                    .map(s => {
                        const rid = `restore-${selectedHistoryUid}-${s.slide_id}`;
                        restoreIdToHistoryId.current[rid] = s.slide_id;
                        return { id: rid, order: s.order };
                    })
                    .sort((a, b) => a.order - b.order);

                const entries = await Promise.all(
                    raw.map(async s => {
                        const id = `restore-${selectedHistoryUid}-${s.slide_id}`;
                        return [id, toSlideData(s.data)] as [string, SlideData];
                    })
                );

                setRestoreSlidesOrder(orders);
                setSlideDataMap(prev => ({ ...prev, ...Object.fromEntries(entries) }));
                setSelectedRestoreSlide(orders[0]?.id ?? null);
            } catch (e) {
                console.error("히스토리 단건 조회 실패:", e);
                setRestoreSlidesOrder([]); setSelectedRestoreSlide(null);
            }
        })();
    }, [presentationId, selectedHistoryUid, getAuthToken]);

    const handleThumbnailRendered = useCallback((slideId: string, dataUrl: string) => {
        setThumbnails(prev => ({ ...prev, [slideId]: dataUrl }));
    }, []);

    const handleRestoreSelectedOne = useCallback(() => {
        if (!selectedCurrentSlide || !selectedRestoreSlide) return;

        const restoreData = slideDataMap[selectedRestoreSlide];
        if (restoreData) {
            setSlideDataMap(prev => ({ ...prev, [selectedCurrentSlide]: cloneSlideData(restoreData) }));
        }

        const historySlideId = toHistorySlideId(selectedRestoreSlide);
        setPendingMappings(prev => [
            ...prev.filter(m => m.target_slide !== selectedCurrentSlide),
            { target_slide: selectedCurrentSlide, history_slide: historySlideId },
        ]);
    }, [selectedCurrentSlide, selectedRestoreSlide, slideDataMap]);

    const handleApplyRestore = useCallback(async () => {
        if (!presentationId || !selectedHistoryUid) return;
        try {
            const res = await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/restorations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "partial",
                    history_id: baseHistoryId(selectedHistoryUid),
                    last_revision_user_id: userId,
                    mappings: pendingMappings,
                }),
            });
            if (res.status >= 200 && res.status < 400) {
                alert("선택한 슬라이드가 복원되었습니다."); navigate(`/editor/${presentationId}`);
            } else {
                const detail = await res.text().catch(() => "");
                alert(`부분 복원 실패 (${res.status})\n${detail || "서버 응답이 없습니다."}`);
            }
        } catch (e) {
            console.error(e); alert("복원 적용 중 오류가 발생했습니다.");
        }
    }, [presentationId, selectedHistoryUid, pendingMappings, userId, navigate, fetchWithAuth]);

    const handleRestoreAllSlides = useCallback(async () => {
        if (!presentationId || !selectedHistoryUid) return;
        if (!window.confirm("선택한 히스토리의 전체 슬라이드를 현재 프레젠테이션에 복원할까요?")) return;

        try {
            const res = await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/restorations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "all",
                    history_id: baseHistoryId(selectedHistoryUid),
                    last_revision_user_id: userId,
                }),
            });
            if (res.status >= 200 && res.status < 400) {
                alert("복원이 완료되었습니다."); navigate(`/editor/${presentationId}`);
            } else {
                const detail = await res.text().catch(() => "");
                alert(`히스토리 복원 실패 (${res.status})\n${detail || "서버 응답이 없습니다."}`);
            }
        } catch (e) {
            console.error("히스토리 복원 중 오류:", e);
            alert("히스토리 복원 중 오류가 발생했습니다.");
        }
    }, [presentationId, selectedHistoryUid, userId, navigate, fetchWithAuth]);

    return (
        <div className="history">
            <Header variant="history" title={selectedTitle} onApplyRestore={handleApplyRestore} />

            <div className="history-body">
                <Sidebar
                    variant="current"
                    slides={currentSlidesOrder.map(s => s.id)}
                    currentSlide={selectedCurrentSlide}
                    setCurrentSlide={setSelectedCurrentSlide}
                    thumbnails={thumbnails}
                    selectedSlides={[selectedCurrentSlide]}
                    setSelectedSlides={slides => {
                        const selected = typeof slides === "function" ? slides([])[0] : slides[0];
                        setSelectedCurrentSlide(selected || ""); return slides;
                    }}
                />

                <Sidebar
                    variant="restore"
                    slides={restoreSlidesOrder.map(s => s.id)}
                    currentSlide={selectedRestoreSlide || ""}
                    setCurrentSlide={id => {
                        const newId = typeof id === "function" ? id(selectedRestoreSlide ?? "") : id;
                        setSelectedRestoreSlide(newId);
                    }}
                    thumbnails={thumbnails}
                    selectedSlides={selectedRestoreSlide ? [selectedRestoreSlide] : []}
                    setSelectedSlides={slides => {
                        const selected = typeof slides === "function" ? slides([])[0] : slides[0];
                        setSelectedRestoreSlide(selected || null); return slides;
                    }}
                    onRestoreSelected={handleRestoreSelectedOne}
                    isRestoreEnabled={!!(selectedCurrentSlide && selectedRestoreSlide)}
                    onRestoreAll={handleRestoreAllSlides}
                    isRestoreAllEnabled={!!selectedHistoryUid}
                />

                <div className="history-canvas">
                    <Canvas
                        activeTool="cursor"
                        selectedColor="#000000"
                        setSelectedColor={() => {}}
                        setActiveTool={() => {}}
                        shapes={current?.shapes || []}
                        setShapes={() => {}}
                        texts={current?.texts || []}
                        setTexts={() => {}}
                        currentSlide={shownSlideId}
                        updateThumbnail={() => {}}
                        sendEdit={() => {}}
                        setIsTyping={() => {}}
                        defaultFontSize={20}
                        isHistoryPage={true}
                        onSelectShape={() => {}}
                        onSelectText={() => {}}
                    />

                    {Object.entries(slideDataMap).map(([id, data]) => (
                        <ThumbnailRenderer key={id} slideId={id} slideData={data} onRendered={handleThumbnailRendered} />
                    ))}
                </div>

                <HistoryList
                    histories={histories}
                    selectedHistoryId={selectedHistoryUid}
                    onSelect={uid => setSelectedHistoryUid(uid)}
                />
            </div>
        </div>
    );
};

export default History;