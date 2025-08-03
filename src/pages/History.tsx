import React, { useEffect, useState } from "react";
import "./History.css";
import Header from "../components/Header/Header.tsx";
import Sidebar from "../components/Sidebar/Sidebar.tsx";
import HistoryList from "../components/HistoryList/HistoryList.tsx";
import Canvas from "../components/Canvas/Canvas.tsx";
import ThumbnailRenderer from "../components/ThumbnailRenderer/ThumbnailRenderer.tsx";
import { Shape, TextItem } from "../types/types.ts";
import { useNavigate } from "react-router-dom";

type SlideContent = {
    shapes: Shape[];
    texts: TextItem[];
};

const fetchMockSlides = async (): Promise<{ [id: string]: SlideContent }> => {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                "1": {
                    shapes: [
                        {
                            id: 999,
                            type: "rectangle",
                            x: 150,
                            y: 150,
                            width: 150,
                            height: 100,
                            color: "#FF9900",
                        },
                    ],
                    texts: [],
                },
                "2": {
                    shapes: [
                        {
                            id: 3,
                            type: "triangle",
                            x: 300,
                            y: 200,
                            points: [0, -50, -50, 50, 50, 50],
                            color: "#00CC66",
                        },
                    ],
                    texts: [],
                },
            });
        }, 500);
    });
};

const History: React.FC = () => {
    const navigate = useNavigate();

    const [slideDataMap, setSlideDataMap] = useState<{ [id: string]: SlideContent }>({});
    const [selectedCurrentSlide, setSelectedCurrentSlide] = useState<string>("");
    const [selectedRestoreSlide, setSelectedRestoreSlide] = useState<string | null>(null);
    const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
    const [thumbnails, setThumbnails] = useState<{ [key: string]: string }>({});

    const shownSlideId = selectedRestoreSlide || selectedCurrentSlide;
    const current = slideDataMap[selectedCurrentSlide];
    const isRestoreEnabled = selectedCurrentSlide && selectedRestoreSlide;

    const historyData: {
        [timestamp: string]: {
            [slideId: string]: SlideContent;
        };
    } = {
        "2025년 2월 13일 12:00": {
            "1": {
                shapes: [
                    { id: 1, type: "rectangle", x: 100, y: 100, width: 200, height: 100, color: "#FF0000" },
                ],
                texts: [],
            },
            "2": {
                shapes: [
                    { id: 2, type: "circle", x: 400, y: 200, radius: 50, color: "#00AAFF" },
                ],
                texts: [],
            },
            "3": {
                shapes: [
                    { id: 1, type: "rectangle", x: 100, y: 100, width: 200, height: 100, color: "#FF0000" },
                ],
                texts: [],
            },
            "4": {
                shapes: [
                    { id: 2, type: "circle", x: 400, y: 200, radius: 50, color: "#00AAFF" },
                ],
                texts: [],
            },
            "5": {
                shapes: [
                    { id: 1, type: "rectangle", x: 100, y: 100, width: 200, height: 100, color: "#FF0000" },
                ],
                texts: [],
            },
            "6": {
                shapes: [
                    { id: 2, type: "circle", x: 400, y: 200, radius: 50, color: "#00AAFF" },
                ],
                texts: [],
            },
        },
        "2025년 2월 11일 16:00": {
            "1": {
                shapes: [
                    {
                        id: 3,
                        type: "triangle",
                        x: 300,
                        y: 200,
                        points: [0, -50, -50, 50, 50, 50],
                        color: "#00CC66",
                    },
                ],
                texts: [],
            },
        },
    };

    const getRestoreSlides = (version: string | null): string[] => {
        if (!version || !historyData[version]) return [];
        return Object.keys(historyData[version]).map(
            (slideId) => `restore-${version}-${slideId}`
        );
    };

    const restoreSlides = getRestoreSlides(selectedVersion);

    useEffect(() => {
        const loadSlides = async () => {
            const slides = await fetchMockSlides();
            setSlideDataMap(slides);

            const firstSlideId = Object.keys(slides)[0];
            if (firstSlideId) {
                setSelectedCurrentSlide(firstSlideId);
            }
        };

        loadSlides();
    }, []);

    useEffect(() => {
        if (!selectedVersion || !historyData[selectedVersion]) return;

        const newEntries: { [id: string]: SlideContent } = {};
        Object.entries(historyData[selectedVersion]).forEach(([slideId, content]) => {
            const id = `restore-${selectedVersion}-${slideId}`;
            newEntries[id] = content;
        });

        setSlideDataMap((prev) => ({
            ...prev,
            ...newEntries,
        }));
    }, [selectedVersion]);

    const handleSelectVersion = (timestamp: string) => {
        setSelectedVersion(timestamp);
        setSelectedRestoreSlide(null);
    };

    const handleRestoreSlide = () => {
        if (!selectedRestoreSlide || !selectedCurrentSlide) return;

        const restoreData = slideDataMap[selectedRestoreSlide];
        setSlideDataMap((prev) => ({
            ...prev,
            [selectedCurrentSlide]: restoreData,
        }));

        // 썸네일 강제 갱신
        setTimeout(() => {
            const canvas = document.querySelector("canvas");
            if (canvas) {
                const dataUrl = canvas.toDataURL();
                setThumbnails((prev) => ({ ...prev, [selectedCurrentSlide]: dataUrl }));
            }
        }, 0);

        setSelectedRestoreSlide(null);
    };

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
            <Header
                variant="history"
                title={selectedVersion || "히스토리"}
                onApplyRestore={handleApplyRestore}
            />

            <div className="history-body">
                <Sidebar
                    variant="current"
                    slides={Object.keys(slideDataMap).filter(id => !id.startsWith("restore-"))}
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
                    slides={restoreSlides}
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
                    onRestoreSelected={handleRestoreSlide}
                    isRestoreEnabled={!!isRestoreEnabled}
                />

                <div className="history-canvas">
                    <Canvas
                        activeTool="cursor"
                        selectedColor="#000000"
                        setActiveTool={() => {}}
                        shapes={current?.shapes || []}
                        setShapes={(updatedShapes) => {
                            setSlideDataMap((prev) => ({
                                ...prev,
                                [selectedCurrentSlide]: {
                                    ...prev[selectedCurrentSlide],
                                    shapes: typeof updatedShapes === "function"
                                        ? updatedShapes(prev[selectedCurrentSlide].shapes)
                                        : updatedShapes,
                                },
                            }));
                        }}
                        texts={current?.texts || []}
                        setTexts={(updatedTexts) => {
                            setSlideDataMap((prev) => ({
                                ...prev,
                                [selectedCurrentSlide]: {
                                    ...prev[selectedCurrentSlide],
                                    texts: typeof updatedTexts === "function"
                                        ? updatedTexts(prev[selectedCurrentSlide].texts)
                                        : updatedTexts,
                                },
                            }));
                        }}
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
                        <ThumbnailRenderer
                            key={id}
                            slideId={id}
                            slideData={data}
                            onRendered={handleThumbnailRendered}
                        />
                    ))}
                </div>

                <HistoryList
                    historyData={historyData}
                    selected={selectedVersion}
                    onSelect={handleSelectVersion}
                />
            </div>
        </div>
    );
};

export default History;