import React, { useState, useRef, useEffect } from "react";
import "./Toolbar.css";
import { Icon } from '@iconify/react';
import AdvancedColorPicker from "./AdvancedColorPicker";

interface ToolbarProps {
    setActiveTool: (tool: string) => void;
    activeTool: string;
    selectedColor: string;
    setSelectedColor: (color: string) => void;
    defaultFontSize: number;
    setDefaultFontSize: (size: number) => void;
    onImageUpload: (imageDataUrl: string) => void;
    eraserSize?: number;
    setEraserSize?: (size: number) => void;
    eraserMode?: "size" | "area";
    setEraserMode?: (mode: "size" | "area") => void;
}

const resizeImage = (file: File, maxWidth = 1000): Promise<File> => {
    return new Promise((resolve) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const scale = maxWidth / img.width;
                canvas.width = maxWidth;
                canvas.height = img.height * scale;

                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                canvas.toBlob((blob) => {
                    if (!blob) return;
                    const resizedFile = new File([blob], file.name, {
                        type: "image/jpeg",
                        lastModified: Date.now(),
                    });
                    resolve(resizedFile);
                }, "image/jpeg", 0.8);
            };

            img.src = e.target?.result as string;
        };

        reader.readAsDataURL(file);
    });
};


const Toolbar: React.FC<ToolbarProps> = ({
                                             setActiveTool,
                                             activeTool,
                                             selectedColor,
                                             setSelectedColor,
                                             defaultFontSize,
                                             setDefaultFontSize,
                                             onImageUpload,
                                             eraserSize = 15,
                                             setEraserSize,
                                             eraserMode = "size",
                                             setEraserMode,
                                         }) => {
    const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false);
    const [isTextMenuOpen, setIsTextMenuOpen] = useState(false);

    const shapeMenuRef = useRef<HTMLDivElement | null>(null);
    const textMenuRef = useRef<HTMLDivElement | null>(null);

    const [showPicker, setShowPicker] = useState(false);
    const [pickerAnchor, setPickerAnchor] = useState<HTMLElement | null>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;

            if (shapeMenuRef.current && !shapeMenuRef.current.contains(target)) {
                setIsShapeMenuOpen(false);
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
        { name: "eraser", icon: "/assets/toolIcon/eraser.svg" },
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
                                    <button onClick={() => { setActiveTool("star"); setIsShapeMenuOpen(false); }}>
                                        <Icon icon="mdi:star" width="18" height="18" />
                                        <span>별</span>
                                    </button>
                                    <button onClick={() => { setActiveTool("arrow"); setIsShapeMenuOpen(false); }}>
                                        <Icon icon="mdi:arrow-right" width="18" height="18" />
                                        <span>화살표</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                } else if (tool.isColorButton) {
                    return (
                        <div className="color-dropdown" key={tool.name}>
                            <button
                                className={`toolbar-btn ${showPicker ? "active" : ""}`}
                                onClick={(e) => {
                                    setActiveTool("color");
                                    setIsShapeMenuOpen(false);
                                    setIsTextMenuOpen(false);
                                    setPickerAnchor(e.currentTarget);
                                    setShowPicker((prev) => !prev);
                                }}
                            >
                                <img src={tool.icon} alt="Color" />
                            </button>

                            {showPicker && (
                                <AdvancedColorPicker
                                    value={selectedColor}
                                    onChange={(c) => {
                                        setSelectedColor(c);
                                    }}
                                    onClose={() => setShowPicker(false)}
                                    enableAlpha={true}
                                    anchorEl={pickerAnchor}
                                />
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
                } else if (tool.name === "image") {
                    return (
                        <React.Fragment key={tool.name}>
                            <input
                                type="file"
                                accept="image/*"
                                id="image-upload"
                                style={{ display: "none" }}


                                onChange={async (e) => {
                                    try {
                                        const file = e.target.files?.[0];
                                        if (!file) return;

                                        const resized = await resizeImage(file);

                                        const formData = new FormData();
                                        formData.append("file", resized);

                                        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/images/upload`, {
                                            method: "POST",
                                            body: formData,
                                        });

                                        if (!res.ok) throw new Error("업로드 실패");

                                        const relativeUrl = await res.text();
                                        const imageUrl = `${import.meta.env.VITE_BASE_URL}${relativeUrl}`;
                                        console.log("이미지 URL:", imageUrl);

                                        onImageUpload(imageUrl);
                                    } catch (err) {
                                        console.error("이미지 업로드 중 에러 발생:", err);
                                        alert("이미지 업로드에 실패했습니다.");
                                    }
                                }}

                            />

                            <label htmlFor="image-upload" className="toolbar-btn">
                                <img src={tool.icon} alt="Image" />
                            </label>
                        </React.Fragment>
                    );

                } else if (tool.name === "pen") {
                    return (
                        <button
                            key={tool.name}
                            className={`toolbar-btn ${activeTool === tool.name ? "active" : ""}`}
                            onClick={() => setActiveTool("pen")}
                        >
                            <img src={tool.icon} alt={tool.name} />
                        </button>
                    );
                } else if (tool.name === "eraser") {
                    if (activeTool === "pen" || activeTool === "eraser") {
                        return (
                            <div key={tool.name} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <button
                                    className={`toolbar-btn ${activeTool === tool.name ? "active" : ""}`}
                                    onClick={() => setActiveTool(activeTool === "eraser" ? "pen" : "eraser")}
                                    title="지우개"
                                >
                                    <Icon icon="mdi:eraser" width="20" height="20" />
                                </button>
                                {activeTool === "eraser" && setEraserMode && (
                                    <select
                                        value={eraserMode}
                                        onChange={(e) => setEraserMode(e.target.value as "size" | "area")}
                                        style={{
                                            fontSize: "12px",
                                            padding: "2px 4px",
                                            border: "1px solid #ccc",
                                            borderRadius: "3px",
                                        }}
                                        title="지우개 모드"
                                    >
                                        <option value="size">획 지우개</option>
                                        <option value="area">영역 지우개</option>
                                    </select>
                                )}
                                {activeTool === "eraser" && setEraserSize && (
                                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                        <input
                                            type="range"
                                            min="5"
                                            max="50"
                                            value={eraserSize}
                                            onChange={(e) => setEraserSize(parseInt(e.target.value))}
                                            style={{
                                                width: "50px",
                                                height: "20px",
                                            }}
                                            title="지우개 크기"
                                        />
                                        <span style={{ fontSize: "12px", color: "#666" }}>
                                            {eraserSize}
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    }
                    return null;
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
