// import * as Y from "yjs";

export interface Shape {
    id: number;
    type: "rectangle" | "circle" | "triangle" | "image" | "star" | "arrow" | "line";
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    radius?: number;
    radiusX?: number;
    radiusY?: number;
    points?: number[];
    rotation?: number;
    color?: string;
    imageSrc?: string;
    strokeWidth?: number;
}

export interface TextItem {
    id: number;
    x: number;
    y: number;
    text: string;
    color: string;
    fontSize?: number;
}

export type EditPayload =
    | { type: 'ADD_SHAPE'; shape: Shape }
    | { type: 'ADD_TEXT'; text: TextItem }
    | { type: 'DELETE_SHAPE'; id: number }
    | { type: 'DELETE_TEXT'; id: number }
    | { type: 'UPDATE_SHAPE'; shape: Shape }
    | { type: 'UPDATE_TEXT'; text: TextItem };


export interface ReceivedSlide {
    slide_id: string;
    order: number;
    data?: {
        shapes?: Shape[];
        texts?: TextItem[];
    };
}


export type SlideData = {
    shapes: Shape[];
    texts: TextItem[];
};

export type SlideOrder = {
    id: string;
    order: number
};


export type SlideMap = {
    [slideId: string]: SlideData;
};


export interface User {
    id: string;
    email: string;
    name: string;
    profileImage?: string;
    createdAt: string;
}

export interface Presentation {
    id: string;
    title: string;
    thumbnail?: string;
    createdAt: string;
    updatedAt: string;
    userId: string;
    isShared: boolean;
    shareUrl?: string;
}

export interface Workspace {
    id: string;
    name: string;
    presentations: Presentation[];
    createdAt: string;
    updatedAt: string;
}

export interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
}

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface RegisterCredentials {
    email: string;
    password: string;
    name: string;
}

// API 응답 타입들
export interface PresentationResponse {
    presentation: {
        presentation_id: string;
        presentation_title: string;
        last_revision_date: string;
        user_id: string;
    };
    thumbnail_url?: string;
}

export interface SlideResponse {
    slide_id: string;
    last_revision_date: string;
    last_revision_user_id: string;
    order: number;
    data: {
        shapes?: Shape[];
        texts?: TextItem[];
    };
}

export interface PresentationDetailResponse {
    presentation: {
        presentation_id: string;
        presentation_title: string;
    };
    slides: SlideResponse[];
}

export interface CreatePresentationRequest {
    user_id: string;
}
