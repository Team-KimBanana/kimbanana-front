import React, { useEffect, useState } from "react";
import "./History.css";
import Header from "../components/Header/Header.tsx";
import Sidebar from "../components/Sidebar/Sidebar.tsx";
import HistoryList from "../components/HistoryList/HistoryList.tsx";
import Canvas from "../components/Canvas/Canvas.tsx";
import { Shape, TextItem } from "../types/types.ts";

const History: React.FC = () => {
    const slides = ["1", "2"];
    const thumbnails = {};
    const [currentSlide, setCurrentSlide] = useState("1");

    const [shapes, setShapes] = useState<Shape[]>([]);
    const [texts, setTexts] = useState<TextItem[]>([]);
    const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

    const historyData: {
        [timestamp: string]: {
            shapes: Shape[];
            texts: TextItem[];
        };
    } = {
        "2025년 2월 13일 12:00": {
            shapes: [{ id: 1, type: "rectangle", x: 100, y: 100, width: 200, height: 100, color: "#FF0000" }],
            texts: [],
        },
        "2025년 2월 13일 11:04": {
            shapes: [{ id: 2, type: "circle", x: 400, y: 200, radius: 50, color: "#00AAFF" }],
            texts: [],
        },
        "2025년 2월 11일 16:00": {
            shapes: [{ id: 3, type: "triangle", x: 300, y: 200, points: [0, -50, -50, 50, 50, 50], color: "#00CC66" }],
            texts: [],
        },
    };

    const handleSelect = (timestamp: string) => {
        setSelectedVersion(timestamp);
        const selectedData = historyData[timestamp];
        setShapes(selectedData?.shapes || []);
        setTexts(selectedData?.texts || []);
    };

    useEffect(() => {
        const defaultTimestamp = Object.keys(historyData)[0];
        handleSelect(defaultTimestamp);
    }, []);

    return (
        <div className="history">
            <Header variant="history" title={selectedVersion || "히스토리"} />

            <div className="history-body">
                <Sidebar
                    variant="history"
                    slides={slides}
                    currentSlide={currentSlide}
                    setCurrentSlide={setCurrentSlide}
                    thumbnails={thumbnails}
                />

                <div className="history-canvas">
                    <Canvas
                        activeTool="cursor"
                        selectedColor="#000000"
                        setActiveTool={() => {}}
                        shapes={shapes}
                        setShapes={setShapes}
                        texts={texts}
                        setTexts={setTexts}
                        currentSlide={currentSlide}
                        updateThumbnail={() => {}}
                        sendEdit={() => {}}
                        setIsTyping={() => {}}
                        defaultFontSize={20}
                        isHistoryPage={true}
                        onSelectShape={() => {}}
                        onSelectText={() => {}}
                    />
                </div>

                <HistoryList
                    historyData={historyData}
                    selected={selectedVersion}
                    onSelect={handleSelect}
                />
            </div>
        </div>
    );
};

export default History;
