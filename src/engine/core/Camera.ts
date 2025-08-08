// src/engine/Camera.ts
import { mat4, vec3 } from 'gl-matrix';
import { Entity } from './Entity';

export class Camera extends Entity {
  public name : string = "";
  
  // Camera-specific properties
  private _target: vec3 = vec3.create();
  
  // Projection settings
  private _fieldOfView: number; // in degrees
  private _aspect: number;
  private _near: number;
  private _far: number;
  
  // Matrix caching for camera-specific matrices
  private _viewMatrix: mat4 = mat4.create();
  private _projectionMatrix: mat4 = mat4.create();
  private _viewMatrixDirty: boolean = true;
  private _projectionMatrixDirty: boolean = true;
  
  // Combined matrix caching
  private _viewProjectionMatrix: mat4 = mat4.create();
  private _viewProjectionMatrixDirty: boolean = true;

  constructor(gl: WebGL2RenderingContext, fieldOfView = 45, near = 0.1, far = 100) {
    super(gl);
    this._fieldOfView = fieldOfView;
    this._aspect = 1;
    this._near = near;
    this._far = far;
    this.type = Entity.EntityTypes.Camera;
  }
  
  /**
   * Get the target position
   * @returns {vec3} The target position
   */
  public get target(): vec3 {
    return this._target;
  }
  
  /**
   * Set the target position and mark view matrix as dirty
   * @param {vec3} target - The new target position
   */
  public set target(target: vec3) {
    if (!vec3.exactEquals(this._target, target)) {
      vec3.copy(this._target, target);
      this.markViewMatrixDirty();
    }
  }
  
  /**
   * Get the field of view
   * @returns {number} The field of view in degrees
   */
  public get fieldOfView(): number {
    return this._fieldOfView;
  }
  
  /**
   * Set the field of view and mark projection matrix as dirty
   * @param {number} fov - The new field of view in degrees
   */
  public set fieldOfView(fov: number) {
    if (this._fieldOfView !== fov) {
      this._fieldOfView = fov;
      this.markProjectionMatrixDirty();
    }
  }
  
  /**
   * Get the aspect ratio
   * @returns {number} The aspect ratio
   */
  public get aspect(): number {
    return this._aspect;
  }
  
  /**
   * Set the aspect ratio and mark projection matrix as dirty
   * @param {number} aspect - The new aspect ratio
   */
  public set aspect(aspect: number) {
    if (this._aspect !== aspect) {
      this._aspect = aspect;
      this.markProjectionMatrixDirty();
    }
  }
  
  /**
   * Get the near plane distance
   * @returns {number} The near plane distance
   */
  public get near(): number {
    return this._near;
  }
  
  /**
   * Set the near plane distance and mark projection matrix as dirty
   * @param {number} near - The new near plane distance
   */
  public set near(near: number) {
    if (this._near !== near) {
      this._near = near;
      this.markProjectionMatrixDirty();
    }
  }
  
  /**
   * Get the far plane distance
   * @returns {number} The far plane distance
   */
  public get far(): number {
    return this._far;
  }
  
  /**
   * Set the far plane distance and mark projection matrix as dirty
   * @param {number} far - The new far plane distance
   */
  public set far(far: number) {
    if (this._far !== far) {
      this._far = far;
      this.markProjectionMatrixDirty();
    }
  }
  
  /**
   * Override Entity's markDirty to also mark view matrix as dirty
   */
  protected markDirty(): void {
    super.markDirty();
    this.markViewMatrixDirty();
  }
  
  /**
   * Mark the view matrix as dirty
   */
  private markViewMatrixDirty(): void {
    this._viewMatrixDirty = true;
    this._viewProjectionMatrixDirty = true;
  }
  
  /**
   * Mark the projection matrix as dirty
   */
  private markProjectionMatrixDirty(): void {
    this._projectionMatrixDirty = true;
    this._viewProjectionMatrixDirty = true;
  }
  
  /**
   * Check if view matrix needs recalculation
   * @returns {boolean} True if view matrix is dirty
   */
  public isViewMatrixDirty(): boolean {
    return this._viewMatrixDirty;
  }
  
  /**
   * Check if projection matrix needs recalculation
   * @returns {boolean} True if projection matrix is dirty
   */
  public isProjectionMatrixDirty(): boolean {
    return this._projectionMatrixDirty;
  }

  /**
   * Get the projection matrix for this camera (cached)
   * @returns {mat4} The projection matrix
   */
  getProjectionMatrix(): mat4 {
    if (this._projectionMatrixDirty) {
      // Convert FOV to radians
      const fovRad = (this._fieldOfView * Math.PI) / 180;
      mat4.perspective(this._projectionMatrix, fovRad, this._aspect, this._near, this._far);
      this._projectionMatrixDirty = false;
    }
    return this._projectionMatrix;
  }

  /**
   * Get the view matrix for this camera (cached)
   * @returns {mat4} The view matrix
   */
  getViewMatrix(): mat4 {
    if (this._viewMatrixDirty) {
      mat4.lookAt(this._viewMatrix, this.position, this._target, vec3.fromValues(0, 1, 0));
      this._viewMatrixDirty = false;
    }
    return this._viewMatrix;
  }
  
  /**
   * Get the combined view-projection matrix (cached)
   * @returns {mat4} The view-projection matrix
   */
  getViewProjectionMatrix(): mat4 {
    if (this._viewProjectionMatrixDirty) {
      const view = this.getViewMatrix();
      const proj = this.getProjectionMatrix();
      mat4.multiply(this._viewProjectionMatrix, proj, view);
      this._viewProjectionMatrixDirty = false;
    }
    return this._viewProjectionMatrix;
  }
  
  /**
   * Get cached matrices without recalculation
   * Warning: May return outdated matrices if dirty flags are set
   * @returns {Object} Object containing cached matrices
   */
  getCachedMatrices(): {
    view: mat4;
    projection: mat4;
    viewProjection: mat4;
  } {
    return {
      view: this._viewMatrix,
      projection: this._projectionMatrix,
      viewProjection: this._viewProjectionMatrix
    };
  }

  /**
   * Handle canvas resize
   * @param {number} width - New canvas width
   * @param {number} height - New canvas height
   */
  handleResize(width: number, height: number): void {
    this.aspect = width / height;
  }

  /**
   * Get the camera's forward vector (from camera to target)
   * @returns {vec3} Normalized forward vector
   */
  getForwardVector(): vec3 {
    const forward = vec3.create();
    vec3.subtract(forward, this._target, this.position);
    vec3.normalize(forward, forward);
    return forward;
  }

  /**
   * Get the camera's right vector
   * @param {vec3} worldUp - Optional world up vector (defaults to Y-up)
   * @returns {vec3} Normalized right vector
   */
  getRightVector(worldUp: vec3 = vec3.fromValues(0, 1, 0)): vec3 {
    const forward = this.getForwardVector();
    const right = vec3.create();
    vec3.cross(right, forward, worldUp);
    vec3.normalize(right, right);
    return right;
  }

  /**
   * Get the camera's up vector
   * @param {vec3} worldUp - Optional world up vector (defaults to Y-up)
   * @returns {vec3} Normalized up vector
   */
  getUpVector(worldUp: vec3 = vec3.fromValues(0, 1, 0)): vec3 {
    const forward = this.getForwardVector();
    const right = this.getRightVector(worldUp);
    const up = vec3.create();
    vec3.cross(up, right, forward);
    vec3.normalize(up, up);
    return up;
  }

  /**
   * Get the camera's left vector (negative right)
   * @param {vec3} worldUp - Optional world up vector (defaults to Y-up)
   * @returns {vec3} Normalized left vector
   */
  getLeftVector(worldUp: vec3 = vec3.fromValues(0, 1, 0)): vec3 {
    const right = this.getRightVector(worldUp);
    const left = vec3.create();
    vec3.negate(left, right);
    return left;
  }

  /**
   * Get the camera's backward vector (negative forward)
   * @returns {vec3} Normalized backward vector
   */
  getBackwardVector(): vec3 {
    const forward = this.getForwardVector();
    const backward = vec3.create();
    vec3.negate(backward, forward);
    return backward;
  }

  /**
   * Get the distance from camera to target
   * @returns {number} Distance to target
   */
  getDistanceToTarget(): number {
    return vec3.distance(this.position, this._target);
  }

  /**
   * Set the distance from camera to target while maintaining direction
   * @param {number} distance - New distance to target
   */
  setDistanceToTarget(distance: number): void {
    const direction = vec3.create();
    vec3.subtract(direction, this.position, this._target);
    vec3.normalize(direction, direction);
    vec3.scaleAndAdd(this.position, this._target, direction, distance);
    this.markDirty();
  }

  /**
   * Look at a specific point from current position
   * @param {vec3} target - Point to look at
   * @param {vec3} worldUp - Optional world up vector (defaults to Y-up)
   */
  lookAt(target: vec3, worldUp: vec3 = vec3.fromValues(0, 1, 0)): void {
    this.target = target;
  }

  /**
   * Set both camera position and target
   * @param {vec3} position - New camera position
   * @param {vec3} target - New target position
   */
  setPositionAndTarget(position: vec3, target: vec3): void {
    // Set position through Entity setter
    this.setPosition(position);
    // Set target through Camera setter
    this.target = target;
  }

  /**
   * Move the camera and target by a delta
   * @param {vec3} delta - Movement delta
   */
  translate(delta: vec3): void {
    // Use parent translate for position
    super.translate(delta);
    // Update target
    vec3.add(this._target, this._target, delta);
    this.markViewMatrixDirty();
  }

  /**
   * Move the camera position only (changes view direction)
   * @param {vec3} delta - Movement delta
   */
  translatePosition(delta: vec3): void {
    super.translate(delta);
  }

  /**
   * Move the target only (changes view direction)
   * @param {vec3} delta - Movement delta
   */
  translateTarget(delta: vec3): void {
    vec3.add(this._target, this._target, delta);
    this.markViewMatrixDirty();
  }

  /**
   * Orbit the camera around the target
   * @param {number} azimuth - Horizontal rotation in radians
   * @param {number} elevation - Vertical rotation in radians
   * @param {vec3} worldUp - Optional world up vector (defaults to Y-up)
   */
  orbit(azimuth: number, elevation: number, worldUp: vec3 = vec3.fromValues(0, 1, 0)): void {
    const offset = vec3.create();
    vec3.subtract(offset, this.position, this._target);
    
    // Convert to spherical coordinates
    const radius = vec3.length(offset);
    let theta = Math.atan2(offset[0], offset[2]);
    let phi = Math.acos(Math.max(-1, Math.min(1, offset[1] / radius)));
    
    // Apply rotations
    theta += azimuth;
    phi += elevation;
    
    // Clamp phi to prevent flipping (small epsilon to prevent gimbal lock)
    phi = Math.max(0.01, Math.min(Math.PI - 0.01, phi));
    
    // Convert back to Cartesian
    const sinPhiRadius = Math.sin(phi) * radius;
    offset[0] = sinPhiRadius * Math.sin(theta);
    offset[1] = Math.cos(phi) * radius;
    offset[2] = sinPhiRadius * Math.cos(theta);
    
    // Update position
    vec3.add(this.position, this._target, offset);
    this.markDirty();
  }

  /**
   * Zoom the camera (move closer/farther from target)
   * @param {number} factor - Zoom factor (1.0 = no change, <1.0 = zoom in, >1.0 = zoom out)
   */
  zoom(factor: number): void {
    const distance = this.getDistanceToTarget();
    this.setDistanceToTarget(distance * factor);
  }

  /**
   * Pan the camera (move perpendicular to view direction)
   * @param {number} horizontal - Horizontal pan amount
   * @param {number} vertical - Vertical pan amount
   * @param {vec3} worldUp - Optional world up vector (defaults to Y-up)
   */
  pan(horizontal: number, vertical: number, worldUp: vec3 = vec3.fromValues(0, 1, 0)): void {
    const right = this.getRightVector(worldUp);
    const up = this.getUpVector(worldUp);
    
    const delta = vec3.create();
    vec3.scaleAndAdd(delta, delta, right, horizontal);
    vec3.scaleAndAdd(delta, delta, up, vertical);
    
    this.translate(delta);
  }

  /**
   * Get the camera's view direction as Euler angles
   * @returns {Object} Object with yaw and pitch in radians
   */
  getViewAngles(): { yaw: number; pitch: number } {
    const forward = this.getForwardVector();
    const yaw = Math.atan2(forward[0], forward[2]);
    const pitch = Math.asin(-forward[1]);
    return { yaw, pitch };
  }

  /**
   * Set the camera's view direction using Euler angles
   * @param {number} yaw - Horizontal rotation in radians
   * @param {number} pitch - Vertical rotation in radians
   * @param {number} distance - Distance from target
   */
  setViewAngles(yaw: number, pitch: number, distance: number): void {
    // Clamp pitch to prevent gimbal lock
    pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
    
    const cosPitch = Math.cos(pitch);
    const offset = vec3.fromValues(
      Math.sin(yaw) * cosPitch * distance,
      -Math.sin(pitch) * distance,
      Math.cos(yaw) * cosPitch * distance
    );
    vec3.add(this.position, this._target, offset);
    this.markDirty();
  }

  /**
   * Get a ray from the camera through a screen point
   * @param {number} x - Screen X coordinate (normalized -1 to 1)
   * @param {number} y - Screen Y coordinate (normalized -1 to 1)
   * @returns {Object} Object with origin and direction vectors
   */
  getScreenRay(x: number, y: number): { origin: vec3; direction: vec3 } {
    const vpMatrix = this.getViewProjectionMatrix();
    
    // Invert the view-projection matrix
    const invVpMatrix = mat4.create();
    mat4.invert(invVpMatrix, vpMatrix);
    
    // Create near and far points in NDC space
    const nearPoint = vec3.fromValues(x, y, -1);
    const farPoint = vec3.fromValues(x, y, 1);
    
    // Transform to world space
    const nearWorld = vec3.create();
    const farWorld = vec3.create();
    vec3.transformMat4(nearWorld, nearPoint, invVpMatrix);
    vec3.transformMat4(farWorld, farPoint, invVpMatrix);
    
    // Calculate ray direction
    const direction = vec3.create();
    vec3.subtract(direction, farWorld, nearWorld);
    vec3.normalize(direction, direction);
    
    return {
      origin: vec3.clone(this.position),
      direction
    };
  }

  /**
   * Rotate camera around its own position (FPS-style look)
   * @param {number} yaw - Horizontal rotation in radians
   * @param {number} pitch - Vertical rotation in radians
   */
  rotate(yaw: number, pitch: number): void {
    // Get current direction to target
    const forward = this.getForwardVector();
    const distance = this.getDistanceToTarget();
    
    // Get current angles
    const angles = this.getViewAngles();
    
    // Apply rotation
    const newYaw = angles.yaw + yaw;
    const newPitch = Math.max(-Math.PI / 2 + 0.01, 
                     Math.min(Math.PI / 2 - 0.01, angles.pitch + pitch));
    
    // Calculate new forward direction
    const cosPitch = Math.cos(newPitch);
    const newForward = vec3.fromValues(
      Math.sin(newYaw) * cosPitch,
      -Math.sin(newPitch),
      Math.cos(newYaw) * cosPitch
    );
    
    // Update target position based on new forward direction
    vec3.scaleAndAdd(this._target, this.position, newForward, distance);
    this.markViewMatrixDirty();
  }

  /**
   * Dolly the camera (move forward/backward along view direction)
   * @param {number} distance - Distance to move (positive = forward, negative = backward)
   */
  dolly(distance: number): void {
    const forward = this.getForwardVector();
    const delta = vec3.create();
    vec3.scale(delta, forward, distance);
    this.translate(delta);
  }

  /**
   * Truck the camera (move left/right perpendicular to view)
   * @param {number} distance - Distance to move (positive = right, negative = left)
   */
  truck(distance: number): void {
    const right = this.getRightVector();
    const delta = vec3.create();
    vec3.scale(delta, right, distance);
    this.translate(delta);
  }

  /**
   * Pedestal the camera (move up/down)
   * @param {number} distance - Distance to move (positive = up, negative = down)
   */
  pedestal(distance: number): void {
    const up = this.getUpVector();
    const delta = vec3.create();
    vec3.scale(delta, up, distance);
    this.translate(delta);
  }
  
  /**
   * Force recalculation of all matrices
   */
  public forceMatrixUpdate(): void {
    this.forceDirty();
    this._viewMatrixDirty = true;
    this._projectionMatrixDirty = true;
    this._viewProjectionMatrixDirty = true;
  }

  /**
   * Create a copy of this camera
   * @returns {Camera} A new camera with the same properties
   */
  clone(): Camera {
    const newCamera = new Camera(this.gl!, this._fieldOfView, this._near, this._far);
    vec3.copy(newCamera.position, this.position);
    vec3.copy(newCamera._target, this._target);
    vec3.copy(newCamera.rotation, this.rotation);
    vec3.copy(newCamera.scale, this.scale);
    newCamera._aspect = this._aspect;
    newCamera.name = this.name + "_clone";
    return newCamera;
  }

  /**
   * Debug information
   */
  debugInfo(): void {
    console.log("Camera Debug Info:");
    console.log("Name:", this.name);
    console.log("Position:", this.position);
    console.log("Target:", this._target);
    console.log("Distance to Target:", this.getDistanceToTarget());
    console.log("Forward Vector:", this.getForwardVector());
    console.log("Right Vector:", this.getRightVector());
    console.log("Up Vector:", this.getUpVector());
    console.log("Rotation:", this.rotation);
    console.log("Scale:", this.scale);
    console.log(`FOV: ${this._fieldOfView}, Aspect: ${this._aspect}, Near: ${this._near}, Far: ${this._far}`);
    const angles = this.getViewAngles();
    console.log(`View Angles - Yaw: ${angles.yaw * 180/Math.PI}°, Pitch: ${angles.pitch * 180/Math.PI}°`);
    console.log("Matrix States:");
    console.log(`  Model Matrix Dirty: ${this.isDirty()}`);
    console.log(`  View Matrix Dirty: ${this._viewMatrixDirty}`);
    console.log(`  Projection Matrix Dirty: ${this._projectionMatrixDirty}`);
    console.log(`  View-Projection Matrix Dirty: ${this._viewProjectionMatrixDirty}`);
    console.log(`  Is Static: ${this.isStatic()}`);
  }  
}