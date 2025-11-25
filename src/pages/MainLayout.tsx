import React, {useState, useEffect, useRef, useCallback} from "react";
import { useParams, useSearchParams } from "react-router-dom";
import * as Y from "yjs";
import {Client, StompSubscription} from "@stomp/stompjs";

import Header from "../components/Header/Header.tsx";
import Sidebar from "../components/Sidebar/Sidebar.tsx";
import Canvas from "../components/Canvas/Canvas.tsx";
import Toolbar from "../components/Toolbar/Toolbar.tsx";
import { useAuth } from "../contexts/AuthContext";
import {Shape, TextItem, ReceivedSlide, SlideData, SlideOrder, ActiveUsersResponse } from "../types/types.ts";
import useFullscreen from "../hooks/useFullscreen";
import { useThumbnails } from "../hooks/useThumbnails";
import { demoPresentations } from "../data/demoData";
import jsPDF from 'jspdf';
import { createInvitation, verifyInvitation } from "../api/invitations";
import "./MainLayout.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '/api' : undefined);
const WS_URL   = import.meta.env.DEV ? (import.meta.env.VITE_WS_URL || 'wss://localhost:8080/ws') : import.meta.env.VITE_WS_URL;

type YSlideDataMap = Y.Map<any>;
type YPresentationMap = Y.Map<YSlideDataMap>;

const yMapToObject = (yMap: YPresentationMap): Record<string, SlideData> => {
    const obj: Record<string, SlideData> = {};
    yMap.forEach((ySlide: YSlideDataMap, slideId: string) => {
        const shapes = (ySlide.get("shapes") as Y.Array<Shape> | undefined)?.toJSON?.() || [];
        const texts  = (ySlide.get("texts")  as Y.Array<TextItem> | undefined)?.toJSON?.() || [];
        obj[slideId] = { shapes: shapes as Shape[], texts: texts as TextItem[] };
    });
    return obj;
};

function dataURLtoBlob(dataURL: string) {
    const [header, base64] = dataURL.split(",");
    const mime = header.match(/:(.*?);/)?.[1] || "image/png";
    const bin = atob(base64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
}

const MainLayout: React.FC = () => {
    const { user, getAuthToken, isAuthenticated } = useAuth?.() ?? ({ user: null, getAuthToken: () => Promise.resolve(null), isAuthenticated: false } as never);
    const [searchParams] = useSearchParams();
    const [guestToken, setGuestToken] = useState<string | null>(null);
    const [isGuest, setIsGuest] = useState(false);

    const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}) => {
        const token = guestToken || await getAuthToken();
        const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        return fetch(url, {
            ...options,
            headers,
            credentials: 'include',
        });
    }, [getAuthToken, guestToken]);

    const [activeTool, setActiveTool] = useState("cursor");
    const [selectedColor, setSelectedColor] = useState("#B0B0B0");
    const [slides, setSlides] = useState<{ id: string; order: number }[]>([]);
    const [currentSlide, setCurrentSlide] = useState<string>("");
    const [slideData, setSlideData] = useState<Record<string, SlideData>>({});
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const [defaultFontSize, setDefaultFontSize] = useState(20);
    const [eraserSize, setEraserSize] = useState(15);
    const [eraserMode, setEraserMode] = useState<"size" | "area">("size");
    const [presentationTitle, setPresentationTitle] = useState<string | undefined>(undefined);
    const [undoStack, setUndoStack] = useState<SlideData[]>([]);
    const [redoStack, setRedoStack] = useState<SlideData[]>([]);

    const [selectedShapeId, setSelectedShapeId] = useState<string | number | null>(null);
    const [selectedTextId, setSelectedTextId] = useState<string | number | null>(null);
    const [clipboardData, setClipboardData] = useState<{ shapes: Shape[]; texts: TextItem[] } | null>(null);
    const [activeUsers, setActiveUsers] = useState<ActiveUsersResponse | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);
    const { isFullscreen, enter, exit } = useFullscreen(containerRef);
    const [isPresentationMode, setIsPresentationMode] = useState(false);

    const { id } = useParams();
    const presentationId = id ?? "p1";
    const isDemo = presentationId.startsWith('demo-');

    const stompClientRef = useRef<Client | null>(null);
    const structureSubRef = useRef<StompSubscription | null>(null);
    const slideSubRef = useRef<StompSubscription | null>(null);
    const usersSubRef = useRef<StompSubscription | null>(null);
    const allSlideSubsRef = useRef<Map<string, StompSubscription>>(new Map());
    const joinedPresentationsRef = useRef<Set<string>>(new Set());

    const yDocRef = useRef<Y.Doc | null>(null);
    const yMapRef = useRef<YPresentationMap | null>(null);
    const yOrderRef = useRef<Y.Array<string> | null>(null);
    const isApplyingRemoteUpdate = useRef(false);

    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastBroadcastData = useRef<string>("");

    useEffect(() => setIsPresentationMode(isFullscreen), [isFullscreen]);

    useEffect(() => {
        const inviteToken = searchParams.get('invite');
        const guestTokenKey = `guestToken_${presentationId}`;
        

        if (inviteToken) {
            verifyInvitation(inviteToken)
                .then((result) => {
                    if (result.valid && result.guest_token) {
                        setGuestToken(result.guest_token);
                        setIsGuest(true);
                        sessionStorage.setItem(guestTokenKey, result.guest_token);
                        const newSearchParams = new URLSearchParams(searchParams);
                        newSearchParams.delete('invite');
                        const newUrl = window.location.pathname + (newSearchParams.toString() ? `?${newSearchParams.toString()}` : '');
                        window.history.replaceState({}, '', newUrl);
                    } else {
                        console.error('[MainLayout] 초대 링크 검증 실패:', result.message);
                        const newSearchParams = new URLSearchParams(searchParams);
                        newSearchParams.delete('invite');
                        const newUrl = window.location.pathname + (newSearchParams.toString() ? `?${newSearchParams.toString()}` : '');
                        window.history.replaceState({}, '', newUrl);
                        alert(result.message || "초대 링크가 유효하지 않거나 만료되었습니다.");
                    }
                })
                .catch((error) => {
                    console.error('[MainLayout] 초대 링크 검증 중 오류:', error);
                    const newSearchParams = new URLSearchParams(searchParams);
                    newSearchParams.delete('invite');
                    const newUrl = window.location.pathname + (newSearchParams.toString() ? `?${newSearchParams.toString()}` : '');
                    window.history.replaceState({}, '', newUrl);
                    alert("초대 링크 검증 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.");
                });
            return;
        }

        const storedGuestToken = sessionStorage.getItem(guestTokenKey);

        if (storedGuestToken) {
            setGuestToken(storedGuestToken);
            setIsGuest(true);
            return;
        }

        const hasAccessToken = localStorage.getItem('accessToken');

        if (isAuthenticated || hasAccessToken) {
            setGuestToken(null);
            setIsGuest(false);
            sessionStorage.removeItem(guestTokenKey);
            return;
        }

        setGuestToken(null);
        setIsGuest(false);
    }, [searchParams, presentationId, isAuthenticated]);

    const uploadFirstThumbnailToServer = useCallback(async (dataUrl: string) => {
        const blob = dataURLtoBlob(dataUrl);
        const form = new FormData();
        form.append("file", blob, `thumb_${presentationId}.png`);
        form.append("presentationId", presentationId);
        const url = `${API_BASE}/images/thumbnails/presentation`;
        const res = await fetchWithAuth(url, { method: "POST", body: form });
        if (!res.ok) throw new Error(`thumbnail upload failed: ${res.status}`);
    }, [presentationId, fetchWithAuth]);

    const { thumbnails, renderThumbnail, scheduleThumbnail, updateThumbnail, renderHighResThumbnail } = useThumbnails({
        uploadFirstThumbnail: uploadFirstThumbnailToServer,
    });

    const goToNextSlide = () => {
        const idx = slides.findIndex(s => s.id === currentSlide);
        if (idx < slides.length - 1) setCurrentSlide(slides[idx + 1].id);
    };
    const goToPrevSlide = () => {
        const idx = slides.findIndex(s => s.id === currentSlide);
        if (idx > 0) setCurrentSlide(slides[idx - 1].id);
    };

    const normalizeShapes = (shapes: Shape[]): Shape[] =>
        shapes.map((shape) => {
            const base = { id: shape.id, type: shape.type, x: shape.x, y: shape.y, rotation: shape.rotation ?? 0 };
            if (shape.type === "circle")    return { ...base, radiusX: shape.radiusX ?? 50, radiusY: shape.radiusY ?? 50, color: shape.color || "#000000" };
            if (shape.type === "rectangle") return { ...base, width: shape.width || 0, height: shape.height || 0, color: shape.color || "#000000" };
            if (shape.type === "triangle")  return { ...base, points: shape.points || [], color: shape.color || "#000000" };
            if (shape.type === "image")     return { ...base, width: shape.width || 0, height: shape.height || 0, imageSrc: shape.imageSrc || "" };
            if (shape.type === "star")      return { ...base, numPoints: shape.numPoints ?? 5, innerRadius: shape.innerRadius ?? 20, outerRadius: shape.outerRadius ?? 40, color: shape.color || "#000000" };
            if (shape.type === "arrow")     return { ...base, points: shape.points || [], pointerLength: shape.pointerLength ?? 10, pointerWidth: shape.pointerWidth ?? 10, color: shape.color || "#000000", strokeWidth: shape.strokeWidth || 3 };
            if (shape.type === "line")      return { ...base, points: shape.points || [], color: shape.color || "#000000", strokeWidth: shape.strokeWidth || 3 };
            return shape;
        });

    const normalizeTexts = (texts: TextItem[]): TextItem[] =>
        texts.map((t) => ({ id: t.id, text: t.text, x: t.x, y: t.y, color: t.color || "#000000", fontSize: t.fontSize || 18 }));

    const getActiveYSlide = (): YSlideDataMap | null => {
        if (!yMapRef.current || !currentSlide) return null;
        return yMapRef.current.get(currentSlide) as YSlideDataMap | null;
    };

    const handleDownloadPdf = async () => {
        if (!slides.length) { alert("다운로드할 슬라이드가 없습니다."); return; }
        const ORIGINAL_WIDTH = 1280, ORIGINAL_HEIGHT = 720, SLIDE_ASPECT_RATIO = ORIGINAL_WIDTH / ORIGINAL_HEIGHT;
        const CUSTOM_PAGE_WIDTH = 297, CUSTOM_PAGE_HEIGHT = CUSTOM_PAGE_WIDTH / SLIDE_ASPECT_RATIO;
        const doc = new jsPDF('l', 'mm', [CUSTOM_PAGE_WIDTH, CUSTOM_PAGE_HEIGHT]);
        const docWidth = doc.internal.pageSize.getWidth();
        const docHeight = doc.internal.pageSize.getHeight();

        for (let i = 0; i < slides.length; i++) {
            const slideId = slides[i].id;
            const data = slideData[slideId];
            if (!data) continue;
            const imgData = await renderHighResThumbnail(slideId, data);
            if (i > 0) doc.addPage();
            doc.addImage(imgData, 'PNG', 0, 0, docWidth, docHeight);
        }
        doc.save(`${presentationTitle || 'Presentation'}.pdf`);
    };

    const handleShare = async () => {
        try {
            const token = await getAuthToken();
            if (!token) {
                alert("로그인이 필요합니다.");
                return;
            }

            const invitation = await createInvitation(
                {
                    presentation_id: presentationId,
                    expires_in_hours: 24,
                },
                token
            );

            try {
                await navigator.clipboard.writeText(invitation.invitation_url);
                alert("초대 링크가 클립보드에 복사되었습니다!");
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (err) {
                const fallbackText = `초대 링크: ${invitation.invitation_url}`;
                alert(fallbackText);
            }
        } catch (error) {
            alert(error instanceof Error ? error.message : "초대 링크 생성에 실패했습니다.");
        }
    };

    const fetchSlides = useCallback(async () => {
        if (isDemo && demoPresentations[presentationId]) {
            const demo = demoPresentations[presentationId];
            setPresentationTitle(demo.title);

            const orders: SlideOrder[] = demo.slides.map(s => ({ id: s.id, order: s.order })).sort((a,b)=>a.order-b.order);
            yDocRef.current?.transact(() => {
                const yMap = yMapRef.current!;
                const yOrder = yOrderRef.current!;
                orders.forEach(({id}) => {
                    const ySlide = new Y.Map();
                    ySlide.set("shapes", new Y.Array<Shape>());
                    ySlide.set("texts", new Y.Array<TextItem>());
                    const data = demo.slides.find(s => s.id === id)?.data;
                    if (data) {
                        (ySlide.get("shapes") as Y.Array<Shape>).insert(0, normalizeShapes(data.shapes || []));
                        (ySlide.get("texts")  as Y.Array<TextItem>).insert(0, normalizeTexts(data.texts  || []));
                    }
                    yMap.set(id, ySlide);
                });
                yOrder.delete(0, yOrder.length);
                yOrder.push(orders.map(o=>o.id));
            }, "demo-load");

            setSlides(orders);
            setSlideData(Object.fromEntries(orders.map(o => [o.id, demo.slides.find(s=>s.id===o.id)!.data])));
            setCurrentSlide(prev => orders.find(o => o.id === prev)?.id ?? orders[0]?.id ?? "");

            orders.forEach(({ id }, idx) => {
                const data = demo.slides.find(s=>s.id===id)?.data;
                if (data) renderThumbnail(id, data, idx===0);
            });
            return;
        }

        try {
            const res = await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides`);
            if (!res.ok) { return; }
            const json = await res.json();
            const serverTitle = json?.presentation?.presentation_title ?? json?.presentation_title ?? json?.title ?? "";
            setPresentationTitle(serverTitle);

            const slideList: ReceivedSlide[] = Array.isArray(json.slides) ? json.slides : [];
            if (slideList.length === 0) {
                const res2 = await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides`, { method: "POST" });
                const json2 = await res2.json();
                const defaultSlideId: string = json2.slide_id;
                const defaultOrder: number = json2.order;
                const orders: SlideOrder[] = [{ id: defaultSlideId, order: defaultOrder }];
                yDocRef.current?.transact(() => {
                    const yMap = yMapRef.current!;
                    const yOrder = yOrderRef.current!;
                    const ySlide = new Y.Map();
                    ySlide.set("shapes", new Y.Array<Shape>());
                    ySlide.set("texts", new Y.Array<TextItem>());
                    yMap.set(defaultSlideId, ySlide);
                    yOrder.delete(0, yOrder.length);
                    yOrder.push([defaultSlideId]);
                }, "seed-default");
                setSlides(orders);
                setSlideData({ [defaultSlideId]: { shapes: [], texts: [] } });
                setCurrentSlide(defaultSlideId);
                renderThumbnail(defaultSlideId, { shapes: [], texts: [] }, true);
                return;
            }

            const orders: SlideOrder[] = slideList.map(s => ({ id: s.slide_id, order: s.order })).sort((a,b)=>a.order-b.order);

            const dataPromises: Promise<[string, SlideData]>[] = slideList.map(async (s): Promise<[string, SlideData]> => {
                let d: any = s.data;
                if (d == null) {
                    const detail = await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides/${s.slide_id}`);
                    if (detail.ok) { const dj = await detail.json(); d = dj?.data ?? { shapes:[], texts:[] }; }
                    else { d = { shapes:[], texts:[] }; }
                }
                if (typeof d === "string") { try { d = JSON.parse(d); } catch { d = { shapes:[], texts:[] }; } }
                const shapes: Shape[] = Array.isArray(d?.shapes) ? d.shapes : [];
                const texts : TextItem[] = Array.isArray(d?.texts)  ? d.texts  : [];
                return [s.slide_id, { shapes, texts }];
            });

            const entries = await Promise.all(dataPromises);
            const mapObj = Object.fromEntries(entries) as Record<string, SlideData>;

            yDocRef.current?.transact(() => {
                const yMap = yMapRef.current!;
                const yOrder = yOrderRef.current!;
                orders.forEach(({id}) => {
                    const ySlide = new Y.Map();
                    const yShapes = new Y.Array<Shape>();
                    const yTexts  = new Y.Array<TextItem>();
                    const d = mapObj[id] || { shapes:[], texts:[] };
                    if (d.shapes.length) yShapes.insert(0, normalizeShapes(d.shapes));
                    if (d.texts.length)  yTexts.insert(0,  normalizeTexts(d.texts));
                    ySlide.set("shapes", yShapes);
                    ySlide.set("texts", yTexts);
                    yMap.set(id, ySlide);
                });
                yOrder.delete(0, yOrder.length);
                yOrder.push(orders.map(o=>o.id));
            }, "initial-load");

            setSlides(orders);
            setSlideData(mapObj);
            setCurrentSlide(prev => orders.find(o => o.id === prev)?.id ?? orders[0]?.id ?? "");
        } catch (err) {
        }
    }, [API_BASE, fetchWithAuth, isDemo, presentationId]);

    useEffect(() => {
        if (isDemo) { fetchSlides(); return; }

        const ydoc = new Y.Doc();
        yDocRef.current = ydoc;
        yMapRef.current = ydoc.getMap("slides_data") as YPresentationMap;
        yOrderRef.current = ydoc.getArray<string>("slides_order");

        const applyDocToReact = () => {
            const yMap = yMapRef.current!;
            const yOrder = yOrderRef.current!;
            const mirror = yMapToObject(yMap);

            setSlideData(mirror);

            const ids = yOrder.toArray();
            setSlides(ids.map((id, i) => ({ id, order: i + 1 })));

            ids.forEach((id, idx) => {
                if (mirror[id]) {
                    scheduleThumbnail(id, mirror[id], idx === 0);
                }
            });
            
            if (stompClientRef.current?.connected) {
                const currentSubs = new Set(allSlideSubsRef.current.keys());
                const newIds = new Set(ids);
                
                currentSubs.forEach(slideId => {
                    if (!newIds.has(slideId)) {
                        allSlideSubsRef.current.get(slideId)?.unsubscribe();
                        allSlideSubsRef.current.delete(slideId);
                    }
                });
                
                newIds.forEach(slideId => {
                    if (!allSlideSubsRef.current.has(slideId) && stompClientRef.current?.connected) {
                        const sub = stompClientRef.current.subscribe(
                            `/topic/presentation.${presentationId}.slide.${slideId}`,
                            (message) => {
                                try {
                                    const parsed = JSON.parse(message.body);
                                    const data = typeof parsed.data === "string" ? JSON.parse(parsed.data) : parsed.data;
                                    if (!data) return;

                                    const normalizedData: SlideData = {
                                        shapes: normalizeShapes(data.shapes || []),
                                        texts: normalizeTexts(data.texts || [])
                                    };

                                    isApplyingRemoteUpdate.current = true;
                                    try {
                                        yDocRef.current?.transact(() => {
                                            const ySlide = yMapRef.current?.get(slideId) as YSlideDataMap | null;
                                            if (!ySlide) return;
                                            const yShapes = ySlide.get("shapes") as Y.Array<Shape>;
                                            const yTexts = ySlide.get("texts") as Y.Array<TextItem>;
                                            yShapes.delete(0, yShapes.length);
                                            yTexts.delete(0, yTexts.length);
                                            yShapes.insert(0, normalizedData.shapes);
                                            yTexts.insert(0, normalizedData.texts);
                                        }, "remote-slide-apply-all");
                                        
                                        const currentOrder = yOrderRef.current?.toArray() || [];
                                        const isFirst = currentOrder[0] === slideId;
                                        scheduleThumbnail(slideId, normalizedData, isFirst, true);
                                    } finally {
                                        isApplyingRemoteUpdate.current = false;
                                    }
                                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                } catch (e) { /* empty */ }
                            }
                        );
                        allSlideSubsRef.current.set(slideId, sub);
                    }
                });
            }
        };

        yMapRef.current.observeDeep(applyDocToReact);
        yOrderRef.current.observe(applyDocToReact);

        const handleYUpdate = (_update: Uint8Array, origin: any) => {
            if (isApplyingRemoteUpdate.current) return;
            if (origin === "remote") return;
            if (!stompClientRef.current?.connected) return;

            const ySlide = getActiveYSlide();
            if (!ySlide || !currentSlide) return;

            const shapes = (ySlide.get("shapes") as Y.Array<Shape> | undefined)?.toJSON?.() || [];
            const texts  = (ySlide.get("texts")  as Y.Array<TextItem> | undefined)?.toJSON?.() || [];

            const currentSlideOrder = slides.find(s => s.id === currentSlide)?.order ?? 9999;
            const offset = new Date().getTimezoneOffset() * 60000;
            const lastRevisionDate = new Date(Date.now() - offset).toISOString().slice(0, -1);

            const payload = {
                slide_id: currentSlide,
                order: currentSlideOrder,
                last_revision_user_id: (user as any)?.id || "anonymous",
                last_revision_date: lastRevisionDate,
                data: JSON.stringify({ shapes: normalizeShapes(shapes as Shape[]), texts: normalizeTexts(texts as TextItem[]) }),
            };

            const body = JSON.stringify(payload);
            if (lastBroadcastData.current === body) return;
            lastBroadcastData.current = body;

            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
                try {
                    stompClientRef.current?.publish({
                        destination: `/app/slide.edit.presentation.${presentationId}.slide.${currentSlide}`,
                        body
                    });
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                } catch (e) { /* empty */ }
                debounceTimerRef.current = null;
            }, 250);
        };

        ydoc.on("update", handleYUpdate);

        const inviteToken = searchParams.get('invite');
        const guestTokenKey = `guestToken_${presentationId}`;
        const storedGuestToken = sessionStorage.getItem(guestTokenKey);
        const finalGuestToken = guestToken || storedGuestToken;
        
        if (inviteToken && !finalGuestToken) {
            return;
        }

        if (stompClientRef.current?.connected) {
            return;
        }

        const tokenPromise = finalGuestToken ? Promise.resolve(finalGuestToken) : getAuthToken();
        tokenPromise.then((token) => {
            if (stompClientRef.current?.connected) {
                return;
            }

            const client = new Client({
                brokerURL: WS_URL,
                reconnectDelay: 5000,
                connectHeaders: token ? { 'Authorization': `Bearer ${token}` } : {},
            });

            client.onConnect = () => {
                stompClientRef.current = client;

                if (!joinedPresentationsRef.current.has(presentationId)) {
                    client.publish({
                        destination: `/app/presentation.${presentationId}.join`,
                        body: '',
                    });
                    joinedPresentationsRef.current.add(presentationId);
                } else {
                }

                usersSubRef.current?.unsubscribe();
                usersSubRef.current = client.subscribe(`/topic/presentation.${presentationId}.users`, (message) => {
                    try {
                        const data: ActiveUsersResponse = JSON.parse(message.body);
                        setActiveUsers(data);
                    } catch (e) {
                        console.error('접속자 목록 파싱 실패:', e);
                    }
                });

                structureSubRef.current = client.subscribe(`/topic/presentation.${presentationId}`, (message) => {
                    try {
                        const parsed = JSON.parse(message.body);
                        const { type, payload } = parsed || {};

                        if (type === "SLIDE_ADD") {
                            const { slide_id } = payload || {};
                            yDocRef.current?.transact(() => {
                                if (!yMapRef.current?.has(slide_id)) {
                                    const ySlide = new Y.Map();
                                    ySlide.set("shapes", new Y.Array<Shape>());
                                    ySlide.set("texts", new Y.Array<TextItem>());
                                    yMapRef.current?.set(slide_id, ySlide);
                                }
                                const arr = yOrderRef.current!.toArray();
                                if (!arr.includes(slide_id)) yOrderRef.current!.push([slide_id]);
                            }, "remote-slide-add");
                        } else if (type === "SLIDE_DELETE" || type === "STRUCTURE_UPDATED") {
                            const list: ReceivedSlide[] = payload?.slides || [];
                            yDocRef.current?.transact(() => {
                                const yMap = yMapRef.current!;
                                const yOrder = yOrderRef.current!;
                                const newIds = list.map(s => s.slide_id);
                                yMap.forEach((_v, key) => { if (!newIds.includes(key)) yMap.delete(key); });
                                list.forEach(s => {
                                    if (!yMap.has(s.slide_id)) {
                                        const ySlide = new Y.Map();
                                        ySlide.set("shapes", new Y.Array<Shape>());
                                        ySlide.set("texts", new Y.Array<TextItem>());
                                        yMap.set(s.slide_id, ySlide);
                                    }
                                });
                                yOrder.delete(0, yOrder.length);
                                yOrder.push(list.sort((a,b)=>a.order-b.order).map(s => s.slide_id));
                            }, "remote-structure-update");
                        } else if (type === "TITLE_UPDATED" || type === "TITLE_UPDATE") {
                            const newTitle = payload?.new_title;
                            if (!payload?.presentation_id || payload.presentation_id === presentationId) {
                                setPresentationTitle(newTitle ?? undefined);
                                if (newTitle) document.title = `${newTitle} - Kimbanana`;
                            }
                        }
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    } catch (e) { /* empty */ }
                });

                fetchSlides();

                resubscribeSlideChannel(client);
            };

            client.onStompError = (frame) => {
                if (client.connected) {
                    console.warn('STOMP 에러:', frame);
                }
            };

            client.onWebSocketError = (event) => {
                if (!client.connected && !client.active) {
                    console.error('WebSocket 연결 실패:', event);
                }
            };

            client.activate();
        });

        return () => {
            yMapRef.current?.unobserveDeep(applyDocToReact);
            yOrderRef.current?.unobserve(applyDocToReact);
            ydoc.off("update", handleYUpdate);

            slideSubRef.current?.unsubscribe();
            structureSubRef.current?.unsubscribe();
            usersSubRef.current?.unsubscribe();
            allSlideSubsRef.current.forEach(sub => sub.unsubscribe());
            allSlideSubsRef.current.clear();
            stompClientRef.current?.deactivate();

            stompClientRef.current = null;
            // presentationId가 변경되면 해당 프레젠테이션의 join 상태 제거
            joinedPresentationsRef.current.delete(presentationId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
        // guestToken은 의존성 배열에서 제거: 변경되어도 이미 연결되어 있으면 재연결하지 않음
        // 초대 링크 검증 완료 후 guestToken이 설정되면, useEffect 내부에서 sessionStorage를 확인하여 처리
    }, [WS_URL, presentationId, fetchSlides, getAuthToken, currentSlide, slides.length]);

    const resubscribeSlideChannel = (client?: Client | null) => {
        const c = client ?? stompClientRef.current;
        if (!c || !currentSlide) return;
        slideSubRef.current?.unsubscribe();
        slideSubRef.current = c.subscribe(`/topic/presentation.${presentationId}.slide.${currentSlide}`, (message) => {
            try {
                const parsed = JSON.parse(message.body);
                const data = typeof parsed.data === "string" ? JSON.parse(parsed.data) : parsed.data;
                if (!data) return;

                const slideId = parsed.slide_id || currentSlide;
                const normalizedData: SlideData = {
                    shapes: normalizeShapes(data.shapes || []),
                    texts: normalizeTexts(data.texts || [])
                };

                isApplyingRemoteUpdate.current = true;
                try {
                    yDocRef.current?.transact(() => {
                        const ySlide = getActiveYSlide();
                        if (!ySlide) return;
                        const yShapes = ySlide.get("shapes") as Y.Array<Shape>;
                        const yTexts  = ySlide.get("texts")  as Y.Array<TextItem>;
                        yShapes.delete(0, yShapes.length);
                        yTexts.delete(0, yTexts.length);
                        yShapes.insert(0, normalizedData.shapes);
                        yTexts.insert(0, normalizedData.texts);
                    }, "remote-slide-apply");
                    
                    const isFirst = slides[0]?.id === slideId;
                    scheduleThumbnail(slideId, normalizedData, isFirst, true);
                } finally {
                    isApplyingRemoteUpdate.current = false;
                }
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e) { /* empty */ }
        });
    };

    useEffect(() => {
        if (!slides.length) return;
        slides.forEach((s, idx) => {
            const data = slideData[s.id];
            if (data) {
                scheduleThumbnail(s.id, data, idx === 0);
            }
        });
    }, [slides, slideData, scheduleThumbnail]);


    useEffect(() => {
        if (!stompClientRef.current || !currentSlide) return;
        resubscribeSlideChannel();
    }, [currentSlide]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const pushHistory = (prevData: SlideData, _after: { shapes: Shape[]; texts: TextItem[]; }) => {
        setUndoStack(prev => [...prev, prevData]);
        setRedoStack([]);
    };

    const updateShapes = (newShapes: Shape[] | ((prev: Shape[]) => Shape[])) => {
        const ySlide = getActiveYSlide();
        if (!ySlide) return;
        yDocRef.current?.transact(() => {
            const yShapes = ySlide.get("shapes") as Y.Array<Shape>;
            const cur = yShapes.toArray() as Shape[];
            const next = typeof newShapes === "function" ? newShapes(cur) : newShapes;
            const normalized = normalizeShapes(next);
            const before = { shapes: cur, texts: (ySlide.get("texts") as Y.Array<TextItem>).toArray() as TextItem[] };
            yShapes.delete(0, yShapes.length);
            yShapes.insert(0, normalized);
            const after = { shapes: normalized, texts: before.texts };
            setSlideData(prev => ({ ...prev, [currentSlide]: after }));
            pushHistory(before, after);
        }, "canvas-edit");
    };

    const updateTexts = (newTexts: TextItem[] | ((prev: TextItem[]) => TextItem[])) => {
        const ySlide = getActiveYSlide();
        if (!ySlide) return;
        yDocRef.current?.transact(() => {
            const yTexts = ySlide.get("texts") as Y.Array<TextItem>;
            const cur = yTexts.toArray() as TextItem[];
            const next = typeof newTexts === "function" ? newTexts(cur) : newTexts;
            const normalized = normalizeTexts(next);
            const before = { shapes: (ySlide.get("shapes") as Y.Array<Shape>).toArray() as Shape[], texts: cur };
            yTexts.delete(0, yTexts.length);
            yTexts.insert(0, normalized);
            const after = { shapes: before.shapes, texts: normalized };
            setSlideData(prev => ({ ...prev, [currentSlide]: after }));
            pushHistory(before, after);
        }, "canvas-edit");
    };

    const handleUndo = () => {
        if (!undoStack.length || !currentSlide) return;
        const prev = undoStack[undoStack.length - 1];
        setUndoStack(s => s.slice(0, -1));
        setRedoStack(r => [...r, slideData[currentSlide] ?? { shapes:[], texts:[] }]);

        const ySlide = getActiveYSlide();
        if (!ySlide) return;
        yDocRef.current?.transact(() => {
            const yShapes = ySlide.get("shapes") as Y.Array<Shape>;
            const yTexts  = ySlide.get("texts")  as Y.Array<TextItem>;
            yShapes.delete(0, yShapes.length);
            yTexts.delete(0,  yTexts.length);
            yShapes.insert(0, normalizeShapes(prev.shapes || []));
            yTexts.insert(0,  normalizeTexts(prev.texts  || []));
            setSlideData(prevState => ({ ...prevState, [currentSlide]: prev }));
        }, "undo");
    };

    const handleRedo = () => {
        if (!redoStack.length || !currentSlide) return;
        const next = redoStack[redoStack.length - 1];
        setRedoStack(r => r.slice(0, -1));
        setUndoStack(s => [...s, slideData[currentSlide] ?? { shapes:[], texts:[] }]);

        const ySlide = getActiveYSlide();
        if (!ySlide) return;
        yDocRef.current?.transact(() => {
            const yShapes = ySlide.get("shapes") as Y.Array<Shape>;
            const yTexts  = ySlide.get("texts")  as Y.Array<TextItem>;
            yShapes.delete(0, yShapes.length);
            yTexts.delete(0,  yTexts.length);
            yShapes.insert(0, normalizeShapes(next.shapes || []));
            yTexts.insert(0,  normalizeTexts(next.texts  || []));
            setSlideData(prevState => ({ ...prevState, [currentSlide]: next }));
        }, "redo");
    };

    const handleAddSlide = async () => {
        try {
            const res = await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides`, { method: "POST", headers: { 'Accept': 'application/json' }});
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const json = await res.json();
            const newId = json.slide_id as string;

            yDocRef.current?.transact(() => {
                const ySlide = new Y.Map();
                ySlide.set("shapes", new Y.Array<Shape>());
                ySlide.set("texts", new Y.Array<TextItem>());
                yMapRef.current?.set(newId, ySlide);
                yOrderRef.current?.push([newId]);
            }, "add-slide");

            setCurrentSlide(newId);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) { /* empty */ }
    };

    const handleDeleteSlide = async (slideId: string) => {
        if (slides.length === 1) return;

        yDocRef.current?.transact(() => {
            yMapRef.current?.delete(slideId);
            const yOrder = yOrderRef.current!;
            const idx = yOrder.toArray().indexOf(slideId);
            if (idx !== -1) yOrder.delete(idx, 1);
        }, "delete-slide");

        if (currentSlide === slideId) {
            const after = yOrderRef.current?.toArray() ?? [];
            setCurrentSlide(after[0] ?? "");
        }

        const newOrder = (yOrderRef.current?.toArray() ?? []).map((id, i) => ({ slide_id: id, order: i+1 }));
        await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ presentation_id: presentationId, slides: newOrder }),
        });

        await fetchSlides();
    };

    const handleReorderSlides = async (newOrder: string[]) => {
        yDocRef.current?.transact(() => {
            const yOrder = yOrderRef.current!;
            yOrder.delete(0, yOrder.length);
            yOrder.insert(0, newOrder);
        }, "reorder-slides");

        await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                presentation_id: presentationId,
                slides: newOrder.map((id, index) => ({ slide_id: id, order: index + 1 })),
            }),
        });

        const newFirst = newOrder[0];
        if (newFirst && slideData[newFirst]) {
            renderThumbnail(newFirst, slideData[newFirst], true);
        }
    };

    const handleImageUpload = (imageUrl: string) => {
        const ySlide = getActiveYSlide();
        if (!ySlide) return;
        const img = new window.Image();
        img.onload = () => {
            const newId = Date.now();
            const newImage: Shape = { id: newId, type: "image", x: 200, y: 150, width: img.width, height: img.height, imageSrc: imageUrl };
            setSelectedShapeId(newId);
            yDocRef.current?.transact(() => {
                const yShapes = ySlide.get("shapes") as Y.Array<Shape>;
                yShapes.push([newImage]);
            }, "add-image");
        };
        img.src = imageUrl;
    };

    const deleteSelected = () => {
        const ySlide = getActiveYSlide();
        if (!ySlide) return;
        yDocRef.current?.transact(() => {
            if (selectedShapeId != null) {
                const yShapes = ySlide.get("shapes") as Y.Array<Shape>;
                const idx = yShapes.toArray().findIndex(s => String(s.id) === String(selectedShapeId));
                if (idx !== -1) yShapes.delete(idx, 1);
                setSelectedShapeId(null);
                return;
            }
            if (selectedTextId != null) {
                const yTexts = ySlide.get("texts") as Y.Array<TextItem>;
                const idx = yTexts.toArray().findIndex(t => String(t.id) === String(selectedTextId));
                if (idx !== -1) yTexts.delete(idx, 1);
                setSelectedTextId(null);
            }
        }, "delete-element");
    };

    const handleCopyPaste = useCallback((e: KeyboardEvent) => {
        const ae = document.activeElement as HTMLElement | null;
        const isTypingInForm = !!ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
        if (isTypingInForm || !currentSlide) return;

        const isModifierPressed = e.ctrlKey || e.metaKey;
        if (!isModifierPressed) return;

        const currentSlideData = slideData[currentSlide] || { shapes: [], texts: [] };
        const ySlide = getActiveYSlide();
        if (!ySlide) return;

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
            if (!clipboardData || (clipboardData.shapes.length === 0 && clipboardData.texts.length === 0)) return;
            e.preventDefault();
            const newShapes: Shape[] = clipboardData.shapes.map(s => ({ ...s, id: Date.now() + Math.random(), x: (s.x ?? 0)+10, y: (s.y ?? 0)+10 }));
            const newTexts : TextItem[] = clipboardData.texts.map(t => ({ ...t, id: Date.now() + Math.random(), x: (t.x ?? 0)+10, y: (t.y ?? 0)+10 }));
            yDocRef.current?.transact(() => {
                const yShapes = ySlide.get("shapes") as Y.Array<Shape>;
                const yTexts  = ySlide.get("texts")  as Y.Array<TextItem>;
                if (newShapes.length) yShapes.push(newShapes);
                if (newTexts.length)  yTexts.push(newTexts);
                if (newShapes.length) setSelectedShapeId(String(newShapes[0].id));
                else if (newTexts.length) setSelectedTextId(String(newTexts[0].id));
            }, "paste");
            setClipboardData({ shapes: newShapes, texts: newTexts });
        }
    }, [currentSlide, slideData, selectedShapeId, selectedTextId, clipboardData]);

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
            if (slides.length > 1 && currentSlide) {
                e.preventDefault();
                handleDeleteSlide(currentSlide);
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [currentSlide, slides.length, isTyping, selectedShapeId, selectedTextId, activeTool, handleCopyPaste]);

    const handleSaveHistory = async () => {
        try {
            if (!slides.length) { alert("저장할 슬라이드가 없습니다."); return false; }
            const offset = new Date().getTimezoneOffset() * 60000;
            const isoLocal = new Date(Date.now() - offset).toISOString().slice(0, -1);

            const payload = {
                last_revision_user_id: user?.id || "anonymous",
                slides: slides.map(s => {
                    const data = slideData[s.id] ?? { shapes: [], texts: [] };
                    const dataString = JSON.stringify({
                        shapes: (data.shapes ?? []).map(shape => ({
                            id: shape.id, type: shape.type, x: shape.x, y: shape.y, rotation: shape.rotation ?? 0,
                            ...(shape.type === "rectangle" && { width: shape.width || 0, height: shape.height || 0, color: shape.color || "#000000" }),
                            ...(shape.type === "circle"    && { radiusX: (shape as any).radiusX ?? (shape as any).radius ?? 50, radiusY: (shape as any).radiusY ?? (shape as any).radius ?? 50, color: shape.color || "#000000" }),
                            ...(shape.type === "triangle"  && { points: shape.points || [], color: shape.color || "#000000" }),
                            ...(shape.type === "image"     && { width: shape.width || 0, height: shape.height || 0, imageSrc: shape.imageSrc || "" }),
                        })),
                        texts: (data.texts ?? []).map(t => ({ id: t.id, text: t.text, x: t.x, y: t.y, color: t.color || "#000000", fontSize: t.fontSize || 18 })),
                    });
                    return { slide_id: s.id, order: s.order, last_revision_user_id: user?.id || "anonymous", last_revision_date: isoLocal, data: dataString };
                }),
            };

            const res = await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/histories`, {
                method: "POST",
                mode: "cors",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                alert(`히스토리 저장 실패 (${res.status})`);
                return false;
            }
            return true;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) {
            alert("히스토리 저장 중 오류가 발생");
            return false;
        }
    };

    const savePresentationTitle = async (title: string) => {
        try {
            await fetchWithAuth(`${API_BASE}/presentations/${presentationId}/slides/title`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ presentation_id: presentationId, new_title: title }),
            });
            setPresentationTitle(title);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (err) { /* empty */ }
    };

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
                onTitleSave={savePresentationTitle}
                onSaveHistory={handleSaveHistory}
                onDownloadPdf={handleDownloadPdf}
                onShare={handleShare}
                isGuest={isGuest}
                activeUsers={activeUsers}
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
                    {currentSlide && slideData[currentSlide] && (
                        <Canvas
                            activeTool={activeTool}
                            selectedColor={selectedColor}
                            setSelectedColor={setSelectedColor}
                            setActiveTool={setActiveTool}
                            shapes={slideData[currentSlide]?.shapes || []}
                            texts={slideData[currentSlide]?.texts || []}
                            setShapes={(updater) => updateShapes(updater)}
                            setTexts={(updater) => updateTexts(updater)}
                            currentSlide={currentSlide}
                            updateThumbnail={(slideId, dataUrl) => {
                                const firstSlideId = slides[0]?.id;
                                updateThumbnail(slideId, dataUrl, firstSlideId);
                            }}
                            // 레거시 시그니처 유지: 내부적으로는 Yjs가 publish 처리
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
                        canUndo={undoStack.length > 0}
                        canRedo={redoStack.length > 0}
                        getAuthToken={getAuthToken}
                    />
                </div>
            </div>
        </div>
    );
};

export default MainLayout;