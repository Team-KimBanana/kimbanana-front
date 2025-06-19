import React, { useState, useEffect, useRef } from "react";
import { Client, StompSubscription } from "@stomp/stompjs";

import Header from "./Header/Header";
import Sidebar from "./Sidebar/Sidebar";
import Canvas from "./Canvas/Canvas";
import Toolbar from "./Toolbar/Toolbar";

import { Shape, TextItem, ReceivedSlide } from "../types/types";
import "./MainLayout.css";

const presentationId = "p_19025";

const MainLayout: React.FC = () => {
    const [activeTool, setActiveTool] = useState("cursor");
    const [selectedColor, setSelectedColor] = useState("#B0B0B0");
    const [slides, setSlides] = useState<number[]>([1]);
    const [currentSlide, setCurrentSlide] = useState<number>(1);
    const [slideData, setSlideData] = useState<{
        [key: number]: { shapes: Shape[]; texts: TextItem[] };
    }>({ 1: { shapes: [], texts: [] } });
    const [thumbnails, setThumbnails] = useState<{ [key: number]: string }>({});
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [defaultFontSize, setDefaultFontSize] = useState(20);
    const stompClientRef = useRef<Client | null>(null);
    const subscriptionRef = useRef<StompSubscription | null>(null);

    useEffect(() => {
        const client = new Client({
            brokerURL: "ws://192.168.68.102:8080/ws-api",
            reconnectDelay: 5000,
        });

        client.onConnect = () => {
            console.log("웹소켓 연결됨");
            subscribeToStructure(client);
            subscribeToSlide(client, currentSlide);
        };

        client.activate();
        stompClientRef.current = client;

        return () => {
            client.deactivate();
        };
    }, []);

    const subscribeToSlide = (client: Client, slideNumber: number) => {
        const topic = `/topic/presentation.${presentationId}.slide.${slideNumber}`;
        console.log("구독 시작:", topic);

        subscriptionRef.current = client.subscribe(topic, (message) => {
            const parsed = JSON.parse(message.body);
            console.log("수신 메시지:", parsed);

            setSlideData((prev) => ({
                ...prev,
                [slideNumber]: {
                    shapes: parsed.data?.shapes || [],
                    texts: parsed.data?.texts || [],
                },
            }));
        });
    };

    const broadcastFullSlideFromData = (
        data: { [key: number]: { shapes: Shape[]; texts: TextItem[] } }
    ) => {
        if (isTyping) return;

        const current = data[currentSlide];

        const payload = {
            last_revision_user_id: "admin",
            data: {
                shapes: current?.shapes || [],
                texts: current?.texts || [],
            },
        };

        console.log("슬라이드 단일 전송:", payload);

        stompClientRef.current?.publish({
            destination: `/app/slide.edit.presentation.${presentationId}.slide.${currentSlide}`,
            body: JSON.stringify(payload),
        });
    };

    const subscribeToStructure = (client: Client) => {
        const topic = `/topic/presentation.${presentationId}`;
        console.log("구조 구독 시작:", topic);

        client.subscribe(topic, (message) => {
            const parsed = JSON.parse(message.body);
            console.log("구조 수신 메시지:", parsed);

            const slideList: ReceivedSlide[] = parsed.slides || [];
            const newSlideData: {
                [key: number]: { shapes: Shape[]; texts: TextItem[] };
            } = {};
            const orders: number[] = [];

            const seen = new Set<number>();
            for (let i = 0; i < slideList.length; i++) {
                const slide = slideList[i];
                let order = slide.order;

                while (seen.has(order)) {
                    order += 1;
                }
                seen.add(order);

                orders.push(order);
                newSlideData[order] = {
                    shapes: slide.data?.shapes || [],
                    texts: slide.data?.texts || [],
                };
            }

            console.log("수신된 slide orders:", slideList.map((s) => s.order));

            setSlides(orders);
            setSlideData(newSlideData);
            if (orders.length > 0) setCurrentSlide(orders[0]);
        });
    };

    const broadcastStructure = (
        data: { [key: number]: { shapes: Shape[]; texts: TextItem[] } }
    ) => {
        const slidesPayload = Object.keys(data).map((slideIdStr) => {
            const slideId = Number(slideIdStr);
            return {
                slideId: `slide-${slideId}`,
                order: slideId,
                lastRevisionDate: new Date().toISOString(),
                lastRevisionUserId: "admin",
            };
        });

        const payload = {
            presentationId,
            presentationTitle: "제목 없음",
            lastRevisionDate: new Date().toISOString(),
            userId: "admin",
            slides: slidesPayload,
        };

        console.log("전체 구조 전송:", payload);

        stompClientRef.current?.publish({
            destination: `/app/slide.edit.presentation.${presentationId}`,
            body: JSON.stringify(payload),
        });
    };

    const handleAddSlide = () => {
        const maxSlideNum = Math.max(...slides, 0);
        const newSlideNum = maxSlideNum + 1;

        setSlides((prev) => [...prev, newSlideNum]);
        setSlideData((prev) => {
            const newData = {
                ...prev,
                [newSlideNum]: { shapes: [], texts: [] },
            };

            const client = stompClientRef.current;
            if (client && client.connected) {
                subscribeToSlide(client, newSlideNum);
            }

            setTimeout(() => broadcastStructure(newData), 0);
            return newData;
        });
        setCurrentSlide(newSlideNum);
    };

    const handleDeleteSlide = (slideNum: number) => {
        if (slides.length === 1) return;
        const newSlides = slides.filter((s) => s !== slideNum);
        const newSlideData = { ...slideData };
        delete newSlideData[slideNum];
        setSlides(newSlides);
        setSlideData(newSlideData);
        if (currentSlide === slideNum) {
            const index = slides.indexOf(slideNum);
            const nextSlide = newSlides[Math.max(0, index - 1)];
            setCurrentSlide(nextSlide);
        }
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

    const handleReorderSlides = (newSlides: number[]) => {
        setSlides(newSlides);
    };

    const updateShapes = (
        newShapes: Shape[] | ((prev: Shape[]) => Shape[])
    ) => {
        setSlideData((prev) => {
            const updatedShapes =
                typeof newShapes === "function"
                    ? newShapes(prev[currentSlide]?.shapes || [])
                    : newShapes;

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

    const updateTexts = (
        newTexts: TextItem[] | ((prev: TextItem[]) => TextItem[])
    ) => {
        setSlideData((prev) => {
            const updatedTexts =
                typeof newTexts === "function"
                    ? newTexts(prev[currentSlide]?.texts || [])
                    : newTexts;

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
                    slides={slides}
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
