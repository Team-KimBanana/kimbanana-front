import { useRef } from "react";
import Konva from "konva";
import { KonvaEventObject } from "konva/lib/Node";
import { Shape } from "../types/types";
import Vector2d = Konva.Vector2d;

interface UseDrawingOptions {
    color?: string;
    width?: number;
    isEraser?: boolean;
    eraserSize?: number;
    eraserMode?: "size" | "area";
}

export default function useDrawing(
    layerRef: React.RefObject<Konva.Layer>,
    options: UseDrawingOptions = {},
    setShapes: React.Dispatch<React.SetStateAction<Shape[]>>
) {
    const {
        color = "black",
        width = 2,
        isEraser = false,
        eraserSize = 15,
        eraserMode = "size",
    } = options;

    const isDrawing = useRef(false);
    const eraserStartPos = useRef<{ x: number; y: number } | null>(null);
    const currentPoints = useRef<number[]>([]);

    const onMouseDown = (e: KonvaEventObject<MouseEvent>) => {
        isDrawing.current = true;

        const stage = e.target.getStage();
        const pos: Vector2d | null = stage?.getPointerPosition() ?? null;
        if (!pos) return;

        if (isEraser) {
            clearTempVisuals();
            eraserStartPos.current = pos;
        } else {
            currentPoints.current = [pos.x, pos.y];
        }
    };

    const onMouseMove = (e: KonvaEventObject<MouseEvent>) => {
        if (!isDrawing.current) return;

        const stage = e.target.getStage();
        const pos: Vector2d | null = stage?.getPointerPosition() ?? null;
        if (!pos) return;

        if (isEraser) {
            if (eraserMode === "size") {
                handleSizeEraser(pos);
            } else {
                handleAreaEraser(pos);
            }
        } else {
            currentPoints.current.push(pos.x, pos.y);
            drawTempLine();
        }
    };

    const onMouseUp = () => {
        isDrawing.current = false;

        if (!isEraser && currentPoints.current.length >= 4) {
            const newLine: Shape = {
                id: Date.now(),
                type: "line",
                x: 0,
                y: 0,
                points: [...currentPoints.current],
                color,
                strokeWidth: width,
            };
            setShapes((prev) => [...prev, newLine]);
        }

        currentPoints.current = [];
        eraserStartPos.current = null;
        clearTempVisuals();
    };

    const drawTempLine = () => {
        let preview = layerRef.current?.findOne(".drawing-preview") as Konva.Line | null;
        if (!preview) {
            preview = new Konva.Line({
                name: "drawing-preview",
                points: currentPoints.current,
                stroke: color,
                strokeWidth: width,
                lineCap: "round",
                lineJoin: "round",
                dash: [10, 5],
            });
            layerRef.current?.add(preview);
        } else {
            preview.points(currentPoints.current);
        }
        layerRef.current?.batchDraw();
    };

    const clearTempVisuals = () => {
        layerRef.current?.find(".drawing-preview").forEach((n) => n.destroy());
        layerRef.current?.find(".eraser-circle").forEach((n) => n.destroy());
        layerRef.current?.find(".eraser-rect").forEach((n) => n.destroy());
        layerRef.current?.batchDraw();
    };

    const handleSizeEraser = (pos: { x: number; y: number }) => {
        const centerX = pos.x;
        const centerY = pos.y;
        const radius = eraserSize / 2;

        setShapes((prev) =>
            prev.filter((shape) => {
                if (shape.type !== "line" || !shape.points) return true;
                for (let i = 0; i < shape.points.length; i += 2) {
                    const px = shape.points[i];
                    const py = shape.points[i + 1];
                    if (Math.hypot(px - centerX, py - centerY) <= radius) return false;
                }
                return true;
            })
        );

        let circle = layerRef.current?.findOne(".eraser-circle") as Konva.Circle | null;
        if (!circle) {
            circle = new Konva.Circle({
                name: "eraser-circle",
                x: centerX,
                y: centerY,
                radius,
                fill: "rgba(255,0,0,0.2)",
                stroke: "red",
                strokeWidth: 2,
            });
            layerRef.current?.add(circle);
        } else {
            circle.position({ x: centerX, y: centerY });
            circle.radius(radius);
        }
        layerRef.current?.batchDraw();
    };

    const handleAreaEraser = (pos: { x: number; y: number }) => {
        if (!eraserStartPos.current) return;
        const start = eraserStartPos.current;

        const minX = Math.min(start.x, pos.x);
        const maxX = Math.max(start.x, pos.x);
        const minY = Math.min(start.y, pos.y);
        const maxY = Math.max(start.y, pos.y);

        setShapes((prev) =>
            prev.filter((shape) => {
                if (shape.type !== "line" || !shape.points) return true;
                for (let i = 0; i < shape.points.length; i += 2) {
                    const px = shape.points[i];
                    const py = shape.points[i + 1];
                    if (px >= minX && px <= maxX && py >= minY && py <= maxY) return false;
                }
                return true;
            })
        );

        let rect = layerRef.current?.findOne(".eraser-rect") as Konva.Rect | null;
        const attrs = {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY,
        };
        if (!rect) {
            rect = new Konva.Rect({
                name: "eraser-rect",
                ...attrs,
                fill: "rgba(255,0,0,0.3)",
                stroke: "red",
                strokeWidth: 2,
            });
            layerRef.current?.add(rect);
        } else {
            rect.setAttrs(attrs);
        }
        layerRef.current?.batchDraw();
    };

    return { onMouseDown, onMouseMove, onMouseUp };
}