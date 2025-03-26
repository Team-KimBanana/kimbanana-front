import React, { useState, useRef, useEffect } from "react";
import { Stage, Layer, Rect, Circle, Line, Transformer, Text } from "react-konva";
import Konva from "konva";
import "./Canvas.css";

interface CanvasProps {
    activeTool: string;
    selectedColor: string;
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
}

interface TextItem {
    id: number;
    x: number;
    y: number;
    text: string;
    color: string;
}

const Canvas: React.FC<CanvasProps> = ({ activeTool, selectedColor }) => {
    const [shapes, setShapes] = useState<Shape[]>([]);
    const [texts, setTexts] = useState<TextItem[]>([]);
    const [selectedShapeId, setSelectedShapeId] = useState<number | null>(null);
    const [selectedTextId, setSelectedTextId] = useState<number | null>(null);
    const transformerRef = useRef<Konva.Transformer | null>(null);
    const shapeRefs = useRef<Map<number, Konva.Node>>(new Map());
    const textRefs = useRef<Map<number, Konva.Text>>(new Map());

    const addShape = (x: number, y: number) => {
        let newShape: Shape;

        if (activeTool === "rectangle") {
            newShape = { type: "rectangle", x: x - 50, y: y - 50, width: 100, height: 100, color: "#B0B0B0", id: Date.now() };
        } else if (activeTool === "circle") {
            newShape = { type: "circle", x, y, radius: 50, color: "#B0B0B0", id: Date.now() };
        } else if (activeTool === "triangle") {
            newShape = {
                type: "triangle",
                points: [x, y - 50, x - 50, y + 50, x + 50, y + 50],
                color: "#B0B0B0",
                id: Date.now(),
            };
        } else {
            return;
        }

        setShapes((prevShapes) => [...prevShapes, newShape]);
    };

    const addText = (x: number, y: number) => {
        if (activeTool !== "text") return;
        const newText: TextItem = {
            id: Date.now(),
            x,
            y,
            text: "새 텍스트",
            color: "#B0B0B0",
        };
        setTexts((prev) => [...prev, newText]);
    };


    // 색상 변경
    useEffect(() => {
        if (selectedShapeId !== null) {
            setShapes((prevShapes) =>
                prevShapes.map((shape) =>
                    shape.id === selectedShapeId ? { ...shape, color: selectedColor } : shape
                )
            );
        } else if (selectedTextId !== null) {
            setTexts((prevTexts) =>
                prevTexts.map((text) =>
                    text.id === selectedTextId ? { ...text, color: selectedColor } : text
                )
            );
        }
    }, [selectedColor]);

    // 크기 조정 후 상태 업데이트
    const handleTransformEnd = (shapeId: number) => {
        const node = shapeRefs.current.get(shapeId);
        if (!node) return;

        setShapes((prevShapes) =>
            prevShapes.map((shape) =>
                shape.id === shapeId
                    ? {
                        ...shape,
                        x: node.x(),
                        y: node.y(),
                        width: shape.type === "rectangle" ? node.width() : shape.width,
                        height: shape.type === "rectangle" ? node.height() : shape.height,
                        radius: shape.type === "circle" ? node.scaleX() * (shape.radius || 50) : shape.radius,
                        points:
                            shape.type === "triangle"
                                ? [node.x(), node.y() - 50, node.x() - 50, node.y() + 50, node.x() + 50, node.y() + 50]
                                : shape.points,
                    }
                    : shape
            )
        );
    };

    // 선택한 도형을 Transformer에 적용
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

    // 선택한 도형 삭제 기능
    const deleteShape = () => {
        if (selectedShapeId === null) return;
        setShapes((prevShapes) => prevShapes.filter((shape) => shape.id !== selectedShapeId));
        setSelectedShapeId(null);
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Backspace") {
                deleteShape();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [selectedShapeId, selectedTextId]);

    return (
        <div className="whiteboard-container">
            <Stage
                width={1000}
                height={563}
                onMouseDown={(e) => {
                    if (e.target === e.target.getStage()) {
                        setSelectedShapeId(null);
                        return;
                    }
                    addShape(e.evt.layerX, e.evt.layerY);
                    addText(e.evt.layerX, e.evt.layerY);
                }}

            >
                <Layer>
                    <Rect width={1000} height={563} fill="white" />

                    {shapes.map((shape) => {
                        const isSelected = shape.id === selectedShapeId;
                        const strokeColor = isSelected ? "#1E90FF" : "transparent";

                        return (
                            <React.Fragment key={shape.id}>
                                {shape.type === "rectangle" && (
                                    <Rect
                                        ref={(node) => node && shapeRefs.current.set(shape.id, node)}
                                        x={shape.x!}
                                        y={shape.y!}
                                        width={shape.width!}
                                        height={shape.height!}
                                        fill={shape.color}
                                        stroke={strokeColor}
                                        strokeWidth={2}
                                        draggable
                                        onClick={() => setSelectedShapeId(shape.id)}
                                        onTransformEnd={() => handleTransformEnd(shape.id)}
                                    />
                                )}
                                {shape.type === "circle" && (
                                    <Circle
                                        ref={(node) => node && shapeRefs.current.set(shape.id, node)}
                                        x={shape.x!}
                                        y={shape.y!}
                                        radius={shape.radius!}
                                        fill={shape.color}
                                        stroke={strokeColor}
                                        strokeWidth={2}
                                        draggable
                                        onClick={() => setSelectedShapeId(shape.id)}
                                        onTransformEnd={() => handleTransformEnd(shape.id)}
                                    />
                                )}
                                {shape.type === "triangle" && (
                                    <Line
                                        ref={(node) => node && shapeRefs.current.set(shape.id, node)}
                                        points={shape.points!}
                                        fill={shape.color}
                                        stroke={strokeColor}
                                        strokeWidth={3}
                                        closed
                                        draggable
                                        onClick={() => setSelectedShapeId(shape.id)}
                                        onTransformEnd={() => handleTransformEnd(shape.id)}
                                    />
                                )}
                            </React.Fragment>
                        );
                    })}

                    {texts.map((text) => (
                        <Text
                            key={text.id}
                            ref={(node) => node && textRefs.current.set(text.id, node)}
                            x={text.x}
                            y={text.y}
                            text={text.text}
                            fill={text.color}
                            fontSize={20}
                            draggable
                            onClick={() => {
                                setSelectedTextId(text.id);
                                setSelectedShapeId(null);
                            }}
                        />
                    ))}

                    {selectedShapeId !== null && (
                        <Transformer
                            ref={transformerRef}
                            enabledAnchors={["top-left", "top-right", "bottom-left", "bottom-right"]}
                            boundBoxFunc={(oldBox, newBox) => {
                                if (newBox.width < 5 || newBox.height < 5) return oldBox;
                                return newBox;
                            }}
                        />
                    )}
                </Layer>
            </Stage>
        </div>
    );
};

export default Canvas;