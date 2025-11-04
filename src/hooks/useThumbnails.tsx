import { useState, useRef, useCallback } from "react";
import ReactDOM from "react-dom/client";
import ThumbnailRenderer from "../components/ThumbnailRenderer/ThumbnailRenderer";
import { SlideData } from "../types/types";

interface UseThumbnailsProps {
    uploadFirstThumbnail: (dataUrl: string) => Promise<void>;
}

export const useThumbnails = ({ uploadFirstThumbnail }: UseThumbnailsProps) => {
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
    const renderingQueue = useRef<Set<string>>(new Set());
    const uploadHashRef = useRef<string>("");
    const uploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dataHashRef = useRef<Record<string, string>>({});

    // 데이터의 간단한 해시 생성 (JSON.stringify 사용)
    const getDataHash = useCallback((data: SlideData): string => {
        return JSON.stringify({
            shapes: data.shapes?.map(s => ({ id: s.id, type: s.type, x: s.x, y: s.y, rotation: s.rotation, 
                width: s.width, height: s.height, radiusX: (s as any).radiusX, radiusY: (s as any).radiusY,
                color: s.color, imageSrc: s.imageSrc, points: s.points, 
                numPoints: (s as any).numPoints, innerRadius: (s as any).innerRadius, outerRadius: (s as any).outerRadius,
                pointerLength: (s as any).pointerLength, pointerWidth: (s as any).pointerWidth, strokeWidth: (s as any).strokeWidth
            })),
            texts: data.texts?.map(t => ({ id: t.id, text: t.text, x: t.x, y: t.y, color: t.color, fontSize: t.fontSize }))
        });
    }, []);

    const renderThumbnail = useCallback((slideId: string, data: SlideData, isFirst = false, pixelRatio = 0.25) => {
        if (renderingQueue.current.has(slideId)) return;
        renderingQueue.current.add(slideId);

        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = ReactDOM.createRoot(container);

        const handleRendered = (id: string, dataUrl: string) => {
            setThumbnails(prev => ({ ...prev, [id]: dataUrl }));
            
            // 데이터 해시 저장
            const currentHash = getDataHash(data);
            dataHashRef.current[id] = currentHash;
            
            if (isFirst) {
                uploadFirstThumbnail(dataUrl).catch(err => 
                    console.error("썸네일 업로드 실패:", err)
                );
            }
            
            root.unmount();
            document.body.removeChild(container);
            renderingQueue.current.delete(slideId);
        };

        root.render(
            <ThumbnailRenderer 
                slideId={slideId} 
                slideData={data} 
                onRendered={handleRendered}
                pixelRatio={pixelRatio}
            />
        );
    }, [uploadFirstThumbnail, getDataHash]);

    const scheduleThumbnail = useCallback((slideId: string, data: SlideData, isFirst = false, forceUpdate = false) => {
        if (!data) return;
        
        // 데이터 해시 확인
        const currentHash = getDataHash(data);
        const previousHash = dataHashRef.current[slideId];
        
        // 이미 렌더링 중이면 스킵 (단, forceUpdate가 true면 제외)
        if (!forceUpdate && renderingQueue.current.has(slideId)) return;
        
        // 썸네일이 있고 데이터가 변경되지 않았으면 스킵 (단, forceUpdate가 true면 제외)
        if (!forceUpdate && thumbnails[slideId] && previousHash === currentHash) return;

        const runner = () => renderThumbnail(slideId, data, isFirst);

        if (typeof window !== "undefined" && window.requestIdleCallback) {
            window.requestIdleCallback(runner, { timeout: 500 });
        } else {
            setTimeout(runner, 0);
        }
    }, [thumbnails, renderThumbnail, getDataHash]);

    const updateThumbnail = useCallback((slideId: string, dataUrl: string, firstSlideId?: string) => {
        setThumbnails(prev => ({ ...prev, [slideId]: dataUrl }));

        // 첫 번째 슬라이드 썸네일만 서버에 업로드
        if (firstSlideId && slideId === firstSlideId) {
            const quickHash = dataUrl.slice(0, 4096);
            if (quickHash !== uploadHashRef.current) {
                uploadHashRef.current = quickHash;
                
                if (uploadTimerRef.current) clearTimeout(uploadTimerRef.current);
                
                uploadTimerRef.current = setTimeout(() => {
                    uploadFirstThumbnail(dataUrl)
                        .catch(err => console.error("썸네일 업로드 실패:", err));
                    uploadTimerRef.current = null;
                }, 400);
            }
        }
    }, [uploadFirstThumbnail]);

    const renderHighResThumbnail = useCallback((slideId: string, data: SlideData): Promise<string> => {
        return new Promise((resolve) => {
            const container = document.createElement("div");
            document.body.appendChild(container);
            const root = ReactDOM.createRoot(container);
            
            const handleRendered = (_id: string, dataUrl: string) => {
                root.unmount();
                document.body.removeChild(container);
                resolve(dataUrl);
            };
            
            root.render(
                <ThumbnailRenderer 
                    slideId={slideId} 
                    slideData={data} 
                    onRendered={handleRendered} 
                    pixelRatio={3.0} 
                />
            );
        });
    }, []);

    return {
        thumbnails,
        renderThumbnail,
        scheduleThumbnail,
        updateThumbnail,
        renderHighResThumbnail,
    };
};

