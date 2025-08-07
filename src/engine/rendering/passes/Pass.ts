// src/engine/rendering/passes/Pass.ts
import * as ENGINE from '../../ENGINE';

/**
 * Abstract base class for all rendering passes
 * Provides common interface and functionality for different rendering stages
 */
export abstract class Pass {
    protected gl: WebGL2RenderingContext;
    protected width: number;
    protected height: number;
    protected enabled: boolean = true;
    protected name: string;

    /**
     * Creates a new Pass instance
     * @param {WebGL2RenderingContext} gl - The WebGL context
     * @param {number} width - Width of the render target
     * @param {number} height - Height of the render target
     * @param {string} name - Name of the pass for debugging
     */
    constructor(gl: WebGL2RenderingContext, width: number, height: number, name: string) {
        this.gl = gl;
        this.width = width;
        this.height = height;
        this.name = name;
    }

    /**
     * Initialize the pass (create shaders, buffers, etc.)
     */
    abstract init(): void;

    /**
     * Execute the rendering pass
     * @param {ENGINE.Scene} scene - The scene to render
     * @param {Object} inputTextures - Input textures from previous passes
     * @returns {Object} Output textures/data from this pass
     */
    abstract execute(scene: ENGINE.Scene, inputTextures?: any): any;

    /**
     * Resize the pass render targets
     * @param {number} width - New width
     * @param {number} height - New height
     */
    abstract resize(width: number, height: number): void;

    /**
     * Clean up resources
     */
    abstract dispose(): void;

    /**
     * Enable or disable the pass
     * @param {boolean} enabled - Whether the pass should be executed
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /**
     * Check if the pass is enabled
     * @returns {boolean} True if the pass is enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Get the name of the pass
     * @returns {string} The pass name
     */
    getName(): string {
        return this.name;
    }

    /**
     * Debug information
     */
    debugInfo(): void {
        console.log(`--- ${this.name} Debug Info ---`);
        console.log(`Dimensions: ${this.width} x ${this.height}`);
        console.log(`Enabled: ${this.enabled}`);
    }
}