export class BitmapFontAtlas {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private fontFamily: string;
    private fgColor: string;
    private bgColor: string;
    private size: number;
    private isBold: boolean;
    private chars: string[];
    private charData: Record<string, { percWidth: number }>;

    public charsPerRow: number = 0;
    public charsPerColumn: number = 0;

    constructor(fontFamily: string, fgColor: string, bgColor: string, size: number, bold: boolean = false) {
        const canvas = document.createElement('canvas') as HTMLCanvasElement;
        canvas.width = size;
        canvas.height = size;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error(`Unable to get 2D context for canvas`);
        }

        this.canvas = canvas;
        this.ctx = ctx;
        this.fontFamily = fontFamily;
        this.fgColor = fgColor;
        this.bgColor = bgColor;
        this.size = size;
        this.isBold = bold;
        this.chars = Array.from({ length: 95 }, (_, i) => String.fromCharCode(i + 32)); // ASCII 32-126
        this.charData = {};

        this.createFontAtlas();
    }

    getCanvas() : HTMLCanvasElement {
        return this.canvas;
    }

    private createFontAtlas(): void {
        this.canvas.width = this.size;
        this.canvas.height = this.size;

        const numChars = this.chars.length;
        const gridSize = Math.ceil(Math.sqrt(numChars)); // Squares count per row / column
        const cellSize = Math.floor(this.size / gridSize); // Size in pixels of each square
        const fontSize = Math.floor(cellSize * 0.95); // 80% of cell size for best fit

        this.charsPerRow = 10;  // You could calculate this dynamically if needed
        this.charsPerColumn = 10;

        this.ctx.fillStyle = this.bgColor;
        this.ctx.fillRect(0, 0, this.size, this.size);

        const fontWeight = this.isBold ? "bold" : "normal";
        this.ctx.font = `${fontWeight} ${fontSize}px ${this.fontFamily}`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillStyle = this.fgColor;

        for (let i = 0; i < numChars; i++) {
            const col = i % gridSize;
            const row = Math.floor(i / gridSize);

            const x = col * cellSize + cellSize / 2;
            const y = row * cellSize + cellSize / 2;

            this.ctx.fillText(this.chars[i], x, y);

            // Measure width for letter spacing in OpenGL
            const metrics = this.ctx.measureText(this.chars[i]);
            const percWidth = metrics.width / cellSize; // percentage of CHAR that covers the cell
            const letterWidthPixels = metrics.width;

            this.charData[this.chars[i]] = {
                percWidth
            };
        }
    }

    public getSpacingData(): Record<string, { percWidth: number; }> {
        return this.charData;
    }
}
