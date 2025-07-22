import React, { useState } from "react";
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
    const grouped: { [date: string]: string[] } = {};

    Object.keys(historyData).forEach((timestamp) => {
        const parts = timestamp.split(" ");
        const date = parts.slice(0, 3).join(" ");
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(timestamp);
    });

    const [openDates, setOpenDates] = useState<{ [date: string]: boolean }>({});

    const toggleDate = (date: string) => {
        setOpenDates((prev) => ({
            ...prev,
            [date]: !prev[date],
        }));
    };

    return (
        <div className="history-right">
            <h3 className="history-title">history</h3>

            {Object.entries(grouped).map(([date, timestamps]) => (
                <div className="history-group" key={date}>
                    <div className="history-date" onClick={() => toggleDate(date)}>
                        {openDates[date] ? "▼" : "▶"} {date}
                    </div>

                    {openDates[date] && (
                        <div className="history-timestamps">
                            {timestamps.map((timestamp) => {
                                const isActive = selected === timestamp;

                                return (
                                    <div
                                        key={timestamp}
                                        className={`history-item ${isActive ? "active" : ""}`}
                                        onClick={() => onSelect(timestamp)}
                                    >
                                        <span>{timestamp}</span>
                                        {isActive && (
                                            <div className="history-restore-button">복원하기</div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

export default HistoryList;
