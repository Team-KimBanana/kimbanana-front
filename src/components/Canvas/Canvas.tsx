import React, { useState, useRef, useEffect } from "react";
import { Stage, Layer, Rect, Ellipse, Line, Transformer, Text, Image } from "react-konva";
import { Shape, TextItem} from "../../types/types.ts";
import Konva from "konva";
import "./Canvas.css";
import {KonvaEventObject} from "konva/lib/Node";
import useImage from "use-image";

interface CanvasProps {
    activeTool: string;
    selectedColor: string;
    setActiveTool: (tool: string) => void;
    shapes: Shape[];
    setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
    texts: TextItem[];
    setTexts: React.Dispatch<React.SetStateAction<TextItem[]>>;
    currentSlide: string;
    updateThumbnail: (slideId: string, dataUrl: string) => void;
    sendEdit: () => void;
    setIsTyping: (typing: boolean) => void;
    defaultFontSize: number;
    isHistoryPage?: boolean;
    onSelectShape: (id: string | null) => void;
    onSelectText: (id: string | null) => void;
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
                                           texts,
                                           setTexts,
                                           currentSlide,
                                           updateThumbnail,
                                           sendEdit,
                                           setIsTyping,
                                           defaultFontSize,
                                           isHistoryPage,
                                           onSelectShape,
                                           onSelectText
                                       }) => {
    const [isComposing, setIsComposing] = useState(false);
    const [selectedShapeId, setSelectedShapeId] = useState<number | null>(null);
    const [selectedTextId, setSelectedTextId] = useState<number | null>(null);
    const [editingText, setEditingText] = useState<TextItem | null>(null);
    const transformerRef = useRef<Konva.Transformer | null>(null);
    const shapeRefs = useRef<Map<number, Konva.Node>>(new Map());
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const backgroundRef = useRef<Konva.Rect>(null);
    const stageRef = useRef<Konva.Stage>(null);
    const typingTimeout = useRef<NodeJS.Timeout | null>(null);
    const prevDataRef = useRef<{ shapes: Shape[]; texts: TextItem[] }>({ shapes: [], texts: [] });
    const thumbnailTimeout = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (thumbnailTimeout.current) clearTimeout(thumbnailTimeout.current);

        thumbnailTimeout.current = setTimeout(() => {
            if (stageRef.current) {
                const dataUrl = stageRef.current.toDataURL({ pixelRatio: 0.25 });
                updateThumbnail(currentSlide, dataUrl);
            }
        }, 300);
    }, [shapes, texts, currentSlide]);


    useEffect(() => {
        const prev = prevDataRef.current;
        const hasChanged =
            JSON.stringify(prev.shapes) !== JSON.stringify(shapes) ||
            JSON.stringify(prev.texts) !== JSON.stringify(texts);

        if (hasChanged) {
            sendEdit();
            prevDataRef.current = { shapes, texts };
        }
    }, [shapes, texts]);

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
                radiusX: 50,
                radiusY: 50,
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
                rotation: 0,
            };
        }

        if (newShape) {
            setShapes((prev) => {
                return [...prev, newShape];
            });

            setSelectedShapeId(newShape.id);
            setSelectedTextId(null);

            setTimeout(() => {
                setActiveTool("cursor");
            }, 0);
        }


    };

    const addText = (x: number, y: number) => {
        const id = Date.now();
        const newText: TextItem = {
            id,
            text: "",
            x,
            y,
            color: "#000000",
            fontSize: defaultFontSize,
        };

        setTexts((prev) => {
            return [...prev, newText];;
        });

        setSelectedTextId(id);
    };

    useEffect(() => {
        // 가장 최근에 추가된 텍스트로 editingText 설정
        if (activeTool === "text" && texts.length > 0) {
            const latest = texts[texts.length - 1];
            setEditingText(latest);
        }
    }, [texts]);

    useEffect(() => {
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
            return;
        }

        const { x, y } = pointerPosition;

        if (activeTool === "text") {
            addText(x, y);
        } else if (["rectangle", "circle", "triangle"].includes(activeTool)) {
            addShape(x, y);
            setEditingText(null);
        } else {
            setSelectedShapeId(null);
            setSelectedTextId(null);
            setEditingText(null);
            onSelectShape(null);
            onSelectText(null);
        }
    };

    const handleTransformEnd = (shapeId: number) => {
        const node = shapeRefs.current.get(shapeId);
        if (!node) return;

        const scaleX = node.scaleX();
        const scaleY = node.scaleY();

        let updatedShape: Shape | null = null;

        setShapes((prev) =>
            prev.map((shape) => {
                if (shape.id !== shapeId) return shape;

                const newShape: Shape = {
                    ...shape,
                    x: node.x(),
                    y: node.y(),
                };

                if (shape.type === "rectangle") {
                    newShape.width = node.width() * scaleX;
                    newShape.height = node.height() * scaleY;
                } else if (shape.type === "circle") {
                    newShape.radiusX = (node.width() / 2) * scaleX;
                    newShape.radiusY = (node.height() / 2) * scaleY;
                } else if (shape.type === "triangle") {
                    const originalPoints = shape.points || drawTrianglePoints(0, 0);
                    newShape.points = originalPoints.map((point, index) =>
                        index % 2 === 0 ? point * scaleX : point * scaleY
                    );
                    newShape.rotation = node.rotation();
                } else if (shape.type === "image") {
                    newShape.width = node.width() * scaleX;
                    newShape.height = node.height() * scaleY;
                }

                node.scaleX(1);
                node.scaleY(1);

                updatedShape = newShape;
                return newShape;
            })
        );

        if (updatedShape) {
            sendEdit();
        }
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
            setShapes((prev) => prev.filter((shape) => shape.id !== selectedShapeId))
            sendEdit();
            setSelectedShapeId(null);
            onSelectShape(null);
        } else if (selectedTextId !== null) {
            setTexts((prev) => prev.filter((text) => text.id !== selectedTextId));
            sendEdit();
            setSelectedTextId(null)
            onSelectText(null);
        }
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Backspace" || event.key === "Delete") {
                if (document.activeElement?.tagName === "TEXTAREA") return;

                deleteShape();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [selectedShapeId, selectedTextId]);


    const isDraggableShape = (id: number) => {
        return activeTool === "cursor" && selectedShapeId === id;
    };

    const isDraggableText = (id: number) => {
        return activeTool === "cursor" && selectedTextId === id && editingText?.id !== id;
    };

    const originalWidth = 1000;
    const originalHeight = 563;

    const displayWidth = isHistoryPage ? 800 : originalWidth;
    const displayHeight = isHistoryPage ? 450 : originalHeight;
    const scale = isHistoryPage
        ? {
            x: displayWidth / originalWidth,
            y: displayHeight / originalHeight,
        }
        : { x: 1, y: 1 };


    return (
        <div className="whiteboard-container" style={{ position: "relative" }}>
            <Stage
                ref={stageRef}
                width={displayWidth}
                height={displayHeight}
                scale={scale}
                x={(displayWidth - originalWidth * scale.x) / 2}
                y={(displayHeight - originalHeight * scale.y) / 2}
                onMouseDown={handleMouseDown}
            >
                <Layer>
                    <Rect width={originalWidth} height={originalHeight} fill="white" ref={backgroundRef} />

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
                                    onTransformEnd={() => handleTransformEnd(shape.id)}
                                    draggable={isDraggableShape(shape.id)}
                                    onClick={() => {
                                        setSelectedShapeId(shape.id);
                                        setSelectedTextId(null);
                                        setActiveTool("cursor");
                                        onSelectShape(String(shape.id));
                                        onSelectText(null);
                                    }}
                                    onDragEnd={(e) => {
                                        const { x, y } = e.target.position();

                                        const updatedShape = { ...shape, x, y };

                                        setShapes((prev) => {
                                            const updated = prev.map((s) =>
                                                s.id === shape.id ? updatedShape : s
                                            );
                                            setTimeout(() => sendEdit(), 0);
                                            return updated;
                                        });


                                        e.target.getLayer()?.batchDraw();
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
                                    onTransformEnd={() => handleTransformEnd(shape.id)}
                                    draggable={isDraggableShape(shape.id)}
                                    onClick={() => {
                                        setSelectedShapeId(shape.id);
                                        setSelectedTextId(null);
                                        setActiveTool("cursor");
                                        onSelectShape(String(shape.id));
                                        onSelectText(null);
                                    }}
                                    onDragEnd={(e) => {
                                        const { x, y } = e.target.position();

                                        const updatedShape = { ...shape, x, y };

                                        setShapes((prev) => {
                                            const updated = prev.map((s) =>
                                                s.id === shape.id ? updatedShape : s
                                            );
                                            setTimeout(() => sendEdit(), 0);
                                            return updated;
                                        });


                                        e.target.getLayer()?.batchDraw();
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
                                    rotation={shape.rotation || 0}
                                    closed
                                    onTransformEnd={() => handleTransformEnd(shape.id)}
                                    draggable={isDraggableShape(shape.id)}
                                    onClick={() => {
                                        setSelectedShapeId(shape.id);
                                        setSelectedTextId(null);
                                        setActiveTool("cursor");
                                        onSelectShape(String(shape.id));
                                        onSelectText(null);
                                    }}
                                    onDragEnd={(e) => {
                                        const { x, y } = e.target.position();

                                        const updatedShape = { ...shape, x, y };

                                        setShapes((prev) => {
                                            const updated = prev.map((s) =>
                                                s.id === shape.id ? updatedShape : s
                                            );
                                            setTimeout(() => sendEdit(), 0);
                                            return updated;
                                        });

                                        e.target.getLayer()?.batchDraw();
                                    }}
                                />
                            )}
                            {shape.type === "image" && (
                                <CanvasImage
                                    key={shape.id}
                                    shape={shape}
                                    onSelect={() => {
                                        setSelectedShapeId(shape.id);
                                        setSelectedTextId(null);
                                        setActiveTool("cursor");
                                    }}
                                    onDrag={(newX, newY) => {
                                        const updated = { ...shape, x: newX, y: newY };
                                        setShapes((prev) =>
                                            prev.map((s) => (s.id === shape.id ? updated : s))
                                        );
                                        sendEdit();
                                    }}
                                    registerRef={(node) => {
                                        if (node) shapeRefs.current.set(shape.id, node);
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
                            fontSize={text.fontSize || 20}
                            fontFamily="Noto Sans KR"
                            fill={text.color}
                            draggable={isDraggableText(text.id)}
                            onClick={() => {
                                setSelectedTextId(text.id);
                                setActiveTool("cursor");
                                onSelectText(String(text.id));
                                onSelectShape(null);
                            }}
                            onDblClick={() => {
                                setEditingText(text);
                            }}
                            onDragEnd={(e) => {
                                const { x, y } = e.target.position();
                                const updatedText = { ...text, x, y };
                                setTexts((prev) => {
                                    const updated = prev.map((t) =>
                                        t.id === text.id ? updatedText : t
                                    );
                                    setTimeout(() => sendEdit(), 0);
                                    return updated;
                                });

                                e.target.getLayer()?.batchDraw();
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

            {editingText && stageRef.current && (() => {
                const stage = stageRef.current;
                const transform = stage.getAbsoluteTransform();
                const absPos = transform.point({
                    x: editingText.x,
                    y: editingText.y
                });

                const top = absPos.y;
                const left = absPos.x;

                // console.log("Canvas 좌표:", editingText.x, editingText.y);
                // console.log("절대 변환 좌표:", absPos.x, absPos.y);
                // console.log("textarea top/left:", top, left);


                return (
                    <textarea
                        ref={inputRef}
                        value={editingText.text}
                        style={{
                            position: "absolute",
                            top,
                            left,
                            fontSize: `${editingText.fontSize || defaultFontSize}px`,
                            fontFamily: "'Noto Sans KR'",
                            lineHeight: "0.82",
                            whiteSpace: "pre",
                            padding: "0",
                            margin: "0",
                            border: "none",
                            background: "transparent",
                            outline: "none",
                            resize: "none",
                            overflow: "hidden",
                            verticalAlign: "top",
                            color: editingText.color,
                            zIndex: 10,
                        }}
                        onCompositionStart={() => setIsComposing(true)}
                        onCompositionEnd={() => setIsComposing(false)}

                        onChange={(e) => {
                            const updated = e.target.value;

                            setEditingText((prev) => (prev ? { ...prev, text: updated } : null));

                            if (isComposing) return;

                            setTexts((prev) =>
                                prev.map((t) =>
                                    t.id === editingText.id ? { ...t, text: updated } : t
                                )
                            );

                            setIsTyping(true);
                            if (typingTimeout.current) clearTimeout(typingTimeout.current);
                            typingTimeout.current = setTimeout(() => setIsTyping(false), 500);

                            sendEdit();
                        }}

                        onBlur={() => {
                            const trimmed = editingText?.text.trim() || "";

                            if (trimmed === "") {
                                setTexts((prev) => prev.filter((t) => t.id !== editingText.id));
                            } else {
                                setTexts((prev) =>
                                    prev.map((t) =>
                                        t.id === editingText.id ? { ...t, text: trimmed } : t
                                    )
                                );
                                sendEdit();
                            }


                            setEditingText(null);
                            setSelectedTextId(null);
                        }}


                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();

                                const trimmed = inputRef.current?.value.trim() || "";

                                if (trimmed === "") {
                                    setTexts((prev) => prev.filter((t) => t.id !== editingText.id));
                                } else {
                                    setTexts((prev) =>
                                        prev.map((t) =>
                                            t.id === editingText.id ? { ...t, text: trimmed } : t
                                        )
                                    );
                                }

                                setEditingText(null);
                                setSelectedTextId(null);
                                setActiveTool("cursor");
                            }
                        }}

                    />
                );

            })()}
        </div>
    );
};
const CanvasImage: React.FC<{
    shape: Shape;
    onSelect: () => void;
    onDrag: (x: number, y: number) => void;
    registerRef: (node: Konva.Image | null) => void;
}> = ({ shape, onSelect, onDrag, registerRef }) => {
    const [image] = useImage(shape.imageSrc || "", "anonymous");
    return (
        <Image
            ref={registerRef}
            image={image}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            draggable
            onClick={onSelect}
            onDragEnd={(e) => {
                const { x, y } = e.target.position();
                onDrag(x, y);
            }}
        />
    );
};

export default Canvas;