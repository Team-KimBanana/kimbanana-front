import React, { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";
import "./AdvancedColorPicker.css";

type Props = {
    value: string;
    onChange: (hexOrRgba: string) => void;
    onClose?: () => void;
    enableAlpha?: boolean;
    anchorEl?: HTMLElement | null;
};

const isHex6 = (s: string) => /^#([0-9a-fA-F]{6})$/.test(s);
const isHex8 = (s: string) => /^#([0-9a-fA-F]{8})$/.test(s);
const rgbaRegex =
    /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d*\.?\d+))?\s*\)/;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const clamp255 = (n: number) => Math.min(255, Math.max(0, Math.round(n)));

const rgbToHex = (r: number, g: number, b: number) =>
    `#${[r, g, b]
        .map((v) => clamp255(v).toString(16).padStart(2, "0"))
        .join("")}`;

const hexToRgb = (hex: string) => {
    const s = hex.replace("#", "");
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    return { r, g, b };
};

function parseInitialColor(value?: string) {
    let hex = "#3385FF";
    let alphaPct = 100;

    if (!value || typeof value !== "string") return { hex, alphaPct };

    if (isHex6(value)) {
        hex = value;
        alphaPct = 100;
        return { hex, alphaPct };
    }
    if (isHex8(value)) {
        hex = value.slice(0, 7);
        const a = parseInt(value.slice(7, 9), 16);
        alphaPct = Math.round((a / 255) * 100);
        return { hex, alphaPct };
    }

    const m = value.match(rgbaRegex);
    if (m) {
        const r = +m[1],
            g = +m[2],
            b = +m[3];
        const a = m[4] != null ? clamp01(+m[4]) : 1;
        hex = rgbToHex(r, g, b);
        alphaPct = Math.round(a * 100);
        return { hex, alphaPct };
    }

    return { hex, alphaPct };
}

export default function AdvancedColorPicker({
                                                value,
                                                onChange,
                                                onClose,
                                                enableAlpha = true,
                                                anchorEl,
                                            }: Props) {
    const ref = useRef<HTMLDivElement>(null);

    const init = parseInitialColor(value);
    const [hex, setHex] = useState<string>(init.hex);
    const [alpha, setAlpha] = useState<number>(init.alphaPct);

    useEffect(() => {
        const { hex: h, alphaPct: a } = parseInitialColor(value);
        setHex(h);
        setAlpha(a);
    }, [value]);

    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (!ref.current || ref.current.contains(e.target as Node)) return;
            onClose?.();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose?.();
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [onClose]);

    const style: React.CSSProperties = {};
    if (anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        const offset = 8;
        style.position = "fixed";
        style.left = rect.left + rect.width / 2;
        style.top = rect.top - offset;
        style.transform = "translate(-50%, -100%)";
        style.zIndex = 2000;
    }


    const apply = (nextHex: string, nextAlpha = alpha) => {
        setHex(nextHex);
        if (enableAlpha && nextAlpha < 100) {
            const { r, g, b } = hexToRgb(nextHex);
            const a = +(nextAlpha / 100).toFixed(2);
            onChange(`rgba(${r}, ${g}, ${b}, ${a})`);
        } else {
            onChange(nextHex);
        }
    };

    return (
        <div className="acp-popover" ref={ref} style={style}>
            <div className="acp-row">
                <HexColorPicker color={hex} onChange={(c) => apply(c)} />
            </div>

            {enableAlpha && (
                <div className="acp-row acp-alpha">
                    <label>투명도</label>
                    <input
                        type="range"
                        min={0}
                        max={100}
                        value={alpha}
                        onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            setAlpha(v);
                            apply(hex, v);
                        }}
                    />
                    <span>{alpha}%</span>
                </div>
            )}

            <div className="acp-row acp-tools">
                <input
                    className="acp-hex-input"
                    value={hex.toUpperCase()}
                    onChange={(e) => {
                        const raw = e.target.value.trim();
                        const v = raw.startsWith("#") ? raw : `#${raw}`;
                        if (isHex6(v)) apply(v);
                        setHex(v);
                    }}
                />
            </div>
        </div>
    );
}
