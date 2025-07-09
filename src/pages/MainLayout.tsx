import React, {useState, useEffect, useRef} from "react";
import {Client, StompSubscription} from "@stomp/stompjs";

import Header from "../components/Header/Header.tsx";
import Sidebar from "../components/Sidebar/Sidebar.tsx";
import Canvas from "../components/Canvas/Canvas.tsx";
import Toolbar from "../components/Toolbar/Toolbar.tsx";

import {Shape, TextItem, ReceivedSlide} from "../types/types.ts";
import "./MainLayout.css";

const presentationId = "p1";
const API_BASE = import.meta.env.VITE_API_BASE_URL;
const WS_URL = import.meta.env.VITE_WS_URL;

const MainLayout: React.FC = () => {
    const [activeTool, setActiveTool] = useState("cursor");
    const [selectedColor, setSelectedColor] = useState("#B0B0B0");
    const [slides, setSlides] = useState<{ id: string; order: number }[]>([]);
    const [currentSlide, setCurrentSlide] = useState<string>("");
    const [slideData, setSlideData] = useState<{ [key: string]: { shapes: Shape[]; texts: TextItem[] } }>({});
    const [thumbnails, setThumbnails] = useState<{ [key: string]: string }>({});
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [defaultFontSize, setDefaultFontSize] = useState(20);
    const stompClientRef = useRef<Client | null>(null);
    const subscriptionRef = useRef<StompSubscription | null>(null);
    const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
    const [selectedTextId, setSelectedTextId] = useState<string | null>(null);


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
            console.log("슬라이드 API 응답:", json);

            const slideList: ReceivedSlide[] = Array.isArray(json.slides) ? json.slides : [];

            if (slideList.length === 0) {
                const res = await fetch(`${API_BASE}/presentations/${presentationId}/slides`, {
                    method: "POST",
                });
                const json = await res.json();
                const defaultSlideId = json.slide_id;
                const defaultOrder = json.order;

                const defaultSlides = [{ id: defaultSlideId, order: defaultOrder }];
                const defaultData = {
                    [defaultSlideId]: { shapes: [], texts: [] },
                };

                setSlides(defaultSlides);
                setSlideData(defaultData);
                setCurrentSlide(defaultSlideId);

                return;
            }



            const newSlideData: Record<string, { shapes: Shape[]; texts: TextItem[] }> = {};
            const orders: { id: string; order: number }[] = [];

            slideList.forEach((slide) => {
                const id = slide.slide_id;
                newSlideData[id] = {
                    shapes: slide.data?.shapes || [],
                    texts: slide.data?.texts || [],
                };
                orders.push({id, order: slide.order});
            });


            orders.sort((a, b) => a.order - b.order);
            setSlides(orders);
            setSlideData(newSlideData);

            setCurrentSlide(orders[0].id);

        } catch (err) {
            console.error("슬라이드 fetch 중 오류 발생:", err);
        }
    };


    useEffect(() => {
        if (!stompClientRef.current || !currentSlide) return;

        subscriptionRef.current?.unsubscribe();

        const topic = `/topic/presentation.${presentationId}.slide.${currentSlide}`;
        console.log("슬라이드 구독 시작:", topic);

        subscriptionRef.current = stompClientRef.current.subscribe(topic, (message) => {
            console.log("슬라이드 원본 메시지 수신:", message.body);

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
        return shapes.map(shape => ({
            type: shape.type,
            x: shape.x,
            y: shape.y,
            color: shape.color || "#000000",
            id: shape.id,
            radius: shape.radius || 0,
            width: shape.width || 0,
            height: shape.height || 0,
            points: shape.points || [],
        }));
    };

    const normalizeTexts = (texts: TextItem[]): TextItem[] => {
        return texts.map(text => ({
            id: text.id,
            text: text.text,
            x: text.x,
            y: text.y,
            color: text.color || "#000000",
        }));
    };

    const broadcastFullSlideFromData = (data: { [key: string]: { shapes: Shape[]; texts: TextItem[] } }) => {
        if (isTyping) return;

        const slide = data[currentSlide];

        const payload = {
            slide_id: currentSlide,
            last_revision_user_id: "admin",
            data: JSON.stringify({
                shapes: normalizeShapes(slide.shapes),
                texts: normalizeTexts(slide.texts),
            }),
        };

        const destination = `/app/slide.edit.presentation.${presentationId}.slide.${currentSlide}`;
        console.log("WebSocket 데이터 전송 대상:", destination);
        console.log("WebSocket 데이터 전송:", payload);

        stompClientRef.current?.publish({
            destination,
            body: JSON.stringify(payload),
        });
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
                setSlideData(newSlideData);

                if (orders.length > 0 && (!currentSlide || currentSlide === "")) {
                    setCurrentSlide(orders[0].id);
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

    };



    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                e.key === "Backspace" &&
                !isTyping &&
                slides.length > 1 &&
                selectedShapeId === null &&
                selectedTextId === null
            ) {
                e.preventDefault();
                handleDeleteSlide(currentSlide);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [currentSlide, slides, isTyping, selectedShapeId, selectedTextId]);




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

    const handleImageUpload = (imageDataUrl: string) => {
        const newImage: Shape = {
            id: Date.now(),
            type: "image",
            x: 200,
            y: 150,
            width: 300,
            height: 200,
            imageSrc: imageDataUrl,
        };
        updateShapes((prev) => [...prev, newImage]);
    };

    return (
        <div className="main-layout">
            <Header variant="main"/>
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
                            setActiveTool={setActiveTool}
                            shapes={slideData[currentSlide]?.shapes || []}
                            texts={slideData[currentSlide]?.texts || []}
                            setShapes={(updater) => updateShapes(updater)}
                            setTexts={(updater) => updateTexts(updater)}
                            currentSlide={currentSlide}
                            updateThumbnail={(slideId, dataUrl) =>
                                setThumbnails((prev) => ({...prev, [slideId]: dataUrl}))
                            }
                            sendEdit={() => broadcastFullSlideFromData(slideData)}
                            setIsTyping={setIsTyping}
                            defaultFontSize={defaultFontSize}
                            onSelectShape={setSelectedShapeId}
                            onSelectText={setSelectedTextId}
                        />
                    )}
                    <Toolbar
                        activeTool={activeTool}
                        setActiveTool={setActiveTool}
                        setSelectedColor={setSelectedColor}
                        defaultFontSize={defaultFontSize}
                        setDefaultFontSize={setDefaultFontSize}
                        onImageUpload={handleImageUpload}
                    />
                </div>
            </div>
        </div>
    );
};

export default MainLayout;
