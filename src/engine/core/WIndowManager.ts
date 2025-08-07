// src/engine/core/WindowManager.ts
import * as ENGINE from '../ENGINE'
import { InputManager, IInputSubscriber } from '../input/InputManager';

export interface WindowManagerConfig {
    enableGUI?: boolean;
    showDebug?: boolean;
    useBitmapFontAtlas?: boolean;
    debugMode?: number;
    enableInput?: boolean;  // New option for input system
}
  
export class WindowManager {
    private canvas: HTMLCanvasElement;
    public gl: WebGL2RenderingContext;
    public renderer: ENGINE.Renderer;
    private config: WindowManagerConfig;
    private debugShown: boolean = false;
    private isInitialized = false;
    public timer: ENGINE.Utils.Timer = new ENGINE.Utils.Timer();
    private fpsCounter: HTMLDivElement;
    private debugFramesCount: number = 0;
    
    // Input management
    public inputManager: InputManager | null = null;
    
    // New: Extended FPS display mode
    private extendedFPSDisplay: boolean = true;

    constructor(canvasSelector: string, config?: WindowManagerConfig) {      
        this.config = config || {
            enableGUI: true,
            showDebug: false,
            useBitmapFontAtlas: false,
            debugMode: 0,
            enableInput: true  // Enable input by default     
        };
    
        // Initialize GL using config
        this.canvas = document.getElementById(canvasSelector) as HTMLCanvasElement;
        if(!this.canvas) throw new Error('Cannot find canvas element ' + canvasSelector);
        
        this.gl = this.canvas.getContext('webgl2', {
            depth: true,
            premultipliedAlpha: false,
            powerPreference: 'high-performance'
        })!;
        if (!this.gl) throw new Error('WebGL not supported.');     

        this.canvas.addEventListener('webglcontextlost', (event) => {
            event.preventDefault();
            console.warn("WebGL context lost!");
            this.isInitialized = false;
            
            // Disable input on context loss
            if (this.inputManager) {
                this.inputManager.disable();
            }
        });    
        
        this.canvas.addEventListener('webglcontextrestored', () => {
            console.log("WebGL context restored!");
            this.isInitialized = true;
            
            // Re-enable input on context restoration
            if (this.inputManager && this.config.enableInput) {
                this.inputManager.enable();
            }
        });      

        if (!this.gl.getExtension("EXT_color_buffer_float")) {
            throw new Error("FLOAT color buffer not available");
        }
        
        // Get renderer & vendor info
        const debugInfo = this.gl.getExtension("WEBGL_debug_renderer_info");
        if (debugInfo) {
            console.log("Renderer:", this.gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
            console.log("Vendor:", this.gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
        }      

        this.renderer = new ENGINE.DeferredRenderer(this.gl, this.canvas.width, this.canvas.height);        
        this.renderer.setDebugMode(this.config.debugMode ?? 0);
        this.isInitialized = true;
        
        // Initialize input manager if enabled
        if (this.config.enableInput) {
            this.inputManager = new InputManager(this.canvas, true);
            console.log('InputManager initialized');
        }

        this.fpsCounter = document.createElement('div');
        if(this.config.enableGUI) {
            // Create enhanced FPS counter
            this.fpsCounter.style.position = 'absolute';
            this.fpsCounter.style.top = '10px';
            this.fpsCounter.style.left = '10px';
            this.fpsCounter.style.color = 'white';
            this.fpsCounter.style.backgroundColor = 'rgba(0,0,0,0.7)';
            this.fpsCounter.style.padding = '8px';
            this.fpsCounter.style.fontFamily = "'Courier New', Courier, monospace";
            this.fpsCounter.style.fontSize = '11px';
            this.fpsCounter.style.lineHeight = '1.4';
            this.fpsCounter.style.borderRadius = '4px';
            this.fpsCounter.style.minWidth = '200px';
            this.fpsCounter.innerHTML = this.getDefaultFPSHTML();
            document.body.appendChild(this.fpsCounter);
            
            // Add click handler to toggle display modes
            this.fpsCounter.style.cursor = 'pointer';
            this.fpsCounter.addEventListener('click', () => {
                this.extendedFPSDisplay = !this.extendedFPSDisplay;
            });
            
            // Add keyboard shortcut info if input is enabled
            if (this.inputManager) {
                this.setupDebugKeyboardShortcuts();
            }
        } else {
            this.fpsCounter.style.display = 'none';
        }

        this.handleResize(window.innerWidth, window.innerHeight);
    }
    
    /**
     * Setup debug keyboard shortcuts
     */
    private setupDebugKeyboardShortcuts(): void {
        if (!this.inputManager) return;
        
        // Create a simple input subscriber for debug controls
        const debugSubscriber: IInputSubscriber = {
            onUpdate(deltaTime: number) : void {

            },
            onInputEvent: (event) => {
                if (event.type === 'keydown' && !event.data.repeat) {
                    switch (event.data.code) {
                        case 'F1':
                            // Toggle FPS display
                            this.toggleFPSDisplay();
                            break;
                        case 'F2':
                            // Toggle extended FPS display mode
                            this.toggleFPSDisplayMode();
                            break;
                        case 'F3':
                            // Reset performance stats
                            this.resetPerformanceStats();
                            console.log('Performance stats reset');
                            break;
                        case 'F4':
                            // Debug info to console
                            if (event.data.shift) {
                                this.debugInfo();
                            }
                            break;
                        case 'KeyI':
                            // Toggle input system with Ctrl+I
                            if (event.data.ctrl) {
                                this.toggleInput();
                            }
                            break;
                    }
                }
            }
        };
        
        this.inputManager.subscribe(debugSubscriber);
    }
    
    /**
     * Toggle FPS display visibility
     */
    private toggleFPSDisplay(): void {
        if (this.fpsCounter) {
            this.fpsCounter.style.display = 
                this.fpsCounter.style.display === 'none' ? 'block' : 'none';
        }
    }
    
    /**
     * Toggle input system on/off
     */
    private toggleInput(): void {
        if (this.inputManager) {
            const isEnabled = this.inputManager.isEnabled();
            this.setInputEnabled(!isEnabled);
            console.log(`Input system ${!isEnabled ? 'enabled' : 'disabled'}`);
        }
    }
    
    /**
     * Get default HTML for FPS display
     * @returns {string} Default HTML content
     */
    private getDefaultFPSHTML(): string {
        const inputInfo = this.inputManager ? 
            '<br><span style="font-size: 9px; color: #888">F1: Toggle | F2: Mode | Ctrl+I: Input</span>' : '';
        
        return 'RAF FPS : 0.0<br>' +
               'Render  : 0.0<br>' +
               'Ms      : 0.00<br>' +
               'Time    : 00:00' +
               inputInfo;
    }
    
    /**
     * Format FPS display based on current mode
     * @returns {string} Formatted HTML for FPS counter
     */
    private formatFPSDisplay(): string {
        const stats = this.timer.getPerformanceStats();
        const time = this.timer.getTime();
        
        // Get input status if available
        const inputStatus = this.inputManager ? 
            (this.inputManager.isEnabled() ? 
                '<span style="color: #4fc3f7">●</span>' : 
                '<span style="color: #888">○</span>') : '';
        
        if (this.extendedFPSDisplay) {
            // Get additional input info
            let inputInfo = '';
            if (this.inputManager && this.inputManager.isEnabled()) {
                const mouseState = this.inputManager.getMouseState();
                const keyboardState = this.inputManager.getKeyboardState();
                const gamepads = this.inputManager.getAllGamepads();
                
                inputInfo = `<span style="color: #9c88ff">Input    :</span> ${inputStatus} ` +
                           `M[${mouseState.buttons.filter(b => b).length}] ` +
                           `K[${keyboardState.keys.size}] ` +
                           `G[${gamepads.length}]<br>`;
            }
            
            // Extended display with all metrics
            return `<strong>Performance Monitor</strong><br>` +
                   `<span style="color: #4fc3f7">RAF FPS  :</span> ${stats.rafFPS.toFixed(1)}<br>` +
                   `<span style="color: #81c784">Real FPS :</span> ${stats.renderFPS.toFixed(1)}<br>` +
                   `<span style="color: #ffb74d">Effect.  :</span> ${stats.effectiveFPS.toFixed(1)}<br>` +
                   `<span style="color: #e57373">Render   :</span> ${stats.lastRenderTime.toFixed(2)}ms<br>` +
                   `<span style="color: #ba68c8">Avg      :</span> ${stats.movingAvgRenderTime.toFixed(2)}ms<br>` +
                   `<span style="color: #64b5f6">Min/Max  :</span> ${stats.minRenderTime.toFixed(1)}/${stats.maxRenderTime.toFixed(1)}<br>` +
                   inputInfo +
                   `<span style="color: #aed581">Time     :</span> ${this.timer.getDisplayTime()}<br>` +
                   `<span style="font-size: 9px; color: #888">(Click to toggle | F1-F4: Debug)</span>`;
        } else {
            // Simple display
            const shortcuts = this.inputManager ? ' | F1/F2: Display' : '';
            return `RAF FPS : ${stats.rafFPS.toFixed(1)} ${inputStatus}<br>` +
                   `Render  : ${stats.renderFPS.toFixed(1)}<br>` +
                   `Ms      : ${stats.lastRenderTime.toFixed(2)}<br>` +
                   `Time    : ${this.timer.getDisplayTime()}` +
                   `<span style="font-size: 9px; color: #888">${shortcuts}</span>`;
        }
    }
    
    /**
     * Handle window resize
     * @param {number} width - New width
     * @param {number} height - New height
     */
    handleResize(width: number, height: number): void {      
        this.canvas.width = width;
        this.canvas.height = height;
        console.log('WindowManager Resize:' + this.canvas.width + ' x ' + this.canvas.height);
        this.renderer?.setSize(width, height);
        
        // InputManager automatically handles resize through its window resize listener
    }

    /**
     * Update timing and FPS display
     */
    update(): void {   
        if(!this.isInitialized) return;
        
        if(!this.timer.running) {
            this.timer.start();
        }
        this.timer.update();

        if(this.inputManager) {
            this.inputManager.update(this.timer.deltaTime);
        }
        
        if(!this.config.enableGUI) return;

        this.debugFramesCount++;
        
        // Update display more frequently for smoother feedback
        if(this.debugFramesCount > 30) { // Update every 30 frames instead of 100
            this.debugFramesCount = 0;
            this.fpsCounter.innerHTML = this.formatFPSDisplay();
        }
    }
  
    /**
     * Check if renderer is ready
     * @returns {boolean} True if initialized
     */
    isReady(): boolean {
        return this.isInitialized;
    }
    
    /**
     * Toggle extended FPS display mode
     */
    toggleFPSDisplayMode(): void {
        this.extendedFPSDisplay = !this.extendedFPSDisplay;
    }
    
    /**
     * Reset performance statistics
     */
    resetPerformanceStats(): void {
        this.timer.resetStats();
    }
    
    /**
     * Enable or disable the input system
     * @param {boolean} enabled - Whether to enable or disable input
     */
    setInputEnabled(enabled: boolean): void {
        if (this.inputManager) {
            if (enabled) {
                this.inputManager.enable();
            } else {
                this.inputManager.disable();
            }
        }
    }
    
    /**
     * Get the input manager instance
     * @returns {InputManager | null} The input manager or null if not initialized
     */
    getInputManager(): InputManager | null {
        return this.inputManager;
    }
    
    /**
     * Subscribe to input events
     * @param {IInputSubscriber} subscriber - The subscriber to add
     */
    subscribeToInput(subscriber: IInputSubscriber): void {
        if (this.inputManager) {
            this.inputManager.subscribe(subscriber);
        }
    }
    
    /**
     * Unsubscribe from input events
     * @param {IInputSubscriber} subscriber - The subscriber to remove
     */
    unsubscribeFromInput(subscriber: IInputSubscriber): void {
        if (this.inputManager) {
            this.inputManager.unsubscribe(subscriber);
        }
    }
    
    /**
     * Request pointer lock for FPS-style controls
     */
    requestPointerLock(): void {
        if (this.inputManager) {
            this.inputManager.requestPointerLock();
        }
    }
    
    /**
     * Exit pointer lock
     */
    exitPointerLock(): void {
        if (this.inputManager) {
            this.inputManager.exitPointerLock();
        }
    }
    
    /**
     * Check if pointer is locked
     * @returns {boolean} True if pointer is locked
     */
    isPointerLocked(): boolean {
        return this.inputManager ? this.inputManager.isPointerLocked() : false;
    }
    
    /**
     * Set gamepad deadzone
     * @param {number} deadzone - Deadzone value (0-1)
     */
    setGamepadDeadzone(deadzone: number): void {
        if (this.inputManager) {
            this.inputManager.setGamepadDeadzone(deadzone);
        }
    }
    
    /**
     * Clean up resources including input manager
     */
    dispose(): void {
        if (this.inputManager) {
            this.inputManager.dispose();
            this.inputManager = null;
        }
        
        if (this.fpsCounter && this.fpsCounter.parentNode) {
            this.fpsCounter.parentNode.removeChild(this.fpsCounter);
        }
        
        if (this.renderer) {
            // Note: renderer should have its own dispose method
            // this.renderer.dispose();
        }
        
        this.isInitialized = false;
    }
    
    /**
     * Debug information
     */
    debugInfo(): void {
        console.log('--- WindowManager Debug Info ---');
        console.log('Canvas Element:', this.canvas);
        console.log(`Canvas Dimensions: ${this.canvas.width} x ${this.canvas.height}`);
        console.log('WebGL Context:', this.gl);
        if (this.gl) {
            const debugInfo = this.gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                console.log('Renderer:', this.gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
                console.log('Vendor:', this.gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
            } else {
                console.log('WEBGL_debug_renderer_info extension not available.');
            }
        }
        console.log('Configuration:', this.config);
        console.log('Is Initialized:', this.isInitialized);
        console.log('Extended FPS Display:', this.extendedFPSDisplay);
        console.log('Timer Performance Stats:', this.timer.getPerformanceStats());
        
        if (this.inputManager) {
            console.log('--- Input System ---');
            console.log('Input Manager Enabled:', this.inputManager.isEnabled());
            
            if (this.inputManager.isEnabled()) {
                const mouseState = this.inputManager.getMouseState();
                const keyboardState = this.inputManager.getKeyboardState();
                const gamepads = this.inputManager.getAllGamepads();
                
                console.log('Mouse Position:', mouseState.position);
                console.log('Mouse Buttons Pressed:', mouseState.buttons.map((b, i) => b ? i : null).filter(b => b !== null));
                console.log('Keys Pressed:', Array.from(keyboardState.keys));
                console.log('Modifiers:', {
                    shift: keyboardState.shift,
                    ctrl: keyboardState.ctrl,
                    alt: keyboardState.alt,
                    meta: keyboardState.meta
                });
                console.log('Connected Gamepads:', gamepads.length);
                
                gamepads.forEach((gamepad, index) => {
                    console.log(`  Gamepad ${index}: ${gamepad.id}`);
                    if (gamepad.leftStick[0] !== 0 || gamepad.leftStick[1] !== 0) {
                        console.log(`    Left Stick: [${gamepad.leftStick[0].toFixed(2)}, ${gamepad.leftStick[1].toFixed(2)}]`);
                    }
                    if (gamepad.rightStick[0] !== 0 || gamepad.rightStick[1] !== 0) {
                        console.log(`    Right Stick: [${gamepad.rightStick[0].toFixed(2)}, ${gamepad.rightStick[1].toFixed(2)}]`);
                    }
                    const pressedButtons = gamepad.buttons.map((b, i) => b ? i : null).filter(b => b !== null);
                    if (pressedButtons.length > 0) {
                        console.log(`    Buttons Pressed:`, pressedButtons);
                    }
                });
            }
            
            // Full debug info from InputManager
            this.inputManager.debugInfo();
        } else {
            console.log('Input Manager: Not initialized');
        }
        
        if (this.renderer) {
            console.log('Renderer Debug Info:');
            // this.renderer.debugInfo();
        }
        console.log('--- End WindowManager Debug Info ---');
    }    
}