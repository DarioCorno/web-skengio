import * as ENGINE from '../ENGINE'
//import * as dat from 'dat.gui';

export interface WindowManagerConfig {
    enableGUI?: boolean;
    showDebug?:boolean;
    useBitmapFontAtlas?: boolean,
    debugMode?: number;    
}
  
export class WindowManager {

    private canvas: HTMLCanvasElement;
    public gl: WebGL2RenderingContext;

    public renderer: ENGINE.Renderer;
  
    private config: WindowManagerConfig;
    private debugShown: boolean = false;

    //private gui: dat.GUI | null = null;
    private isInitialized = false;
  
    public timer : ENGINE.Utils.Timer = new ENGINE.Utils.Timer();
    private fpsCounter: HTMLDivElement;
    private debugFramesCount: number = 0;

    constructor(canvasSelector: string, config?: WindowManagerConfig) {      
      this.config = config || {
        enableGUI : true,
        showDebug : false,
        useBitmapFontAtlas : false,
        debugMode : 0        
      };
  
      //actually initialize gl using config
      this.canvas = document.getElementById(canvasSelector) as HTMLCanvasElement;
      if(!this.canvas) throw new Error('Cannot find canvas element ' + canvasSelector);
      
      this.gl = this.canvas.getContext('webgl2',{
          premultipliedAlpha: false,  // Ask for non-premultiplied alpha
          powerPreference: 'high-performance'
      })!;
      if (!this.gl) throw new Error('WebGL not supported.');     

      this.canvas.addEventListener('webglcontextlost', (event) => { // Context lost
          event.preventDefault(); // Prevent default behavior
          console.warn("WebGL context lost!");
          this.isInitialized = false; // Mark as not initialized
          // ... (Handle context loss - e.g., stop rendering)
      });    
      
      this.canvas.addEventListener('webglcontextrestored', () => { // Context restored
          console.log("WebGL context restored!");
          // ... (Handle context restoration - e.g., re-initialize WebGL state, reload textures)
          this.isInitialized = true; // Mark as initialized
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
      //this.renderer = new ENGINE.ForwardRenderer(this.gl, this.canvas.width, this.canvas.height);        
      this.renderer.setDebugMode(this.config.debugMode ?? 0);
      this.isInitialized = true;

      this.fpsCounter = document.createElement('div');
      if(this.config.enableGUI) {
          // Create FPS counter
          this.fpsCounter.style.position = 'absolute';
          this.fpsCounter.style.top = '10px';
          this.fpsCounter.style.left = '10px';
          this.fpsCounter.style.color = 'white';
          this.fpsCounter.style.backgroundColor = 'rgba(0,0,0,0.5)';
          this.fpsCounter.style.padding = '5px';
          this.fpsCounter.style.fontFamily = "'Courier-New',Courier,monospace";
          this.fpsCounter.style.fontSize = '12px';
          this.fpsCounter.innerHTML = 'FPS: 0<br>Ms :0<br>T   :00:00';
          document.body.appendChild(this.fpsCounter);    
      } else {
          this.fpsCounter.style.display = 'none';
      }

      this.handleResize(window.innerWidth, window.innerHeight);
    }
    
    handleResize(width: number, height: number) {      
        this.canvas.width = width;
        this.canvas.height = height;
        console.log('WindowManager Resize:' + this.canvas.width + ' x ' + this.canvas.height);
        this.renderer?.setSize(width,height);
    }

    update() : void {   
        if(!this.isInitialized) return;
        
        if(!this.timer.running) {
            this.timer.start();
        }
        this.timer.update();
        
        if(!this.config.enableGUI) return;

        this.debugFramesCount++;
        if(this.debugFramesCount > 100) {
            this.debugFramesCount = 0;
            this.fpsCounter.innerHTML = 'FPS : ' + (this.timer.fps).toFixed(2) + '<br>Ms : ' + (this.timer.deltaTime.toFixed(2)) + '<br>T : ' + this.timer.getDisplayTime();
        }
    }
  
    isReady() {
        return this.isInitialized;
    }

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
        console.log('FPS Counter Element:', this.fpsCounter);
        console.log('Current FPS Text:', this.fpsCounter.innerText);
        if (this.renderer) {
            console.log('Renderer Debug Info:');
            this.renderer.debugInfo();
        }
        console.log('--- End WindowManager Debug Info ---');
    }    
  }
  