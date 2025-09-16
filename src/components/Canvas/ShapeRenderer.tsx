import React from "react";
import { Ellipse, Line, Rect, Star, Arrow } from "react-konva";
import Konva from "konva";
import { Shape } from "../../types/types";

interface ShapeRendererProps {
    shape: Shape;
    setActiveTool: (tool: string) => void;
    setSelectedColor: (color: string) => void;
    onSelectShape: (id: string | null) => void;
    onSelectText: (id: string | null) => void;
    setSelectedShapeId: (id: number | null) => void;
    setSelectedTextId: (id: number | null) => void;
    setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
    sendEdit: () => void;
    shapeRefs: React.MutableRefObject<Map<number, Konva.Node>>;
    isDraggable: boolean;
    onTransformEnd: (shapeId: number) => void;
}

const ShapeRenderer: React.FC<ShapeRendererProps> = ({
    shape,
    setActiveTool,
    setSelectedColor,
    onSelectShape,
    onSelectText,
    setSelectedShapeId,
    setSelectedTextId,
    setShapes,
    sendEdit,
    shapeRefs,
    isDraggable,
    onTransformEnd,
}) => {
    const commonHandlers = {
        onClick: () => {
            setSelectedShapeId(shape.id);
            setSelectedTextId(null);
            setActiveTool("cursor");
            onSelectShape(String(shape.id));
            onSelectText(null);
            if (shape.color) setSelectedColor(shape.color);
        },
        onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
            const { x, y } = e.target.position();
            const updatedShape = { ...shape, x, y } as Shape;
            setShapes((prev) => {
                const updated = prev.map((s) => (s.id === shape.id ? updatedShape : s));
                setTimeout(() => sendEdit(), 0);
                return updated;
            });
            e.target.getLayer()?.batchDraw();
        },
        draggable: isDraggable,
    } as const;

    if (shape.type === "rectangle") {
        return (
            <Rect
                ref={(node) => node && shapeRefs.current.set(shape.id, node)}
                x={shape.x!}
                y={shape.y!}
                width={shape.width!}
                height={shape.height!}
                fill={shape.color}
                onTransformEnd={() => onTransformEnd(shape.id)}
                {...commonHandlers}
            />
        );
    }

    if (shape.type === "circle") {
        return (
            <Ellipse
                ref={(node) => node && shapeRefs.current.set(shape.id, node)}
                x={shape.x!}
                y={shape.y!}
                radiusX={shape.radiusX ?? shape.radius ?? 50}
                radiusY={shape.radiusY ?? shape.radius ?? 50}
                fill={shape.color}
                onTransformEnd={() => onTransformEnd(shape.id)}
                {...commonHandlers}
            />
        );
    }

    if (shape.type === "triangle") {
        return (
            <Line
                ref={(node) => node && shapeRefs.current.set(shape.id, node)}
                x={shape.x!}
                y={shape.y!}
                points={shape.points!}
                fill={shape.color}
                rotation={shape.rotation || 0}
                closed
                onTransformEnd={() => onTransformEnd(shape.id)}
                {...commonHandlers}
            />
        );
    }

    if (shape.type === "line") {
        return (
            <Line
                key={shape.id}
                points={shape.points || []}
                stroke={shape.color || "black"}
                strokeWidth={shape.strokeWidth || 3}
                lineCap="round"
                lineJoin="round"
            />
        );
    }

    if (shape.type === "star") {
        return (
            <Star
                ref={(node) => node && shapeRefs.current.set(shape.id, node)}
                x={shape.x!}
                y={shape.y!}
                numPoints={shape.numPoints ?? 5}
                innerRadius={shape.innerRadius ?? 20}
                outerRadius={shape.outerRadius ?? 40}
                fill={shape.color}
                onTransformEnd={() => onTransformEnd(shape.id)}
                {...commonHandlers}
            />
        );
    }

    if (shape.type === "arrow") {
        return (
            <Arrow
                ref={(node) => node && shapeRefs.current.set(shape.id, node)}
                points={shape.points || [shape.x ?? 0, shape.y ?? 0, (shape.x ?? 0) + 100, (shape.y ?? 0)]}
                pointerLength={shape.pointerLength ?? 10}
                pointerWidth={shape.pointerWidth ?? 10}
                stroke={shape.color || "black"}
                fill={shape.color || "black"}
                strokeWidth={shape.strokeWidth || 3}
                onTransformEnd={() => onTransformEnd(shape.id)}
                {...commonHandlers}
            />
        );
    }

    return null;
};

export default ShapeRenderer;



