export const ORIGINAL_WIDTH = 1000;
export const ORIGINAL_HEIGHT = 563;

export const drawTrianglePoints = (
    _x: number,
    _y: number,
    scaleX = 1,
    scaleY = 1
): number[] => {
    const baseWidth = 100;
    const baseHeight = 100;

    const width = baseWidth * scaleX;
    const height = baseHeight * scaleY;

    return [
        0, -height / 2,
        -width / 2, height / 2,
        width / 2, height / 2
    ];
};

export const getDisplayDimensions = (
    params: {
        isFullscreen?: boolean;
        isHistoryPage?: boolean;
    }
) => {
    const { isFullscreen, isHistoryPage } = params;
    if (isFullscreen) {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const aspectRatio = ORIGINAL_WIDTH / ORIGINAL_HEIGHT;
        const screenAspectRatio = screenWidth / screenHeight;

        let displayWidth: number;
        let displayHeight: number;
        if (screenAspectRatio > aspectRatio) {
            displayHeight = screenHeight;
            displayWidth = displayHeight * aspectRatio;
        } else {
            displayWidth = screenWidth;
            displayHeight = displayWidth / aspectRatio;
        }

        return {
            width: displayWidth,
            height: displayHeight,
            scale: {
                x: displayWidth / ORIGINAL_WIDTH,
                y: displayHeight / ORIGINAL_HEIGHT,
            }
        } as const;
    } else {
        const displayWidth = isHistoryPage ? 800 : ORIGINAL_WIDTH;
        const displayHeight = isHistoryPage ? 450 : ORIGINAL_HEIGHT;
        const scale = isHistoryPage
            ? {
                x: displayWidth / ORIGINAL_WIDTH,
                y: displayHeight / ORIGINAL_HEIGHT,
            }
            : { x: 1, y: 1 };

        return {
            width: displayWidth,
            height: displayHeight,
            scale
        } as const;
    }
};



