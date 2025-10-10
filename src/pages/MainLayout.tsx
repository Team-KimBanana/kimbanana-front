import React, {useState, useEffect, useRef} from "react";
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
import "./MainLayout.css";

// 개발 환경에서는 프록시 사용, 운영 환경에서는 실제 URL 사용
const API_BASE = import.meta.env.DEV 
    ? '/api'  // 개발 환경: Vite 프록시 사용
    : import.meta.env.VITE_API_BASE_URL;
const WS_URL = import.meta.env.DEV 
    ? '/ws-api'  // 개발 환경: Vite 프록시 사용
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
    const { user } = useAuth();
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
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastBroadcastData = useRef<string>("");
    const containerRef = useRef<HTMLDivElement>(null);
    const { isFullscreen, enter, exit } = useFullscreen(containerRef);
    const [isPresentationMode, setIsPresentationMode] = useState(false);
    const [presentationTitle, setPresentationTitle] = useState<string | undefined>(undefined);
    const lastUploadedHashRef = useRef<string>("");
    const uploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


    const { id } = useParams();
    const presentationId = id ?? "p1";

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
        const res = await fetch(url, { method: "POST", body: form });

        if (!res.ok) throw new Error(`thumbnail upload failed: ${res.status}`);
    }



    useEffect(() => {
        const client = new Client({
            brokerURL: WS_URL,
            reconnectDelay: 5000,
        });

        client.onConnect = () => {
            console.log("웹소켓 연결됨");
            subscribeToStructure(client);
            fetchSlides();
        };

        client.activate();
        stompClientRef.current = client;

        return () => {
            client.deactivate();
        };
    }, []);


    const fetchSlides = async () => {
        try {
            const res = await fetch(`${API_BASE}/presentations/${presentationId}/slides`);
            if (!res.ok) {
                console.error("슬라이드 불러오기 실패", res.status);
                return;
            }

            const json = await res.json();
            const serverTitle =
                json?.presentation?.presentation_title ??
                json?.presentation_title ??
                json?.title ??
                "";
            setPresentationTitle(serverTitle);

            const slideList: ReceivedSlide[] = Array.isArray(json.slides) ? json.slides : [];

            if (slideList.length === 0) {
                const res2 = await fetch(`${API_BASE}/presentations/${presentationId}/slides`, { method: "POST" });
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

                if (d === undefined) {
                    const detail = await fetch(`${API_BASE}/presentations/${presentationId}/slides/${s.slide_id}`);
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

                return [s.slide_id, { shapes, texts }];
            });

            const dataEntries: [string, SlideData][] = await Promise.all(dataPromises);

            const newSlideData: Record<string, SlideData> = Object.fromEntries(dataEntries);

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
        if (!stompClientRef.current || !currentSlide) return;

        subscriptionRef.current?.unsubscribe();

        const topic = `/topic/presentation.${presentationId}.slide.${currentSlide}`;
        console.log("슬라이드 구독 시작:", topic);

        subscriptionRef.current = stompClientRef.current.subscribe(topic, (message) => {

            try {
                const parsed = JSON.parse(message.body);
                console.log("슬라이드 수신 메시지:", parsed);

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
            console.log("WebSocket 데이터 전송 대상:", destination);
            console.log("WebSocket 데이터 전송:", payload);

            stompClientRef.current?.publish({
                destination,
                body: serializedPayload,
            });

            debounceTimerRef.current = null;
        }, 300);
    };




    const subscribeToStructure = (client: Client) => {
        const topic = `/topic/presentation.${presentationId}`;
        console.log("구조 구독 시작:", topic);

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



    const handleAddSlide = async () => {
        try {
            const res = await fetch(`${API_BASE}/presentations/${presentationId}/slides`, {
                method: "POST",
            });
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

        await fetch(`${API_BASE}/presentations/${presentationId}/slides`, {
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


    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const ae = document.activeElement as HTMLElement | null;
            const isTypingInForm =
                !!ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
            if (isTypingInForm) return;

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
    ]);



    const handleReorderSlides = async (newOrder: string[]) => {
        const updatedSlides = newOrder.map((id, index) => ({
            id,
            order: index + 1,
        }));
        setSlides(updatedSlides);

        await fetch(`${API_BASE}/presentations/${presentationId}/slides`, {
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


    const updateShapes = (newShapes: Shape[] | ((prev: Shape[]) => Shape[])) => {
        setSlideData((prev) => {
            const updatedShapes = typeof newShapes === "function" ? newShapes(prev[currentSlide]?.shapes || []) : newShapes;
            const newData = {
                ...prev,
                [currentSlide]: {
                    ...prev[currentSlide],
                    shapes: updatedShapes,
                    texts: prev[currentSlide]?.texts || [],
                },
            };
            setTimeout(() => broadcastFullSlideFromData(newData), 0);
            return newData;
        });
    };

    const updateTexts = (newTexts: TextItem[] | ((prev: TextItem[]) => TextItem[])) => {
        setSlideData((prev) => {
            const updatedTexts = typeof newTexts === "function" ? newTexts(prev[currentSlide]?.texts || []) : newTexts;
            const newData = {
                ...prev,
                [currentSlide]: {
                    ...prev[currentSlide],
                    texts: updatedTexts,
                    shapes: prev[currentSlide]?.shapes || [],
                },
            };
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

    const savePresentationTitle = async (title: string) => {
        try {
            await fetch(`${API_BASE}/presentations/${presentationId}/slides/title`, {
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

            const res = await fetch(`${API_BASE}/presentations/${presentationId}/histories`, {
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
                } catch {
                    // ignore error
                }
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
                    />
                </div>
            </div>
        </div>
    );
};

export default MainLayout;
