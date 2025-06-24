import React, { useState, useEffect, useRef } from "react";
import { Client, StompSubscription } from "@stomp/stompjs";

import Header from "./Header/Header";
import Sidebar from "./Sidebar/Sidebar";
import Canvas from "./Canvas/Canvas";
import Toolbar from "./Toolbar/Toolbar";

import { Shape, TextItem, ReceivedSlide } from "../types/types";
import "./MainLayout.css";

const presentationId = "p_2929";

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

    useEffect(() => {
        const client = new Client({
            brokerURL: "ws://192.168.10.75:8080/ws-api",
            reconnectDelay: 5000,
        });

        client.onConnect = () => {
            console.log("웹소켓 연결됨");
            subscribeToStructure(client);
            subscribeToSlide(client);
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
            const res = await fetch(`http://192.168.10.75:8080/api/presentations/${presentationId}/slides`);
            if (!res.ok) {
                console.error("슬라이드 불러오기 실패", res.status);
                return;
            }

            const json = await res.json();
            const slideList: ReceivedSlide[] = json.slides;
            if (!Array.isArray(slideList)) {
                console.error("슬라이드 응답 형식 오류:", slideList);
                return;
            }

            const newSlideData: Record<string, { shapes: Shape[]; texts: TextItem[] }> = {};
            const orders: { id: string; order: number }[] = [];

            slideList.forEach((slide) => {
                const id = slide.slideId;
                newSlideData[id] = {
                    shapes: slide.data?.shapes || [],
                    texts: slide.data?.texts || [],
                };
                orders.push({ id, order: slide.slideOrder });
            });

            orders.sort((a, b) => a.order - b.order);
            setSlides(orders);
            setSlideData(newSlideData);
            if (orders.length > 0) setCurrentSlide(orders[0].id);
        } catch (err) {
            console.error("슬라이드 fetch 중 오류 발생:", err);
        }
    };

    const broadcastFullSlideFromData = (data: { [key: string]: { shapes: Shape[]; texts: TextItem[] } }) => {
        if (isTyping) return;

        const slidesPayload = slides.map(({ id, order }) => ({
            slideId: id,
            order,
            lastRevisionUserId: "admin",
            data: data[id],
        }));

        const payload = {
            presentationId,
            userId: "admin",
            slides: slidesPayload,
        };

        console.log("슬라이드 전체 전송(payload):", payload);

        stompClientRef.current?.publish({
            destination: `/app/slide.edit.presentation.${presentationId}.slide.${currentSlide}`,
            body: JSON.stringify(payload),
        });

    };

    const subscribeToSlide = (client: Client) => {
        const topic = `/topic/presentation.${presentationId}.slide.${currentSlide}`;
        console.log("구독 시작:", topic);

        subscriptionRef.current = client.subscribe(topic, (message) => {
            const parsed = JSON.parse(message.body);
            console.log("수신 메시지:", parsed);

            const slideList: ReceivedSlide[] = parsed.slides || [];
            const newSlideData: { [key: string]: { shapes: Shape[]; texts: TextItem[] } } = {};
            const orders: { id: string; order: number }[] = [];

            slideList.forEach((slide) => {
                const id = slide.slideId;
                if (typeof slide.data !== "object" || slide.data === null) return;

                newSlideData[id] = {
                    shapes: slide.data.shapes || [],
                    texts: slide.data.texts || [],
                };
                orders.push({ id, order: slide.slideOrder || 9999 });
            });

            orders.sort((a, b) => a.order - b.order);
            setSlides(orders);
            setSlideData(newSlideData);
            if (orders.length > 0) setCurrentSlide(orders[0].id);
        });
    };

    const broadcastStructure = (
        data: { [key: string]: { shapes: Shape[]; texts: TextItem[] } },
        slideOrder: { id: string; order: number }[]
    ) => {
        const slidesPayload = slideOrder.map(({ id, order }) => ({
            slideId: id,
            order,
            data: data[id],
        }));

        const payload = {
            presentationId,
            presentationTitle: "제목 없음",
            slides: slidesPayload,
        };

        console.log("전체 구조 전송:", payload);

        stompClientRef.current?.publish({
            destination: `/app/slide.edit.struct.presentation.${presentationId}`,
            body: JSON.stringify(payload),
        });
    };

    const subscribeToStructure = (client: Client) => {
        const topic = `/topic/struct/presentation.${presentationId}`;
        console.log("구조 구독 시작:", topic);

        client.subscribe(topic, (message) => {
            const parsed = JSON.parse(message.body);
            console.log("구조 수신 메시지:", parsed);

            const slideList: ReceivedSlide[] = parsed.slides || [];
            const newSlideData: { [key: string]: { shapes: Shape[]; texts: TextItem[] } } = {};
            const orders: { id: string; order: number }[] = [];

            slideList.forEach((slide) => {
                const id = slide.slideId;
                if (typeof slide.data !== "object" || slide.data === null) return;

                newSlideData[id] = {
                    shapes: slide.data.shapes || [],
                    texts: slide.data.texts || [],
                };
                orders.push({ id, order: slide.slideOrder || 9999 });
            });

            orders.sort((a, b) => a.order - b.order);
            console.log("수신된 slide orders:", orders);

            setSlides(orders);
            setSlideData(newSlideData);
            if (orders.length > 0) setCurrentSlide(orders[0].id);
        });
    };

    const handleAddSlide = () => {
        const ids = slides.map(s => parseInt(s.id.replace("s_", ""), 10)).filter(id => !isNaN(id));
        const maxId = ids.length > 0 ? Math.max(...ids) : 0;
        const newId = `s_${maxId + 1}`;
        const newSlide = { id: newId, order: slides.length + 1 };
        const newSlides = [...slides, newSlide];
        const newData = { ...slideData, [newId]: { shapes: [], texts: [] } };

        setSlides(newSlides);
        setSlideData(newData);
        setCurrentSlide(newId);

        setTimeout(() => broadcastStructure(newData, newSlides), 0);
    };

    const handleDeleteSlide = (slideId: string) => {
        if (slides.length === 1) return;

        const newSlides = slides
            .filter(s => s.id !== slideId)
            .map((s, i) => ({ ...s, order: i + 1 }));

        const newSlideData = { ...slideData };
        delete newSlideData[slideId];

        setSlides(newSlides);
        setSlideData(newSlideData);

        if (currentSlide === slideId) {
            setCurrentSlide(newSlides[0].id);
        }

        broadcastStructure(newSlideData, newSlides);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Backspace" && !isTyping && slides.length > 1) {
                e.preventDefault();
                handleDeleteSlide(currentSlide);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [currentSlide, slides, isTyping]);

    const handleReorderSlides = (newOrder: string[]) => {
        const updatedSlides = newOrder.map((id, index) => ({
            id,
            order: index + 1,
        }));
        setSlides(updatedSlides);
        broadcastStructure(slideData, updatedSlides);
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
            <Header />
            <div className="content">
                <Sidebar
                    slides={slides.map(s => s.id)}
                    currentSlide={currentSlide}
                    setCurrentSlide={setCurrentSlide}
                    onAddSlide={handleAddSlide}
                    thumbnails={thumbnails}
                    onReorderSlides={handleReorderSlides}
                />
                <div className="canvas-container">
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
                            setThumbnails((prev) => ({ ...prev, [slideId]: dataUrl }))
                        }
                        sendEdit={() => broadcastFullSlideFromData(slideData)}
                        setIsTyping={setIsTyping}
                        defaultFontSize={defaultFontSize}
                    />
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
