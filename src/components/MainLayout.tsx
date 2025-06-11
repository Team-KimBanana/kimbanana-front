import React, { useState, useEffect, useRef } from "react";
import { Client, StompSubscription} from "@stomp/stompjs";

import Header from "./Header/Header";
import Sidebar from "./Sidebar/Sidebar";
import Canvas from "./Canvas/Canvas";
import Toolbar from "./Toolbar/Toolbar";

import { Shape, TextItem } from "../types/types";
import "./MainLayout.css";

const presentationId = "p_19025";

const MainLayout: React.FC = () => {
    const [activeTool, setActiveTool] = useState("cursor");
    const [selectedColor, setSelectedColor] = useState("#B0B0B0");
    const [slides, setSlides] = useState<number[]>([1]);
    const [currentSlide, setCurrentSlide] = useState<number>(1);
    const [slideData, setSlideData] = useState<{
        [key: number]: { shapes: Shape[]; texts: TextItem[] };
    }>({
        1: { shapes: [], texts: [] },
    });
    const [thumbnails, setThumbnails] = useState<{ [key: number]: string }>({});
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [defaultFontSize, setDefaultFontSize] = useState(20);
    const stompClientRef = useRef<Client | null>(null);
    const subscriptionRef = useRef<StompSubscription | null>(null);
    const senderId = useRef<string>()

    useEffect(() => {
        const client = new Client({
            brokerURL: "ws://192.168.0.33:8080/ws-api",
            reconnectDelay: 5000,
        });

        client.onConnect = () => {
            console.log("웹소켓 연결됨");
            subscribeToSlide(client, currentSlide);
        };

        client.activate();
        stompClientRef.current = client;

        return () => {
            client.deactivate();
        };
    }, []);

    useEffect(() => {
        const client = stompClientRef.current;
        if (client && client.connected) {
            subscriptionRef.current?.unsubscribe();
            subscribeToSlide(client, currentSlide);
        }
    }, [currentSlide]);

    const subscribeToSlide = (client: Client, slideNumber: number) => {
        const topic = `/topic/presentation.${presentationId}.slide.slide-${slideNumber}`;
        console.log("구독 시작:", topic);

        subscriptionRef.current = client.subscribe(topic, (message) => {
            const parsed = JSON.parse(message.body);

            const data = parsed.data;
            const slideId = parseInt(parsed.slideId.replace("slide-", ""));

            console.log("수신 메시지:", parsed);

            setSlideData((prev) => ({
                ...prev,
                [slideId]: {
                    shapes: data.shapes || [],
                    texts: data.texts || [],
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
            slideId: `slide-${currentSlide}`,
            presentationId,
            lastRevisionDate: new Date().toISOString(),
            lastRevisionUserId: "admin",
            order: currentSlide,
            senderId: senderId.current,
            data: {
                shapes: current?.shapes || [],
                texts: current?.texts || [],
            },
        };

        console.log("WebSocket 전송:", payload);

        stompClientRef.current?.publish({
            destination: `/app/slide.edit.presentation.${presentationId}.slide.slide-${currentSlide}`,
            body: JSON.stringify(payload),
        });
    };

    const handleAddSlide = () => {
        const newSlideNum = slides.length + 1;
        setSlides((prev) => [...prev, newSlideNum]);
        setSlideData((prev) => ({
            ...prev,
            [newSlideNum]: { shapes: [], texts: [] },
        }));
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
            if (
                e.key === "Backspace" &&
                !isTyping &&
                slides.length > 1
            ) {
                e.preventDefault();
                handleDeleteSlide(currentSlide);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
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
                    />
                </div>
            </div>
        </div>
    );
};

export default MainLayout;