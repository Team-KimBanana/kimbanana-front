import React, { useState, useEffect } from "react";
import Header from "./Header/Header";
import Sidebar from "./Sidebar/Sidebar";
import Canvas from "./Canvas/Canvas";
import Toolbar from "./Toolbar/Toolbar";
import "./MainLayout.css";

const MainLayout: React.FC = () => {
    const [activeTool, setActiveTool] = useState("cursor");
    const [selectedColor, setSelectedColor] = useState("#B0B0B0");

    useEffect(() => {
        console.log("현재 선택된 도구:", activeTool);
        console.log("현재 선택된 색상:", selectedColor);
    }, [activeTool, selectedColor]);

    return (
        <div className="main-layout">
            <Header />
            <div className="content">
                <Sidebar />
                <div className="canvas-container">
                    <Canvas activeTool={activeTool} selectedColor={selectedColor} />
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
