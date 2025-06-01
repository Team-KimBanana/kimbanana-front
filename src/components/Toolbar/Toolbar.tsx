import React, { useState, useRef, useEffect } from "react";
import "./Toolbar.css";
import { Icon } from '@iconify/react';

interface ToolbarProps {
    setActiveTool: (tool: string) => void;
    activeTool: string;
    setSelectedColor: (color: string) => void;
    defaultFontSize: number;
    setDefaultFontSize: (size: number) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
                                             setActiveTool,
                                             activeTool,
                                             setSelectedColor,
                                             defaultFontSize,
                                             setDefaultFontSize
                                         }) => {
    const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);
    const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
    const [isTextMenuOpen, setIsTextMenuOpen] = useState(false);

    const shapeMenuRef = useRef<HTMLDivElement | null>(null);
    const colorMenuRef = useRef<HTMLDivElement | null>(null);
    const textMenuRef = useRef<HTMLDivElement | null>(null);

    const colors = ["#FF5733", "#33FF57", "#3385FF", "#F6DE55", "#000000","#D86868", "#CFA37A", "#4399B5", "#476C96" ];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            if (shapeMenuRef.current && !shapeMenuRef.current.contains(target)) {
                setIsShapeMenuOpen(false);
            }
            if (colorMenuRef.current && !colorMenuRef.current.contains(target)) {
                setIsColorMenuOpen(false);
            }
            if (textMenuRef.current && !textMenuRef.current.contains(target)) {
                setIsTextMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const tools = [
        { name: "cursor", icon: "/assets/toolIcon/cursor.svg" },
        { name: "text", icon: "/assets/toolIcon/text.svg", isTextButton: true },
        { name: "shapes", icon: "/assets/toolIcon/shapes.svg", isShapeButton: true },
        { name: "color", icon: "/assets/toolIcon/color.svg", isColorButton: true },
        { name: "pen", icon: "/assets/toolIcon/pen.svg" },
        { name: "image", icon: "/assets/toolIcon/image.svg" },
    ];

    return (
        <div className="toolbar">
            {tools.map((tool) => {
                if (tool.isShapeButton) {
                    return (
                        <div className="shape-dropdown" key={tool.name}>
                            <button className={`toolbar-btn ${isShapeMenuOpen ? "active" : ""}`} onClick={() => {
                                setIsShapeMenuOpen((prev) => !prev);
                                setActiveTool("shapes");
                            }}>
                                <img src={tool.icon} alt="Shapes" />
                            </button>

                            {isShapeMenuOpen && (
                                <div className="shape-menu" ref={shapeMenuRef}>
                                    <button onClick={() => { setActiveTool("circle"); setIsShapeMenuOpen(false); }}>
                                        <img src="/assets/toolIcon/circle.svg" alt="Circle" />
                                        <span>원</span>
                                    </button>
                                    <button onClick={() => { setActiveTool("rectangle"); setIsShapeMenuOpen(false); }}>
                                        <img src="/assets/toolIcon/rectangle.svg" alt="Rectangle" />
                                        <span>사각형</span>
                                    </button>
                                    <button onClick={() => { setActiveTool("triangle"); setIsShapeMenuOpen(false); }}>
                                        <img src="/assets/toolIcon/triangle.svg" alt="Triangle" />
                                        <span>삼각형</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                } else if (tool.isColorButton) {
                    return (
                        <div className="color-dropdown" key={tool.name}>
                            <button className={`toolbar-btn ${isColorMenuOpen ? "active" : ""}`} onClick={() => {
                                setIsColorMenuOpen((prev) => !prev);
                                setActiveTool("color");
                            }}>
                                <img src={tool.icon} alt="Color" />
                            </button>

                            {isColorMenuOpen && (
                                <div className="color-menu" ref={colorMenuRef}>
                                    {colors.map((color) => (
                                        <button
                                            key={color}
                                            style={{
                                                backgroundColor: color,
                                                width: "24px",
                                                height: "24px",
                                                borderRadius: "50%",
                                            }}
                                            onClick={() => {
                                                setSelectedColor(color);
                                                setIsColorMenuOpen(false);
                                            }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                } else if (tool.isTextButton) {
                    return (
                        <div className="text-dropdown" key={tool.name}>
                            <button className={`toolbar-btn ${isTextMenuOpen ? "active" : ""}`} onClick={() => {
                                setIsTextMenuOpen((prev) => !prev);
                                setActiveTool("text");
                            }}>
                                <img src={tool.icon} alt="Text" />
                            </button>

                            {isTextMenuOpen && (
                                <div className="text-menu" ref={textMenuRef}>
                                    <Icon icon="mdi:format-size" width="18" height="18" />
                                    <select
                                        value={defaultFontSize}
                                        onChange={(e) => setDefaultFontSize(parseInt(e.target.value, 10))}
                                    >
                                        {[18, 24, 32, 48, 64, 96, 128].map((size) => (
                                            <option key={size} value={size}>
                                                {size}px
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    );
                } else {
                    return (
                        <button
                            key={tool.name}
                            className={`toolbar-btn ${activeTool === tool.name ? "active" : ""}`}
                            onClick={() => setActiveTool(tool.name)}
                        >
                            <img src={tool.icon} alt={tool.name} />
                        </button>
                    );
                }
            })}

            <div className="divider"></div>
            <button className="toolbar-btn">
                <img src="/assets/toolIcon/before.svg" alt="Undo" />
            </button>
            <button className="toolbar-btn">
                <img src="/assets/toolIcon/after.svg" alt="Redo" />
            </button>
        </div>
    );
};

export default Toolbar;
