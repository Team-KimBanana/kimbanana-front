import React, { useEffect, useRef, useState } from "react";
import { Stage, Layer, Rect, Ellipse, Line, Text, Image as KonvaImage } from "react-konva";
import Konva from "konva";
import { Shape, TextItem } from "../../types/types.ts";

interface ThumbnailRendererProps {
    slideId: string;
    slideData: { shapes: Shape[]; texts: TextItem[] };
    onRendered: (slideId: string, dataUrl: string) => void;
}

const ThumbnailRenderer: React.FC<ThumbnailRendererProps> = ({ slideId, slideData, onRendered }) => {
    const stageRef = useRef<Konva.Stage>(null);
    const [images, setImages] = useState<Record<string, HTMLImageElement>>({});

    // 이미지 프리로드
    useEffect(() => {
        const loadImages = async () => {
            const imagePromises = slideData.shapes
                .filter((s) => s.type === "image" && s.imageSrc)
                .map(
                    (s) =>
                        new Promise<void>((resolve) => {
                            const img = new window.Image();
                            img.crossOrigin = "anonymous";
                            img.src = s.imageSrc!;
                            img.onload = () => {
                                setImages((prev) => ({ ...prev, [s.id]: img }));
                                resolve();
                            };
                            img.onerror = () => resolve();
                        })
                );

            await Promise.all(imagePromises);

            // 이미지 로드 후 썸네일 생성
            setTimeout(() => {
                const dataUrl = stageRef.current?.toDataURL({ pixelRatio: 0.25 });
                if (dataUrl) {
                    onRendered(slideId, dataUrl);
                }
            }, 100);
        };

        loadImages();
    }, [slideData.shapes, slideId, onRendered]);

    const drawTrianglePoints = (): number[] => [0, -50, -50, 50, 50, 50];

    return (
        <div style={{ position: "absolute", top: -9999, left: -9999 }}>
            <Stage width={1000} height={563} ref={stageRef}>
                <Layer>
                    <Rect width={1000} height={563} fill="white" />
                    {slideData.shapes.map((shape) => {
                        if (shape.type === "rectangle") {
                            return (
                                <Rect
                                    key={shape.id}
                                    x={shape.x!}
                                    y={shape.y!}
                                    width={shape.width!}
                                    height={shape.height!}
                                    fill={shape.color}
                                />
                            );
                        }
                        if (shape.type === "circle") {
                            return (
                                <Ellipse
                                    key={shape.id}
                                    x={shape.x!}
                                    y={shape.y!}
                                    radiusX={shape.radius ?? 50}
                                    radiusY={shape.radius ?? 50}
                                    fill={shape.color}
                                />
                            );
                        }
                        if (shape.type === "triangle") {
                            return (
                                <Line
                                    key={shape.id}
                                    x={shape.x!}
                                    y={shape.y!}
                                    points={shape.points ?? drawTrianglePoints()}
                                    fill={shape.color}
                                    closed
                                    rotation={shape.rotation ?? 0}
                                />
                            );
                        }
                        if (shape.type === "image" && images[shape.id]) {
                            return (
                                <KonvaImage
                                    key={shape.id}
                                    x={shape.x!}
                                    y={shape.y!}
                                    width={shape.width!}
                                    height={shape.height!}
                                    image={images[shape.id]}
                                />
                            );
                        }
                        return null;
                    })}

                    {slideData.texts.map((text) => (
                        <Text
                            key={text.id}
                            x={text.x}
                            y={text.y}
                            text={text.text}
                            fontSize={text.fontSize || 20}
                            fontFamily="Noto Sans KR"
                            fill={text.color}
                        />
                    ))}
                </Layer>
            </Stage>
        </div>
    );
};

export default ThumbnailRenderer;