// src/engine/Camera.ts
import { mat4, vec3 } from 'gl-matrix';
import { Entity } from './Entity';

export class Camera extends Entity {
  public name : string = "";
  // Transform fields inherited from Entity:
  // public position = vec3.fromValues(0.0, 0.0, 5.0);
  // public rotation = vec3.fromValues(0, 0, 0);
  // public scale = vec3.fromValues(1,1,1);

  public target = vec3.create();

  // Projection settings
  public fieldOfView: number; // in degrees
  public aspect: number;
  public near: number;
  public far: number;

  constructor(gl: WebGL2RenderingContext, fieldOfView = 45, near = 0.1, far = 100) {
    super(gl);
    this.fieldOfView = fieldOfView;
    this.aspect = 1;
    this.near = near;
    this.far = far;
    this.type = Entity.EntityTypes.Camera;
  }

  /**
   * Get the projection matrix for this camera
   * @returns {mat4} The projection matrix
   */
  getProjectionMatrix(): mat4 {
    const out = mat4.create();
    // Convert FOV to radians
    const fovRad = (this.fieldOfView * Math.PI) / 180;
    mat4.perspective(out, fovRad, this.aspect, this.near, this.far);
    return out;
  }

  /**
   * Get the view matrix for this camera
   * @returns {mat4} The view matrix
   */
  getViewMatrix() : mat4 {
    var viewMatrix = mat4.create();
    mat4.lookAt(viewMatrix, this.position, this.target, vec3.fromValues(0, 1, 0));
    return viewMatrix;   
  }

  /**
   * Handle canvas resize
   * @param {number} width - New canvas width
   * @param {number} height - New canvas height
   */
  handleResize(width: number, height: number) {
    this.aspect = width / height;
  }

  /**
   * Get the camera's forward vector (from camera to target)
   * @returns {vec3} Normalized forward vector
   */
  getForwardVector(): vec3 {
    const forward = vec3.create();
    vec3.subtract(forward, this.target, this.position);
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
    return vec3.distance(this.position, this.target);
  }

  /**
   * Set the distance from camera to target while maintaining direction
   * @param {number} distance - New distance to target
   */
  setDistanceToTarget(distance: number): void {
    const direction = vec3.create();
    vec3.subtract(direction, this.position, this.target);
    vec3.normalize(direction, direction);
    vec3.scaleAndAdd(this.position, this.target, direction, distance);
  }

  /**
   * Look at a specific point from current position
   * @param {vec3} target - Point to look at
   * @param {vec3} worldUp - Optional world up vector (defaults to Y-up)
   */
  lookAt(target: vec3, worldUp: vec3 = vec3.fromValues(0, 1, 0)): void {
    vec3.copy(this.target, target);
    // Note: The actual lookAt transformation is handled by getViewMatrix()
    // This method just updates the target. If you want to also set position:
    // use setPositionAndTarget() method instead
  }

  /**
   * Set both camera position and target
   * @param {vec3} position - New camera position
   * @param {vec3} target - New target position
   */
  setPositionAndTarget(position: vec3, target: vec3): void {
    vec3.copy(this.position, position);
    vec3.copy(this.target, target);
  }

  /**
   * Move the camera and target by a delta
   * @param {vec3} delta - Movement delta
   */
  translate(delta: vec3): void {
    vec3.add(this.position, this.position, delta);
    vec3.add(this.target, this.target, delta);
  }

  /**
   * Move the camera position only (changes view direction)
   * @param {vec3} delta - Movement delta
   */
  translatePosition(delta: vec3): void {
    vec3.add(this.position, this.position, delta);
  }

  /**
   * Move the target only (changes view direction)
   * @param {vec3} delta - Movement delta
   */
  translateTarget(delta: vec3): void {
    vec3.add(this.target, this.target, delta);
  }

  /**
   * Orbit the camera around the target
   * @param {number} azimuth - Horizontal rotation in radians
   * @param {number} elevation - Vertical rotation in radians
   * @param {vec3} worldUp - Optional world up vector (defaults to Y-up)
   */
  orbit(azimuth: number, elevation: number, worldUp: vec3 = vec3.fromValues(0, 1, 0)): void {
    const offset = vec3.create();
    vec3.subtract(offset, this.position, this.target);
    
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
    vec3.add(this.position, this.target, offset);
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
    vec3.add(this.position, this.target, offset);
  }

  /**
   * Get a ray from the camera through a screen point
   * @param {number} x - Screen X coordinate (normalized -1 to 1)
   * @param {number} y - Screen Y coordinate (normalized -1 to 1)
   * @returns {Object} Object with origin and direction vectors
   */
  getScreenRay(x: number, y: number): { origin: vec3; direction: vec3 } {
    const projMatrix = this.getProjectionMatrix();
    const viewMatrix = this.getViewMatrix();
    
    // Combine matrices
    const vpMatrix = mat4.create();
    mat4.multiply(vpMatrix, projMatrix, viewMatrix);
    
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
    vec3.scaleAndAdd(this.target, this.position, newForward, distance);
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
   * Create a copy of this camera
   * @returns {Camera} A new camera with the same properties
   */
  clone(): Camera {
    const newCamera = new Camera(this.gl!, this.fieldOfView, this.near, this.far);
    vec3.copy(newCamera.position, this.position);
    vec3.copy(newCamera.target, this.target);
    vec3.copy(newCamera.rotation, this.rotation);
    vec3.copy(newCamera.scale, this.scale);
    newCamera.aspect = this.aspect;
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
    console.log("Target:", this.target);
    console.log("Distance to Target:", this.getDistanceToTarget());
    console.log("Forward Vector:", this.getForwardVector());
    console.log("Right Vector:", this.getRightVector());
    console.log("Up Vector:", this.getUpVector());
    console.log("Rotation:", this.rotation);
    console.log("Scale:", this.scale);
    console.log(`FOV: ${this.fieldOfView}, Aspect: ${this.aspect}, Near: ${this.near}, Far: ${this.far}`);
    const angles = this.getViewAngles();
    console.log(`View Angles - Yaw: ${angles.yaw * 180/Math.PI}°, Pitch: ${angles.pitch * 180/Math.PI}°`);
  }  
}