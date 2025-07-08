import React from "react";
import "./HistoryList.css";
import { Shape, TextItem } from "../../types/types.ts";

interface HistoryListProps {
    historyData: {
        [timestamp: string]: {
            shapes: Shape[];
            texts: TextItem[];
        };
    };
    selected: string | null;
    onSelect: (timestamp: string) => void;
}

const HistoryList: React.FC<HistoryListProps> = ({ historyData, selected, onSelect }) => {
    const grouped: { [month: string]: string[] } = {};
    Object.keys(historyData).forEach((timestamp) => {
        const month = timestamp.slice(0, 9); // 예: "2025년 2월"
        if (!grouped[month]) grouped[month] = [];
        grouped[month].push(timestamp);
    });

    return (
        <div className="history-right">
            <h3 className="history-title">history</h3>

            {Object.entries(grouped).map(([month, items]) => (
                <div className="history-group" key={month}>
                    <p className="history-month">{month}</p>
                    {items.map((item) => {
                        const isActive = selected === item;

                        return (
                            <div
                                key={item}
                                className={`history-item ${isActive ? "active" : ""}`}
                                onClick={() => onSelect(item)}
                            >
                                <span>{item}</span>

                                {isActive && (
                                    <div className="history-restore-button">복원하기</div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

export default HistoryList;
