export class Timer {
    public running : boolean = false;
    private startCalcTime: number = 0;
    private beginTime: number = 0;
    private lastUpdateTime: number = 0;
    private calculationTime: number = 0;
    public elapsedTime: number = 0;
    public deltaTime: number = 0;
    public frameCount: number = 0;
    public fps: number = 0;

    public start() {
        this.running = true;
        this.startCalcTime = performance.now();
        this.beginTime = this.startCalcTime;
        this.lastUpdateTime = this.startCalcTime;
    }    

    public update() {
        const now = performance.now();
        this.deltaTime = now - this.lastUpdateTime;
        this.calculationTime = now - this.startCalcTime;
        this.elapsedTime = now - this.beginTime;
        this.lastUpdateTime = now;

        // Calculate FPS
        this.frameCount++;
        if (this.calculationTime > 1000) { // Calculate FPS every second
            this.fps = (this.frameCount / this.calculationTime) * 1000;
            this.frameCount = 0;
            this.startCalcTime = now; // Reset for the next calculation period
        }
    }

    public getElapsedTime(): number {
        return this.elapsedTime;
    }

    public getDisplayTime(): string {
        const ms = this.elapsedTime;
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(0);
        return `${minutes.toString().padStart(2,'0')}:${seconds.padStart(2, '0')}`;
    }

    public getDeltaTime(): number {
        return this.deltaTime;
    }

    public getFPS(): number {
        return this.fps;
    }

    public getTime() : { elapsed: number, deltaTime: number, fps: number } {
        return { elapsed: this.elapsedTime, deltaTime: this.deltaTime, fps: this.fps };
    }
}
