import React, { useState, useEffect } from "react";
import Header from "./Header/Header";
import Sidebar from "./Sidebar/Sidebar";
import Canvas from "./Canvas/Canvas";
import Toolbar from "./Toolbar/Toolbar";
import "./MainLayout.css";

interface Shape {
    id: number;
    type: "rectangle" | "circle" | "triangle";
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    radius?: number;
    points?: number[];
    color: string;
}

interface TextItem {
    id: number;
    x: number;
    y: number;
    text: string;
    color: string;
}

const MainLayout: React.FC = () => {
    const [activeTool, setActiveTool] = useState("cursor");
    const [selectedColor, setSelectedColor] = useState("#B0B0B0");
    const [slides, setSlides] = useState<number[]>([1]);
    const [currentSlide, setCurrentSlide] = useState<number>(1);
    const [slideData, setSlideData] = useState<{ [key: number]: { shapes: Shape[]; texts: TextItem[] } }>({
        1: { shapes: [], texts: [] },
    });

    useEffect(() => {
        console.log("현재 선택된 도구:", activeTool);
        console.log("현재 선택된 색상:", selectedColor);
    }, [activeTool, selectedColor]);

    const handleAddSlide = () => {
        const newSlideNum = slides.length + 1;
        setSlides((prev) => [...prev, newSlideNum]);
        setSlideData((prev) => ({
            ...prev,
            [newSlideNum]: { shapes: [], texts: [] },
        }));
        setCurrentSlide(newSlideNum);
    };

    const updateShapes = (newShapes: Shape[] | ((prev: Shape[]) => Shape[])) => {
        setSlideData((prev) => ({
            ...prev,
            [currentSlide]: {
                ...prev[currentSlide],
                shapes: typeof newShapes === 'function' ? newShapes(prev[currentSlide]?.shapes || []) : newShapes,
                texts: prev[currentSlide]?.texts || [],
            },
        }));
    };

    const updateTexts = (newTexts: TextItem[] | ((prev: TextItem[]) => TextItem[])) => {
        setSlideData((prev) => ({
            ...prev,
            [currentSlide]: {
                ...prev[currentSlide],
                texts: typeof newTexts === 'function' ? newTexts(prev[currentSlide]?.texts || []) : newTexts,
                shapes: prev[currentSlide]?.shapes || [],
            },
        }));
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
                />
                <div className="canvas-container">
                    <Canvas
                        activeTool={activeTool}
                        selectedColor={selectedColor}
                        setActiveTool={setActiveTool}
                        shapes={slideData[currentSlide]?.shapes || []}
                        texts={slideData[currentSlide]?.texts || []}
                        setShapes={updateShapes}
                        setTexts={updateTexts}
                        currentSlide={currentSlide}
                    />
                    <Toolbar
                        activeTool={activeTool}
                        setActiveTool={setActiveTool}
                        setSelectedColor={setSelectedColor}
                    />
                </div>
            </div>
        </div>
    );
};

export default MainLayout;