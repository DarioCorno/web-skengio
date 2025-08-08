import { vec3, vec4, mat4 } from 'gl-matrix';
import * as ENGINE from '../ENGINE';
import { MaterialColor } from '../materials/Material';

export class Entity {
    public gl : WebGL2RenderingContext | null = null;
    public name : string = "";
    private _id : number = 0;   // ObjectId
    
    // Transform properties with dirty tracking
    private _position: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    private _rotation: vec3 = vec3.fromValues(0.0, 0.0, 0.0);
    private _scale: vec3 = vec3.fromValues(1.0, 1.0, 1.0);
    
    // Matrix caching system
    private _modelMatrix: mat4 = mat4.create();
    private _isDirty: boolean = true;
    
    // Static flag - when true, matrices will never be recalculated after initial calculation
    private _isStatic: boolean = false;
    private _hasInitialMatrix: boolean = false;

    public static EntityTypes = {
        Undefined: -1,
        Mesh: 0,
        Light: 1,
        Camera: 2,
        LightDebug: 3
    }

    public type : number = Entity.EntityTypes.Undefined;
    private debugMesh : ENGINE.Mesh | null = null;

    constructor(gl : WebGL2RenderingContext) {
        this.gl = gl;
    }

    /**
     * Set the entity ID
     * @param {number} id - The entity ID
     */
    public set id(id: number) {
        this._id = id;
    }

    /**
     * Get the entity ID
     * @returns {number} The entity ID
     */
    public get id() : number {
        return this._id;
    }

    /**
     * Get the position vector
     * @returns {vec3} The position vector
     */
    public get position(): vec3 {
        return this._position;
    }        
    
    /**
     * Set position using individual components
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate  
     * @param {number} z - Z coordinate
     */
    public setPosition(newPos: vec3): void {
        if (!this._isStatic && !vec3.exactEquals(this._position, newPos)) {
            vec3.copy(this._position, newPos);
            this.markDirty();
            
            if(this.debugMesh != null) {
                this.debugMesh.setPosition(newPos);
            }
        } else if (this._isStatic && !this._hasInitialMatrix) {
            vec3.copy(this._position, newPos);
            this.markDirty();
            
            if(this.debugMesh != null) {
                this.debugMesh.setPosition(newPos);
            }
        }
    }

    /**
     * Get the rotation vector
     * @returns {vec3} The rotation vector (in radians)
     */
    public get rotation(): vec3 {
        return this._rotation;
    }
    
    /**
     * Set rotation using individual components
     * @param {number} x - X rotation in radians
     * @param {number} y - Y rotation in radians
     * @param {number} z - Z rotation in radians
     */
    public setRotation(newRot: vec3): void {
        if (!this._isStatic && !vec3.exactEquals(this._rotation, newRot)) {
            vec3.copy(this._rotation, newRot);
            this.markDirty();
        } else if (this._isStatic && !this._hasInitialMatrix) {
            vec3.copy(this._rotation, newRot);
            this.markDirty();
        }
    }    

    /**
     * Get the scale vector
     * @returns {vec3} The scale vector
     */
    public get scale(): vec3 {
        return this._scale;
    }    
    
    /**
     * Set scale using individual components
     * @param {number} x - X scale factor
     * @param {number} y - Y scale factor
     * @param {number} z - Z scale factor
     */
    public setScale(newScale: vec3): void {
        if (!this._isStatic && !vec3.exactEquals(this._scale, newScale)) {
            vec3.copy(this._scale, newScale);
            this.markDirty();
        } else if (this._isStatic && !this._hasInitialMatrix) {
            vec3.copy(this._scale, newScale);
            this.markDirty();
        }
    }
    
    /**
     * Mark entity as static - its transform will never change after initial setup
     * @param {boolean} isStatic - True to mark as static, false for dynamic
     */
    public setStatic(isStatic: boolean): void {
        this._isStatic = isStatic;
        if (isStatic && this._isDirty) {
            // Force matrix calculation for static entities
            this.getModelMatrix();
        }
    }
    
    /**
     * Check if entity is static
     * @returns {boolean} True if entity is static
     */
    public isStatic(): boolean {
        return this._isStatic;
    }
    
    /**
     * Mark the entity transform as dirty, requiring matrix recalculation
     */
    protected markDirty(): void {
        if (!this._isStatic || !this._hasInitialMatrix) {
            this._isDirty = true;
        }
    }
    
    /**
     * Check if the entity's transform is dirty
     * @returns {boolean} True if transform needs recalculation
     */
    public isDirty(): boolean {
        return this._isDirty;
    }
    
    /**
     * Force mark entity as dirty (bypasses static check)
     * Use sparingly, only when absolutely necessary
     */
    public forceDirty(): void {
        this._isDirty = true;
        this._hasInitialMatrix = false;
    }
    
    /**
     * Update position without marking dirty (for internal use)
     * @param {vec3} position - The new position
     */
    protected setPositionInternal(position: vec3): void {
        vec3.copy(this._position, position);
    }
    
    /**
     * Update rotation without marking dirty (for internal use)
     * @param {vec3} rotation - The new rotation
     */
    protected setRotationInternal(rotation: vec3): void {
        vec3.copy(this._rotation, rotation);
    }
    
    /**
     * Update scale without marking dirty (for internal use)
     * @param {vec3} scale - The new scale
     */
    protected setScaleInternal(scale: vec3): void {
        vec3.copy(this._scale, scale);
    }
    
    /**
     * Translate the entity by a delta vector
     * @param {vec3} delta - The translation delta
     */
    public translate(delta: vec3): void {
        if (!this._isStatic) {
            vec3.add(this._position, this._position, delta);
            this.markDirty();
            
            if(this.debugMesh != null) {
                this.debugMesh.setPosition(this._position[0], this._position[1], this._position[2]);
            }
        }
    }
    
    /**
     * Rotate the entity by delta angles
     * @param {number} deltaX - Rotation around X axis (radians)
     * @param {number} deltaY - Rotation around Y axis (radians)
     * @param {number} deltaZ - Rotation around Z axis (radians)
     */
    public rotate(deltaX: number, deltaY: number, deltaZ: number): void {
        if (!this._isStatic) {
            this._rotation[0] += deltaX;
            this._rotation[1] += deltaY;
            this._rotation[2] += deltaZ;
            this.markDirty();
        }
    }
    
    /**
     * Scale the entity by factors
     * @param {number} scaleX - Scale factor for X axis
     * @param {number} scaleY - Scale factor for Y axis
     * @param {number} scaleZ - Scale factor for Z axis
     */
    public scaleBy(scaleX: number, scaleY: number, scaleZ: number): void {
        if (!this._isStatic) {
            this._scale[0] *= scaleX;
            this._scale[1] *= scaleY;
            this._scale[2] *= scaleZ;
            this.markDirty();
        }
    }

    /**
     * Get debug mesh for this entity
     * @param {WebGL2RenderingContext} gl - WebGL context
     * @returns {ENGINE.Mesh | null} Debug mesh or null
     */
    getDebugMesh(gl : WebGL2RenderingContext) {
        this.debugMesh = null;
        switch(this.type) {
            case Entity.EntityTypes.Light:
                const sData = ENGINE.Utils.GeometryGenerator.generateSphere(0.1, 8, 8);
                this.debugMesh = new ENGINE.Mesh(gl, sData);
                const light : ENGINE.Light = this as ENGINE.Light;
                const color = vec4.fromValues(light.color[0], light.color[1], light.color[2], 1.0)
                this.debugMesh.material = new MaterialColor( color );
                this.debugMesh.material.name = 'LightDebugMaterial';
                this.debugMesh.material.shininess = 0.0;
                this.debugMesh.setPosition(light.position[0], light.position[1], light.position[2]);
                this.debugMesh.setStatic(this._isStatic);
                this.debugMesh.type = Entity.EntityTypes.LightDebug;
                this.debugMesh.init();
                break;
        }

        if(this.debugMesh == null) throw new Error('Cannot create debug mesh for:' + this.name);
        return this.debugMesh;
    }

    /**
     * Computes and returns the model matrix for this entity using its position, rotation, and scale.
     * Uses caching to avoid recalculation when transform hasn't changed.
     * @returns {mat4} The model matrix
     */
    getModelMatrix(): mat4 {
        // If static and already calculated, return cached matrix
        if (this._isStatic && this._hasInitialMatrix && !this._isDirty) {
            return this._modelMatrix;
        }
        
        // Only recalculate if dirty
        if (this._isDirty) {
            mat4.identity(this._modelMatrix);
            mat4.translate(this._modelMatrix, this._modelMatrix, [this._position[0], this._position[1], this._position[2]]);
            mat4.rotateX(this._modelMatrix, this._modelMatrix, this._rotation[0]);
            mat4.rotateY(this._modelMatrix, this._modelMatrix, this._rotation[1]);
            mat4.rotateZ(this._modelMatrix, this._modelMatrix, this._rotation[2]);
            mat4.scale(this._modelMatrix, this._modelMatrix, [this._scale[0], this._scale[1], this._scale[2]]);
            
            // Mark as clean
            this._isDirty = false;
            
            // Mark that static entity has its initial matrix
            if (this._isStatic) {
                this._hasInitialMatrix = true;
            }
        }
        
        return this._modelMatrix;
    }
    
    /**
     * Get the cached model matrix without recalculation
     * Warning: May return outdated matrix if entity is dirty
     * @returns {mat4} The cached model matrix
     */
    getCachedModelMatrix(): mat4 {
        return this._modelMatrix;
    }
    
    /**
     * Clone the entity's transform properties
     * @param {Entity} target - Target entity to copy transform to
     */
    copyTransformTo(target: Entity): void {
        vec3.copy(target._position, this._position);
        vec3.copy(target._rotation, this._rotation);
        vec3.copy(target._scale, this._scale);
        target.markDirty();
    }
    
    /**
     * Reset transform to identity
     */
    resetTransform(): void {
        if (!this._isStatic) {
            vec3.set(this._position, 0, 0, 0);
            vec3.set(this._rotation, 0, 0, 0);
            vec3.set(this._scale, 1, 1, 1);
            this.markDirty();
        }
    }
    
    /**
     * Get debug information about the entity
     * @returns {Object} Debug information
     */
    getDebugInfo(): {
        name: string;
        id: number;
        type: number;
        isStatic: boolean;
        isDirty: boolean;
        hasInitialMatrix: boolean;
        position: vec3;
        rotation: vec3;
        scale: vec3;
    } {
        return {
            name: this.name,
            id: this._id,
            type: this.type,
            isStatic: this._isStatic,
            isDirty: this._isDirty,
            hasInitialMatrix: this._hasInitialMatrix,
            position: vec3.clone(this._position),
            rotation: vec3.clone(this._rotation),
            scale: vec3.clone(this._scale)
        };
    }
}