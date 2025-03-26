import React, { useState, useRef, useEffect } from "react";
import "./Toolbar.css";

interface ToolbarProps {
    setActiveTool: (tool: string) => void;
    activeTool: string;
    setSelectedColor: (color: string) => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ setActiveTool, activeTool, setSelectedColor }) => {
    const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);
    const [isColorMenuOpen, setIsColorMenuOpen] = useState(false);
    const shapeMenuRef = useRef<HTMLDivElement | null>(null);
    const colorMenuRef = useRef<HTMLDivElement | null>(null);

    const colors = ["#FF5733", "#33FF57", "#3385FF", "#F6DE55", "#B0B0B0"]; // ✅ 기본 색상 목록

    const toggleShapeMenu = () => setIsShapeMenuOpen((prev) => !prev);
    const toggleColorMenu = () => setIsColorMenuOpen((prev) => !prev);

    // ✅ 메뉴 바깥 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (shapeMenuRef.current && !shapeMenuRef.current.contains(event.target as Node)) {
                setIsShapeMenuOpen(false);
            }
            if (colorMenuRef.current && !colorMenuRef.current.contains(event.target as Node)) {
                setIsColorMenuOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const tools = [
        { name: "cursor", icon: "/assets/toolIcon/cursor.svg" },
        { name: "text", icon: "/assets/toolIcon/text.svg" },
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
                            <button className={`toolbar-btn ${isShapeMenuOpen ? "active" : ""}`} onClick={toggleShapeMenu}>
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
                            <button className={`toolbar-btn ${isColorMenuOpen ? "active" : ""}`} onClick={toggleColorMenu}>
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
