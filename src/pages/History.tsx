import React, { useEffect, useState } from "react";
import "./History.css";
import Header from "../components/Header/Header.tsx";
import Sidebar from "../components/Sidebar/Sidebar.tsx";
import HistoryList, { HistoryEntry } from "../components/HistoryList/HistoryList.tsx";
import Canvas from "../components/Canvas/Canvas.tsx";
import ThumbnailRenderer from "../components/ThumbnailRenderer/ThumbnailRenderer.tsx";
import { Shape, TextItem } from "../types/types.ts";
import { useNavigate, useParams } from "react-router-dom";
import { fetchHistoryList, fetchHistorySlides } from "../api/history";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

type SlideData = { shapes: Shape[]; texts: TextItem[] };
type SlideOrder = { id: string; order: number };

function formatKorean(tsISO: string) {
    const d = new Date(tsISO);
    const yyyy = d.getFullYear();
    const m = d.getMonth() + 1;
    const dd = d.getDate();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return {
        dateOnly: `${yyyy}년 ${m}월 ${dd}일`,
        dateTime: `${yyyy}년 ${m}월 ${dd}일 ${hh}:${mm}`,
    };
}

const History: React.FC = () => {
    const navigate = useNavigate();
    const { presentationId } = useParams();

    const [currentSlidesOrder, setCurrentSlidesOrder] = useState<SlideOrder[]>([]);
    const [slideDataMap, setSlideDataMap] = useState<Record<string, SlideData>>({});
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
    const [selectedCurrentSlide, setSelectedCurrentSlide] = useState<string>("");

    const [restoreSlidesOrder, setRestoreSlidesOrder] = useState<SlideOrder[]>([]);
    const [selectedRestoreSlide, setSelectedRestoreSlide] = useState<string | null>(null);

    const [histories, setHistories] = useState<HistoryEntry[]>([]);
    const [selectedHistoryUid, setSelectedHistoryUid] = useState<string | null>(null);

    const selectedTitle =
        histories.find((h) => h.historyId === selectedHistoryUid)?.displayDateTime ?? "히스토리";

    const fetchCurrentSlides = async () => {
        if (!presentationId) return;
        try {
            const res = await fetch(`${API_BASE}/presentations/${presentationId}/slides`, {
                mode: "cors",
                credentials: "omit",
                headers: { Accept: "application/json" },
            });
            if (!res.ok) return;

            const json = await res.json();
            const slideList: { slide_id: string; order: number; data?: unknown }[] =
                Array.isArray(json.slides) ? json.slides : [];
            if (slideList.length === 0) return;

            const orders: SlideOrder[] = slideList
                .map((s) => ({ id: s.slide_id, order: s.order }))
                .sort((a, b) => a.order - b.order);

            const dataPromises: Promise<[string, SlideData]>[] = slideList.map(async (s) => {
                let d: unknown = s.data;

                if (d === undefined) {
                    const detail = await fetch(
                        `${API_BASE}/presentations/${presentationId}/slides/${s.slide_id}`,
                        { mode: "cors", credentials: "omit", headers: { Accept: "application/json" } }
                    );
                    if (detail.ok) {
                        const dj = await detail.json();
                        d = dj?.data ?? { shapes: [], texts: [] };
                    } else {
                        d = { shapes: [], texts: [] };
                    }
                }

                if (typeof d === "string") {
                    try {
                        d = JSON.parse(d);
                    } catch {
                        d = { shapes: [], texts: [] };
                    }
                }

                let shapes: Shape[] = [];
                let texts: TextItem[] = [];
                if (d && typeof d === "object") {
                    const obj = d as { shapes?: Shape[]; texts?: TextItem[] };
                    shapes = Array.isArray(obj.shapes) ? obj.shapes : [];
                    texts = Array.isArray(obj.texts) ? obj.texts : [];
                }

                return [s.slide_id, { shapes, texts }] as [string, SlideData];
            });

            const entries = await Promise.all(dataPromises);
            const newData: Record<string, SlideData> = Object.fromEntries(entries);

            setCurrentSlidesOrder(orders);
            setSlideDataMap((prev) => ({ ...prev, ...newData }));
            setSelectedCurrentSlide((prev) => prev || orders[0].id);
        } catch (err) {
            console.error("슬라이드 fetch 중 오류:", err);
        }
    };

    useEffect(() => {
        (async () => {
            if (!presentationId) return;
            const list = await fetchHistoryList(presentationId);
            const mapped: HistoryEntry[] = list.map((it) => {
                const f = formatKorean(it.lastRevisionISO);
                return {
                    historyId: `${it.historyId}__${it.lastRevisionISO}`,
                    displayDateOnly: f.dateOnly,
                    displayDateTime: f.dateTime,
                };
            });
            setHistories(mapped);
        })();
    }, [presentationId]);

    useEffect(() => {
        fetchCurrentSlides();
    }, [presentationId]);

    useEffect(() => {
        (async () => {
            if (!presentationId || !selectedHistoryUid) {
                setRestoreSlidesOrder([]);
                setSelectedRestoreSlide(null);
                return;
            }

            try {
                const baseHistoryId = selectedHistoryUid.split("__")[0];

                const raw = await fetchHistorySlides(presentationId, baseHistoryId);
                if (raw.length === 0) {
                    setRestoreSlidesOrder([]);
                    setSelectedRestoreSlide(null);
                    return;
                }

                const prefixedOrders: SlideOrder[] = raw
                    .map((s) => ({ id: `restore-${selectedHistoryUid}-${s.slide_id}`, order: s.order }))
                    .sort((a, b) => a.order - b.order);

                const dataPromises: Promise<[string, SlideData]>[] = raw.map(async (s) => {
                    let d: unknown = s.data;
                    if (typeof d === "string") {
                        try {
                            d = JSON.parse(d);
                        } catch {
                            d = { shapes: [], texts: [] };
                        }
                    }

                    let shapes: Shape[] = [];
                    let texts: TextItem[] = [];
                    if (d && typeof d === "object") {
                        const obj = d as { shapes?: Shape[]; texts?: TextItem[] };
                        shapes = Array.isArray(obj.shapes) ? obj.shapes : [];
                        texts = Array.isArray(obj.texts) ? obj.texts : [];
                    }

                    const id = `restore-${selectedHistoryUid}-${s.slide_id}`;
                    return [id, { shapes, texts }] as [string, SlideData];
                });

                const entries = await Promise.all(dataPromises);
                const restoreDataMap: Record<string, SlideData> = Object.fromEntries(entries);

                setRestoreSlidesOrder(prefixedOrders);
                setSlideDataMap((prev) => ({ ...prev, ...restoreDataMap }));
                setSelectedRestoreSlide(prefixedOrders[0]?.id ?? null);
            } catch (e) {
                console.error("히스토리 단건 조회 실패:", e);
                setRestoreSlidesOrder([]);
                setSelectedRestoreSlide(null);
            }
        })();
    }, [presentationId, selectedHistoryUid]);

    const shownSlideId = selectedRestoreSlide || selectedCurrentSlide;
    const current = shownSlideId ? slideDataMap[shownSlideId] : undefined;

    const handleApplyRestore = () => {
        if (window.confirm("복원된 내용을 적용하시겠습니까?")) {
            alert("복원이 완료되었습니다.");
            navigate("/");
        }
    };

    const handleThumbnailRendered = (slideId: string, dataUrl: string) => {
        setThumbnails((prev) => ({ ...prev, [slideId]: dataUrl }));
    };

    return (
        <div className="history">
            <Header variant="history" title={selectedTitle} onApplyRestore={handleApplyRestore} />

            <div className="history-body">
                <Sidebar
                    variant="current"
                    slides={currentSlidesOrder.map((s) => s.id)}
                    currentSlide={selectedCurrentSlide}
                    setCurrentSlide={setSelectedCurrentSlide}
                    thumbnails={thumbnails}
                    selectedSlides={[selectedCurrentSlide]}
                    setSelectedSlides={(slides) => {
                        const selected = typeof slides === "function" ? slides([])[0] : slides[0];
                        setSelectedCurrentSlide(selected || "");
                        return slides;
                    }}
                />

                <Sidebar
                    variant="restore"
                    slides={restoreSlidesOrder.map((s) => s.id)}
                    currentSlide={selectedRestoreSlide || ""}
                    setCurrentSlide={(id) => {
                        const newId = typeof id === "function" ? id(selectedRestoreSlide ?? "") : id;
                        setSelectedRestoreSlide(newId);
                    }}
                    thumbnails={thumbnails}
                    selectedSlides={selectedRestoreSlide ? [selectedRestoreSlide] : []}
                    setSelectedSlides={(slides) => {
                        const selected = typeof slides === "function" ? slides([])[0] : slides[0];
                        setSelectedRestoreSlide(selected || null);
                        return slides;
                    }}
                    onRestoreSelected={() => {}}
                    isRestoreEnabled={!!(selectedCurrentSlide && selectedRestoreSlide)}
                />

                <div className="history-canvas">
                    <Canvas
                        activeTool="cursor"
                        selectedColor="#000000"
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
                    onSelect={(uid) => setSelectedHistoryUid(uid)}
                />
            </div>
        </div>
    );
};

export default History;