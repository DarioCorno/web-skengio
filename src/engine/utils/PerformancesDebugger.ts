/**
 *  A helper class that wraps the timer query functionality so you can measure the GPU time spent on a render pass. 
 *  You can then use the measured time to compute an FPS value (or simply log the elapsed time)
 *  Usage example:
 *  const perfDebugger = new PerformanceDebugger(gl);
 * function render() {
 *       perfDebugger
 *           .measureRenderPass(() => {
 *           // Insert your rendering code here.
 *           // For example, render your deferred pipeline passes.
 *           drawScene();
 *           })
 *           .then((gpuTimeMs) => {
 *           if (gpuTimeMs >= 0) {
 *               // Calculate approximate FPS based solely on the measured GPU time
 *               const fps = 1000 / gpuTimeMs;
 *               console.log(`GPU Time: ${gpuTimeMs.toFixed(2)} ms, approx FPS: ${fps.toFixed(2)}`);
 *           } else {
 *               console.log("GPU timing measurement unavailable due to disjoint event.");
 *           }
 *           })
 *           .catch((error) => {
 *           console.error("Performance measurement error:", error);
 *           });
 *
 *         requestAnimationFrame(render);
 *       }
 **/
export class PerformancesDebugger {
    private gl: WebGL2RenderingContext;
    //private ext: EXT_disjoint_timer_query_webgl2 | null;
    private ext: EXT_disjoint_timer_query_webgl2 | null;
  
    constructor(gl: WebGL2RenderingContext) {
      this.gl = gl;
      // Try to get the timer query extension
      this.ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
      if (!this.ext) {
        console.warn("EXT_disjoint_timer_query_webgl2 not supported on this device.");
      }
    }
  
    /**
     * Measures the GPU time (in milliseconds) taken by the provided render pass.
     * @param renderPass A function that executes the rendering commands to be measured.
     * @returns A promise that resolves to the elapsed time in milliseconds, or -1 if a disjoint occurred.
     */
    public measureRenderPass(renderPass: () => void): Promise<number> {
      return new Promise((resolve, reject) => {
        if (!this.ext) {
          reject("EXT_disjoint_timer_query_webgl2 not available.");
          return;
        }
  
        const query = this.gl.createQuery();
        if (!query) {
          reject("Unable to create query object.");
          return;
        }
  
        // Start the timer query
        this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
  
        // Execute the render pass
        renderPass();
  
        // End the query
        this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
  
        // Function to check if the query result is available
        const checkQuery = () => {
          if (this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE)) {
            const disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT);
            if (disjoint) {
              console.warn("Disjoint occurred during GPU timing query.");
              resolve(-1);
            } else {
              // The result is in nanoseconds, convert to milliseconds.
              const timeElapsed = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT) as number;
              resolve(timeElapsed / 1e6);
            }
          } else {
            // Wait and check again
            requestAnimationFrame(checkQuery);
          }
        };
  
        requestAnimationFrame(checkQuery);
      });
    }
  }