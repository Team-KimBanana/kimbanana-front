import React, { useMemo, useState } from "react";
import "./HistoryList.css";

export type HistoryEntry = {
    historyId: string;
    displayDateTime: string;
    displayDateOnly: string;
};

interface HistoryListProps {
    histories: HistoryEntry[];
    selectedHistoryId: string | null;
    onSelect: (historyId: string) => void;
}

const HistoryList: React.FC<HistoryListProps> = ({ histories, selectedHistoryId, onSelect }) => {
    const grouped = useMemo(() => {
        const map: Record<string, HistoryEntry[]> = {};

        histories.forEach((h) => {
            if (!map[h.displayDateOnly]) {
                map[h.displayDateOnly] = [];
            }

            const exists = map[h.displayDateOnly].some(
                (item) => item.historyId.split("__")[0] === h.historyId.split("__")[0]
            );

            if (!exists) {
                map[h.displayDateOnly].push(h);
            }
        });

        return map;
    }, [histories]);


    const [openDates, setOpenDates] = useState<Record<string, boolean>>({});
    const toggleDate = (date: string) =>
        setOpenDates((prev) => ({ ...prev, [date]: !prev[date] }));

    return (
        <div className="history-right">
            <h3 className="history-title">history</h3>

            {Object.entries(grouped).map(([date, items]) => (
                <div className="history-group" key={date}>
                    <div className="history-date" onClick={() => toggleDate(date)}>
                        {openDates[date] ? "▼" : "▶"} {date}
                    </div>

                    {openDates[date] && (
                        <div className="history-timestamps">
                            {items.map((it) => {
                                const isActive = selectedHistoryId === it.historyId;
                                return (
                                    <div
                                        key={it.historyId}
                                        className={`history-item ${isActive ? "active" : ""}`}
                                        onClick={() => onSelect(it.historyId)}
                                    >
                                        <span>{it.displayDateTime}</span>
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