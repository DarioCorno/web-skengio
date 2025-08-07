// src/engine/utils/Timer.ts

/**
 * Timer class for measuring application performance and render timing
 * Provides accurate FPS calculation based on actual render time, not RAF limitations
 */
export class Timer {
    public running: boolean = false;
    
    // General timing
    private startCalcTime: number = 0;
    private beginTime: number = 0;
    private lastUpdateTime: number = 0;
    private calculationTime: number = 0;
    public elapsedTime: number = 0;
    public deltaTime: number = 0;
    
    // RAF-based FPS (traditional)
    public frameCount: number = 0;
    public fps: number = 0;
    
    // Render-based FPS (new)
    private renderStartTime: number = 0;
    private renderEndTime: number = 0;
    private renderDeltaTime: number = 0;
    public renderFrameCount: number = 0;
    private renderFPSCalcTime: number = 0;
    private renderTimeAccumulator: number = 0;
    public renderFPS: number = 0;
    public avgRenderTime: number = 0;
    public lastRenderTime: number = 0;
    
    // Performance statistics
    private minRenderTime: number = Number.MAX_VALUE;
    private maxRenderTime: number = 0;
    private renderTimes: number[] = [];
    private maxSamples: number = 60; // Keep last 60 frame times for moving average

    /**
     * Start the timer
     */
    public start(): void {
        this.running = true;
        this.startCalcTime = performance.now();
        this.beginTime = this.startCalcTime;
        this.lastUpdateTime = this.startCalcTime;
        this.renderFPSCalcTime = this.startCalcTime;
    }

    /**
     * Update general timing (call this in your main loop)
     */
    public update(): void {
        const now = performance.now();
        this.deltaTime = now - this.lastUpdateTime;
        this.calculationTime = now - this.startCalcTime;
        this.elapsedTime = now - this.beginTime;
        this.lastUpdateTime = now;

        // Calculate traditional RAF-based FPS
        this.frameCount++;
        if (this.calculationTime > 1000) { // Calculate FPS every second
            this.fps = (this.frameCount / this.calculationTime) * 1000;
            this.frameCount = 0;
            this.startCalcTime = now; // Reset for the next calculation period
        }
    }

    /**
     * Mark the start of rendering
     * Call this right before your render operations begin
     */
    public startRender(): void {
        this.renderStartTime = performance.now();
    }

    /**
     * Mark the end of rendering and calculate render-based FPS
     * Call this right after your render operations complete
     */
    public endRender(): void {
        this.renderEndTime = performance.now();
        this.renderDeltaTime = this.renderEndTime - this.renderStartTime;
        this.lastRenderTime = this.renderDeltaTime;
        
        // Update min/max statistics
        this.minRenderTime = Math.min(this.minRenderTime, this.renderDeltaTime);
        this.maxRenderTime = Math.max(this.maxRenderTime, this.renderDeltaTime);
        
        // Add to moving average buffer
        this.renderTimes.push(this.renderDeltaTime);
        if (this.renderTimes.length > this.maxSamples) {
            this.renderTimes.shift();
        }
        
        // Accumulate render time and frame count
        this.renderTimeAccumulator += this.renderDeltaTime;
        this.renderFrameCount++;
        
        // Calculate render-based FPS every second
        const now = performance.now();
        const timeSinceLastCalc = now - this.renderFPSCalcTime;
        
        if (timeSinceLastCalc > 1000) {
            // Calculate average render time over the period
            this.avgRenderTime = this.renderTimeAccumulator / this.renderFrameCount;
            
            // Calculate FPS based on average render time
            // This gives us the theoretical maximum FPS if only limited by render time
            this.renderFPS = 1000 / this.avgRenderTime;
            
            // Reset accumulators
            this.renderTimeAccumulator = 0;
            this.renderFrameCount = 0;
            this.renderFPSCalcTime = now;
        }
    }

    /**
     * Get elapsed time since timer started
     * @returns {number} Elapsed time in milliseconds
     */
    public getElapsedTime(): number {
        return this.elapsedTime;
    }

    /**
     * Get formatted display time (MM:SS)
     * @returns {string} Formatted time string
     */
    public getDisplayTime(): string {
        const ms = this.elapsedTime;
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(0);
        return `${minutes.toString().padStart(2, '0')}:${seconds.padStart(2, '0')}`;
    }

    /**
     * Get delta time since last update
     * @returns {number} Delta time in milliseconds
     */
    public getDeltaTime(): number {
        return this.deltaTime;
    }

    /**
     * Get traditional RAF-based FPS
     * @returns {number} Frames per second
     */
    public getFPS(): number {
        return this.fps;
    }

    /**
     * Get render-based FPS (actual performance)
     * @returns {number} Theoretical max FPS based on render time
     */
    public getRenderFPS(): number {
        return this.renderFPS;
    }

    /**
     * Get moving average of render time
     * @returns {number} Average render time over last N frames
     */
    public getMovingAverageRenderTime(): number {
        if (this.renderTimes.length === 0) return 0;
        const sum = this.renderTimes.reduce((a, b) => a + b, 0);
        return sum / this.renderTimes.length;
    }

    /**
     * Get performance statistics
     * @returns {Object} Object containing various performance metrics
     */
    public getPerformanceStats(): {
        rafFPS: number;
        renderFPS: number;
        lastRenderTime: number;
        avgRenderTime: number;
        movingAvgRenderTime: number;
        minRenderTime: number;
        maxRenderTime: number;
        effectiveFPS: number;
    } {
        const movingAvg = this.getMovingAverageRenderTime();
        const effectiveFPS = movingAvg > 0 ? 1000 / movingAvg : 0;
        
        return {
            rafFPS: this.fps,
            renderFPS: this.renderFPS,
            lastRenderTime: this.lastRenderTime,
            avgRenderTime: this.avgRenderTime,
            movingAvgRenderTime: movingAvg,
            minRenderTime: this.minRenderTime === Number.MAX_VALUE ? 0 : this.minRenderTime,
            maxRenderTime: this.maxRenderTime,
            effectiveFPS: effectiveFPS
        };
    }

    /**
     * Get all timing information
     * @returns {Object} Complete timing data
     */
    public getTime(): { 
        elapsed: number; 
        deltaTime: number; 
        fps: number;
        renderFPS: number;
        avgRenderTime: number;
    } {
        return { 
            elapsed: this.elapsedTime, 
            deltaTime: this.deltaTime, 
            fps: this.fps,
            renderFPS: this.renderFPS,
            avgRenderTime: this.avgRenderTime
        };
    }

    /**
     * Reset performance statistics
     */
    public resetStats(): void {
        this.minRenderTime = Number.MAX_VALUE;
        this.maxRenderTime = 0;
        this.renderTimes = [];
        this.renderTimeAccumulator = 0;
        this.renderFrameCount = 0;
    }

    /**
     * Get a formatted string with performance information
     * @returns {string} Formatted performance string for display
     */
    public getPerformanceString(): string {
        const stats = this.getPerformanceStats();
        return `RAF FPS: ${stats.rafFPS.toFixed(1)} | ` +
               `Render FPS: ${stats.renderFPS.toFixed(1)} | ` +
               `Effective: ${stats.effectiveFPS.toFixed(1)} | ` +
               `Render: ${stats.lastRenderTime.toFixed(2)}ms (avg: ${stats.movingAvgRenderTime.toFixed(2)}ms)`;
    }
}