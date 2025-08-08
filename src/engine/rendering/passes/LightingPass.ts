// src/engine/rendering/passes/LightingPass.ts
import { Pass } from './Pass';
import vertexShaderSource from '../../shaders/deferredVertexShader.glsl?raw';
import fragmentShaderSource from '../../shaders/deferredFragmentShader.glsl?raw';
import * as ENGINE from '../../ENGINE';
import { UniformLocationCache } from '../../utils/UniformLocationCache';
import { mat4, vec3 } from 'gl-matrix';

/**
 * LightingPass performs deferred lighting calculations using G-buffer data
 * Optimized with dirty tracking to minimize uniform uploads
 */
export class LightingPass extends Pass {
    private program: WebGLProgram | null = null;
    private vao: WebGLVertexArrayObject | null = null;
    private uniformCache: UniformLocationCache;
    
    // Cache for light uniform locations
    private lightUniformLocations: Array<{
        uLightPosition: WebGLUniformLocation | null;
        uModelViewMatrix: WebGLUniformLocation | null;
        uLightColor: WebGLUniformLocation | null;
        uLightIntensity: WebGLUniformLocation | null;
    }> = [];
    
    private lastLightCount: number = -1;
    
    // Debug mode: 0 = final render, 1 = position, 2 = albedo, 3 = normal, 4 = objectData, 5 = alpha, 6 = depth
    public debugMode: number = 0;
    
    // Optimization: Track view matrix changes
    private lastViewMatrix: mat4 = mat4.create();
    private viewMatrixDirty: boolean = true;
    
    // Optimization: Track camera position changes
    private lastCameraPosition: vec3 = vec3.create();
    private cameraPositionDirty: boolean = true;
    
    // Statistics tracking
    private stats = {
        totalUniformUploads: 0,
        skippedUniformUploads: 0,
        frameCount: 0
    };
    
    /**
     * Creates a new LightingPass instance
     * @param {WebGL2RenderingContext} gl - The WebGL context
     * @param {number} width - Width of the viewport
     * @param {number} height - Height of the viewport
     */
    constructor(gl: WebGL2RenderingContext, width: number, height: number) {
        super(gl, width, height, 'LightingPass');
        
        // Get singleton instance of cache
        this.uniformCache = UniformLocationCache.getInstance();
        this.uniformCache.initialize(gl);
        
        this.init();
    }
    
    /**
     * Initialize the lighting pass
     */
    init(): void {
        // Create shader program
        this.program = ENGINE.Utils.ShadersUtility.createProgram(
            this.gl, 
            vertexShaderSource, 
            fragmentShaderSource
        );
        
        if (!this.program) {
            throw new Error('Failed to create lighting shader program');
        }
        
        // Pre-cache common uniform locations
        this.cacheCommonUniforms();
        
        // Create fullscreen quad VAO
        this.vao = this.createQuadVAO();
    }
    
    /**
     * Pre-cache common uniforms
     */
    private cacheCommonUniforms(): void {
        if (!this.program) return;
        
        this.uniformCache.getUniformLocations(this.program, [
            'uPosition',
            'uAlbedo',
            'uNormal',
            'uObjectData',
            'uViewMatrix',
            'uNearPlane',
            'uFarPlane',
            'uCameraPosition',
            'uDebugMode',
            'uNumLights'
        ]);
    }
    
    /**
     * Cache light uniform locations based on light count
     * @param {ENGINE.Light[]} lights - Array of lights in the scene
     */
    private cacheLightUniforms(lights: ENGINE.Light[]): void {
        const lightCount = lights.length;
        
        // Only update if light count changed
        if (this.lastLightCount === lightCount || !this.program) {
            return;
        }
        
        this.lastLightCount = lightCount;
        
        // Use centralized cache for structured uniforms
        this.lightUniformLocations = this.uniformCache.cacheStructuredUniforms(
            this.program,
            'uLights',
            ['uLightPosition', 'uModelViewMatrix', 'uLightColor', 'uLightIntensity'],
            lightCount
        );
        
        console.log(`Cached uniform locations for ${lightCount} lights`);
    }
    
    /**
     * Create a fullscreen quad VAO
     * @returns {WebGLVertexArrayObject | null} The quad VAO
     */
    private createQuadVAO(): WebGLVertexArrayObject | null {
        const gl = this.gl;
        
        if (!this.program) {
            throw new Error('Program not initialized');
        }
        
        // Fullscreen quad vertices (position and UV)
        const vertices = new Float32Array([
            // Position   // UV
            -1.0, -1.0,   0.0, 0.0,
             1.0, -1.0,   1.0, 0.0,
            -1.0,  1.0,   0.0, 1.0,
             1.0,  1.0,   1.0, 1.0,
        ]);
        
        const vao = gl.createVertexArray();
        const vbo = gl.createBuffer();
        
        if (!vao || !vbo) {
            throw new Error('Failed to create VAO or VBO for lighting pass');
        }
        
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        
        // Get attribute locations from cache
        const aPositionLoc = this.uniformCache.getAttribLocation(this.program, 'aPosition');
        const aUVLoc = this.uniformCache.getAttribLocation(this.program, 'aUV');
        
        // Enable position attribute
        if (aPositionLoc >= 0) {
            gl.enableVertexAttribArray(aPositionLoc);
            gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0);
        }
        
        // Enable UV attribute
        if (aUVLoc >= 0) {
            gl.enableVertexAttribArray(aUVLoc);
            gl.vertexAttribPointer(aUVLoc, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 2 * Float32Array.BYTES_PER_ELEMENT);
        }
        
        // Unbind
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        
        return vao;
    }
    
    /**
     * Set debug mode for visualization
     * @param {number} mode - Debug mode (0-6)
     */
    setDebugMode(mode: number): void {
        this.debugMode = mode;
    }
    
    /**
     * Check if view matrix has changed
     * @param {mat4} currentViewMatrix - Current view matrix
     * @returns {boolean} True if view matrix changed
     */
    private checkViewMatrixChanged(currentViewMatrix: mat4): boolean {
        if (!mat4.exactEquals(this.lastViewMatrix, currentViewMatrix)) {
            mat4.copy(this.lastViewMatrix, currentViewMatrix);
            this.viewMatrixDirty = true;
            return true;
        }
        this.viewMatrixDirty = false;
        return false;
    }
    
    /**
     * Check if camera position has changed
     * @param {vec3} currentPosition - Current camera position
     * @returns {boolean} True if position changed
     */
    private checkCameraPositionChanged(currentPosition: vec3): boolean {
        if (!vec3.exactEquals(this.lastCameraPosition, currentPosition)) {
            vec3.copy(this.lastCameraPosition, currentPosition);
            this.cameraPositionDirty = true;
            return true;
        }
        this.cameraPositionDirty = false;
        return false;
    }
    
    /**
     * Update light uniforms only when dirty
     * @param {ENGINE.Light[]} lights - Array of lights
     * @param {mat4} viewMatrix - Current view matrix
     */
    private updateLightUniforms(lights: ENGINE.Light[], viewMatrix: mat4): void {
        const gl = this.gl;
        
        for (let i = 0; i < lights.length && i < this.lightUniformLocations.length; i++) {
            const light = lights[i];
            const locations = this.lightUniformLocations[i];
            
            // Track if position needs update (either light moved or view changed)
            const positionNeedsUpdate = light.isPositionDirty() || this.viewMatrixDirty;
            
            // Update position only if needed

            // Update position only if needed
            if (locations.uLightPosition && positionNeedsUpdate) {
                // Send world-space position (shader will transform to view space)
                gl.uniform3fv(locations.uLightPosition, light.position);
                this.stats.totalUniformUploads++;
            } else {
                this.stats.skippedUniformUploads++;
            }
            
            // Update color only if dirty
            if (locations.uLightColor && light.isColorDirty()) {
                gl.uniform3fv(locations.uLightColor, light.color);
                this.stats.totalUniformUploads++;
            } else {
                this.stats.skippedUniformUploads++;
            }
            
            // Update intensity only if dirty
            if (locations.uLightIntensity && light.isIntensityDirty()) {
                gl.uniform1f(locations.uLightIntensity, light.intensity);
                this.stats.totalUniformUploads++;
            } else {
                this.stats.skippedUniformUploads++;
            }
        }
        
        // Clear dirty flags after updating
        for (let i = 0; i < lights.length; i++) {
            lights[i].clearAllDirty();
        }
    }
    
    /**
     * Execute the lighting pass
     * @param {ENGINE.Scene} scene - The scene with lights and camera
     * @param {Object} inputTextures - G-buffer textures from previous pass
     * @returns {void} Renders directly to screen
     */
    execute(scene: ENGINE.Scene, inputTextures?: { [key: string]: WebGLTexture }): void {
        if (!this.enabled || !this.program || !this.vao || !inputTextures) {
            return;
        }
        
        const gl = this.gl;
        const lights = scene.getLights();
        const camera = scene.getCamera();
        
        // Track frame for statistics
        this.stats.frameCount++;
        
        // Cache light uniforms if needed
        this.cacheLightUniforms(lights);
        
        // Check for view matrix changes
        const viewMatrix = camera.getViewMatrix();
        this.checkViewMatrixChanged(viewMatrix);
        
        // Check for camera position changes
        this.checkCameraPositionChanged(camera.position);
        
        // Configure stencil test to only render where geometry exists
        gl.enable(gl.STENCIL_TEST);
        gl.stencilFunc(gl.EQUAL, 1, 0xFF); // Only render pixels with stencil value of 1
        gl.stencilMask(0x00); // Don't write to stencil buffer
        
        // Use lighting shader
        gl.useProgram(this.program);
        
        // Bind fullscreen quad VAO
        gl.bindVertexArray(this.vao);
        
        // Bind G-buffer textures
        const textureBindings = [
            { uniformName: 'uPosition', textureKey: 'position', unit: 0 },
            { uniformName: 'uAlbedo', textureKey: 'albedo', unit: 1 },
            { uniformName: 'uNormal', textureKey: 'normal', unit: 2 },
            { uniformName: 'uObjectData', textureKey: 'objdata', unit: 3 }
        ];
        
        for (const binding of textureBindings) {
            if (inputTextures[binding.textureKey]) {
                gl.activeTexture(gl.TEXTURE0 + binding.unit);
                gl.bindTexture(gl.TEXTURE_2D, inputTextures[binding.textureKey]);
                
                const location = this.uniformCache.getUniformLocation(this.program, binding.uniformName);
                if (location) {
                    gl.uniform1i(location, binding.unit);
                }
            } else {
                console.warn(`Missing G-buffer texture: ${binding.textureKey}`);
            }
        }
        
        // Update camera uniforms only if changed
        const nearPlaneLocation = this.uniformCache.getUniformLocation(this.program, 'uNearPlane');
        if (nearPlaneLocation && camera.isProjectionMatrixDirty()) {
            gl.uniform1f(nearPlaneLocation, camera.near);
        }
        
        const farPlaneLocation = this.uniformCache.getUniformLocation(this.program, 'uFarPlane');
        if (farPlaneLocation && camera.isProjectionMatrixDirty()) {
            gl.uniform1f(farPlaneLocation, camera.far);
        }
        
        const viewMatrixLocation = this.uniformCache.getUniformLocation(this.program, 'uViewMatrix');
        if (viewMatrixLocation && this.viewMatrixDirty) {
            gl.uniformMatrix4fv(viewMatrixLocation, false, viewMatrix);
        }
        
        const cameraPosLocation = this.uniformCache.getUniformLocation(this.program, 'uCameraPosition');
        if (cameraPosLocation && this.cameraPositionDirty) {
            gl.uniform3fv(cameraPosLocation, camera.position);
        }
        
        // Set light count (always update as it's cheap)
        const numLightsLocation = this.uniformCache.getUniformLocation(this.program, 'uNumLights');
        if (numLightsLocation) {
            gl.uniform1i(numLightsLocation, lights.length);
        }
        
        // Update light uniforms with dirty tracking
        this.updateLightUniforms(lights, viewMatrix);
        
        // Set debug mode
        const debugModeLocation = this.uniformCache.getUniformLocation(this.program, 'uDebugMode');
        if (debugModeLocation) {
            gl.uniform1i(debugModeLocation, this.debugMode);
        }
        
        // Configure render state
        gl.depthMask(false); // Don't write to depth
        gl.disable(gl.DEPTH_TEST); // Don't test depth
        gl.clear(gl.COLOR_BUFFER_BIT); // Clear color buffer
        
        // Draw fullscreen quad
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        
        // Cleanup
        gl.bindVertexArray(null);
        
        // Restore render state
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.disable(gl.STENCIL_TEST);
        
        // Log statistics periodically
        if (this.stats.frameCount % 300 === 0) {
            const uploadRate = (this.stats.totalUniformUploads / 
                               (this.stats.totalUniformUploads + this.stats.skippedUniformUploads)) * 100;
            console.log(`LightingPass Optimization Stats (last 300 frames):`);
            console.log(`  Uniform uploads: ${this.stats.totalUniformUploads}`);
            console.log(`  Skipped uploads: ${this.stats.skippedUniformUploads}`);
            console.log(`  Upload rate: ${uploadRate.toFixed(1)}%`);
            console.log(`  Savings: ${(100 - uploadRate).toFixed(1)}% fewer uploads`);
            
            // Reset stats
            this.stats.totalUniformUploads = 0;
            this.stats.skippedUniformUploads = 0;
        }
    }
    
    /**
     * Force all lights to be marked as dirty
     * Useful when switching scenes or after major changes
     */
    public forceAllLightsDirty(scene: ENGINE.Scene): void {
        const lights = scene.getLights();
        for (const light of lights) {
            light.forceAllDirty();
        }
        this.viewMatrixDirty = true;
        this.cameraPositionDirty = true;
    }
    
    /**
     * Resize the lighting pass (viewport size)
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resize(width: number, height: number): void {
        this.width = width;
        this.height = height;
        // Lighting pass doesn't have its own buffers to resize
        // but we should mark view matrix as dirty on resize
        this.viewMatrixDirty = true;
    }
    
    /**
     * Clean up resources
     */
    dispose(): void {
        const gl = this.gl;
        
        if (this.vao) {
            gl.deleteVertexArray(this.vao);
            this.vao = null;
        }
        
        if (this.program) {
            this.uniformCache.clearProgramCache(this.program);
            gl.deleteProgram(this.program);
            this.program = null;
        }
        
        this.lightUniformLocations = [];
        this.lastLightCount = -1;
    }
    
    /**
     * Get optimization statistics
     * @returns {Object} Current optimization stats
     */
    getOptimizationStats(): {
        frameCount: number;
        totalUniformUploads: number;
        skippedUniformUploads: number;
        uploadRate: number;
        savingsPercentage: number;
    } {
        const total = this.stats.totalUniformUploads + this.stats.skippedUniformUploads;
        const uploadRate = total > 0 ? (this.stats.totalUniformUploads / total) * 100 : 0;
        
        return {
            frameCount: this.stats.frameCount,
            totalUniformUploads: this.stats.totalUniformUploads,
            skippedUniformUploads: this.stats.skippedUniformUploads,
            uploadRate: uploadRate,
            savingsPercentage: 100 - uploadRate
        };
    }
    
    /**
     * Debug information
     */
    debugInfo(): void {
        super.debugInfo();
        console.log('Debug mode:', this.debugMode);
        console.log('Has VAO:', !!this.vao);
        console.log('Has program:', !!this.program);
        console.log('Cached light count:', this.lastLightCount);
        console.log('View matrix dirty:', this.viewMatrixDirty);
        console.log('Camera position dirty:', this.cameraPositionDirty);
        console.log('Optimization stats:', this.getOptimizationStats());
        console.log(`--- End ${this.name} Debug Info ---`);
    }
}