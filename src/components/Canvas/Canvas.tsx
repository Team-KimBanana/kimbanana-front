import React, { useState, useRef, useEffect } from "react";
import { Stage, Layer, Rect, Circle, Line, Transformer, Text } from "react-konva";
import Konva from "konva";
import "./Canvas.css";

interface CanvasProps {
    activeTool: string;
    selectedColor: string;
    setActiveTool: (tool: string) => void;
    shapes: Shape[];
    texts: TextItem[];
    setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
    setTexts: React.Dispatch<React.SetStateAction<TextItem[]>>;
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
}

interface TextItem {
    id: number;
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
                                           texts,
                                           setShapes,
                                           setTexts,
                                           currentSlide,
                                           updateThumbnail,
                                       }) => {
    const [selectedShapeId, setSelectedShapeId] = useState<number | null>(null);
    const [selectedTextId, setSelectedTextId] = useState<number | null>(null);
    const [editingText, setEditingText] = useState<TextItem | null>(null);

    const transformerRef = useRef<Konva.Transformer | null>(null);
    const shapeRefs = useRef<Map<number, Konva.Node>>(new Map());
    const textRefs = useRef<Map<number, Konva.Text>>(new Map());
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
        if (activeTool !== "text") return;
        const newText: TextItem = {
            id: Date.now(),
            x,
            y,
            text: "",
            color: selectedColor,
        };
        setTexts((prev) => [...prev, newText]);
        setSelectedTextId(newText.id);
        setSelectedShapeId(null);
        setEditingText(newText);
        setActiveTool("cursor");
    };

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
                    updatedShape.radius = ((shape.radius || 50) * (scaleX + scaleY)) / 2;
                } else if (shape.type === "triangle") {
                    const originalPoints = shape.points || drawTrianglePoints(0, 0);
                    updatedShape.points = originalPoints.map((point, index) =>
                        index % 2 === 0 ? point * scaleX : point * scaleY
                    );
                }

                // scale 리셋!
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
                onMouseDown={(e) => {
                    if (e.target === backgroundRef.current) {
                        if (activeTool === "text") {
                            addText(e.evt.layerX, e.evt.layerY);
                        } else if (["rectangle", "circle", "triangle"].includes(activeTool)) {
                            addShape(e.evt.layerX, e.evt.layerY);
                        } else {
                            setSelectedShapeId(null);
                            setSelectedTextId(null);
                        }
                    }
                }}
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
                                <Circle
                                    ref={(node) => node && shapeRefs.current.set(shape.id, node)}
                                    x={shape.x!}
                                    y={shape.y!}
                                    radius={shape.radius!}
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
                            ref={(node) => node && textRefs.current.set(text.id, node)}
                            x={text.x}
                            y={text.y}
                            text={text.text}
                            fontSize={20}
                            fill={text.color || "#000"}
                            draggable
                            onClick={() => {
                                setSelectedTextId(text.id);
                                setSelectedShapeId(null);
                                setEditingText(text);
                            }}
                            onDragEnd={(e) => {
                                const { x, y } = e.target.position();
                                setTexts((prev) =>
                                    prev.map((t) => (t.id === text.id ? { ...t, x, y } : t))
                                );
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

            {editingText && (
                <input
                    type="text"
                    value={editingText.text}
                    autoFocus
                    style={{
                        position: "absolute",
                        top: editingText.y,
                        left: editingText.x,
                        fontSize: 20,
                        border: "1px solid #ccc",
                        padding: "2px 4px",
                        borderRadius: "4px",
                        backgroundColor: "white",
                        outline: "none",
                    }}
                    onChange={(e) => {
                        const newText = e.target.value;
                        setEditingText((prev) => prev && { ...prev, text: newText });
                        setTexts((prev) =>
                            prev.map((text) =>
                                text.id === editingText.id ? { ...text, text: newText } : text
                            )
                        );
                    }}
                    onBlur={() => {
                        setEditingText(null);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            setEditingText(null);
                        }
                    }}
                />
            )}
        </div>
    );
};

export default Canvas;
