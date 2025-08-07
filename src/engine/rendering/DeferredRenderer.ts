// src/engine/rendering/DeferredRenderer.ts
import * as ENGINE from '../ENGINE';
import { DepthPrepass } from './passes/DepthPrepass';
import { GBufferPass } from './passes/GBufferpass';
import { LightingPass } from './passes/LightingPass';

/**
 * DeferredRenderer manages the deferred rendering pipeline
 * Orchestrates multiple rendering passes to produce the final image
 */
export class DeferredRenderer extends ENGINE.Renderer {
    private width: number;
    private height: number;
    
    // Rendering passes
    private depthPrepass: DepthPrepass;
    private gbufferPass: GBufferPass;
    private lightingPass: LightingPass;
    
    /**
     * Creates a new DeferredRenderer instance
     * @param {WebGL2RenderingContext} gl - The WebGL context
     * @param {number} width - Viewport width
     * @param {number} height - Viewport height
     */
    constructor(gl: WebGL2RenderingContext, width: number, height: number) {
        super(gl);
        this.gl = gl;
        this.width = width;
        this.height = height;
        
        // Initialize rendering passes
        this.depthPrepass = new DepthPrepass(gl, width, height);
        this.gbufferPass = new GBufferPass(gl, width, height);
        this.lightingPass = new LightingPass(gl, width, height);
        
        this.init();
    }
    
    /**
     * Initialize the renderer
     */
    init(): void {
        // Passes are already initialized in their constructors
        console.log('DeferredRenderer initialized with pass system');
    }
        
    /**
     * Set debug mode for visualization
     * @param {number} mode - Debug mode (0-6)
     */
    setDebugMode(mode: number = 0): void {
        this.lightingPass.setDebugMode(mode);
    }
    
    /**
     * Resize the renderer and all passes
     * @param {number} width - New width
     * @param {number} height - New height
     */
    setSize(width: number, height: number): void {
        if (!this.gl) return;
        
        console.log(`Renderer resize: ${width} x ${height}`);
        
        this.width = width;
        this.height = height;
        
        // Set viewport
        this.gl.viewport(0, 0, width, height);
        
        // Resize all passes
        this.depthPrepass.resize(width, height);
        this.gbufferPass.resize(width, height);
        this.lightingPass.resize(width, height);
    }
    
    /**
     * Render the scene using deferred rendering pipeline
     * @param {ENGINE.Scene} scene - The scene to render
     */
    public render(scene: ENGINE.Scene): void {
        const gl = this.gl;
        
        // Get G-buffer framebuffer
        const gbufferFBO = this.gbufferPass.getFramebuffer();
        
        if (!gbufferFBO) {
            console.error('G-buffer framebuffer not available');
            return;
        }
        
        // Execute depth prepass

        // Bind G-buffer framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, gbufferFBO);
                
        // Execute depth prepass directly to G-buffer's depth attachment
        this.depthPrepass.executeToTarget(scene, gbufferFBO);
        
        // Unbind framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        // Execute G-buffer pass
        const gbufferTextures = this.gbufferPass.execute(scene);
        
        // Execute lighting pass (renders to screen)
        this.lightingPass.execute(scene, gbufferTextures);
    }
    
    /**
     * Get a specific rendering pass
     * @param {string} name - Name of the pass
     * @returns {Pass | null} The requested pass
     */
    getPass(name: string): any {
        switch (name.toLowerCase()) {
            case 'depth':
            case 'depthprepass':
                return this.depthPrepass;
            case 'gbuffer':
            case 'gbufferpass':
                return this.gbufferPass;
            case 'lighting':
            case 'lightingpass':
                return this.lightingPass;
            default:
                return null;
        }
    }
    
    /**
     * Get G-buffer textures for external use
     * @returns {Object} The G-buffer textures
     */
    getGBufferTextures(): { [key: string]: WebGLTexture } {
        return this.gbufferPass.getTextures();
    }
    
    /**
     * Clean up all resources
     */
    dispose(): void {
        this.depthPrepass.dispose();
        this.gbufferPass.dispose();
        this.lightingPass.dispose();
    }
    
    /**
     * Debug information
     */
    debugInfo(): void {
        console.log('--- DeferredRenderer Debug Info ---');
        console.log(`Dimensions: ${this.width} x ${this.height}`);
        console.log('Passes:');
        
        this.depthPrepass.debugInfo();
        this.gbufferPass.debugInfo();
        this.lightingPass.debugInfo();
        
        console.log('--- End DeferredRenderer Debug Info ---');
    }
}