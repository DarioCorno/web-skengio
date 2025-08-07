// src/engine/rendering/passes/DepthPrepass.ts
import { Pass } from './Pass';
import depthVertexShader from '../../shaders/depth_prepass.vert.glsl?raw';
import depthFragmentShader from '../../shaders/depth_prepass.frag.glsl?raw';
import * as ENGINE from '../../ENGINE';
import { mat4 } from 'gl-matrix';
import { UniformLocationCache } from '../../utils/UniformLocationCache';

/**
 * DepthPrepass handles early Z-rejection by rendering geometry depth only
 * This improves performance by reducing overdraw in subsequent passes
 */
export class DepthPrepass extends Pass {
    private program: WebGLProgram | null = null;
    private uniformCache: UniformLocationCache;
    private depthTexture: WebGLTexture | null = null;
    private fbo: WebGLFramebuffer | null = null;
    
    /**
     * Creates a new DepthPrepass instance
     * @param {WebGL2RenderingContext} gl - The WebGL context
     * @param {number} width - Width of the depth buffer
     * @param {number} height - Height of the depth buffer
     */
    constructor(gl: WebGL2RenderingContext, width: number, height: number) {
        super(gl, width, height, 'DepthPrepass');
        
        // Get singleton instance of cache
        this.uniformCache = UniformLocationCache.getInstance();
        this.uniformCache.initialize(gl);
        
        this.init();
    }
    
    /**
     * Initialize the depth prepass shader and resources
     */
    init(): void {
        // Create shader program
        this.createShaderProgram();
        
        // Create depth texture and framebuffer
        this.createDepthResources();
    }
    
    /**
     * Create or recreate the shader program
     */
    private createShaderProgram(): void {
        // Create shader program
        this.program = ENGINE.Utils.ShadersUtility.createProgram(
            this.gl, 
            depthVertexShader, 
            depthFragmentShader
        );
        
        if (!this.program) {
            throw new Error('Failed to create depth prepass shader program');
        }
        
        // Pre-cache uniform locations
        this.uniformCache.getUniformLocations(this.program, [
            'uModelViewMatrix',
            'uProjectionMatrix'
        ]);
    }
    
    /**
     * Create depth texture and framebuffer
     */
    private createDepthResources(): void {
        const gl = this.gl;
        
        // Delete old resources if they exist
        if (this.depthTexture) {
            gl.deleteTexture(this.depthTexture);
            this.depthTexture = null;
        }
        
        if (this.fbo) {
            gl.deleteFramebuffer(this.fbo);
            this.fbo = null;
        }
        
        // Create depth texture
        this.depthTexture = gl.createTexture();
        if (!this.depthTexture) {
            throw new Error('Failed to create depth texture');
        }
        
        gl.bindTexture(gl.TEXTURE_2D, this.depthTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT32F, this.width, this.height);
        
        // Create framebuffer
        this.fbo = gl.createFramebuffer();
        if (!this.fbo) {
            throw new Error('Failed to create depth framebuffer');
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.depthTexture, 0);
        
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            throw new Error(`Depth framebuffer is incomplete: ${status}`);
        }
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }
    
    /**
     * Execute the depth prepass
     * @param {ENGINE.Scene} scene - The scene to render
     * @param {Object} inputTextures - Not used for depth prepass
     * @returns {Object} Object containing the depth texture
     */
    execute(scene: ENGINE.Scene, inputTextures?: any): { depthTexture: WebGLTexture | null } {
        if (!this.enabled || !this.program || !this.fbo) {
            return { depthTexture: null };
        }
        
        const gl = this.gl;
        
        // Bind depth framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
        gl.viewport(0, 0, this.width, this.height);
        
        // Clear depth buffer
        gl.clearDepth(1.0);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        
        // Configure render state
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LESS);
        gl.depthMask(true);
        gl.colorMask(false, false, false, false); // Disable color writes
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        
        // Use depth shader
        gl.useProgram(this.program);
        
        // Get camera matrices
        const camera = scene.getCamera();
        const viewMatrix = camera.getViewMatrix();
        const projectionMatrix = camera.getProjectionMatrix();
        
        // Set projection matrix (constant for all meshes)
        const projLocation = this.uniformCache.getUniformLocation(this.program, 'uProjectionMatrix');
        if (projLocation) {
            gl.uniformMatrix4fv(projLocation, false, projectionMatrix);
        }
        
        // Render all opaque meshes
        const meshes = scene.getMeshes();
        for (const mesh of meshes) {
            // Skip transparent meshes
            if (mesh.material && mesh.material.isTransparent) {
                continue;
            }
            
            // Calculate model-view matrix
            const modelMatrix = mesh.getModelMatrix();
            const modelViewMatrix = mat4.create();
            mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
            
            // Set model-view matrix
            const mvLocation = this.uniformCache.getUniformLocation(this.program, 'uModelViewMatrix');
            if (mvLocation) {
                gl.uniformMatrix4fv(mvLocation, false, modelViewMatrix);
            }
            
            // Bind vertex positions only
            const positionLoc = this.uniformCache.getAttribLocation(this.program, 'aPosition');
            if (mesh.positionsBuffer && positionLoc >= 0) {
                gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionsBuffer);
                gl.enableVertexAttribArray(positionLoc);
                gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
            }
            
            // Draw the mesh
            mesh.draw(gl);
            
            // Clean up
            if (positionLoc >= 0) {
                gl.disableVertexAttribArray(positionLoc);
            }
        }
        
        // Restore render state
        gl.colorMask(true, true, true, true);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        
        return { depthTexture: this.depthTexture };
    }
    
    /**
     * Execute depth prepass directly to a target framebuffer
     * @param {ENGINE.Scene} scene - The scene to render
     * @param {WebGLFramebuffer} targetFBO - Target framebuffer with depth attachment
     */
    executeToTarget(scene: ENGINE.Scene, targetFBO: WebGLFramebuffer): void {
        if (!this.enabled || !this.program) {
            console.error('DepthPrepass not properly initialized. Program:', this.program, 'Enabled:', this.enabled);
            return;
        }
        
        const gl = this.gl;
        
        // Bind target framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, targetFBO);
        gl.viewport(0, 0, this.width, this.height);
        
        // Configure render state
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LESS);
        gl.depthMask(true);
        gl.clear(gl.DEPTH_BUFFER_BIT);        
        gl.colorMask(false, false, false, false);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        
        // Use depth shader
        gl.useProgram(this.program);
        
        // Get camera matrices
        const camera = scene.getCamera();
        const viewMatrix = camera.getViewMatrix();
        const projectionMatrix = camera.getProjectionMatrix();
        
        // Set projection matrix
        const projLocation = this.uniformCache.getUniformLocation(this.program, 'uProjectionMatrix');
        if (projLocation) {
            gl.uniformMatrix4fv(projLocation, false, projectionMatrix);
        }
        
        // Render all opaque meshes
        const meshes = scene.getMeshes();
        for (const mesh of meshes) {
            if (mesh.material && mesh.material.isTransparent) {
                continue;
            }
            
            const modelMatrix = mesh.getModelMatrix();
            const modelViewMatrix = mat4.create();
            mat4.multiply(modelViewMatrix, viewMatrix, modelMatrix);
            
            const mvLocation = this.uniformCache.getUniformLocation(this.program, 'uModelViewMatrix');
            if (mvLocation) {
                gl.uniformMatrix4fv(mvLocation, false, modelViewMatrix);
            }
            
            const positionLoc = this.uniformCache.getAttribLocation(this.program, 'aPosition');
            if (mesh.positionsBuffer && positionLoc >= 0) {
                gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positionsBuffer);
                gl.enableVertexAttribArray(positionLoc);
                gl.vertexAttribPointer(positionLoc, 3, gl.FLOAT, false, 0, 0);
            }
            
            mesh.draw(gl);
            
            if (positionLoc >= 0) {
                gl.disableVertexAttribArray(positionLoc);
            }
        }
        
        // Restore state
        gl.colorMask(true, true, true, true);
    }
    
    /**
     * Get the shader program
     * @returns {WebGLProgram | null} The depth prepass shader program
     */
    getProgram(): WebGLProgram | null {
        return this.program;
    }
    
    /**
     * Get the depth texture
     * @returns {WebGLTexture | null} The depth texture
     */
    getDepthTexture(): WebGLTexture | null {
        return this.depthTexture;
    }
    
    /**
     * Resize the depth buffer
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resize(width: number, height: number): void {
        this.width = width;
        this.height = height;
        
        // Only recreate depth resources, not the shader program
        this.createDepthResources();
    }
    
    /**
     * Clean up resources
     */
    dispose(): void {
        const gl = this.gl;
        
        if (this.depthTexture) {
            gl.deleteTexture(this.depthTexture);
            this.depthTexture = null;
        }
        
        if (this.fbo) {
            gl.deleteFramebuffer(this.fbo);
            this.fbo = null;
        }
        
        if (this.program) {
            this.uniformCache.clearProgramCache(this.program);
            gl.deleteProgram(this.program);
            this.program = null;
        }
    }
    
    /**
     * Debug information
     */
    debugInfo(): void {
        super.debugInfo();
        console.log('Has depth texture:', !!this.depthTexture);
        console.log('Has framebuffer:', !!this.fbo);
        console.log('Has program:', !!this.program);
        console.log(`--- End ${this.name} Debug Info ---`);
    }
}