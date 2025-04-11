import React, { useState, useRef, useEffect } from "react";
import { Stage, Layer, Rect, Ellipse, Line, Transformer, Text } from "react-konva";
import Konva from "konva";
import "./Canvas.css";
import {KonvaEventObject} from "konva/lib/Node";

interface CanvasProps {
    activeTool: string;
    selectedColor: string;
    setActiveTool: (tool: string) => void;
    shapes: Shape[];
    setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
    currentSlide: number;
    updateThumbnail: (slideId: number, dataUrl: string) => void;
}

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
    radiusX?: number;
    radiusY?: number;
}

interface TextElement {
    id: string;
    x: number;
    y: number;
    text: string;
    color: string;
}

const drawTrianglePoints = (
    _x: number,
    _y: number,
    scaleX = 1,
    scaleY = 1
): number[] => {
    const baseWidth = 100;
    const baseHeight = 100;

    const width = baseWidth * scaleX;
    const height = baseHeight * scaleY;

    return [
        0, -height / 2,
        -width / 2, height / 2,
        width / 2, height / 2
    ];
};


const Canvas: React.FC<CanvasProps> = ({
                                           activeTool,
                                           selectedColor,
                                           setActiveTool,
                                           shapes,
                                           setShapes,
                                           currentSlide,
                                           updateThumbnail,
                                       }) => {
    const [selectedShapeId, setSelectedShapeId] = useState<number | null>(null);
    const [texts, setTexts] = useState<TextElement[]>([]);
    const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState<TextElement | null>(null);

    const transformerRef = useRef<Konva.Transformer | null>(null);
    const shapeRefs = useRef<Map<number, Konva.Node>>(new Map());
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const backgroundRef = useRef<Konva.Rect>(null);
    const stageRef = useRef<Konva.Stage>(null);


    useEffect(() => { // 썸넬용
        if (stageRef.current) {
            const dataUrl = stageRef.current.toDataURL({ pixelRatio: 0.25 });
            updateThumbnail(currentSlide, dataUrl);
        }
    }, [shapes, texts]);



    useEffect(() => {
        setSelectedShapeId(null);
        setSelectedTextId(null);
        setEditingText(null);
    }, [currentSlide]);

    const addShape = (x: number, y: number) => {
        let newShape: Shape | null = null;

        if (activeTool === "rectangle") {
            newShape = {
                type: "rectangle",
                x: x - 50,
                y: y - 50,
                width: 100,
                height: 100,
                color: "#B0B0B0",
                id: Date.now(),
            };
        } else if (activeTool === "circle") {
            newShape = {
                type: "circle",
                x,
                y,
                radius: 50,
                color: "#B0B0B0",
                id: Date.now(),
            };
        } else if (activeTool === "triangle") {
            newShape = {
                type: "triangle",
                x,
                y,
                points: drawTrianglePoints(x, y),
                color: "#B0B0B0",
                id: Date.now(),
            };
        }

        if (newShape) {
            setShapes((prev) => [...prev, newShape]);
            setSelectedShapeId(newShape.id);
            setSelectedTextId(null);
            setActiveTool("cursor");
        }
    };

    const addText = (x: number, y: number) => {
        const id = `text-${Date.now()}`;
        const newText: TextElement = {
            id,
            text: "",
            x,
            y,
            color: "#000000",
        };

        console.log("🆕 텍스트 객체 생성됨:", newText);

        setTexts((prevTexts) => [...prevTexts, newText]);
        setSelectedTextId(id);

        // texts 상태가 먼저 업데이트되고 나서 editingText 설정
        setTimeout(() => {
            setEditingText(newText);
        }, 0); // 다음 이벤트 루프로 밀어서 렌더링 이후 실행
    };

    useEffect(() => {
        console.log("✏️ editingText가 설정됨:", editingText);
        if (editingText && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingText]);

    const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
        // 도형 위를 클릭하면 아무것도 하지 않음
        if (e.target !== backgroundRef.current) return;

        const stage = stageRef.current;
        const pointerPosition = stage?.getPointerPosition();

        if (!pointerPosition) {
            console.log("📛 pointerPosition이 없습니다.");
            return;
        }

        const { x, y } = pointerPosition;
        console.log("✅ 마우스 클릭 위치:", x, y);

        if (activeTool === "text") {
            console.log("🖋 텍스트 추가 트리거됨");
            addText(x, y);
        } else if (["rectangle", "circle", "triangle"].includes(activeTool)) {
            addShape(x, y);
        } else {
            setSelectedShapeId(null);
            setSelectedTextId(null);
        }

        setEditingText(null);
    };



    const handleTransformEnd = (shapeId: number) => {
        const node = shapeRefs.current.get(shapeId);
        if (!node) return;

        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        setShapes((prev) =>
            prev.map((shape) => {
                if (shape.id !== shapeId) return shape;

                const updatedShape: Shape = {
                    ...shape,
                    x: node.x(),
                    y: node.y(),
                };

                if (shape.type === "rectangle") {
                    updatedShape.width = (node.width() || 1) * scaleX;
                    updatedShape.height = (node.height() || 1) * scaleY;
                } else if (shape.type === "circle") {
                    updatedShape.radiusX = (node.width() / 2) * scaleX;
                    updatedShape.radiusY = (node.height() / 2) * scaleY;
                } else if (shape.type === "triangle") {
                    const originalPoints = shape.points || drawTrianglePoints(0, 0);
                    updatedShape.points = originalPoints.map((point, index) =>
                        index % 2 === 0 ? point * scaleX : point * scaleY
                    );
                }

                node.scaleX(1);
                node.scaleY(1);

                return updatedShape;
            })
        );
    };


    useEffect(() => {
        if (selectedShapeId !== null && transformerRef.current) {
            const selectedNode = shapeRefs.current.get(selectedShapeId);
            if (selectedNode) {
                transformerRef.current.nodes([selectedNode]);
                transformerRef.current.getLayer()?.batchDraw();
            }
        } else {
            transformerRef.current?.nodes([]);
        }
    }, [selectedShapeId, shapes]);

    useEffect(() => {
        if (selectedShapeId !== null) {
            setShapes((prev) =>
                prev.map((shape) =>
                    shape.id === selectedShapeId ? { ...shape, color: selectedColor } : shape
                )
            );
        } else if (selectedTextId !== null) {
            setTexts((prev) =>
                prev.map((text) =>
                    text.id === selectedTextId ? { ...text, color: selectedColor } : text
                )
            );
        }
    }, [selectedColor]);


    const deleteShape = () => {
        if (selectedShapeId !== null) {
            setShapes((prev) => prev.filter((shape) => shape.id !== selectedShapeId));
            setSelectedShapeId(null);
        } else if (selectedTextId !== null) {
            setTexts((prev) => prev.filter((text) => text.id !== selectedTextId));
            setSelectedTextId(null);
        }
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Backspace") {
                deleteShape();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedShapeId, selectedTextId]);

    return (
        <div className="whiteboard-container" style={{ position: "relative" }}>
            <Stage
                ref={stageRef}
                width={1000}
                height={563}
                onMouseDown={handleMouseDown}
            >
                <Layer>
                    <Rect width={1000} height={563} fill="white" ref={backgroundRef} />

                    {shapes.map((shape) => (
                        <React.Fragment key={shape.id}>
                            {shape.type === "rectangle" && (
                                <Rect
                                    ref={(node) => node && shapeRefs.current.set(shape.id, node)}
                                    x={shape.x!}
                                    y={shape.y!}
                                    width={shape.width!}
                                    height={shape.height!}
                                    fill={shape.color}
                                    draggable
                                    onClick={() => {
                                        setSelectedShapeId(shape.id);
                                        setSelectedTextId(null);
                                    }}
                                    onTransformEnd={() => handleTransformEnd(shape.id)}
                                    onDragEnd={(e) => {
                                        const { x, y } = e.target.position();
                                        setShapes((prev) =>
                                            prev.map((s) => (s.id === shape.id ? { ...s, x, y } : s))
                                        );
                                    }}
                                />
                            )}
                            {shape.type === "circle" && (
                                <Ellipse
                                    ref={(node) => node && shapeRefs.current.set(shape.id, node)}
                                    x={shape.x!}
                                    y={shape.y!}
                                    radiusX={shape.radiusX ?? shape.radius ?? 50}
                                    radiusY={shape.radiusY ?? shape.radius ?? 50}
                                    fill={shape.color}
                                    draggable
                                    onClick={() => {
                                        setSelectedShapeId(shape.id);
                                        setSelectedTextId(null);
                                    }}
                                    onTransformEnd={() => handleTransformEnd(shape.id)}
                                    onDragEnd={(e) => {
                                        const { x, y } = e.target.position();
                                        setShapes((prev) =>
                                            prev.map((s) => (s.id === shape.id ? { ...s, x, y } : s))
                                        );
                                    }}
                                />

                            )}
                            {shape.type === "triangle" && (
                                <Line
                                    ref={(node) => node && shapeRefs.current.set(shape.id, node)}
                                    x={shape.x!}
                                    y={shape.y!}
                                    points={shape.points!}
                                    fill={shape.color}
                                    closed
                                    draggable
                                    onClick={() => {
                                        setSelectedShapeId(shape.id);
                                        setSelectedTextId(null);
                                    }}
                                    onTransformEnd={() => handleTransformEnd(shape.id)}
                                    onDragEnd={(e) => {
                                        const { x, y } = e.target.position();
                                        setShapes((prev) =>
                                            prev.map((s) =>
                                                s.id === shape.id ? { ...s, x, y } : s
                                            )
                                        );
                                    }}
                                />

                            )}
                        </React.Fragment>
                    ))}

                    {texts.map((text) => (
                        <Text
                            key={text.id}
                            x={text.x}
                            y={text.y}
                            text={text.text}
                            fontSize={20}
                            fill={text.color}
                            draggable
                            onClick={() => {
                                setSelectedTextId(text.id);
                                setEditingText(text);
                            }}
                            onDragEnd={(e) => {
                                const { x, y } = e.target.position();
                                setTexts((prev) =>
                                    prev.map((t) =>
                                        t.id === text.id ? { ...t, x, y } : t
                                    )
                                );
                            }}
                        />
                    ))}

                    {(selectedShapeId !== null || selectedTextId !== null) && (
                        <Transformer
                            ref={transformerRef}
                            boundBoxFunc={(oldBox, newBox) => {
                                return newBox.width < 5 || newBox.height < 5 ? oldBox : newBox;
                            }}
                        />
                    )}
                </Layer>
            </Stage>

            {editingText && (
                <textarea
                    ref={inputRef}
                    value={editingText.text}
                    style={{
                        position: "absolute",
                        top: editingText.y,
                        left: editingText.x,
                        fontSize: 20,
                        border: "1px solid #ccc",
                        padding: "4px",
                        backgroundColor: "white",
                        resize: "none",
                        zIndex: 10,
                    }}
                    onChange={(e) => {
                        const updated = e.target.value;
                        setEditingText((prev) => prev && { ...prev, text: updated });
                        setTexts((prev) =>
                            prev.map((t) =>
                                t.id === editingText.id ? { ...t, text: updated } : t
                            )
                        );
                    }}
                    onBlur={() => {
                        if (!editingText.text.trim()) {
                            setTexts((prev) =>
                                prev.filter((t) => t.id !== editingText.id)
                            );
                        }
                        setEditingText(null);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (!editingText.text.trim()) {
                                setTexts((prev) =>
                                    prev.filter((t) => t.id !== editingText.id)
                                );
                            }
                            setEditingText(null);
                        }
                    }}
                />
            )}
        </div>
    );
};

export default Canvas;
