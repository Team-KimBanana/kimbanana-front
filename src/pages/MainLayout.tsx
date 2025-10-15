import React, {useState, useEffect, useRef, useCallback} from "react";
import { useParams } from "react-router-dom";
import ReactDOM from "react-dom/client";
import {Client, StompSubscription} from "@stomp/stompjs";
import Header from "../components/Header/Header.tsx";
import Sidebar from "../components/Sidebar/Sidebar.tsx";
import Canvas from "../components/Canvas/Canvas.tsx";
import Toolbar from "../components/Toolbar/Toolbar.tsx";
import { useAuth } from "../contexts/AuthContext";
import {Shape, TextItem, ReceivedSlide, SlideData, SlideOrder } from "../types/types.ts";
import ThumbnailRenderer from "../components/ThumbnailRenderer/ThumbnailRenderer.tsx";
import useFullscreen from "../hooks/useFullscreen";
import { demoPresentations } from "../data/demoData";
import jsPDF from 'jspdf';
import "./MainLayout.css";

const API_BASE = import.meta.env.DEV
    ? '/api'
    : import.meta.env.VITE_API_BASE_URL;
const WS_URL = import.meta.env.DEV
    ? import.meta.env.VITE_WS_URL || 'wss://localhost:8080/ws'
    : import.meta.env.VITE_WS_URL;

function dataURLtoBlob(dataURL: string) {
    const [header, base64] = dataURL.split(",");
    const mime = header.match(/:(.*?);/)?.[1] || "image/png";
    const bin = atob(base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
}

const MainLayout: React.FC = () => {
    const { user, getAuthToken } = useAuth?.() ?? ({
        user: null,
        getAuthToken: () => Promise.resolve(null)
    } as never);

    const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
        const accessToken = await getAuthToken();
        const headers: Record<string, string> = {
            ...options.headers as Record<string, string>,
        };

        if (accessToken) {
            headers['Authorization'] = `Bearer ${accessToken}`;
        }

        // console.log('fetchWithAuth 호출:', {
        //     url,
        //     hasToken: !!accessToken,
        //     tokenPreview: accessToken ? `${accessToken.substring(0, 20)}...` : 'none',
        //     headers
        // });

        return fetch(url, {
            ...options,
            headers,
        });
    }, [getAuthToken]);

    const [activeTool, setActiveTool] = useState("cursor");
    const [selectedColor, setSelectedColor] = useState("#B0B0B0");
    const [slides, setSlides] = useState<{ id: string; order: number }[]>([]);
    const [currentSlide, setCurrentSlide] = useState<string>("");
    const [slideData, setSlideData] = useState<{ [key: string]: { shapes: Shape[]; texts: TextItem[] } }>({});
    const [thumbnails, setThumbnails] = useState<{ [key: string]: string }>({});
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [defaultFontSize, setDefaultFontSize] = useState(20);
    const [eraserSize, setEraserSize] = useState(15);
    const [eraserMode, setEraserMode] = useState<"size" | "area">("size");
    const stompClientRef = useRef<Client | null>(null);
    const subscriptionRef = useRef<StompSubscription | null>(null);
    const [selectedShapeId, setSelectedShapeId] = useState<string | number | null>(null);
    const [selectedTextId, setSelectedTextId] = useState<string | number | null>(null);
    const [clipboardData, setClipboardData] = useState<{ shapes: Shape[]; texts: TextItem[] } | null>(null);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastBroadcastData = useRef<string>("");
    const containerRef = useRef<HTMLDivElement>(null);
    const { isFullscreen, enter, exit } = useFullscreen(containerRef);
    const [isPresentationMode, setIsPresentationMode] = useState(false);
    const [presentationTitle, setPresentationTitle] = useState<string | undefined>(undefined);
    const [undoStack, setUndoStack] = useState<SlideData[]>([]);
    const [redoStack, setRedoStack] = useState<SlideData[]>([]);
    const lastUploadedHashRef = useRef<string>("");
    const uploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


    const { id } = useParams();
    const presentationId = id ?? "p1";

    const isDemo = presentationId.startsWith('demo-');

    const goToNextSlide = () => {
        const currentIndex = slides.findIndex(slide => slide.id === currentSlide);
        if (currentIndex < slides.length - 1) {
            setCurrentSlide(slides[currentIndex + 1].id);
        }
    };

    const goToPrevSlide = () => {
        const currentIndex = slides.findIndex(slide => slide.id === currentSlide);
        if (currentIndex > 0) {
            setCurrentSlide(slides[currentIndex - 1].id);
        }
    };

    useEffect(() => {
        if (isFullscreen) {
            setIsPresentationMode(true);
        } else {
            setIsPresentationMode(false);
        }
    }, [isFullscreen]);

    const renderSlideThumbnail = (
        slideId: string,
        data: { shapes: Shape[]; texts: TextItem[] },
        isFirst: boolean = false
    ) => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = ReactDOM.createRoot(container);

        const handleRendered = (id: string, dataUrl: string) => {
            setThumbnails(prev => ({ ...prev, [id]: dataUrl }));

            if (isFirst) {
                uploadFirstSlideThumbnail(dataUrl, presentationId)
                    .catch(err => console.error("썸네일 업로드 실패:", err));
            }

            root.unmount();
            document.body.removeChild(container);
        };

        root.render(
            <ThumbnailRenderer slideId={slideId} slideData={data} onRendered={handleRendered} />
        );
    };

    async function uploadFirstSlideThumbnail(dataUrl: string, presentationId: string) {
        const blob = dataURLtoBlob(dataUrl);
        const form = new FormData();
        form.append("file", blob, `thumb_${presentationId}.png`);
        form.append("presentationId", presentationId);

        const url = `${API_BASE}/images/thumbnails/presentation`;
        const res = await fetchWithAuth(url, {
            method: "POST",
            body: form
        });

        if (!res.ok) throw new Error(`thumbnail upload failed: ${res.status}`);
    }

    const handleDownloadPdf = async () => {
        if (!slides.length || Object.keys(thumbnails).length !== slides.length) {
            alert("모든 슬라이드 썸네일이 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
            return;
        }

        const ORIGINAL_WIDTH = 1280;
        const ORIGINAL_HEIGHT = 720;
        const SLIDE_ASPECT_RATIO = ORIGINAL_WIDTH / ORIGINAL_HEIGHT;

        const CUSTOM_PAGE_WIDTH = 297;
        const CUSTOM_PAGE_HEIGHT = CUSTOM_PAGE_WIDTH / SLIDE_ASPECT_RATIO;

        const doc = new jsPDF('l', 'mm', [CUSTOM_PAGE_WIDTH, CUSTOM_PAGE_HEIGHT]);

        const docWidth = doc.internal.pageSize.getWidth();
        const docHeight = doc.internal.pageSize.getHeight();

        for (let i = 0; i < slides.length; i++) {
            const slideId = slides[i].id;
            const imgData = thumbnails[slideId];

            if (!imgData) {
                console.warn(`슬라이드 ${slideId}의 썸네일 데이터가 누락되었습니다.`);
                continue;
            }

            if (i > 0) {
                doc.addPage();
            }

            const finalImgWidth = docWidth;
            const finalImgHeight = docHeight;
            const xOffset = 0;
            const yOffset = 0;

            doc.addImage(
                imgData,
                'PNG',
                xOffset,
                yOffset,
                finalImgWidth,
                finalImgHeight
            );
        }

        doc.save(`${presentationTitle || 'Presentation'}.pdf`);
    };

    const fetchSlides = async () => {
        try {
            if (isDemo && demoPresentations[presentationId]) {
                const demoData = demoPresentations[presentationId];

                setPresentationTitle(demoData.title);

                const orders: SlideOrder[] = demoData.slides
                    .map(s => ({ id: s.id, order: s.order }))
                    .sort((a, b) => a.order - b.order);

                const newSlideData: Record<string, SlideData> = {};
                demoData.slides.forEach(slide => {
                    newSlideData[slide.id] = slide.data;
                });

                setSlides(orders);
                setSlideData(newSlideData);
                setCurrentSlide(orders[0]?.id ?? "");

                orders.forEach(({ id }, idx) => {
                    renderSlideThumbnail(id, newSlideData[id], idx === 0);
                });

                console.log("📊 데모 프레젠테이션 로드됨:", demoData.title);
                return;
            }

            const res = await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides`);
            if (!res.ok) {
                console.error("슬라이드 불러오기 실패", res.status);
                return;
            }

            const json = await res.json();
            // console.log("슬라이드 API 응답:", json);

            const serverTitle =
                json?.presentation?.presentation_title ??
                json?.presentation_title ??
                json?.title ??
                "";
            setPresentationTitle(serverTitle);

            const slideList: ReceivedSlide[] = Array.isArray(json.slides) ? json.slides : [];
            // console.log("슬라이드 목록:", slideList);

            if (slideList.length === 0) {
                const res2 = await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides`, { method: "POST" });
                const json2 = await res2.json();
                const defaultSlideId: string = json2.slide_id;
                const defaultOrder: number = json2.order;

                const defaultSlides: SlideOrder[] = [{ id: defaultSlideId, order: defaultOrder }];
                const defaultData: Record<string, SlideData> = {
                    [defaultSlideId]: { shapes: [], texts: [] },
                };

                setSlides(defaultSlides);
                setSlideData(defaultData);
                setCurrentSlide(defaultSlideId);

                renderSlideThumbnail(defaultSlideId, defaultData[defaultSlideId]);
                return;
            }

            const orders: SlideOrder[] = slideList
                .map((s): SlideOrder => ({ id: s.slide_id, order: s.order }))
                .sort((a, b) => a.order - b.order);

            const dataPromises: Promise<[string, SlideData]>[] = slideList.map(async (s): Promise<[string, SlideData]> => {
                let d: unknown = s.data;

                // console.log(`슬라이드 ${s.slide_id} 데이터:`, {
                //     hasData: !!d,
                //     dataType: typeof d,
                //     data: d
                // });

                if (d === undefined || d === null) {
                    const detail = await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides/${s.slide_id}`);
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
                    texts  = Array.isArray(obj.texts)  ? obj.texts  : [];
                }

                // console.log(`슬라이드 ${s.slide_id} 파싱 결과:`, {
                //     shapesCount: shapes.length,
                //     textsCount: texts.length
                // });

                return [s.slide_id, { shapes, texts }];
            });

            const dataEntries: [string, SlideData][] = await Promise.all(dataPromises);

            const newSlideData: Record<string, SlideData> = Object.fromEntries(dataEntries);

            // console.log("최종 슬라이드 데이터:", {
            //     slidesCount: orders.length,
            //     slideIds: orders.map(o => o.id),
            //     slideData: newSlideData
            // });

            setSlides(orders);
            setSlideData(newSlideData);
            setCurrentSlide(orders[0]?.id ?? "");

            orders.forEach(({ id }, idx) => {
                renderSlideThumbnail(id, newSlideData[id], idx === 0);
            });
        } catch (err) {
            console.error("슬라이드 fetch 중 오류:", err);
        }
    };


    useEffect(() => {
        if (isDemo) {
            fetchSlides();
            return;
        }

        let client: Client | null = null;
        let cleanupDeactivate = () => {};

        getAuthToken().then((token) => {

            client = new Client({
                brokerURL: WS_URL,
                reconnectDelay: 5000,

                connectHeaders: token ? {
                    'Authorization': `Bearer ${token}`,
                } : {},
            });

            client.onConnect = () => {
                // console.log("웹소켓 연결됨");
                subscribeToStructure(client as Client);

                fetchSlides();
            };

            client.onStompError = (frame) => {
                console.error("WebSocket STOMP 에러:", frame);
            };

            client.onWebSocketError = (event) => {
                console.error("WebSocket 연결 에러:", event);
            };

            try {
                client.activate();
                stompClientRef.current = client;

                cleanupDeactivate = () => {
                    try {
                        client?.deactivate();
                    } catch (err) {
                        console.error("WebSocket 비활성화 실패:", err);
                    }
                };

            } catch (err) {
                console.error("WebSocket 활성화 실패:", err);
            }
        });

        return () => {
            cleanupDeactivate();
        };
    }, [getAuthToken]);


    const subscribeToStructure = (client: Client) => {
        const topic = `/topic/presentation.${presentationId}`;
        // console.log("구조 구독 시작:", topic);

        client.subscribe(topic, (message) => {
            const parsed = JSON.parse(message.body);
            console.log("구조 수신 메시지:", parsed);

            const { type, payload } = parsed;

            if (type === "SLIDE_ADD") {
                const { slide_id, order } = payload;

                setSlides(prev => {
                    const updated = [...prev, { id: slide_id, order }];
                    return updated.sort((a, b) => a.order - b.order);
                });

                setSlideData(prev => ({
                    ...prev,
                    [slide_id]: { shapes: [], texts: [] },
                }));

            } else if (type === "STRUCTURE_UPDATED" || type === "SLIDE_DELETE") {
                const slideList = payload.slides || [];

                const newSlideData: { [key: string]: { shapes: Shape[]; texts: TextItem[] } } = {};
                const orders: { id: string; order: number }[] = [];

                slideList.forEach((slide: {
                    slide_id: string;
                    order: number;
                    data?: { shapes?: Shape[]; texts?: TextItem[] };
                }) => {
                    const id = slide.slide_id;

                    newSlideData[id] = {
                        shapes: slide.data?.shapes || [],
                        texts: slide.data?.texts || [],
                    };

                    orders.push({ id, order: slide.order ?? 9999 });
                });

                orders.sort((a, b) => a.order - b.order);

                setSlides(orders);

                setSlideData(prev => {
                    const newData = { ...prev };
                    slideList.forEach((slide: ReceivedSlide) => {
                        const id = slide.slide_id;
                        if (!newData[id]) {
                            newData[id] = { shapes: [], texts: [] };
                        }
                    });
                    return newData;
                });

                if (slideList.length > 0 && (!currentSlide || currentSlide === "")) {
                    setCurrentSlide(slideList[0].slide_id);
                }
            } else if (type === "TITLE_UPDATED" || type === "TITLE_UPDATE") {
                const newTitle = payload?.new_title;
                if (!payload?.presentation_id || payload.presentation_id === presentationId) {
                    setPresentationTitle(newTitle ?? undefined);
                    if (newTitle) document.title = `${newTitle} - Kimbanana`;
                }
            } else {
                console.warn("알 수 없는 구조 메시지 type:", type);
            }
        });
    };

    useEffect(() => {
        if (!stompClientRef.current || !currentSlide) return;

        subscriptionRef.current?.unsubscribe();

        const topic = `/topic/presentation.${presentationId}.slide.${currentSlide}`;
        // console.log("슬라이드 구독 시작:", topic);

        try {
            subscriptionRef.current = stompClientRef.current.subscribe(topic, (message) => {

                try {
                    const parsed = JSON.parse(message.body);
                    // console.log("슬라이드 수신 메시지:", parsed);

                    const data = typeof parsed.data === "string"
                        ? JSON.parse(parsed.data)
                        : parsed.data;

                    if (!data) {
                        console.warn("슬라이드 수신 데이터 파싱 실패:", parsed);
                        return;
                    }

                    setSlideData(prev => ({
                        ...prev,
                        [currentSlide]: {
                            shapes: data.shapes || [],
                            texts: data.texts || [],
                        },
                    }));
                } catch (err) {
                    console.error("슬라이드 수신 메시지 처리 중 오류 발생:", err);
                }
            });
        } catch (err) {
            console.error("WebSocket 구독 실패:", err);
        }
    }, [currentSlide]);

    const normalizeShapes = (shapes: Shape[]): Shape[] => {
        return shapes.map((shape) => {
            const base = {
                id: shape.id,
                type: shape.type,
                x: shape.x,
                y: shape.y,
                rotation: shape.rotation ?? 0,
            };

            if (shape.type === "circle") {
                return {
                    ...base,
                    radiusX: shape.radiusX ?? 50,
                    radiusY: shape.radiusY ?? 50,
                    color: shape.color || "#000000",
                };
            }

            if (shape.type === "rectangle") {
                return {
                    ...base,
                    width: shape.width || 0,
                    height: shape.height || 0,
                    color: shape.color || "#000000",
                };
            }

            if (shape.type === "triangle") {
                return {
                    ...base,
                    points: shape.points || [],
                    color: shape.color || "#000000",
                };
            }

            if (shape.type === "image") {
                return {
                    ...base,
                    width: shape.width || 0,
                    height: shape.height || 0,
                    imageSrc: shape.imageSrc || "",
                };
            }

            return shape;
        });
    };

    const normalizeTexts = (texts: TextItem[]): TextItem[] => {
        return texts.map(text => ({
            id: text.id,
            text: text.text,
            x: text.x,
            y: text.y,
            color: text.color || "#000000",
            fontSize: text.fontSize || 18,
        }));
    };


    const broadcastFullSlideFromData = (data: { [key: string]: { shapes: Shape[]; texts: TextItem[] } }) => {
        if (isTyping) return;

        const slide = data[currentSlide];
        if (!slide) return;

        const currentSlideOrder = slides.find(s => s.id === currentSlide)?.order ?? 9999;
        const offset = new Date().getTimezoneOffset() * 60000;
        const lastRevisionDate = new Date(Date.now() - offset).toISOString().slice(0, -1);

        const payload = {
            slide_id: currentSlide,
            order: currentSlideOrder,
            last_revision_user_id: user?.id || "anonymous",
            last_revision_date: lastRevisionDate,
            data: JSON.stringify({
                shapes: normalizeShapes(slide.shapes),
                texts: normalizeTexts(slide.texts),
            }),
        };

        const serializedPayload = JSON.stringify(payload);

        if (lastBroadcastData.current === serializedPayload) return;
        lastBroadcastData.current = serializedPayload;

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            const destination = `/app/slide.edit.presentation.${presentationId}.slide.${currentSlide}`;
            // console.log("WebSocket 데이터 전송 대상:", destination);
            // console.log("WebSocket 데이터 전송:", payload);

            try {
                stompClientRef.current?.publish({
                    destination,
                    body: serializedPayload,
                });
            } catch (err) {
                console.error("WebSocket 데이터 전송 실패:", err);
            }

            debounceTimerRef.current = null;
        }, 300);
    };

    const handleAddSlide = async () => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides`, {
                method: "POST",
                headers: {
                    'Accept': 'application/json',
                },
            });

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }

            const json = await res.json();

            const newId = json.slide_id;
            const newOrder = json.order;
            const newSlide = { id: newId, order: newOrder };

            const newSlides = [...slides, newSlide];
            const newData = { ...slideData, [newId]: { shapes: [], texts: [] } };

            setSlides(newSlides);
            setSlideData(newData);
            setCurrentSlide(newId);

            setTimeout(() => broadcastFullSlideFromData(newData), 0);

        } catch (err) {
            console.error("슬라이드 추가 실패:", err);
        }
    };



    const handleDeleteSlide = async (slideId: string) => {
        if (slides.length === 1) return;

        const newSlides = slides
            .filter(s => s.id !== slideId)
            .map((s, i) => ({ ...s, order: i + 1 }));

        const newSlideData = { ...slideData };
        delete newSlideData[slideId];

        setSlides(newSlides);
        setSlideData(newSlideData);

        if (currentSlide === slideId) {
            if (newSlides.length > 0) {
                setCurrentSlide(newSlides[0].id);
            } else {
                setCurrentSlide("");
            }
        }

        await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                presentation_id: presentationId,
                slides: newSlides.map(s => ({
                    slide_id: s.id,
                    order: s.order,
                })),
            }),
        });
        const newFirst = newSlides[0]?.id;
        if (newFirst) {
            const data = newSlideData[newFirst] ?? { shapes: [], texts: [] };
            renderSlideThumbnail(newFirst, data, true);
        }
    };

    const deleteSelected = () => {
        if (!currentSlide) return;

        if (selectedShapeId != null) {
            setSlideData(prev => {
                const cur = prev[currentSlide] ?? { shapes: [], texts: [] };
                const newShapes = (cur.shapes ?? []).filter(s => s.id !== selectedShapeId);
                const newData = {
                    ...prev,
                    [currentSlide]: { ...cur, shapes: newShapes }
                };
                setTimeout(() => broadcastFullSlideFromData(newData), 0);
                return newData;
            });
            setSelectedShapeId(null);
            return;
        }

        if (selectedTextId != null) {
            setSlideData(prev => {
                const cur = prev[currentSlide] ?? { shapes: [], texts: [] };
                const newTexts = (cur.texts ?? []).filter(t => t.id !== selectedTextId);
                const newData = {
                    ...prev,
                    [currentSlide]: { ...cur, texts: newTexts }
                };
                setTimeout(() => broadcastFullSlideFromData(newData), 0);
                return newData;
            });
            setSelectedTextId(null);
        }
    };



    const handleReorderSlides = async (newOrder: string[]) => {
        const updatedSlides = newOrder.map((id, index) => ({
            id,
            order: index + 1,
        }));
        setSlides(updatedSlides);

        await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                presentation_id: presentationId,
                slides: updatedSlides.map(s => ({
                    slide_id: s.id,
                    order: s.order,
                })),
            }),
        });

        const newFirst = updatedSlides[0]?.id;
        if (newFirst) {
            const data = slideData[newFirst] ?? { shapes: [], texts: [] };
            renderSlideThumbnail(newFirst, data, true);
        }

    };


    const pushHistory = (prevData: SlideData, nextData: SlideData) => {
        setUndoStack((prev) => [...prev, prevData]);
        setRedoStack([]);
        setTimeout(() => broadcastFullSlideFromData({ [currentSlide]: nextData } as never), 0);
    };

    const updateShapes = (newShapes: Shape[] | ((prev: Shape[]) => Shape[])) => {
        setSlideData((prev) => {
            const updatedShapes = typeof newShapes === "function" ? newShapes(prev[currentSlide]?.shapes || []) : newShapes;
            const before = prev[currentSlide] ?? { shapes: [], texts: [] };
            const after: SlideData = { shapes: updatedShapes, texts: before.texts };
            pushHistory(before, after);
            return { ...prev, [currentSlide]: after };
        });
    };

    const updateTexts = (newTexts: TextItem[] | ((prev: TextItem[]) => TextItem[])) => {
        setSlideData((prev) => {
            const updatedTexts = typeof newTexts === "function" ? newTexts(prev[currentSlide]?.texts || []) : newTexts;
            const before = prev[currentSlide] ?? { shapes: [], texts: [] };
            const after: SlideData = { shapes: before.shapes, texts: updatedTexts };
            pushHistory(before, after);
            return { ...prev, [currentSlide]: after };
        });
    };

    const handleUndo = () => {
        if (!currentSlide || undoStack.length === 0) return;
        setSlideData((prev) => {
            const current = prev[currentSlide] ?? { shapes: [], texts: [] };
            const last = undoStack[undoStack.length - 1];
            setUndoStack((s) => s.slice(0, -1));
            setRedoStack((r) => [...r, current]);
            const newData = { ...prev, [currentSlide]: last };
            setTimeout(() => broadcastFullSlideFromData(newData), 0);
            return newData;
        });
    };

    const handleRedo = () => {
        if (!currentSlide || redoStack.length === 0) return;
        setSlideData((prev) => {
            const current = prev[currentSlide] ?? { shapes: [], texts: [] };
            const next = redoStack[redoStack.length - 1];
            setRedoStack((r) => r.slice(0, -1));
            setUndoStack((s) => [...s, current]);
            const newData = { ...prev, [currentSlide]: next };
            setTimeout(() => broadcastFullSlideFromData(newData), 0);
            return newData;
        });
    };

    const handleImageUpload = (imageUrl: string) => {
        const img = new window.Image();
        img.onload = () => {
            const newId = Date.now();
            const newImage: Shape = {
                id: newId,
                type: "image",
                x: 200,
                y: 150,
                width: img.width,
                height: img.height,
                imageSrc: imageUrl,
            };
            setSelectedShapeId(newId);
            updateShapes((prev) => [...prev, newImage]);
        };
        img.src = imageUrl;
    };

    const handleCopyPaste = useCallback((e: KeyboardEvent) => {
        const ae = document.activeElement as HTMLElement | null;
        const isTypingInForm =
            !!ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
        if (isTypingInForm || !currentSlide) return;

        const isModifierPressed = e.ctrlKey || e.metaKey;

        if (!isModifierPressed) return;

        const currentSlideData = slideData[currentSlide] || { shapes: [], texts: [] };

        if (e.key === 'c' || e.key === 'C') {
            if (selectedShapeId != null) {
                e.preventDefault();
                const shapeToCopy = currentSlideData.shapes.find(s => String(s.id) === String(selectedShapeId));
                if (shapeToCopy) {
                    setClipboardData({ shapes: [shapeToCopy], texts: [] });
                    console.log("도형 복사됨:", shapeToCopy.id);
                }
            } else if (selectedTextId != null) {
                e.preventDefault();
                const textToCopy = currentSlideData.texts.find(t => String(t.id) === String(selectedTextId));
                if (textToCopy) {
                    setClipboardData({ shapes: [], texts: [textToCopy] });
                    console.log("텍스트 복사됨:", textToCopy.id);
                }
            }
        }

        if (e.key === 'v' || e.key === 'V') {
            if (clipboardData && (clipboardData.shapes.length > 0 || clipboardData.texts.length > 0)) {
                e.preventDefault();

                const newShapes: Shape[] = clipboardData.shapes.map(s => ({
                    ...s,
                    id: Date.now() + Math.random(),
                    x: (s.x ?? 0) + 10,
                    y: (s.y ?? 0) + 10,
                }));

                const newTexts: TextItem[] = clipboardData.texts.map(t => ({
                    ...t,
                    id: Date.now() + Math.random(),
                    x: (t.x ?? 0) + 10,
                    y: (t.y ?? 0) + 10,
                }));

                setSlideData(prev => {
                    const cur = prev[currentSlide] || { shapes: [], texts: [] };
                    const newData = {
                        ...prev,
                        [currentSlide]: {
                            shapes: [...cur.shapes, ...newShapes],
                            texts: [...cur.texts, ...newTexts],
                        }
                    };
                    if (newShapes.length > 0) setSelectedShapeId(String(newShapes[0].id));
                    else if (newTexts.length > 0) setSelectedTextId(String(newTexts[0].id));

                    setTimeout(() => broadcastFullSlideFromData(newData), 0);
                    return newData;
                });

                const updatedClipboard = {
                    shapes: newShapes,
                    texts: newTexts
                };
                setClipboardData(updatedClipboard);
            }
        }
    }, [currentSlide, slideData, selectedShapeId, selectedTextId, clipboardData, broadcastFullSlideFromData, setSlideData, setSelectedShapeId, setSelectedTextId]);


    const savePresentationTitle = async (title: string) => {
        try {
            await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides/title`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    presentation_id: presentationId,
                    new_title: title,
                }),
            });
            setPresentationTitle(title);
        } catch (err) {
            console.error("프레젠테이션 제목 업데이트 실패:", err);
        }
    };

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const ae = document.activeElement as HTMLElement | null;
            const isTypingInForm =
                !!ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
            if (isTypingInForm) return;

            handleCopyPaste(e);
            if (e.defaultPrevented) return;

            const isBackspaceOrDelete = e.key === "Backspace" || e.key === "Delete";
            if (!isBackspaceOrDelete || isTyping) return;

            if (selectedShapeId != null || selectedTextId != null) {
                e.preventDefault();
                deleteSelected();
                return;
            }

            if (activeTool !== "cursor") {
                return;
            }

            if (slides.length > 1) {
                e.preventDefault();
                handleDeleteSlide(currentSlide);
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [
        currentSlide,
        slides,
        isTyping,
        selectedShapeId,
        selectedTextId,
        activeTool,
        handleCopyPaste,
    ]);

    const handleSaveHistory = async () => {
        try {
            if (!slides.length) {
                alert("저장할 슬라이드가 없습니다.");
                return false;
            }

            const offset = new Date().getTimezoneOffset() * 60000; // 분→ms
            const isoLocal = new Date(Date.now() - offset).toISOString().slice(0, -1);

            const payload = {
                last_revision_user_id: user?.id || "anonymous",
                slides: slides.map(s => {
                    const data = slideData[s.id] ?? { shapes: [], texts: [] };

                    const dataString = JSON.stringify({
                        shapes: (data.shapes ?? []).map(shape => ({
                            id: shape.id,
                            type: shape.type,
                            x: shape.x,
                            y: shape.y,
                            rotation: shape.rotation ?? 0,
                            ...(shape.type === "rectangle" && {
                                width: shape.width || 0,
                                height: shape.height || 0,
                                color: shape.color || "#000000",
                            }),
                            ...(shape.type === "circle" && {
                                radiusX: shape.radiusX ?? shape.radius ?? 50,
                                radiusY: shape.radiusY ?? shape.radius ?? 50,
                                color: shape.color || "#000000",
                            }),
                            ...(shape.type === "triangle" && {
                                points: shape.points || [],
                                color: shape.color || "#000000",
                            }),
                            ...(shape.type === "image" && {
                                width: shape.width || 0,
                                height: shape.height || 0,
                                imageSrc: shape.imageSrc || "",
                            }),
                        })),
                        texts: (data.texts ?? []).map(t => ({
                            id: t.id,
                            text: t.text,
                            x: t.x,
                            y: t.y,
                            color: t.color || "#000000",
                            fontSize: t.fontSize || 18,
                        })),
                    });

                    return {
                        slide_id: s.id,
                        order: s.order,
                        last_revision_user_id: user?.id || "anonymous",
                        last_revision_date: isoLocal,
                        data: dataString,
                    };
                }),
            };

            const res = await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/histories`, {
                method: "POST",
                mode: "cors",
                credentials: "omit",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                let detail: string = "";
                try {
                    detail = await res.text();
                } catch { /* empty */ }
                console.error("히스토리 저장 실패:", res.status, detail);
                alert(`히스토리 저장 실패 (${res.status})`);
                return false;
            }

            // alert("히스토리 저장 성공");
            return true;
        } catch (err) {
            console.error("히스토리 저장 중 오류:", err);
            alert("히스토리 저장 중 오류가 발생");
            return false;
        }
    };



    return (
        <div className="main-layout" ref={containerRef}>
            <Header
                variant="main"
                presentationId={id}
                isFullscreen={isFullscreen}
                onEnterFullscreen={enter}
                onExitFullscreen={exit}
                title={presentationTitle}
                onTitleChange={setPresentationTitle}
                onTitleSave={savePresentationTitle}
                onSaveHistory={handleSaveHistory}
                onDownloadPdf={handleDownloadPdf}
            />
            <div className="content">
                <Sidebar variant="main"
                         slides={slides.map(s => s.id)}
                         currentSlide={currentSlide}
                         setCurrentSlide={setCurrentSlide}
                         onAddSlide={handleAddSlide}
                         thumbnails={thumbnails}
                         onReorderSlides={handleReorderSlides}
                />
                <div className="canvas-container">
                    {currentSlide && slideData[currentSlide] && (
                        <Canvas
                            activeTool={activeTool}
                            selectedColor={selectedColor}
                            setSelectedColor={setSelectedColor}
                            setActiveTool={setActiveTool}
                            shapes={slideData[currentSlide]?.shapes || []}
                            texts={slideData[currentSlide]?.texts || []}
                            setShapes={(updater) => updateShapes(updater)}
                            setTexts={(updater) => updateTexts(updater)}
                            currentSlide={currentSlide}
                            updateThumbnail={(slideId, dataUrl) => {
                                setThumbnails(prev => ({...prev, [slideId]: dataUrl}));

                                const firstSlideId = slides[0]?.id;
                                if (firstSlideId && slideId === firstSlideId) {
                                    const quickHash = dataUrl.slice(0, 4096);
                                    if (quickHash !== lastUploadedHashRef.current) {
                                        lastUploadedHashRef.current = quickHash;
                                        if (uploadTimerRef.current) clearTimeout(uploadTimerRef.current);
                                        uploadTimerRef.current = setTimeout(() => {
                                            uploadFirstSlideThumbnail(dataUrl, presentationId)
                                                .catch(err => console.error("썸네일 업로드 실패:", err));
                                            uploadTimerRef.current = null;
                                        }, 400);
                                    }
                                }
                            }}
                            sendEdit={() => broadcastFullSlideFromData(slideData)}
                            setIsTyping={setIsTyping}
                            defaultFontSize={defaultFontSize}
                            onSelectShape={setSelectedShapeId}
                            onSelectText={setSelectedTextId}
                            isFullscreen={isFullscreen}
                            onEnterFullscreen={enter}
                            onExitFullscreen={exit}
                            isPresentationMode={isPresentationMode}
                            goToNextSlide={goToNextSlide}
                            goToPrevSlide={goToPrevSlide}
                            slides={slides}
                            eraserSize={eraserSize}
                            eraserMode={eraserMode}
                        />
                    )}
                    <Toolbar
                        activeTool={activeTool}
                        setActiveTool={setActiveTool}
                        selectedColor={selectedColor}
                        setSelectedColor={setSelectedColor}
                        defaultFontSize={defaultFontSize}
                        setDefaultFontSize={setDefaultFontSize}
                        onImageUpload={handleImageUpload}
                        eraserSize={eraserSize}
                        setEraserSize={setEraserSize}
                        eraserMode={eraserMode}
                        setEraserMode={setEraserMode}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        canUndo={undoStack.length > 0}
                        canRedo={redoStack.length > 0}
                        getAuthToken={getAuthToken}
                    />
                </div>
            </div>
        </div>
    );
};

export default MainLayout;