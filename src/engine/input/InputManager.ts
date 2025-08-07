// src/engine/input/InputManager.ts
import { vec2 } from 'gl-matrix';

/**
 * Enum for mouse buttons
 */
export enum MouseButton {
    LEFT = 0,
    MIDDLE = 1,
    RIGHT = 2,
    BACK = 3,
    FORWARD = 4
}

/**
 * Enum for common keyboard keys
 */
export enum KeyCode {
    // Letters
    A = 'KeyA', B = 'KeyB', C = 'KeyC', D = 'KeyD', E = 'KeyE', F = 'KeyF',
    G = 'KeyG', H = 'KeyH', I = 'KeyI', J = 'KeyJ', K = 'KeyK', L = 'KeyL',
    M = 'KeyM', N = 'KeyN', O = 'KeyO', P = 'KeyP', Q = 'KeyQ', R = 'KeyR',
    S = 'KeyS', T = 'KeyT', U = 'KeyU', V = 'KeyV', W = 'KeyW', X = 'KeyX',
    Y = 'KeyY', Z = 'KeyZ',
    
    // Numbers
    ZERO = 'Digit0', ONE = 'Digit1', TWO = 'Digit2', THREE = 'Digit3',
    FOUR = 'Digit4', FIVE = 'Digit5', SIX = 'Digit6', SEVEN = 'Digit7',
    EIGHT = 'Digit8', NINE = 'Digit9',
    
    // Function keys
    F1 = 'F1', F2 = 'F2', F3 = 'F3', F4 = 'F4', F5 = 'F5', F6 = 'F6',
    F7 = 'F7', F8 = 'F8', F9 = 'F9', F10 = 'F10', F11 = 'F11', F12 = 'F12',
    
    // Control keys
    ENTER = 'Enter',
    ESCAPE = 'Escape',
    SPACE = 'Space',
    TAB = 'Tab',
    BACKSPACE = 'Backspace',
    DELETE = 'Delete',
    
    // Modifiers
    SHIFT_LEFT = 'ShiftLeft',
    SHIFT_RIGHT = 'ShiftRight',
    CONTROL_LEFT = 'ControlLeft',
    CONTROL_RIGHT = 'ControlRight',
    ALT_LEFT = 'AltLeft',
    ALT_RIGHT = 'AltRight',
    
    // Arrow keys
    ARROW_UP = 'ArrowUp',
    ARROW_DOWN = 'ArrowDown',
    ARROW_LEFT = 'ArrowLeft',
    ARROW_RIGHT = 'ArrowRight',
    
    // Other
    PAGE_UP = 'PageUp',
    PAGE_DOWN = 'PageDown',
    HOME = 'Home',
    END = 'End',
    INSERT = 'Insert'
}

/**
 * Mouse state information
 */
export interface MouseState {
    position: vec2;
    positionNormalized: vec2; // -1 to 1 range
    deltaPosition: vec2;
    buttons: boolean[];
    wheel: number;
    isOverCanvas: boolean;
}

/**
 * Keyboard state information
 */
export interface KeyboardState {
    keys: Set<string>;
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
}

/**
 * Gamepad button mapping
 */
export enum GamepadButton {
    A = 0,              // Cross on PS
    B = 1,              // Circle on PS
    X = 2,              // Square on PS
    Y = 3,              // Triangle on PS
    LEFT_BUMPER = 4,    // L1
    RIGHT_BUMPER = 5,   // R1
    LEFT_TRIGGER = 6,   // L2
    RIGHT_TRIGGER = 7,  // R2
    SELECT = 8,         // Share/Back
    START = 9,          // Options/Start
    LEFT_STICK = 10,    // L3
    RIGHT_STICK = 11,   // R3
    DPAD_UP = 12,
    DPAD_DOWN = 13,
    DPAD_LEFT = 14,
    DPAD_RIGHT = 15,
    HOME = 16           // PS/Xbox button
}

/**
 * Gamepad state information
 */
export interface GamepadState {
    connected: boolean;
    index: number;
    id: string;
    buttons: boolean[];
    buttonValues: number[]; // Analog values for triggers
    leftStick: vec2;
    rightStick: vec2;
    leftTrigger: number;
    rightTrigger: number;
}

/**
 * Input event types
 */
export enum InputEventType {
    // Mouse events
    MOUSE_DOWN = 'mousedown',
    MOUSE_UP = 'mouseup',
    MOUSE_MOVE = 'mousemove',
    MOUSE_WHEEL = 'mousewheel',
    MOUSE_ENTER = 'mouseenter',
    MOUSE_LEAVE = 'mouseleave',
    
    // Keyboard events
    KEY_DOWN = 'keydown',
    KEY_UP = 'keyup',
    
    // Gamepad events
    GAMEPAD_CONNECTED = 'gamepadconnected',
    GAMEPAD_DISCONNECTED = 'gamepaddisconnected',
    GAMEPAD_BUTTON_DOWN = 'gamepadbuttondown',
    GAMEPAD_BUTTON_UP = 'gamepadbuttonup',
    GAMEPAD_AXIS_CHANGE = 'gamepadaxischange'
}

/**
 * Input event data
 */
export interface InputEvent {
    type: InputEventType;
    timestamp: number;
    data: any;
}

/**
 * Input subscriber interface
 */
export interface IInputSubscriber {
    onInputEvent(event: InputEvent): void;
    onUpdate(deltaTIme: number) : void;
}

/**
 * InputManager class
 * Manages all input devices (keyboard, mouse, gamepad) and notifies subscribers
 */
export class InputManager {
    private canvas: HTMLCanvasElement;
    private enabled: boolean = true;
    private subscribers: Set<IInputSubscriber> = new Set();
    
    // Mouse state
    private mouseState: MouseState;
    private lastMousePosition: vec2 = vec2.create();
    private canvasRect: DOMRect | null = null;
    
    // Keyboard state
    private keyboardState: KeyboardState;
    
    // Gamepad state
    private gamepads: Map<number, GamepadState> = new Map();
    private gamepadPollingInterval: number | null = null;
    private gamepadDeadzone: number = 0.15;
    
    // Event prevention
    private preventContextMenu: boolean = true;
    private capturePointer: boolean = false;
    private pointerLocked: boolean = false;
    
    /**
     * Creates a new InputManager instance
     * @param {HTMLCanvasElement} canvas - The canvas element to attach input handlers to
     * @param {boolean} enabled - Whether the input system should start enabled
     */
    constructor(canvas: HTMLCanvasElement, enabled: boolean = true) {
        this.canvas = canvas;
        this.enabled = enabled;
        
        // Initialize states
        this.mouseState = {
            position: vec2.create(),
            positionNormalized: vec2.create(),
            deltaPosition: vec2.create(),
            buttons: [false, false, false, false, false],
            wheel: 0,
            isOverCanvas: false
        };
        
        this.keyboardState = {
            keys: new Set(),
            shift: false,
            ctrl: false,
            alt: false,
            meta: false
        };
        
        if (this.enabled) {
            this.attachEventListeners();
        }
    }
    
    /**
     * Attach all event listeners to the canvas and document
     */
    private attachEventListeners(): void {
        // Update canvas rect
        this.updateCanvasRect();
        
        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('wheel', this.handleMouseWheel);
        this.canvas.addEventListener('mouseenter', this.handleMouseEnter);
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
        
        // Context menu
        if (this.preventContextMenu) {
            this.canvas.addEventListener('contextmenu', this.handleContextMenu);
        }
        
        // Pointer lock events
        document.addEventListener('pointerlockchange', this.handlePointerLockChange);
        document.addEventListener('pointerlockerror', this.handlePointerLockError);
        
        // Keyboard events (on document to capture all keys)
        document.addEventListener('keydown', this.handleKeyDown);
        document.addEventListener('keyup', this.handleKeyUp);
        
        // Gamepad events
        window.addEventListener('gamepadconnected', this.handleGamepadConnected);
        window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
        
        // Start gamepad polling
        this.startGamepadPolling();
        
        // Window events
        window.addEventListener('resize', this.handleWindowResize);
        window.addEventListener('blur', this.handleWindowBlur);
    }
    
    /**
     * Remove all event listeners
     */
    private removeEventListeners(): void {
        // Mouse events
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('wheel', this.handleMouseWheel);
        this.canvas.removeEventListener('mouseenter', this.handleMouseEnter);
        this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
        this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
        
        // Pointer lock events
        document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
        document.removeEventListener('pointerlockerror', this.handlePointerLockError);
        
        // Keyboard events
        document.removeEventListener('keydown', this.handleKeyDown);
        document.removeEventListener('keyup', this.handleKeyUp);
        
        // Gamepad events
        window.removeEventListener('gamepadconnected', this.handleGamepadConnected);
        window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
        
        // Stop gamepad polling
        this.stopGamepadPolling();
        
        // Window events
        window.removeEventListener('resize', this.handleWindowResize);
        window.removeEventListener('blur', this.handleWindowBlur);
    }
    
    /**
     * Update canvas bounding rect (call on resize)
     */
    private updateCanvasRect(): void {
        this.canvasRect = this.canvas.getBoundingClientRect();
    }
    
    /**
     * Convert screen coordinates to canvas coordinates
     * @param {number} clientX - Screen X coordinate
     * @param {number} clientY - Screen Y coordinate
     * @returns {vec2} Canvas coordinates
     */
    private screenToCanvas(clientX: number, clientY: number): vec2 {
        if (!this.canvasRect) {
            this.updateCanvasRect();
        }
        
        if (!this.canvasRect) {
            return vec2.fromValues(0, 0);
        }
        
        const x = clientX - this.canvasRect.left;
        const y = clientY - this.canvasRect.top;
        return vec2.fromValues(x, y);
    }
    
    /**
     * Normalize canvas coordinates to -1 to 1 range
     * @param {vec2} canvasCoords - Canvas coordinates
     * @returns {vec2} Normalized coordinates
     */
    private normalizeCoordinates(canvasCoords: vec2): vec2 {
        if (!this.canvasRect) {
            return vec2.fromValues(0, 0);
        }
        
        const x = (canvasCoords[0] / this.canvasRect.width) * 2 - 1;
        const y = -((canvasCoords[1] / this.canvasRect.height) * 2 - 1); // Flip Y
        return vec2.fromValues(x, y);
    }
    
    // Mouse event handlers
    private handleMouseDown = (event: MouseEvent): void => {
        if (!this.enabled) return;
        
        this.mouseState.buttons[event.button] = true;
        
        const canvasPos = this.screenToCanvas(event.clientX, event.clientY);
        vec2.copy(this.mouseState.position, canvasPos);
        vec2.copy(this.mouseState.positionNormalized, this.normalizeCoordinates(canvasPos));
        
        this.notifySubscribers({
            type: InputEventType.MOUSE_DOWN,
            timestamp: performance.now(),
            data: {
                button: event.button,
                position: vec2.clone(this.mouseState.position),
                positionNormalized: vec2.clone(this.mouseState.positionNormalized),
                shift: event.shiftKey,
                ctrl: event.ctrlKey,
                alt: event.altKey
            }
        });
    };
    
    private handleMouseUp = (event: MouseEvent): void => {
        if (!this.enabled) return;
        
        this.mouseState.buttons[event.button] = false;
        
        this.notifySubscribers({
            type: InputEventType.MOUSE_UP,
            timestamp: performance.now(),
            data: {
                button: event.button,
                position: vec2.clone(this.mouseState.position),
                positionNormalized: vec2.clone(this.mouseState.positionNormalized),
                shift: event.shiftKey,
                ctrl: event.ctrlKey,
                alt: event.altKey
            }
        });
    };
    
    private handleMouseMove = (event: MouseEvent): void => {
        if (!this.enabled) return;
        
        const canvasPos = this.screenToCanvas(event.clientX, event.clientY);
        
        // Calculate delta
        vec2.subtract(this.mouseState.deltaPosition, canvasPos, this.mouseState.position);
        
        // Update position
        vec2.copy(this.mouseState.position, canvasPos);
        vec2.copy(this.mouseState.positionNormalized, this.normalizeCoordinates(canvasPos));
        
        // For pointer lock, use movement values
        if (this.pointerLocked) {
            vec2.set(this.mouseState.deltaPosition, event.movementX, event.movementY);
        }
        
        this.notifySubscribers({
            type: InputEventType.MOUSE_MOVE,
            timestamp: performance.now(),
            data: {
                position: vec2.clone(this.mouseState.position),
                positionNormalized: vec2.clone(this.mouseState.positionNormalized),
                delta: vec2.clone(this.mouseState.deltaPosition),
                buttons: [...this.mouseState.buttons]
            }
        });
        
        // Reset delta after notification
        vec2.set(this.mouseState.deltaPosition, 0, 0);
    };
    
    private handleMouseWheel = (event: WheelEvent): void => {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        // Normalize wheel delta across browsers
        const delta = event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002);
        this.mouseState.wheel = -delta; // Invert for intuitive scrolling
        
        this.notifySubscribers({
            type: InputEventType.MOUSE_WHEEL,
            timestamp: performance.now(),
            data: {
                delta: this.mouseState.wheel,
                position: vec2.clone(this.mouseState.position)
            }
        });
        
        // Reset wheel after notification
        this.mouseState.wheel = 0;
    };
    
    private handleMouseEnter = (event: MouseEvent): void => {
        if (!this.enabled) return;
        
        this.mouseState.isOverCanvas = true;
        
        this.notifySubscribers({
            type: InputEventType.MOUSE_ENTER,
            timestamp: performance.now(),
            data: {}
        });
    };
    
    private handleMouseLeave = (event: MouseEvent): void => {
        if (!this.enabled) return;
        
        this.mouseState.isOverCanvas = false;
        
        this.notifySubscribers({
            type: InputEventType.MOUSE_LEAVE,
            timestamp: performance.now(),
            data: {}
        });
    };
    
    private handleContextMenu = (event: MouseEvent): void => {
        event.preventDefault();
    };
    
    // Keyboard event handlers
    private handleKeyDown = (event: KeyboardEvent): void => {
        if (!this.enabled) return;
        
        // Ignore repeated events
        if (event.repeat) return;
        
        this.keyboardState.keys.add(event.code);
        this.keyboardState.shift = event.shiftKey;
        this.keyboardState.ctrl = event.ctrlKey;
        this.keyboardState.alt = event.altKey;
        this.keyboardState.meta = event.metaKey;
        
        this.notifySubscribers({
            type: InputEventType.KEY_DOWN,
            timestamp: performance.now(),
            data: {
                code: event.code,
                key: event.key,
                shift: event.shiftKey,
                ctrl: event.ctrlKey,
                alt: event.altKey,
                meta: event.metaKey
            }
        });
    };
    
    private handleKeyUp = (event: KeyboardEvent): void => {
        if (!this.enabled) return;
        
        this.keyboardState.keys.delete(event.code);
        this.keyboardState.shift = event.shiftKey;
        this.keyboardState.ctrl = event.ctrlKey;
        this.keyboardState.alt = event.altKey;
        this.keyboardState.meta = event.metaKey;
        
        this.notifySubscribers({
            type: InputEventType.KEY_UP,
            timestamp: performance.now(),
            data: {
                code: event.code,
                key: event.key,
                shift: event.shiftKey,
                ctrl: event.ctrlKey,
                alt: event.altKey,
                meta: event.metaKey
            }
        });
    };
    
    // Gamepad event handlers
    private handleGamepadConnected = (event: GamepadEvent): void => {
        if (!this.enabled) return;
        
        const gamepad = event.gamepad;
        const state: GamepadState = {
            connected: true,
            index: gamepad.index,
            id: gamepad.id,
            buttons: new Array(gamepad.buttons.length).fill(false),
            buttonValues: new Array(gamepad.buttons.length).fill(0),
            leftStick: vec2.create(),
            rightStick: vec2.create(),
            leftTrigger: 0,
            rightTrigger: 0
        };
        
        this.gamepads.set(gamepad.index, state);
        
        this.notifySubscribers({
            type: InputEventType.GAMEPAD_CONNECTED,
            timestamp: performance.now(),
            data: {
                index: gamepad.index,
                id: gamepad.id
            }
        });
        
        console.log(`Gamepad connected: ${gamepad.id} at index ${gamepad.index}`);
    };
    
    private handleGamepadDisconnected = (event: GamepadEvent): void => {
        if (!this.enabled) return;
        
        const gamepad = event.gamepad;
        this.gamepads.delete(gamepad.index);
        
        this.notifySubscribers({
            type: InputEventType.GAMEPAD_DISCONNECTED,
            timestamp: performance.now(),
            data: {
                index: gamepad.index,
                id: gamepad.id
            }
        });
        
        console.log(`Gamepad disconnected: ${gamepad.id} at index ${gamepad.index}`);
    };
    
    /**
     * Start polling for gamepad state changes
     */
    private startGamepadPolling(): void {
        if (this.gamepadPollingInterval) return;
        
        this.gamepadPollingInterval = window.setInterval(() => {
            this.pollGamepads();
        }, 16); // ~60fps polling
    }
    
    /**
     * Stop polling for gamepad state changes
     */
    private stopGamepadPolling(): void {
        if (this.gamepadPollingInterval) {
            clearInterval(this.gamepadPollingInterval);
            this.gamepadPollingInterval = null;
        }
    }
    
    /**
     * Poll gamepad states
     */
    private pollGamepads(): void {
        if (!this.enabled) return;
        
        const gamepads = navigator.getGamepads();
        
        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (!gamepad) continue;
            
            let state = this.gamepads.get(gamepad.index);
            if (!state) continue;
            
            // Check buttons
            for (let j = 0; j < gamepad.buttons.length; j++) {
                const button = gamepad.buttons[j];
                const wasPressed = state.buttons[j];
                const isPressed = button.pressed;
                
                state.buttonValues[j] = button.value;
                
                if (isPressed && !wasPressed) {
                    state.buttons[j] = true;
                    this.notifySubscribers({
                        type: InputEventType.GAMEPAD_BUTTON_DOWN,
                        timestamp: performance.now(),
                        data: {
                            gamepadIndex: gamepad.index,
                            button: j,
                            value: button.value
                        }
                    });
                } else if (!isPressed && wasPressed) {
                    state.buttons[j] = false;
                    this.notifySubscribers({
                        type: InputEventType.GAMEPAD_BUTTON_UP,
                        timestamp: performance.now(),
                        data: {
                            gamepadIndex: gamepad.index,
                            button: j
                        }
                    });
                }
            }
            
            // Update analog sticks with deadzone
            const leftX = this.applyDeadzone(gamepad.axes[0]);
            const leftY = this.applyDeadzone(gamepad.axes[1]);
            const rightX = this.applyDeadzone(gamepad.axes[2]);
            const rightY = this.applyDeadzone(gamepad.axes[3]);
            
            const leftStickChanged = leftX !== state.leftStick[0] || leftY !== state.leftStick[1];
            const rightStickChanged = rightX !== state.rightStick[0] || rightY !== state.rightStick[1];
            
            if (leftStickChanged || rightStickChanged) {
                vec2.set(state.leftStick, leftX, leftY);
                vec2.set(state.rightStick, rightX, rightY);
                
                this.notifySubscribers({
                    type: InputEventType.GAMEPAD_AXIS_CHANGE,
                    timestamp: performance.now(),
                    data: {
                        gamepadIndex: gamepad.index,
                        leftStick: vec2.clone(state.leftStick),
                        rightStick: vec2.clone(state.rightStick)
                    }
                });
            }
            
            // Update triggers
            state.leftTrigger = gamepad.buttons[6]?.value || 0;
            state.rightTrigger = gamepad.buttons[7]?.value || 0;
        }
    }
    
    /**
     * Apply deadzone to analog stick values
     * @param {number} value - Raw axis value
     * @returns {number} Processed value with deadzone applied
     */
    private applyDeadzone(value: number): number {
        if (Math.abs(value) < this.gamepadDeadzone) {
            return 0;
        }
        
        // Scale the value to account for the deadzone
        const sign = value > 0 ? 1 : -1;
        const scaledValue = (Math.abs(value) - this.gamepadDeadzone) / (1 - this.gamepadDeadzone);
        return sign * scaledValue;
    }
    
    // Window event handlers
    private handleWindowResize = (): void => {
        this.updateCanvasRect();
    };
    
    private handleWindowBlur = (): void => {
        // Clear all pressed keys when window loses focus
        this.keyboardState.keys.clear();
        this.keyboardState.shift = false;
        this.keyboardState.ctrl = false;
        this.keyboardState.alt = false;
        this.keyboardState.meta = false;
        
        // Clear mouse buttons
        this.mouseState.buttons.fill(false);
    };
    
    // Pointer lock
    private handlePointerLockChange = (): void => {
        this.pointerLocked = document.pointerLockElement === this.canvas;
        console.log(`Pointer lock ${this.pointerLocked ? 'acquired' : 'released'}`);
    };
    
    private handlePointerLockError = (): void => {
        console.error('Pointer lock request failed');
    };
    
    /**
     * Subscribe to input events
     * @param {IInputSubscriber} subscriber - The subscriber to add
     */
    public subscribe(subscriber: IInputSubscriber): void {
        this.subscribers.add(subscriber);
    }
    
    /**
     * Unsubscribe from input events
     * @param {IInputSubscriber} subscriber - The subscriber to remove
     */
    public unsubscribe(subscriber: IInputSubscriber): void {
        this.subscribers.delete(subscriber);
    }
    
    /**
     * Notify all subscribers of an input event
     * @param {InputEvent} event - The event to broadcast
     */
    private notifySubscribers(event: InputEvent): void {
        for (const subscriber of this.subscribers) {
            subscriber.onInputEvent(event);
        }
    }
    
    public update(deltaTime: number) : void {
        if(!this.enabled)
            return;

        for (const subscriber of this.subscribers) {
            subscriber.onUpdate(deltaTime);
        }        
    }

    /**
     * Enable the input system
     */
    public enable(): void {
        if (!this.enabled) {
            this.enabled = true;
            this.attachEventListeners();
        }
    }
    
    /**
     * Disable the input system
     */
    public disable(): void {
        if (this.enabled) {
            this.enabled = false;
            this.removeEventListeners();
            this.clearAllStates();
        }
    }
    
    /**
     * Clear all input states
     */
    private clearAllStates(): void {
        // Clear mouse state
        vec2.set(this.mouseState.position, 0, 0);
        vec2.set(this.mouseState.positionNormalized, 0, 0);
        vec2.set(this.mouseState.deltaPosition, 0, 0);
        this.mouseState.buttons.fill(false);
        this.mouseState.wheel = 0;
        this.mouseState.isOverCanvas = false;
        
        // Clear keyboard state
        this.keyboardState.keys.clear();
        this.keyboardState.shift = false;
        this.keyboardState.ctrl = false;
        this.keyboardState.alt = false;
        this.keyboardState.meta = false;
        
        // Clear gamepad states
        this.gamepads.clear();
    }
    
    /**
     * Check if the input system is enabled
     * @returns {boolean} True if enabled
     */
    public isEnabled(): boolean {
        return this.enabled;
    }
    
    /**
     * Get current mouse state
     * @returns {MouseState} Current mouse state
     */
    public getMouseState(): MouseState {
        return { ...this.mouseState };
    }
    
    /**
     * Get current keyboard state
     * @returns {KeyboardState} Current keyboard state
     */
    public getKeyboardState(): KeyboardState {
        return {
            keys: new Set(this.keyboardState.keys),
            shift: this.keyboardState.shift,
            ctrl: this.keyboardState.ctrl,
            alt: this.keyboardState.alt,
            meta: this.keyboardState.meta
        };
    }
    
    /**
     * Get gamepad state by index
     * @param {number} index - Gamepad index
     * @returns {GamepadState | null} Gamepad state or null if not connected
     */
    public getGamepadState(index: number = 0): GamepadState | null {
        const state = this.gamepads.get(index);
        return state ? { ...state } : null;
    }
    
    /**
     * Get all connected gamepads
     * @returns {GamepadState[]} Array of connected gamepad states
     */
    public getAllGamepads(): GamepadState[] {
        return Array.from(this.gamepads.values());
    }
    
    /**
     * Check if a key is currently pressed
     * @param {string | KeyCode} code - Key code to check
     * @returns {boolean} True if the key is pressed
     */
    public isKeyPressed(code: string | KeyCode): boolean {
        return this.keyboardState.keys.has(code);
    }
    
    /**
     * Check if a mouse button is currently pressed
     * @param {MouseButton} button - Mouse button to check
     * @returns {boolean} True if the button is pressed
     */
    public isMouseButtonPressed(button: MouseButton): boolean {
        return this.mouseState.buttons[button] || false;
    }
    
    /**
     * Check if a gamepad button is currently pressed
     * @param {number} gamepadIndex - Gamepad index
     * @param {GamepadButton} button - Button to check
     * @returns {boolean} True if the button is pressed
     */
    public isGamepadButtonPressed(gamepadIndex: number, button: GamepadButton): boolean {
        const state = this.gamepads.get(gamepadIndex);
        return state ? state.buttons[button] || false : false;
    }
    
    /**
     * Request pointer lock for the canvas
     */
    public requestPointerLock(): void {
        if (!this.pointerLocked && this.canvas.requestPointerLock) {
            this.canvas.requestPointerLock();
        }
    }
    
    /**
     * Exit pointer lock
     */
    public exitPointerLock(): void {
        if (this.pointerLocked && document.exitPointerLock) {
            document.exitPointerLock();
        }
    }
    
    /**
     * Check if pointer is locked
     * @returns {boolean} True if pointer is locked
     */
    public isPointerLocked(): boolean {
        return this.pointerLocked;
    }
    
    /**
     * Set gamepad deadzone
     * @param {number} deadzone - Deadzone value (0-1)
     */
    public setGamepadDeadzone(deadzone: number): void {
        this.gamepadDeadzone = Math.max(0, Math.min(1, deadzone));
    }
    
    /**
     * Set whether to prevent context menu
     * @param {boolean} prevent - True to prevent context menu
     */
    public setPreventContextMenu(prevent: boolean): void {
        if (this.preventContextMenu !== prevent) {
            this.preventContextMenu = prevent;
            
            if (this.enabled) {
                if (prevent) {
                    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
                } else {
                    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
                }
            }
        }
    }
    
    /**
     * Dispose of the input manager and clean up resources
     */
    public dispose(): void {
        this.disable();
        this.subscribers.clear();
    }
    
    /**
     * Debug information
     */
    public debugInfo(): void {
        console.log('--- InputManager Debug Info ---');
        console.log('Enabled:', this.enabled);
        console.log('Subscribers count:', this.subscribers.size);
        console.log('Canvas:', this.canvas);
        console.log('Canvas rect:', this.canvasRect);
        console.log('Pointer locked:', this.pointerLocked);
        console.log('Prevent context menu:', this.preventContextMenu);
        console.log('Gamepad deadzone:', this.gamepadDeadzone);
        console.log('Mouse state:', this.mouseState);
        console.log('Keyboard state:', {
            keysPressed: Array.from(this.keyboardState.keys),
            modifiers: {
                shift: this.keyboardState.shift,
                ctrl: this.keyboardState.ctrl,
                alt: this.keyboardState.alt,
                meta: this.keyboardState.meta
            }
        });
        console.log('Connected gamepads:', this.gamepads.size);
        this.gamepads.forEach((state, index) => {
            console.log(`  Gamepad ${index}:`, state);
        });
        console.log('--- End InputManager Debug Info ---');
    }
}