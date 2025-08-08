// src/engine/Light.ts
import { vec3, mat4 } from 'gl-matrix';
import { Entity } from './Entity'

export class Light extends Entity {
  // Private properties with dirty tracking
  private _color: vec3;
  private _intensity: number = 1;
  
  // Dirty flags for individual properties
  private _colorDirty: boolean = true;
  private _intensityDirty: boolean = true;
  
  // Track if ANY property is dirty
  private _anyPropertyDirty: boolean = true;

  constructor(gl: WebGL2RenderingContext, position: vec3 = vec3.fromValues(0, 3, 3), color: vec3 = vec3.fromValues(1, 1, 1), intensity: number = 1) {
    super(gl);
    this.setPosition(position);
    this._color = vec3.clone(color);
    this._intensity = intensity;
    this.type = Entity.EntityTypes.Light;
  }

  /**
   * Get the color vector
   * @returns {vec3} The color vector
   */
  public get color(): vec3 {
    return this._color;
  }

  /**
   * Set the color and mark as dirty if changed
   * @param {vec3} value - The new color
   */
  public set color(value: vec3) {
    if (!vec3.exactEquals(this._color, value)) {
      vec3.copy(this._color, value);
      this._colorDirty = true;
      this._anyPropertyDirty = true;
    }
  }

  /**
   * Get the intensity value
   * @returns {number} The intensity
   */
  public get intensity(): number {
    return this._intensity;
  }

  /**
   * Set the intensity and mark as dirty if changed
   * @param {number} value - The new intensity
   */
  public set intensity(value: number) {
    if (this._intensity !== value) {
      this._intensity = value;
      this._intensityDirty = true;
      this._anyPropertyDirty = true;
    }
  }

  /**
   * Set color using individual components
   * @param {number} r - Red component (0-1)
   * @param {number} g - Green component (0-1)
   * @param {number} b - Blue component (0-1)
   */
  public setColor(r: number, g: number, b: number): void {
    const newColor = vec3.fromValues(r, g, b);
    if (!vec3.exactEquals(this._color, newColor)) {
      vec3.set(this._color, r, g, b);
      this._colorDirty = true;
      this._anyPropertyDirty = true;
    }
  }

  /**
   * Override setPosition to track position changes
   * @param {vec3} newPos - The new position
   */
  public setPosition(newPos: vec3): void {
    const oldPos = vec3.clone(this.position);
    super.setPosition(newPos);
    
    // Check if position actually changed
    if (!vec3.exactEquals(oldPos, this.position)) {
      this._anyPropertyDirty = true;
    }
  }

  /**
   * Override translate to mark as dirty
   * @param {vec3} delta - The translation delta
   */
  public translate(delta: vec3): void {
    super.translate(delta);
    if (!this.isStatic()) {
      this._anyPropertyDirty = true;
    }
  }

  /**
   * Check if color has changed since last clear
   * @returns {boolean} True if color is dirty
   */
  public isColorDirty(): boolean {
    return this._colorDirty;
  }

  /**
   * Check if intensity has changed since last clear
   * @returns {boolean} True if intensity is dirty
   */
  public isIntensityDirty(): boolean {
    return this._intensityDirty;
  }

  /**
   * Check if position has changed (delegates to Entity's isDirty)
   * @returns {boolean} True if position is dirty
   */
  public isPositionDirty(): boolean {
    return this.isDirty();
  }

  /**
   * Check if ANY property of the light has changed
   * @returns {boolean} True if any property is dirty
   */
  public isAnyPropertyDirty(): boolean {
    return this._anyPropertyDirty || this.isDirty();
  }

  /**
   * Clear the color dirty flag
   */
  public clearColorDirty(): void {
    this._colorDirty = false;
    this.updateAnyPropertyDirty();
  }

  /**
   * Clear the intensity dirty flag
   */
  public clearIntensityDirty(): void {
    this._intensityDirty = false;
    this.updateAnyPropertyDirty();
  }

  /**
   * Clear the position dirty flag (delegates to Entity)
   */
  public clearPositionDirty(): void {
    // Entity doesn't have a public method to clear dirty, 
    // but getting the model matrix clears the dirty flag
    this.getModelMatrix();
    this.updateAnyPropertyDirty();
  }

  /**
   * Clear all dirty flags at once
   */
  public clearAllDirty(): void {
    this._colorDirty = false;
    this._intensityDirty = false;
    this.getModelMatrix(); // This clears Entity's dirty flag
    this._anyPropertyDirty = false;
  }

  /**
   * Update the anyPropertyDirty flag based on individual flags
   */
  private updateAnyPropertyDirty(): void {
    this._anyPropertyDirty = this._colorDirty || this._intensityDirty || this.isDirty();
  }

  /**
   * Force all properties to be marked as dirty
   * Useful when the light needs to be fully re-uploaded
   */
  public forceAllDirty(): void {
    this._colorDirty = true;
    this._intensityDirty = true;
    this.forceDirty(); // Force Entity's position to be dirty
    this._anyPropertyDirty = true;
  }

  /**
   * Get a summary of which properties are dirty
   * @returns {Object} Object describing dirty state
   */
  public getDirtyState(): {
    position: boolean;
    color: boolean;
    intensity: boolean;
    any: boolean;
  } {
    return {
      position: this.isDirty(),
      color: this._colorDirty,
      intensity: this._intensityDirty,
      any: this._anyPropertyDirty
    };
  }

  /**
   * Clone the light with all its properties
   * @returns {Light} A new light with the same properties
   */
  public clone(): Light {
    const newLight = new Light(this.gl!, vec3.clone(this.position), vec3.clone(this._color), this._intensity);
    newLight.name = this.name + "_clone";
    newLight.setStatic(this.isStatic());
    return newLight;
  }

  /**
   * Debug information
   */
  debugInfo(): void {
    console.log("Light Debug Info:");
    console.log("Name:", this.name);
    console.log("Position:", this.position);
    console.log("Color:", this._color);
    console.log("Intensity:", this._intensity);
    console.log("Dirty State:", this.getDirtyState());
    console.log("Is Static:", this.isStatic());
  }
}