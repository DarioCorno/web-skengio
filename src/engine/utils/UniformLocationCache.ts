// src/engine/utils/UniformLocationCache.ts

/**
 * Centralized uniform location cache manager for WebGL programs.
 * Caches uniform and attribute locations to avoid repeated GL queries.
 * Supports multiple programs and automatic cache invalidation.
 */
export class UniformLocationCache {
    private static instance: UniformLocationCache | null = null;
    
    // Cache structure: Map<programId, Map<uniformName, location>>
    private uniformCache: Map<WebGLProgram, Map<string, WebGLUniformLocation | null>> = new Map();
    private attributeCache: Map<WebGLProgram, Map<string, number>> = new Map();
    
    // Track program usage for potential cleanup
    private programUsageCount: Map<WebGLProgram, number> = new Map();
    
    private gl: WebGL2RenderingContext | null = null;

    /**
     * Private constructor for singleton pattern
     */
    private constructor() {}

    /**
     * Get singleton instance of UniformLocationCache
     * @returns {UniformLocationCache} The singleton instance
     */
    static getInstance(): UniformLocationCache {
        if (!UniformLocationCache.instance) {
            UniformLocationCache.instance = new UniformLocationCache();
        }
        return UniformLocationCache.instance;
    }

    /**
     * Initialize the cache with WebGL context
     * @param {WebGL2RenderingContext} gl - The WebGL context
     */
    initialize(gl: WebGL2RenderingContext): void {
        this.gl = gl;
    }

    /**
     * Get a uniform location from cache or query and cache it
     * @param {WebGLProgram} program - The shader program
     * @param {string} uniformName - Name of the uniform
     * @returns {WebGLUniformLocation | null} The uniform location
     */
    getUniformLocation(program: WebGLProgram, uniformName: string): WebGLUniformLocation | null {
        if (!this.gl) {
            throw new Error('UniformLocationCache not initialized. Call initialize() first.');
        }

        // Get or create program cache
        let programCache = this.uniformCache.get(program);
        if (!programCache) {
            programCache = new Map();
            this.uniformCache.set(program, programCache);
            this.incrementProgramUsage(program);
        }

        // Check if location is already cached
        if (programCache.has(uniformName)) {
            return programCache.get(uniformName)!;
        }

        // Query and cache the location
        const location = this.gl.getUniformLocation(program, uniformName);
        programCache.set(uniformName, location);
        
        return location;
    }

    /**
     * Get multiple uniform locations at once
     * @param {WebGLProgram} program - The shader program
     * @param {string[]} uniformNames - Array of uniform names
     * @returns {Map<string, WebGLUniformLocation | null>} Map of uniform names to locations
     */
    getUniformLocations(program: WebGLProgram, uniformNames: string[]): Map<string, WebGLUniformLocation | null> {
        const locations = new Map<string, WebGLUniformLocation | null>();
        
        for (const name of uniformNames) {
            locations.set(name, this.getUniformLocation(program, name));
        }
        
        return locations;
    }

    /**
     * Get an attribute location from cache or query and cache it
     * @param {WebGLProgram} program - The shader program
     * @param {string} attributeName - Name of the attribute
     * @returns {number} The attribute location (-1 if not found)
     */
    getAttribLocation(program: WebGLProgram, attributeName: string): number {
        if (!this.gl) {
            throw new Error('UniformLocationCache not initialized. Call initialize() first.');
        }

        // Get or create program cache
        let programCache = this.attributeCache.get(program);
        if (!programCache) {
            programCache = new Map();
            this.attributeCache.set(program, programCache);
            this.incrementProgramUsage(program);
        }

        // Check if location is already cached
        if (programCache.has(attributeName)) {
            return programCache.get(attributeName)!;
        }

        // Query and cache the location
        const location = this.gl.getAttribLocation(program, attributeName);
        programCache.set(attributeName, location);
        
        return location;
    }

    /**
     * Get multiple attribute locations at once
     * @param {WebGLProgram} program - The shader program
     * @param {string[]} attributeNames - Array of attribute names
     * @returns {Map<string, number>} Map of attribute names to locations
     */
    getAttribLocations(program: WebGLProgram, attributeNames: string[]): Map<string, number> {
        const locations = new Map<string, number>();
        
        for (const name of attributeNames) {
            locations.set(name, this.getAttribLocation(program, name));
        }
        
        return locations;
    }

    /**
     * Cache structured uniform locations (for arrays/structs like lights)
     * @param {WebGLProgram} program - The shader program
     * @param {string} baseName - Base name of the uniform array/struct
     * @param {string[]} properties - Property names
     * @param {number} count - Number of array elements
     * @returns {Array} Array of objects with cached locations for each property
     */
    cacheStructuredUniforms(
        program: WebGLProgram, 
        baseName: string, 
        properties: string[], 
        count: number
    ): Array<{[key: string]: WebGLUniformLocation | null}> {
        const locations: Array<{[key: string]: WebGLUniformLocation | null}> = [];
        
        for (let i = 0; i < count; i++) {
            const elementLocations: {[key: string]: WebGLUniformLocation | null} = {};
            
            for (const prop of properties) {
                const uniformName = `${baseName}[${i}].${prop}`;
                elementLocations[prop] = this.getUniformLocation(program, uniformName);
            }
            
            locations.push(elementLocations);
        }
        
        return locations;
    }

    /**
     * Clear cache for a specific program
     * @param {WebGLProgram} program - The program to clear from cache
     */
    clearProgramCache(program: WebGLProgram): void {
        this.uniformCache.delete(program);
        this.attributeCache.delete(program);
        this.programUsageCount.delete(program);
    }

    /**
     * Clear all cached locations
     */
    clearAllCaches(): void {
        this.uniformCache.clear();
        this.attributeCache.clear();
        this.programUsageCount.clear();
    }

    /**
     * Check if a program has cached locations
     * @param {WebGLProgram} program - The program to check
     * @returns {boolean} True if program has cached locations
     */
    hasProgramCache(program: WebGLProgram): boolean {
        return this.uniformCache.has(program) || this.attributeCache.has(program);
    }

    /**
     * Get statistics about cache usage
     * @returns {Object} Cache statistics
     */
    getStatistics(): {
        programCount: number;
        totalUniformsCached: number;
        totalAttributesCached: number;
        programStats: Array<{
            program: WebGLProgram;
            uniformCount: number;
            attributeCount: number;
            usageCount: number;
        }>;
    } {
        const programStats: Array<{
            program: WebGLProgram;
            uniformCount: number;
            attributeCount: number;
            usageCount: number;
        }> = [];

        let totalUniforms = 0;
        let totalAttributes = 0;

        // Collect stats for each program
        const programs = new Set([...this.uniformCache.keys(), ...this.attributeCache.keys()]);
        
        for (const program of programs) {
            const uniformCount = this.uniformCache.get(program)?.size || 0;
            const attributeCount = this.attributeCache.get(program)?.size || 0;
            const usageCount = this.programUsageCount.get(program) || 0;
            
            totalUniforms += uniformCount;
            totalAttributes += attributeCount;
            
            programStats.push({
                program,
                uniformCount,
                attributeCount,
                usageCount
            });
        }

        return {
            programCount: programs.size,
            totalUniformsCached: totalUniforms,
            totalAttributesCached: totalAttributes,
            programStats
        };
    }

    /**
     * Increment usage count for a program
     * @param {WebGLProgram} program - The program being used
     */
    private incrementProgramUsage(program: WebGLProgram): void {
        const current = this.programUsageCount.get(program) || 0;
        this.programUsageCount.set(program, current + 1);
    }

    /**
     * Clean up least recently used programs if cache gets too large
     * @param {number} maxPrograms - Maximum number of programs to keep cached
     */
    cleanupLRU(maxPrograms: number = 10): void {
        if (this.programUsageCount.size <= maxPrograms) {
            return;
        }

        // Sort programs by usage count
        const sortedPrograms = Array.from(this.programUsageCount.entries())
            .sort((a, b) => a[1] - b[1]);

        // Remove least used programs
        const programsToRemove = sortedPrograms.slice(0, sortedPrograms.length - maxPrograms);
        
        for (const [program] of programsToRemove) {
            this.clearProgramCache(program);
        }
    }

    /**
     * Debug helper to print cache contents
     */
    debugPrintCache(): void {
        console.log('=== UniformLocationCache Debug Info ===');
        console.log('GL Context:', this.gl ? 'Initialized' : 'Not initialized');
        
        const stats = this.getStatistics();
        console.log(`Programs cached: ${stats.programCount}`);
        console.log(`Total uniforms cached: ${stats.totalUniformsCached}`);
        console.log(`Total attributes cached: ${stats.totalAttributesCached}`);
        
        for (const stat of stats.programStats) {
            console.log(`Program: ${stat.program}`);
            console.log(`  - Uniforms: ${stat.uniformCount}`);
            console.log(`  - Attributes: ${stat.attributeCount}`);
            console.log(`  - Usage count: ${stat.usageCount}`);
            
            // Print uniform names if available
            const uniformCache = this.uniformCache.get(stat.program);
            if (uniformCache) {
                console.log('  - Cached uniforms:', Array.from(uniformCache.keys()));
            }
            
            // Print attribute names if available
            const attrCache = this.attributeCache.get(stat.program);
            if (attrCache) {
                console.log('  - Cached attributes:', Array.from(attrCache.keys()));
            }
        }
        
        console.log('=== End Cache Debug Info ===');
    }
}