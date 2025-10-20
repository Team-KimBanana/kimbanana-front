import React, {useState, useEffect, useRef, useCallback} from "react";
import { useParams } from "react-router-dom";
import ReactDOM from "react-dom/client";
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import Header from "../components/Header/Header.tsx";
import Sidebar from "../components/Sidebar/Sidebar.tsx";
import Canvas from "../components/Canvas/Canvas.tsx";
import Toolbar from "../components/Toolbar/Toolbar.tsx";
import { useAuth } from "../contexts/AuthContext";
import {Shape, TextItem, SlideData, SlideOrder } from "../types/types.ts";
import ThumbnailRenderer from "../components/ThumbnailRenderer/ThumbnailRenderer.tsx";
import useFullscreen from "../hooks/useFullscreen";
import { demoPresentations } from "../data/demoData";
import jsPDF from 'jspdf';
import "./MainLayout.css";

type ReceivedSlide = {
    slide_id: string;
    order: number;
    data?: string | { shapes?: Shape[]; texts?: TextItem[] };
};

const API_BASE = import.meta.env.DEV
    ? '/api'
    : import.meta.env.VITE_API_BASE_URL;
const YJS_WS_URL = import.meta.env.DEV
    ? (import.meta.env.VITE_YJS_WS_URL) || 'ws://localhost:8000'
    : (import.meta.env.VITE_YJS_WS_URL);

if (!YJS_WS_URL) {
    console.error("VITE_YJS_WS_URL is not defined in .env");
}

type YSlideDataMap = Y.Map<any>;
type YPresentationMap = Y.Map<YSlideDataMap>;

const yMapToObject = (yMap: YPresentationMap): Record<string, SlideData> => {
    const obj: Record<string, SlideData> = {};
    yMap.forEach((ySlideData: YSlideDataMap, slideId: string) => {
        const shapes = (ySlideData.get('shapes') as Y.Array<Shape> | undefined)?.toJSON?.() || [];
        const texts = (ySlideData.get('texts') as Y.Array<TextItem> | undefined)?.toJSON?.() || [];
        obj[slideId] = { shapes: shapes as Shape[], texts: texts as TextItem[] };
    });
    return obj;
};

function uint8ToBase64(u8: Uint8Array): string {
    let bin = '';
    const len = u8.byteLength;
    for (let i = 0; i < len; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin);
}

function dataURLtoBlob(dataURL: string) {
    const [header, base64] = dataURL.split(",");
    const mime = header.match(/:(.*?);/)?.[1] || "image/png";
    const bin = atob(base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
}

const MainLayout: React.FC = () => {
    const { user, getAuthToken } = useAuth?.() ?? ({
        user: null,
        getAuthToken: () => Promise.resolve(null)
    } as never);

    const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
        const accessToken = await getAuthToken();
        const headers: Record<string, string> = {
            ...(options.headers as Record<string, string>),
        };
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
        return fetch(url, { ...options, headers });
    }, [getAuthToken]);

    const [activeTool, setActiveTool] = useState("cursor");
    const [selectedColor, setSelectedColor] = useState("#B0B0B0");
    const [slides, setSlides] = useState<{ id: string; order: number }[]>([]);
    const [currentSlide, setCurrentSlide] = useState<string>("");

    const [mirrorSlideData, setMirrorSlideData] = useState<Record<string, SlideData>>({});

    const [thumbnails, setThumbnails] = useState<{ [key: string]: string }>({});
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [defaultFontSize, setDefaultFontSize] = useState(20);
    const [eraserSize, setEraserSize] = useState(15);
    const [eraserMode, setEraserMode] = useState<"size" | "area">("size");

    // Yjs Ref
    const yDocRef = useRef<Y.Doc | null>(null);
    const yMapRef = useRef<YPresentationMap | null>(null);
    const wsProviderRef = useRef<WebsocketProvider | null>(null);
    const undoManagerRef = useRef<Y.UndoManager | null>(null);
    const ySlidesOrderRef = useRef<Y.Array<string> | null>(null);

    const [selectedShapeId, setSelectedShapeId] = useState<string | number | null>(null);
    const [selectedTextId, setSelectedTextId] = useState<string | number | null>(null);
    const [clipboardData, setClipboardData] = useState<{ shapes: Shape[]; texts: TextItem[] } | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const { isFullscreen, enter, exit } = useFullscreen(containerRef);
    const [isPresentationMode, setIsPresentationMode] = useState(false);
    const [presentationTitle, setPresentationTitle] = useState<string | undefined>(undefined);

    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const refreshUndoRedo = useCallback(() => {
        const m = undoManagerRef.current as unknown as { undoStack?: unknown[]; redoStack?: unknown[] } | null;
        setCanUndo(!!m && Array.isArray(m.undoStack) && m.undoStack.length > 0);
        setCanRedo(!!m && Array.isArray(m.redoStack) && m.redoStack.length > 0);
    }, []);

    const { id } = useParams();
    const presentationId = id ?? "p1";
    const isDemo = presentationId.startsWith('demo-');

    const goToNextSlide = () => {
        const currentIndex = slides.findIndex(slide => slide.id === currentSlide);
        if (currentIndex < slides.length - 1) setCurrentSlide(slides[currentIndex + 1].id);
    };

    const goToPrevSlide = () => {
        const currentIndex = slides.findIndex(slide => slide.id === currentSlide);
        if (currentIndex > 0) setCurrentSlide(slides[currentIndex - 1].id);
    };

    useEffect(() => {
        setIsPresentationMode(isFullscreen);
    }, [isFullscreen]);

    const renderSlideThumbnail = (
        slideId: string,
        data: { shapes: Shape[]; texts: TextItem[] },
        isFirst: boolean = false
    ) => {
        const container = document.createElement("div");
        document.body.appendChild(container);
        const root = ReactDOM.createRoot(container);

        const handleRendered = (id: string, dataUrl: string) => {
            setThumbnails(prev => ({ ...prev, [id]: dataUrl }));
            if (isFirst) {
                uploadFirstSlideThumbnail(dataUrl, presentationId).catch(err => console.error("썸네일 업로드 실패:", err));
            }
            root.unmount();
            document.body.removeChild(container);
        };

        root.render(
            <ThumbnailRenderer slideId={slideId} slideData={data} onRendered={handleRendered} />
        );
    };

    async function uploadFirstSlideThumbnail(dataUrl: string, presentationId: string) {
        const blob = dataURLtoBlob(dataUrl);
        const form = new FormData();
        form.append("file", blob, `thumb_${presentationId}.png`);
        form.append("presentationId", presentationId);
        const url = `${API_BASE}/images/thumbnails/presentation`;
        const res = await fetchWithAuth(url, { method: "POST", body: form });
        if (!res.ok) throw new Error(`thumbnail upload failed: ${res.status}`);
    }

    const handleDownloadPdf = async () => {
        if (!slides.length) {
            alert("다운로드할 슬라이드가 없습니다.");
            return;
        }
        const ORIGINAL_WIDTH = 1280;
        const ORIGINAL_HEIGHT = 720;
        const SLIDE_ASPECT_RATIO = ORIGINAL_WIDTH / ORIGINAL_HEIGHT;
        const CUSTOM_PAGE_WIDTH = 297;
        const CUSTOM_PAGE_HEIGHT = CUSTOM_PAGE_WIDTH / SLIDE_ASPECT_RATIO;
        const doc = new jsPDF('l', 'mm', [CUSTOM_PAGE_WIDTH, CUSTOM_PAGE_HEIGHT]);
        const docWidth = doc.internal.pageSize.getWidth();
        const docHeight = doc.internal.pageSize.getHeight();

        const renderSlideHighRes = (slideId: string, data: SlideData): Promise<string> => new Promise((resolve) => {
            const container = document.createElement("div");
            document.body.appendChild(container);
            const root = ReactDOM.createRoot(container);
            const handleRendered = (_id: string, dataUrl: string) => {
                root.unmount();
                document.body.removeChild(container);
                resolve(dataUrl);
            };
            root.render(
                <ThumbnailRenderer slideId={slideId} slideData={data} onRendered={handleRendered} pixelRatio={3.0} />
            );
        });

        for (let i = 0; i < slides.length; i++) {
            const slideId = slides[i].id;
            const data = mirrorSlideData[slideId];
            if (!data) {
                console.warn(`슬라이드 ${slideId}의 데이터가 누락되었습니다.`);
                continue;
            }
            const imgData = await renderSlideHighRes(slideId, data);
            if (i > 0) doc.addPage();
            doc.addImage(imgData, 'PNG', 0, 0, docWidth, docHeight);
        }
        doc.save(`${presentationTitle || 'Presentation'}.pdf`);
    };

    // Yjs 초기화, Provider 연결
    useEffect(() => {
        if (isDemo) { fetchSlides(); return; }

        const ydoc = new Y.Doc();
        yDocRef.current = ydoc;

        const yMap = ydoc.getMap('slides_data') as YPresentationMap;
        yMapRef.current = yMap;

        const yOrder = ydoc.getArray<string>('slides_order');
        ySlidesOrderRef.current = yOrder;

        const undoManager = new Y.UndoManager([yMap, yOrder], { doc: ydoc });
        undoManagerRef.current = undoManager;

        const handleUndoEvents = () => refreshUndoRedo();
        (undoManager as any).on('stack-item-added', handleUndoEvents);
        (undoManager as any).on('stack-item-popped', handleUndoEvents);
        (undoManager as any).on('stack-cleared', handleUndoEvents);

        const updateReactState = () => {
            setMirrorSlideData(yMapToObject(yMap));
            const newOrderIds = yOrder.toArray();
            setSlides(prev => {
                const updated = newOrderIds.map((id, index) => ({ id, order: index + 1 }));
                if (updated.length !== prev.length || updated.some((s, i) => s.id !== prev[i]?.id)) return updated;
                return prev;
            });
            const firstId = newOrderIds[0];
            if (firstId) {
                const data = yMapToObject(yMap)[firstId];
                if (data) renderSlideThumbnail(firstId, data, true);
            }
            refreshUndoRedo();
        };

        yMap.observeDeep(updateReactState);
        yOrder.observe(updateReactState);

        getAuthToken().then((token) => {
            const params: { [key: string]: string } = {};
            if (token) {
                params['token'] = token;
            }

            const provider = new WebsocketProvider(
                YJS_WS_URL,
                `presentation-${presentationId}`,
                ydoc,
                { params }
            );

            wsProviderRef.current = provider;

            fetchSlides();
        });

        return () => {
            yMap.unobserveDeep(updateReactState);
            yOrder.unobserve(updateReactState);

            (undoManager as any).off?.('stack-item-added', handleUndoEvents);
            (undoManager as any).off?.('stack-item-popped', handleUndoEvents);
            (undoManager as any).off?.('stack-cleared', handleUndoEvents);

            const p = wsProviderRef.current;
            p?.disconnect?.();
            p?.destroy?.();
            wsProviderRef.current = null;
            undoManagerRef.current = null;
        };
    }, [getAuthToken, presentationId, isDemo, refreshUndoRedo]);

    const fetchSlides = async () => {
        if (isDemo && demoPresentations[presentationId]) {
            const demoData = demoPresentations[presentationId];
            setPresentationTitle(demoData.title);
            const orders: SlideOrder[] = demoData.slides
                .map(s => ({ id: s.id, order: s.order }))
                .sort((a, b) => a.order - b.order);
            const newSlideData: Record<string, SlideData> = {};
            demoData.slides.forEach(slide => { newSlideData[slide.id] = slide.data; });
            setSlides(orders);
            setMirrorSlideData(newSlideData);
            setCurrentSlide(orders[0]?.id ?? "");
            orders.forEach(({ id }, idx) => { renderSlideThumbnail(id, newSlideData[id], idx === 0); });
            return;
        }

        try {
            const res = await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides`);
            if (!res.ok) {
                console.error("슬라이드 불러오기 실패", res.status);
                return;
            }
            const json = await res.json();
            const serverTitle = json?.presentation?.presentation_title ?? json?.title ?? "";
            setPresentationTitle(serverTitle);
            const slideList: ReceivedSlide[] = Array.isArray(json.slides) ? json.slides : [];

            const restOrder = slideList
                .map((s): SlideOrder => ({ id: s.slide_id, order: s.order }))
                .sort((a, b) => a.order - b.order)
                .map(s => s.id);

            yDocRef.current?.transact(() => {
                const yOrder = ySlidesOrderRef.current!;
                const yMap = yMapRef.current!;

                restOrder.forEach(id => {
                    if (!yMap.has(id)) {
                        const ySlide = new Y.Map();
                        ySlide.set('shapes', new Y.Array<Shape>());
                        ySlide.set('texts', new Y.Array<TextItem>());
                        yMap.set(id, ySlide);
                    }
                });

                if (yOrder.toArray().join(',') !== restOrder.join(',')) {
                    yOrder.delete(0, yOrder.length);
                    yOrder.push(restOrder);
                }
            });

            setCurrentSlide(restOrder[0] ?? "");
        } catch (err) {
            console.error("슬라이드 fetch 중 오류:", err);
        }
    };

    const normalizeShapes = (shapes: Shape[]): Shape[] => {
        return shapes.map((shape) => {
            const base = {
                id: shape.id,
                type: shape.type,
                x: shape.x,
                y: shape.y,
                rotation: shape.rotation ?? 0,
            };

            if (shape.type === "circle") {
                return { ...base, radiusX: shape.radiusX ?? 50, radiusY: shape.radiusY ?? 50, color: shape.color || "#000000" };
            }
            if (shape.type === "rectangle") {
                return { ...base, width: shape.width || 0, height: shape.height || 0, color: shape.color || "#000000" };
            }
            if (shape.type === "triangle") {
                return { ...base, points: shape.points || [], color: shape.color || "#000000" };
            }
            if (shape.type === "image") {
                return { ...base, width: shape.width || 0, height: shape.height || 0, imageSrc: shape.imageSrc || "" };
            }
            if (shape.type === "star") {
                return {
                    ...base,
                    numPoints: shape.numPoints ?? 5, 
                    innerRadius: shape.innerRadius ?? 20, 
                    outerRadius: shape.outerRadius ?? 40, 
                    color: shape.color || "#000000" 
                };
            }
            if (shape.type === "arrow") {
                return {
                    ...base,
                    points: shape.points || [],
                    pointerLength: shape.pointerLength ?? 10,
                    pointerWidth: shape.pointerWidth ?? 10,
                    color: shape.color || "#000000",
                    strokeWidth: shape.strokeWidth || 3
                };
            }
            if (shape.type === "line") {
                return {
                    ...base,
                    points: shape.points || [], 
                    color: shape.color || "#000000", 
                    strokeWidth: shape.strokeWidth || 3 
                };
            }
            return shape;
        });
    };

    const normalizeTexts = (texts: TextItem[]): TextItem[] => {
        return texts.map(text => ({
            id: text.id,
            text: text.text,
            x: text.x,
            y: text.y,
            color: text.color || "#000000",
            fontSize: text.fontSize || 18,
        }));
    };

    const getActiveYjsSlide = useCallback((): YSlideDataMap | null => {
        if (!yMapRef.current || !currentSlide) return null;
        return yMapRef.current.get(currentSlide) as YSlideDataMap | null;
    }, [currentSlide]);

    const handleAddSlide = async () => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides`, {
                method: "POST",
                headers: { 'Accept': 'application/json' },
            });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const json = await res.json();
            const newId = json.slide_id as string;

            yDocRef.current?.transact(() => {
                const ySlide = new Y.Map();
                ySlide.set('shapes', new Y.Array<Shape>());
                ySlide.set('texts', new Y.Array<TextItem>());
                yMapRef.current?.set(newId, ySlide);
                ySlidesOrderRef.current?.push([newId]);
            }, "add-slide");
            setCurrentSlide(newId);
            refreshUndoRedo();
        } catch (err) {
            console.error("슬라이드 추가 실패:", err);
        }
    };

    const handleDeleteSlide = async (slideId: string) => {
        if (slides.length === 1) return;
        yDocRef.current?.transact(() => {
            yMapRef.current?.delete(slideId);
            const yOrder = ySlidesOrderRef.current;
            const index = yOrder?.toArray().indexOf(slideId);
            if (yOrder && index !== undefined && index !== -1) yOrder.delete(index, 1);
        }, "delete-slide");
        await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides/${slideId}`, { method: "DELETE" });
        const newSlides = slides.filter(s => s.id !== slideId);
        if (currentSlide === slideId) setCurrentSlide(newSlides[0]?.id ?? "");
        refreshUndoRedo();
    };

    const deleteSelected = () => {
        const ySlide = getActiveYjsSlide();
        if (!ySlide) return;
        yDocRef.current?.transact(() => {
        if (selectedShapeId != null) {
                const yShapes = ySlide.get('shapes') as Y.Array<Shape>;
                const index = yShapes.toArray().findIndex(s => String(s.id) === String(selectedShapeId));
                if (index !== -1) yShapes.delete(index, 1);
            setSelectedShapeId(null);
                return;
            }
            if (selectedTextId != null) {
                const yTexts = ySlide.get('texts') as Y.Array<TextItem>;
                const index = yTexts.toArray().findIndex(t => String(t.id) === String(selectedTextId));
                if (index !== -1) yTexts.delete(index, 1);
                setSelectedTextId(null);
            }
        }, "delete-element");
        refreshUndoRedo();
    };

    const handleReorderSlides = async (newOrder: string[]) => {
        yDocRef.current?.transact(() => {
            const yOrder = ySlidesOrderRef.current;
            if (yOrder) {
                yOrder.delete(0, yOrder.length);
                yOrder.insert(0, newOrder);
            }
        }, "reorder-slides");
        await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                presentation_id: presentationId,
                slides: newOrder.map((id, index) => ({ slide_id: id, order: index + 1 })),
            }),
        });
        refreshUndoRedo();
    };

    const updateShapes = (newShapes: Shape[] | ((prev: Shape[]) => Shape[])) => {
        const ySlide = getActiveYjsSlide();
        if (!ySlide) return;
        yDocRef.current?.transact(() => {
            const yShapes = ySlide.get('shapes') as Y.Array<Shape>;
            const currentShapes = yShapes.toArray() as Shape[];
            const updatedShapes = typeof newShapes === "function" ? newShapes(currentShapes) : newShapes;
            const normalized = normalizeShapes(updatedShapes);
            yShapes.delete(0, yShapes.length);
            yShapes.insert(0, normalized);
        }, "canvas-edit");
        refreshUndoRedo();
    };

    const updateTexts = (newTexts: TextItem[] | ((prev: TextItem[]) => TextItem[])) => {
        const ySlide = getActiveYjsSlide();
        if (!ySlide) return;
        yDocRef.current?.transact(() => {
            const yTexts = ySlide.get('texts') as Y.Array<TextItem>;
            const currentTexts = yTexts.toArray() as TextItem[];
            const updatedTexts = typeof newTexts === "function" ? newTexts(currentTexts) : newTexts;
            const normalized = normalizeTexts(updatedTexts);
            yTexts.delete(0, yTexts.length);
            yTexts.insert(0, normalized);
        }, "canvas-edit");
        refreshUndoRedo();
    };

    const handleUndo = () => { undoManagerRef.current?.undo(); refreshUndoRedo(); };
    const handleRedo = () => { undoManagerRef.current?.redo(); refreshUndoRedo(); };

    const handleImageUpload = (imageUrl: string) => {
        const ySlide = getActiveYjsSlide();
        if (!ySlide) return;
        const img = new window.Image();
        img.onload = () => {
            const newId = Date.now();
            const newImage: Shape = {
                id: newId,
                type: "image",
                x: 200,
                y: 150,
                width: img.width,
                height: img.height,
                imageSrc: imageUrl,
            };
            setSelectedShapeId(newId);
            yDocRef.current?.transact(() => {
                const yShapes = ySlide.get('shapes') as Y.Array<Shape>;
                yShapes.push([newImage]);
            }, "add-image");
            refreshUndoRedo();
        };
        img.src = imageUrl;
    };

    const handleCopyPaste = useCallback((e: KeyboardEvent) => {
        const ae = document.activeElement as HTMLElement | null;
        const isTypingInForm = !!ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
        if (isTypingInForm || !currentSlide) return;
        const isModifierPressed = e.ctrlKey || e.metaKey;
        if (!isModifierPressed) return;
        const ySlide = getActiveYjsSlide();
        if (!ySlide) return;
        const currentSlideData = mirrorSlideData[currentSlide] || { shapes: [], texts: [] };
        if (e.key === 'c' || e.key === 'C') {
            if (selectedShapeId != null) {
                e.preventDefault();
                const shapeToCopy = currentSlideData.shapes.find(s => String(s.id) === String(selectedShapeId));
                if (shapeToCopy) setClipboardData({ shapes: [shapeToCopy], texts: [] });
            } else if (selectedTextId != null) {
                e.preventDefault();
                const textToCopy = currentSlideData.texts.find(t => String(t.id) === String(selectedTextId));
                if (textToCopy) setClipboardData({ shapes: [], texts: [textToCopy] });
            }
        }
        if (e.key === 'v' || e.key === 'V') {
            if (clipboardData && (clipboardData.shapes.length > 0 || clipboardData.texts.length > 0)) {
                e.preventDefault();
                const newShapes: Shape[] = clipboardData.shapes.map(s => ({
                    ...s, id: Date.now() + Math.random(), x: (s.x ?? 0) + 10, y: (s.y ?? 0) + 10,
                }));
                const newTexts: TextItem[] = clipboardData.texts.map(t => ({
                    ...t, id: Date.now() + Math.random(), x: (t.x ?? 0) + 10, y: (t.y ?? 0) + 10,
                }));
                yDocRef.current?.transact(() => {
                    const yShapes = ySlide.get('shapes') as Y.Array<Shape>;
                    const yTexts = ySlide.get('texts') as Y.Array<TextItem>;
                    if (newShapes.length > 0) yShapes.push(newShapes);
                    if (newTexts.length > 0) yTexts.push(newTexts);
                    if (newShapes.length > 0) setSelectedShapeId(String(newShapes[0].id));
                    else if (newTexts.length > 0) setSelectedTextId(String(newTexts[0].id));
                }, "paste");
                const updatedClipboard = { shapes: newShapes, texts: newTexts };
                setClipboardData(updatedClipboard);
                refreshUndoRedo();
            }
        }
    }, [currentSlide, mirrorSlideData, selectedShapeId, selectedTextId, clipboardData, getActiveYjsSlide, refreshUndoRedo]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const ae = document.activeElement as HTMLElement | null;
            const isTypingInForm = !!ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
            if (isTypingInForm) return;
            handleCopyPaste(e);
            if (e.defaultPrevented) return;
            const isBackspaceOrDelete = e.key === "Backspace" || e.key === "Delete";
            if (!isBackspaceOrDelete || isTyping) return;
            if (selectedShapeId != null || selectedTextId != null) {
                e.preventDefault();
                deleteSelected();
                return;
            }
            if (activeTool !== "cursor") return;
            if (slides.length > 1) {
                e.preventDefault();
                handleDeleteSlide(currentSlide);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [currentSlide, slides, isTyping, selectedShapeId, selectedTextId, activeTool, handleCopyPaste]);

    const handleSaveHistory = async () => {
        try {
            if (!yDocRef.current) {
                alert("Yjs 문서가 준비되지 않았습니다.");
                return false;
            }
            const yDocState = Y.encodeStateAsUpdate(yDocRef.current);
            const payload = {
                last_revision_user_id: (user as any)?.id || "anonymous",
                presentation_id: presentationId,
                yjs_document_state_base64: uint8ToBase64(new Uint8Array(yDocState)),
            };
            const res = await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/histories/yjs-snapshot`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                let detail = "";
                try { detail = await res.text(); } catch { /* empty */ }
                console.error("히스토리 저장 실패:", res.status, detail);
                alert(`히스토리 저장 실패 (${res.status})`);
                return false;
            }
            return true;
        } catch (err) {
            console.error("히스토리 저장 중 오류:", err);
            alert("히스토리 저장 중 오류가 발생");
            return false;
        }
    };

    const savePresentationTitle = async (title: string) => {
        try {
            await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides/title`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    presentation_id: presentationId,
                    new_title: title,
                }),
            });
            setPresentationTitle(title);
        } catch (err) {
            console.error("프레젠테이션 제목 업데이트 실패:", err);
        }
    };

    const currentSlideData = mirrorSlideData[currentSlide] || { shapes: [], texts: [] };

    return (
        <div className="main-layout" ref={containerRef}>
            <Header
                variant="main"
                presentationId={id}
                isFullscreen={isFullscreen}
                onEnterFullscreen={enter}
                onExitFullscreen={exit}
                title={presentationTitle}
                onTitleChange={setPresentationTitle}
                onTitleSave={async (t) => { await savePresentationTitle(t); }}
                onSaveHistory={handleSaveHistory}
                onDownloadPdf={handleDownloadPdf}
            />
            <div className="content">
                <Sidebar
                    variant="main"
                         slides={slides.map(s => s.id)}
                         currentSlide={currentSlide}
                         setCurrentSlide={setCurrentSlide}
                         onAddSlide={handleAddSlide}
                         thumbnails={thumbnails}
                         onReorderSlides={handleReorderSlides}
                />
                <div className="canvas-container">
                    {currentSlide && (
                        <Canvas
                            activeTool={activeTool}
                            selectedColor={selectedColor}
                            setSelectedColor={setSelectedColor}
                            setActiveTool={setActiveTool}
                            shapes={currentSlideData.shapes}
                            texts={currentSlideData.texts}
                            setShapes={(updater) => updateShapes(updater)}
                            setTexts={(updater) => updateTexts(updater)}
                            currentSlide={currentSlide}
                            updateThumbnail={(slideId, dataUrl) => {
                                setThumbnails(prev => ({...prev, [slideId]: dataUrl}));
                            }}
                            sendEdit={() => {}}
                            setIsTyping={setIsTyping}
                            defaultFontSize={defaultFontSize}
                            onSelectShape={setSelectedShapeId}
                            onSelectText={setSelectedTextId}
                            isFullscreen={isFullscreen}
                            onEnterFullscreen={enter}
                            onExitFullscreen={exit}
                            isPresentationMode={isPresentationMode}
                            goToNextSlide={goToNextSlide}
                            goToPrevSlide={goToPrevSlide}
                            slides={slides}
                            eraserSize={eraserSize}
                            eraserMode={eraserMode}
                        />
                    )}
                    <Toolbar
                        activeTool={activeTool}
                        setActiveTool={setActiveTool}
                        selectedColor={selectedColor}
                        setSelectedColor={setSelectedColor}
                        defaultFontSize={defaultFontSize}
                        setDefaultFontSize={setDefaultFontSize}
                        onImageUpload={handleImageUpload}
                        eraserSize={eraserSize}
                        setEraserSize={setEraserSize}
                        eraserMode={eraserMode}
                        setEraserMode={setEraserMode}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        canUndo={canUndo}
                        canRedo={canRedo}
                        getAuthToken={getAuthToken}
                    />
                </div>
            </div>
        </div>
    );
};

export default MainLayout;