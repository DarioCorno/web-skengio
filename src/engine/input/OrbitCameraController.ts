// src/engine/camera/OrbitCameraController.ts
import { vec3, mat4, quat } from 'gl-matrix';
import { Camera } from '../core/Camera';
import { InputManager, IInputSubscriber, InputEvent, InputEventType, MouseButton, KeyCode } from '../input/InputManager';

/**
 * Configuration options for the OrbitCameraController
 */
export interface OrbitCameraConfig {
    moveSpeed?: number;           // Units per second for movement
    rotateSpeed?: number;          // Radians per pixel for rotation
    zoomSpeed?: number;            // Units per wheel tick for zoom
    minDistance?: number;          // Minimum distance from target
    maxDistance?: number;          // Maximum distance from target
    minPolarAngle?: number;        // Minimum polar angle (radians)
    maxPolarAngle?: number;        // Maximum polar angle (radians)
    enableDamping?: boolean;       // Enable smooth damping
    dampingFactor?: number;        // Damping factor (0-1)
    enableKeyboard?: boolean;      // Enable keyboard controls
    enableMouse?: boolean;         // Enable mouse controls
    enableGamepad?: boolean;       // Enable gamepad controls
    gamepadIndex?: number;         // Gamepad index to use
}

/**
 * OrbitCameraController - Provides orbit-style camera controls
 * 
 * Controls:
 * - Left Mouse + Drag: Rotate camera around target
 * - Mouse Wheel: Zoom in/out
 * - W/S: Move forward/backward (camera-relative)
 * - A/D: Move left/right (camera-relative)
 * - R/F: Move up/down (camera-relative)
 * - Shift: Move faster
 * - Alt: Move slower
 * - Space: Reset camera
 */
export class OrbitCameraController implements IInputSubscriber {
    private camera: Camera;
    private inputManager: InputManager;
    private config: OrbitCameraConfig;
    
    // State
    private enabled: boolean = true;
    private isMouseDragging: boolean = false;
    private lastMouseX: number = 0;
    private lastMouseY: number = 0;
    
    // Spherical coordinates (for orbit)
    private sphericalDelta = { theta: 0, phi: 0 };
    private scale: number = 1;
    
    // Movement accumulator
    private moveVector: vec3 = vec3.create();
    private panOffset: vec3 = vec3.create();
    
    // Damping
    private sphericalDampingDelta = { theta: 0, phi: 0 };
    private scaleDamping: number = 0;
    private panDamping: vec3 = vec3.create();
    
    // Track if any input has occurred
    private hasReceivedInput: boolean = false;
    
    /**
     * Creates a new OrbitCameraController
     * @param {Camera} camera - The camera to control
     * @param {InputManager} inputManager - The input manager to use
     * @param {OrbitCameraConfig} config - Configuration options
     */
    constructor(camera: Camera, inputManager: InputManager, config?: OrbitCameraConfig) {
        this.camera = camera;
        this.inputManager = inputManager;
        
        // Apply default configuration
        this.config = {
            moveSpeed: 5.0,
            rotateSpeed: 0.005,
            zoomSpeed: 1.0,
            minDistance: 1.0,
            maxDistance: 100.0,
            minPolarAngle: 0.1,              // ~5 degrees from top
            maxPolarAngle: Math.PI - 0.1,    // ~5 degrees from bottom
            enableDamping: true,
            dampingFactor: 0.1,
            enableKeyboard: true,
            enableMouse: true,
            enableGamepad: true,
            gamepadIndex: 0,
            ...config
        };
        
        // Subscribe to input events
        this.inputManager.subscribe(this);
    }
    
    /**
     * Convert spherical coordinates to Cartesian
     * @param {number} radius - Distance from origin
     * @param {number} theta - Azimuthal angle (horizontal rotation)
     * @param {number} phi - Polar angle (vertical rotation)
     * @returns {vec3} Cartesian coordinates
     */
    private sphericalToCartesian(radius: number, theta: number, phi: number): vec3 {
        const sinPhiRadius = Math.sin(phi) * radius;
        return vec3.fromValues(
            sinPhiRadius * Math.sin(theta),
            Math.cos(phi) * radius,
            sinPhiRadius * Math.cos(theta)
        );
    }
    
    /**
     * Convert Cartesian coordinates to spherical
     * @param {vec3} cartesian - Cartesian coordinates
     * @returns {Object} Spherical coordinates {radius, theta, phi}
     */
    private cartesianToSpherical(cartesian: vec3): { radius: number; theta: number; phi: number } {
        const radius = vec3.length(cartesian);
        return {
            radius: radius,
            theta: Math.atan2(cartesian[0], cartesian[2]),
            phi: Math.acos(Math.max(-1, Math.min(1, cartesian[1] / radius)))
        };
    }
    
    /**
     * Handle input events from the InputManager
     * @param {InputEvent} event - The input event
     */
    onInputEvent(event: InputEvent): void {
        if (!this.enabled) return;
        
        switch (event.type) {
            case InputEventType.MOUSE_DOWN:
                this.handleMouseDown(event);
                break;
                
            case InputEventType.MOUSE_UP:
                this.handleMouseUp(event);
                break;
                
            case InputEventType.MOUSE_MOVE:
                this.handleMouseMove(event);
                break;
                
            case InputEventType.MOUSE_WHEEL:
                this.handleMouseWheel(event);
                break;
                
            case InputEventType.KEY_DOWN:
                this.handleKeyDown(event);
                break;
                
            case InputEventType.KEY_UP:
                this.handleKeyUp(event);
                break;
                
            case InputEventType.GAMEPAD_AXIS_CHANGE:
                this.handleGamepadAxis(event);
                break;
                
            case InputEventType.GAMEPAD_BUTTON_DOWN:
                this.handleGamepadButton(event);
                break;
        }
    }
    
    /**
     * Handle mouse down event
     * @param {InputEvent} event - The mouse down event
     */
    private handleMouseDown(event: InputEvent): void {
        if (!this.config.enableMouse) return;
        
        if (event.data.button === MouseButton.LEFT) {
            this.isMouseDragging = true;
            this.lastMouseX = event.data.position[0];
            this.lastMouseY = event.data.position[1];
            this.hasReceivedInput = true;
        }
    }
    
    /**
     * Handle mouse up event
     * @param {InputEvent} event - The mouse up event
     */
    private handleMouseUp(event: InputEvent): void {
        if (!this.config.enableMouse) return;
        
        if (event.data.button === MouseButton.LEFT) {
            this.isMouseDragging = false;
        }
    }
    
    /**
     * Handle mouse move event
     * @param {InputEvent} event - The mouse move event
     */
    private handleMouseMove(event: InputEvent): void {
        if (!this.config.enableMouse || !this.isMouseDragging) return;
        
        const deltaX = event.data.position[0] - this.lastMouseX;
        const deltaY = event.data.position[1] - this.lastMouseY;
        
        // Update spherical delta for rotation
        this.sphericalDelta.theta -= deltaX * this.config.rotateSpeed!;
        this.sphericalDelta.phi -= deltaY * this.config.rotateSpeed!;
        
        this.lastMouseX = event.data.position[0];
        this.lastMouseY = event.data.position[1];
        this.hasReceivedInput = true;
    }
    
    /**
     * Handle mouse wheel event
     * @param {InputEvent} event - The mouse wheel event
     */
    private handleMouseWheel(event: InputEvent): void {
        if (!this.config.enableMouse) return;
        
        const delta = event.data.delta;
        
        if (delta > 0) {
            this.scale /= Math.pow(0.95, this.config.zoomSpeed!);
        } else if (delta < 0) {
            this.scale *= Math.pow(0.95, this.config.zoomSpeed!);
        }
        
        this.hasReceivedInput = true;
    }
    
    /**
     * Handle key down event
     * @param {InputEvent} event - The key down event
     */
    private handleKeyDown(event: InputEvent): void {
        if (!this.config.enableKeyboard) return;
        
        // Prevent handling repeated events
        if (event.data.repeat) return;
        
        // Handle special keys
        switch (event.data.code) {
            case KeyCode.SPACE:
                this.resetCamera();
                break;
            default:
                // Mark as having received input for movement keys
                if ([KeyCode.W, KeyCode.A, KeyCode.S, KeyCode.D, KeyCode.R, KeyCode.F].includes(event.data.code as KeyCode)) {
                    this.hasReceivedInput = true;
                }
                break;
        }
    }
    
    /**
     * Handle key up event
     * @param {InputEvent} event - The key up event
     */
    private handleKeyUp(event: InputEvent): void {
        // Currently not needed but available for future use
    }
    
    /**
     * Handle gamepad axis change
     * @param {InputEvent} event - The gamepad axis event
     */
    private handleGamepadAxis(event: InputEvent): void {
        if (!this.config.enableGamepad) return;
        if (event.data.gamepadIndex !== this.config.gamepadIndex) return;
        
        const leftStick = event.data.leftStick;
        const rightStick = event.data.rightStick;
        
        // Mark as having received input for any significant stick movement
        if (Math.abs(leftStick[0]) > 0.01 || Math.abs(leftStick[1]) > 0.01 ||
            Math.abs(rightStick[0]) > 0.01 || Math.abs(rightStick[1]) > 0.01) {
            this.hasReceivedInput = true;
        }
        
        // Note: Actual movement is handled in onUpdate() to properly use deltaTime
    }
    
    /**
     * Handle gamepad button press
     * @param {InputEvent} event - The gamepad button event
     */
    private handleGamepadButton(event: InputEvent): void {
        if (!this.config.enableGamepad) return;
        if (event.data.gamepadIndex !== this.config.gamepadIndex) return;
        
        // Mark as having received input for trigger presses
        if (event.data.button === 6 || event.data.button === 7) { // L2/R2
            this.hasReceivedInput = true;
        }
    }
    
    /**
     * Update the camera controller
     * @param {number} deltaTime - Time since last update in seconds
     */
    public onUpdate(deltaTime: number): void {
        if (!this.enabled) return;
        
        // Don't apply any transformations until we receive input
        if (!this.hasReceivedInput) {
            return;
        }
        
        // Get camera vectors using the Camera class methods
        const cameraForward = this.camera.getForwardVector();
        const cameraRight = this.camera.getRightVector();
        const cameraUp = this.camera.getUpVector();
        
        // Reset move vector
        vec3.set(this.moveVector, 0, 0, 0);
        
        // Check keyboard input for movement
        if (this.config.enableKeyboard) {
            // Use deltaTime in seconds (typically 0.016 for 60fps)
            const moveSpeed = this.getMoveSpeed() * deltaTime;
            
            // Forward/Backward (W/S) - using camera's forward/backward vectors
            if (this.inputManager.isKeyPressed(KeyCode.W)) {
                vec3.scaleAndAdd(this.moveVector, this.moveVector, cameraForward, moveSpeed);
            }
            if (this.inputManager.isKeyPressed(KeyCode.S)) {
                const cameraBackward = this.camera.getBackwardVector();
                vec3.scaleAndAdd(this.moveVector, this.moveVector, cameraBackward, moveSpeed);
            }
            
            // Left/Right (A/D) - using camera's left/right vectors
            if (this.inputManager.isKeyPressed(KeyCode.A)) {
                const cameraLeft = this.camera.getLeftVector();
                vec3.scaleAndAdd(this.moveVector, this.moveVector, cameraLeft, moveSpeed);
            }
            if (this.inputManager.isKeyPressed(KeyCode.D)) {
                vec3.scaleAndAdd(this.moveVector, this.moveVector, cameraRight, moveSpeed);
            }
            
            // Up/Down (R/F) - using camera's up vector
            if (this.inputManager.isKeyPressed(KeyCode.R)) {
                vec3.scaleAndAdd(this.moveVector, this.moveVector, cameraUp, moveSpeed);
            }
            if (this.inputManager.isKeyPressed(KeyCode.F)) {
                vec3.scaleAndAdd(this.moveVector, this.moveVector, cameraUp, -moveSpeed);
            }
        }
        
        // Check gamepad input
        if (this.config.enableGamepad) {
            const gamepad = this.inputManager.getGamepadState(this.config.gamepadIndex!);
            if (gamepad && gamepad.connected) {
                const moveSpeed = this.getMoveSpeed() * deltaTime;
                
                // Left stick for movement (using camera vectors)
                if (Math.abs(gamepad.leftStick[0]) > 0.01) {
                    vec3.scaleAndAdd(this.moveVector, this.moveVector, cameraRight, 
                        gamepad.leftStick[0] * moveSpeed);
                }
                if (Math.abs(gamepad.leftStick[1]) > 0.01) {
                    vec3.scaleAndAdd(this.moveVector, this.moveVector, cameraForward, 
                        -gamepad.leftStick[1] * moveSpeed);
                }
                
                // Right stick for rotation
                if (Math.abs(gamepad.rightStick[0]) > 0.01) {
                    this.sphericalDelta.theta -= gamepad.rightStick[0] * this.config.rotateSpeed! * 50 * deltaTime;
                }
                if (Math.abs(gamepad.rightStick[1]) > 0.01) {
                    this.sphericalDelta.phi += gamepad.rightStick[1] * this.config.rotateSpeed! * 50 * deltaTime;
                }
                
                // Triggers for up/down (using camera's up vector)
                if (gamepad.leftTrigger > 0.1) {
                    vec3.scaleAndAdd(this.moveVector, this.moveVector, cameraUp, 
                        -gamepad.leftTrigger * moveSpeed);
                }
                if (gamepad.rightTrigger > 0.1) {
                    vec3.scaleAndAdd(this.moveVector, this.moveVector, cameraUp, 
                        gamepad.rightTrigger * moveSpeed);
                }
            }
        }
        
        // Apply movement directly or through damping
        if (vec3.length(this.moveVector) > 0) {
            if (this.config.enableDamping) {
                // For damped movement, add to panOffset which will be processed below
                vec3.copy(this.panOffset, this.moveVector);
            } else {
                // For non-damped movement, apply directly using Camera's translate method
                this.camera.translate(this.moveVector);
            }
        }
        
        // Apply damping if enabled
        if (this.config.enableDamping) {
            this.sphericalDampingDelta.theta += this.sphericalDelta.theta * this.config.dampingFactor!;
            this.sphericalDampingDelta.phi += this.sphericalDelta.phi * this.config.dampingFactor!;
            this.scaleDamping += (this.scale - 1) * this.config.dampingFactor!;
            
            // For panning, replace the damping value instead of accumulating
            vec3.copy(this.panDamping, this.panOffset);
            
            // Clear immediate deltas
            this.sphericalDelta.theta *= (1 - this.config.dampingFactor!);
            this.sphericalDelta.phi *= (1 - this.config.dampingFactor!);
            this.scale = 1 + (this.scale - 1) * (1 - this.config.dampingFactor!);
            vec3.set(this.panOffset, 0, 0, 0);
        } else {
            this.sphericalDampingDelta.theta = this.sphericalDelta.theta;
            this.sphericalDampingDelta.phi = this.sphericalDelta.phi;
            this.scaleDamping = this.scale - 1;
            vec3.copy(this.panDamping, this.panOffset);
            
            // Clear immediate deltas
            this.sphericalDelta.theta = 0;
            this.sphericalDelta.phi = 0;
            this.scale = 1;
            vec3.set(this.panOffset, 0, 0, 0);
        }
        
        // Apply orbit rotation and zoom
        this.applyOrbitTransform(
            this.sphericalDampingDelta.theta, 
            this.sphericalDampingDelta.phi,
            1 + this.scaleDamping
        );
        
        // Apply panning with damping using Camera's translate method
        if (vec3.length(this.panDamping) > 0.0001) {
            this.camera.translate(this.panDamping);
            
            // Decay damping
            if (this.config.enableDamping) {
                vec3.scale(this.panDamping, this.panDamping, 1 - this.config.dampingFactor!);
                if (vec3.length(this.panDamping) < 0.0001) {
                    vec3.set(this.panDamping, 0, 0, 0);
                }
            } else {
                vec3.set(this.panDamping, 0, 0, 0);
            }
        }
        
        // Decay rotation damping
        if (this.config.enableDamping) {
            const dampingDecay = 1 - this.config.dampingFactor!;
            this.sphericalDampingDelta.theta *= dampingDecay;
            this.sphericalDampingDelta.phi *= dampingDecay;
            this.scaleDamping *= dampingDecay;
            
            // Stop when very small
            if (Math.abs(this.sphericalDampingDelta.theta) < 0.0001) {
                this.sphericalDampingDelta.theta = 0;
            }
            if (Math.abs(this.sphericalDampingDelta.phi) < 0.0001) {
                this.sphericalDampingDelta.phi = 0;
            }
            if (Math.abs(this.scaleDamping) < 0.0001) {
                this.scaleDamping = 0;
            }
        } else {
            this.sphericalDampingDelta.theta = 0;
            this.sphericalDampingDelta.phi = 0;
            this.scaleDamping = 0;
        }
    }
    
    /**
     * Apply orbit transformation to camera
     * @param {number} deltaTheta - Change in azimuthal angle
     * @param {number} deltaPhi - Change in polar angle  
     * @param {number} scaleAmount - Zoom scale factor
     */
    private applyOrbitTransform(deltaTheta: number, deltaPhi: number, scaleAmount: number): void {
        if (Math.abs(deltaTheta) < 0.0001 && Math.abs(deltaPhi) < 0.0001 && Math.abs(scaleAmount - 1) < 0.0001) {
            return;
        }
        
        // Use Camera's orbit method for rotation
        if (Math.abs(deltaTheta) > 0.0001 || Math.abs(deltaPhi) > 0.0001) {
            this.camera.orbit(deltaTheta, deltaPhi);
        }
        
        // Use Camera's zoom method for zooming
        if (Math.abs(scaleAmount - 1) > 0.0001) {
            // Clamp the scale amount based on current distance
            const currentDistance = this.camera.getDistanceToTarget();
            let newDistance = currentDistance * scaleAmount;
            
            // Clamp to min/max distance
            newDistance = Math.max(this.config.minDistance!, 
                Math.min(this.config.maxDistance!, newDistance));
            
            // Apply the clamped distance
            this.camera.setDistanceToTarget(newDistance);
        }
    }
    
    /**
     * Get current move speed accounting for modifiers
     * @returns {number} Current move speed
     */
    private getMoveSpeed(): number {
        let speed = this.config.moveSpeed!;
        
        // Check for speed modifiers
        if (this.inputManager.isKeyPressed(KeyCode.SHIFT_LEFT) || 
            this.inputManager.isKeyPressed(KeyCode.SHIFT_RIGHT)) {
            speed *= 2.0; // Faster with shift
        }
        
        if (this.inputManager.isKeyPressed(KeyCode.ALT_LEFT) || 
            this.inputManager.isKeyPressed(KeyCode.ALT_RIGHT)) {
            speed *= 0.3; // Slower with alt
        }
        
        return speed;
    }
    
    /**
     * Reset camera to default position
     */
    resetCamera(): void {
        // Use Camera's setPositionAndTarget method
        this.camera.setPositionAndTarget(
            vec3.fromValues(6, 6, 6),
            vec3.fromValues(0, 0, 0)
        );
        
        // Clear all deltas
        this.sphericalDelta.theta = 0;
        this.sphericalDelta.phi = 0;
        this.scale = 1;
        vec3.set(this.panOffset, 0, 0, 0);
        this.sphericalDampingDelta.theta = 0;
        this.sphericalDampingDelta.phi = 0;
        this.scaleDamping = 0;
        vec3.set(this.panDamping, 0, 0, 0);
        
        // Reset input flag
        this.hasReceivedInput = false;
        
        console.log('Camera reset to default position');
    }
    
    /**
     * Set camera position
     * @param {vec3} position - New camera position
     */
    setPosition(position: vec3): void {
        vec3.copy(this.camera.position, position);
    }
    
    /**
     * Set camera target
     * @param {vec3} target - New camera target
     */
    setTarget(target: vec3): void {
        vec3.copy(this.camera.target, target);
    }
    
    /**
     * Enable or disable the controller
     * @param {boolean} enabled - Whether to enable the controller
     */
    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) {
            this.isMouseDragging = false;
        }
    }
    
    /**
     * Check if controller is enabled
     * @returns {boolean} True if enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }
    
    /**
     * Update configuration
     * @param {Partial<OrbitCameraConfig>} config - Configuration options to update
     */
    updateConfig(config: Partial<OrbitCameraConfig>): void {
        this.config = { ...this.config, ...config };
    }
    
    /**
     * Get current configuration
     * @returns {OrbitCameraConfig} Current configuration
     */
    getConfig(): OrbitCameraConfig {
        return { ...this.config };
    }
    
    /**
     * Dispose of the controller and clean up
     */
    dispose(): void {
        this.inputManager.unsubscribe(this);
        this.enabled = false;
    }
    
    /**
     * Debug information
     */
    debugInfo(): void {
        console.log('--- OrbitCameraController Debug Info ---');
        console.log('Enabled:', this.enabled);
        console.log('Camera Position:', this.camera.position);
        console.log('Camera Target:', this.camera.target);
        console.log('Camera Distance:', this.camera.getDistanceToTarget());
        console.log('Camera Forward:', this.camera.getForwardVector());
        console.log('Camera Right:', this.camera.getRightVector());
        console.log('Camera Up:', this.camera.getUpVector());
        console.log('Mouse Dragging:', this.isMouseDragging);
        console.log('Has Received Input:', this.hasReceivedInput);
        console.log('Configuration:', this.config);
        console.log('Current Spherical Delta:', this.sphericalDelta);
        console.log('Current Scale:', this.scale);
        console.log('Current Pan Offset:', this.panOffset);
        console.log('--- End OrbitCameraController Debug Info ---');
    }
}