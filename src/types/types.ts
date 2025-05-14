export interface Shape {
    id: number;
    type: "rectangle" | "circle" | "triangle";
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    radius?: number;
    radiusX?: number;
    radiusY?: number;
    points?: number[];
    color: string;
}

export interface TextItem {
    id: number;
    x: number;
    y: number;
    text: string;
    color: string;
}

export type EditPayload =
    | { type: 'ADD_SHAPE'; shape: Shape }
    | { type: 'ADD_TEXT'; text: TextItem }
    | { type: 'DELETE_SHAPE'; id: number }
    | { type: 'DELETE_TEXT'; id: number }
    | { type: 'UPDATE_SHAPE'; shape: Shape }
    | { type: 'UPDATE_TEXT'; text: TextItem };
