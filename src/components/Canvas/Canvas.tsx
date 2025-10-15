import React, {useState, useRef, useEffect} from "react";
import {Stage, Layer, Rect, Transformer, Text} from "react-konva";
import {Shape, TextItem} from "../../types/types.ts";
import Konva from "konva";
import "./Canvas.css";
import {KonvaEventObject} from "konva/lib/Node";
import useDrawing from "../../hooks/useDrawing";
import { ORIGINAL_HEIGHT, ORIGINAL_WIDTH, drawTrianglePoints, getDisplayDimensions } from "./canvasUtils";
import CanvasImage from "./CanvasImage";
import ShapeRenderer from "./ShapeRenderer";


interface CanvasProps {
    activeTool: string;
    selectedColor: string;
    setSelectedColor: (color: string) => void;
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
    isPresentationMode?: boolean;
    goToNextSlide?: () => void;
    goToPrevSlide?: () => void;
    onEnterFullscreen?: () => void;
    onExitFullscreen?: () => void;
    isFullscreen?: boolean;
    slides?: { id: string; order: number }[];
    eraserSize?: number;
    eraserMode?: "size" | "area";
}

// moved triangle points util to canvasUtils

const Canvas: React.FC<CanvasProps> = ({
                                           activeTool,
                                           selectedColor,
                                           setSelectedColor,
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
                                           onSelectText,
                                           isPresentationMode = false,
                                           isFullscreen,
                                           slides,
                                           goToNextSlide,
                                           goToPrevSlide,
                                           eraserSize,
                                           eraserMode,
                                       }) => {
    const [, setIsComposing] = useState(false);
    const [selectedShapeId, setSelectedShapeId] = useState<number | null>(null);
    const [selectedTextId, setSelectedTextId] = useState<number | null>(null);
    const [editingText, setEditingText] = useState<TextItem | null>(null);
    const transformerRef = useRef<Konva.Transformer | null>(null);
    const shapeRefs = useRef<Map<number, Konva.Node>>(new Map());
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const backgroundRef = useRef<Konva.Rect>(null);
    const stageRef = useRef<Konva.Stage>(null);
    const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevDataRef = useRef<{ shapes: Shape[]; texts: TextItem[] }>({shapes: [], texts: []});
    const thumbnailTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const layerRef = useRef<Konva.Layer>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const focusRoot = () => rootRef.current?.focus();

    useEffect(() => {
        if (!stageRef.current) return;

        if (thumbnailTimeout.current) clearTimeout(thumbnailTimeout.current);

        thumbnailTimeout.current = setTimeout(() => {
            const stage = stageRef.current;
            if (!stage) return;
            const dataUrl = stage.toDataURL({
                pixelRatio: 3.0,
                mimeType: 'image/png'
            });
            updateThumbnail(currentSlide, dataUrl);
        }, 300);
    }, [shapes, texts, currentSlide, updateThumbnail]);


    useEffect(() => {
        const prev = prevDataRef.current;
        const hasChanged =
            JSON.stringify(prev.shapes) !== JSON.stringify(shapes) ||
            JSON.stringify(prev.texts) !== JSON.stringify(texts);

        if (hasChanged) {
            sendEdit();
            prevDataRef.current = {shapes, texts};
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
        } else if (activeTool === "star") {
            newShape = {
                type: "star",
                x,
                y,
                numPoints: 5,
                innerRadius: 20,
                outerRadius: 40,
                color: "#B0B0B0",
                id: Date.now(),
            };
        } else if (activeTool === "arrow") {
            newShape = {
                type: "arrow",
                x,
                y,
                points: [x, y, x + 100, y],
                color: "#000000",
                strokeWidth: 3,
                id: Date.now(),
            };
        }

        if (newShape) {
            setShapes(prev => [...prev, newShape]);

            setSelectedShapeId(newShape.id);
            setSelectedTextId(null);
            onSelectShape(String(newShape.id));
            onSelectText(null);

            setTimeout(() => {
                setActiveTool("cursor");
                focusRoot();
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
            return [...prev, newText];
        });

        setSelectedTextId(id);
        onSelectText(String(id));
        onSelectShape(null);
        setTimeout(focusRoot, 0);
    };

    useEffect(() => {
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
        if (e.target !== backgroundRef.current) return;

        const stage = stageRef.current;
        const pointerPosition = stage?.getPointerPosition();

        if (!pointerPosition) {
            return;
        }

        const {x, y} = pointerPosition;

        if (activeTool === "text") {
            addText(x, y);
        } else if (["rectangle", "circle", "triangle", "star", "arrow"].includes(activeTool)) {
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
                } else if (shape.type === "star") {
                    const avgScale = (scaleX + scaleY) / 2;
                    newShape.innerRadius = (shape.innerRadius ?? 20) * avgScale;
                    newShape.outerRadius = (shape.outerRadius ?? 40) * avgScale;
                } else if (shape.type === "arrow") {
                    const originalPoints = shape.points || [0, 0, 100, 0];
                    const scaled = [...originalPoints];
                    for (let i = 0; i < scaled.length; i += 2) {
                        scaled[i] = scaled[i] * scaleX;
                        scaled[i + 1] = scaled[i + 1] * scaleY;
                    }
                    newShape.points = scaled;
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
        if (stageRef.current) {
            const {width, height, scale} = getDisplayDimensions({ isFullscreen, isHistoryPage });
            stageRef.current.width(width);
            stageRef.current.height(height);
            stageRef.current.scale(scale);

            const x = Math.max(0, (width - ORIGINAL_WIDTH * scale.x) / 2);
            const y = Math.max(0, (height - ORIGINAL_HEIGHT * scale.y) / 2);

            stageRef.current.position({x, y});
            stageRef.current.batchDraw();
        }
    }, [isFullscreen]);


    useEffect(() => {
        if (selectedShapeId !== null) {
            setShapes((prev) =>
                prev.map((shape) =>
                    shape.id === selectedShapeId ? {...shape, color: selectedColor} : shape
                )
            );
        } else if (selectedTextId !== null) {
            setTexts((prev) =>
                prev.map((text) =>
                    text.id === selectedTextId ? {...text, color: selectedColor} : text
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


    const isDraggableShape = (id: number) => {
        return activeTool === "cursor" && selectedShapeId === id;
    };

    const isDraggableText = (id: number) => {
        return activeTool === "cursor" && selectedTextId === id && editingText?.id !== id;
    };

    // moved display dimension logic to canvasUtils

    const drawingHandlers = useDrawing(layerRef, {
        color: selectedColor,
        width: 3,
        isEraser: activeTool === "eraser",
        eraserSize,
        eraserMode,
    }, setShapes);


    const {width: displayWidth, height: displayHeight, scale} = getDisplayDimensions({ isFullscreen, isHistoryPage });



    return (
        <div
            ref={rootRef}
            tabIndex={0}
            onMouseDown={() => focusRoot()}
            onKeyDown={(e) => {
                if (e.key !== "Backspace" && e.key !== "Delete") return;

                if (document.activeElement?.tagName === "TEXTAREA") return;

                const hasSelection = selectedShapeId !== null || selectedTextId !== null;

                if (hasSelection) {
                    e.preventDefault();
                    e.stopPropagation();
                    deleteShape();
                } else { /* empty */ }
            }}
            className="whiteboard-container"
            style={{
                position: isFullscreen ? "fixed" : "relative",
                top: isFullscreen ? 0 : undefined,
                left: isFullscreen ? 0 : undefined,
                width: isFullscreen ? "100vw" : undefined,
                height: isFullscreen ? "100vh" : undefined,
                backgroundColor: isFullscreen ? "black" : undefined,
                zIndex: isFullscreen ? 9999 : undefined,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}
        >


        <Stage
                ref={stageRef}
                width={displayWidth}
                height={displayHeight}
                scale={scale}
                x={(displayWidth - ORIGINAL_WIDTH * scale.x) / 2}
                y={(displayHeight - ORIGINAL_HEIGHT * scale.y) / 2}
                onMouseDown={(e) => {
                    if (activeTool === "pen" || activeTool === "eraser") {
                        drawingHandlers.onMouseDown?.(e);
                    } else {
                        handleMouseDown(e);
                    }
                }}
                onMouseMove={activeTool === "pen" || activeTool === "eraser" ? drawingHandlers.onMouseMove : undefined}
                onMouseUp={activeTool === "pen" || activeTool === "eraser" ? drawingHandlers.onMouseUp : undefined}
            >
                <Layer ref={layerRef}>
                    <Rect width={ORIGINAL_WIDTH} height={ORIGINAL_HEIGHT} fill="white" ref={backgroundRef}/>

                    {shapes.map((shape) => (
                        <React.Fragment key={shape.id}>
                            {shape.type === "image" ? (
                                <CanvasImage
                                    shape={shape}
                                    onSelect={() => {
                                        setSelectedShapeId(shape.id);
                                        setSelectedTextId(null);
                                        setActiveTool("cursor");
                                        onSelectShape(String(shape.id));
                                        onSelectText(null);
                                    }}
                                    onDrag={(newX, newY) => {
                                        const updated = { ...shape, x: newX, y: newY };
                                        setShapes((prev) => prev.map((s) => (s.id === shape.id ? updated : s)));
                                        sendEdit();
                                    }}
                                    onResize={(updatedShape) => {
                                        setShapes((prev) => prev.map((s) => (s.id === updatedShape.id ? updatedShape : s)));
                                        sendEdit();
                                    }}
                                    registerRef={(node) => { if (node) shapeRefs.current.set(shape.id, node); }}
                                    draggable={isDraggableShape(shape.id)}
                                />
                            ) : (
                                <ShapeRenderer
                                    shape={shape}
                                    setActiveTool={setActiveTool}
                                    setSelectedColor={setSelectedColor}
                                    onSelectShape={onSelectShape}
                                    onSelectText={onSelectText}
                                    setSelectedShapeId={setSelectedShapeId}
                                    setSelectedTextId={setSelectedTextId}
                                    setShapes={setShapes}
                                    sendEdit={sendEdit}
                                    shapeRefs={shapeRefs}
                                    isDraggable={isDraggableShape(shape.id)}
                                    onTransformEnd={handleTransformEnd}
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
                            fontFamily="Pretendard"
                            fill={text.color}
                            draggable={isDraggableText(text.id)}
                            onClick={() => {
                                setSelectedTextId(text.id);
                                setActiveTool("cursor");
                                onSelectText(String(text.id));
                                onSelectShape(null);
                                if (text.color) setSelectedColor(text.color);
                            }}
                            onDblClick={() => {
                                setEditingText(text);
                            }}
                            onDragEnd={(e) => {
                                const {x, y} = e.target.position();
                                const updatedText = {...text, x, y};
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

            {isPresentationMode && isFullscreen && (
                <div
                    style={{
                        position: "absolute",
                        bottom: "20px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        backgroundColor: "rgba(0,0,0,0.7)",
                        color: "white",
                        padding: "10px 20px",
                        borderRadius: "20px",
                        fontSize: "14px",
                        zIndex: 1000,
                        display: "flex",
                        alignItems: "center",
                        gap: "20px",
                    }}
                >
                    <button
                        onClick={goToPrevSlide}
                        disabled={slides?.findIndex(slide => slide.id === currentSlide) === 0}
                        style={{
                            background: "none",
                            border: "none",
                            color: "white",
                            fontSize: "16px",
                            cursor: "pointer",
                            opacity: slides?.findIndex(slide => slide.id === currentSlide) === 0 ? 0.5 : 1,
                        }}
                    >
                        ◀
                    </button>
                    <span>
            {slides ? `${slides.findIndex(slide => slide.id === currentSlide) + 1} / ${slides.length}` : '1 / 1'}
        </span>
                    <button
                        onClick={goToNextSlide}
                        disabled={slides ? slides.findIndex(slide => slide.id === currentSlide) === slides?.length - 1 : true}
                        style={{
                            background: "none",
                            border: "none",
                            color: "white",
                            fontSize: "16px",
                            cursor: "pointer",
                            opacity: slides ? (slides.findIndex(slide => slide.id === currentSlide) === slides.length - 1 ? 0.5 : 1) : 0.5,
                        }}
                    >
                        ▶
                    </button>
                </div>
            )}


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
                            fontFamily: "'Pretendard'",
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

                            // Avoid updating Konva stage on every keystroke to prevent input lag.
                            // We will commit to texts on blur or Enter.

                            setIsTyping(true);
                            if (typingTimeout.current) clearTimeout(typingTimeout.current);
                            typingTimeout.current = setTimeout(() => setIsTyping(false), 500);
                        }}

                        onBlur={() => {
                            const trimmed = editingText?.text.trim() || "";

                            if (trimmed === "") {
                                setTexts((prev) => prev.filter((t) => t.id !== editingText.id));
                            } else {
                                setTexts((prev) =>
                                    prev.map((t) =>
                                        t.id === editingText.id ? {...t, text: trimmed} : t
                                    )
                                );
                                sendEdit();
                            }


                            setEditingText(null);
                            setSelectedTextId(null);
                        }}


                        onKeyDown={(e) => {
                            if (e.key === "Backspace" || e.key === "Delete") {
                                e.stopPropagation();
                            }

                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();

                                const trimmed = inputRef.current?.value.trim() || "";

                                if (trimmed === "") {
                                    setTexts((prev) => prev.filter((t) => t.id !== editingText.id));
                                } else {
                                    setTexts((prev) =>
                                        prev.map((t) =>
                                            t.id === editingText.id ? {...t, text: trimmed} : t
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

export default Canvas;