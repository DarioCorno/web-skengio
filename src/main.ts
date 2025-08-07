// src/main.ts
import * as ENGINE from './engine/ENGINE';
import { vec3, vec4 } from 'gl-matrix';
import projectJson from './project.json'

async function main() {
  
  const demo = new ENGINE.ProjectManager();
  await demo.loadProject(projectJson);
  const wm = demo.getWM();

  const renderer = wm?.renderer as ENGINE.DeferredRenderer;
  const inputManager = wm?.getInputManager();

  let cameraController: ENGINE.OrbitCameraController | null = null;
  
  window.addEventListener('resize', (ev) => {
    demo.handleResize();
  });

  const camera = demo.getEntityByName("Camera01");
  const light1 = demo.getEntityByName("Light01") as ENGINE.Light;
  const light2 = demo.getEntityByName("Light02") as ENGINE.Light;
  const sphere = demo.getEntityByName("Sphere01") as ENGINE.Mesh;
  let rot = 0;

  if (inputManager) {
    
    if (camera) {
      // Create the orbit camera controller with custom configuration
      cameraController = new ENGINE.OrbitCameraController(camera, inputManager, {
        moveSpeed: 0.02,           // Units per second
        rotateSpeed: 0.003,       // Radians per pixel
        zoomSpeed: 0.2,           // Zoom multiplier
        minDistance: 2.0,         // Minimum zoom distance
        maxDistance: 50.0,        // Maximum zoom distance
        minPolarAngle: 0.1,       // Prevent going through top
        maxPolarAngle: Math.PI - 0.1, // Prevent going through bottom
        enableDamping: true,      // Smooth camera movement
        dampingFactor: 0.08,      // Damping strength
        enableKeyboard: true,     // Enable WASD controls
        enableMouse: true,        // Enable mouse rotation
        enableGamepad: true,      // Enable gamepad support
        gamepadIndex: 0          // Use first gamepad
      });
      
      console.log('OrbitCameraController initialized');
      console.log('Controls:');
      console.log('  - Left Mouse + Drag: Rotate camera');
      console.log('  - Mouse Wheel: Zoom in/out');
      console.log('  - W/A/S/D: Move forward/left/backward/right');
      console.log('  - R/F: Move up/down');
      console.log('  - Shift: Move faster');
      console.log('  - Alt: Move slower');
      console.log('  - Space: Reset camera');
      console.log('  - Gamepad: Left stick to move, right stick to rotate');
    }
  } else {
    console.warn('InputManager not available - camera controls disabled');
  }
    
  function animate() {
    requestAnimationFrame(animate);
    
    // Get timer reference
    const timer = wm?.timer;
    if (!timer) return;
    
    const time = timer.getTime();
    const deltaTime = time.deltaTime;

    // Update animation
    rot += 0.004;

    const distance = 4.5;
    light1.position[0] = Math.cos(rot) * distance;
    light1.position[1] = 0.0;
    light1.position[2] = Math.sin(rot) * distance;
    
    light2.position[0] = Math.cos(rot * 1.5) * distance / 2.0;
    light2.position[1] = Math.sin(rot / 2.0) * distance / 2.0;
    light2.position[2] = Math.sin(rot * 1.5) * distance / 2.0;

    sphere.position[0] = Math.sin(rot * 1.1) * distance / 1.5;
    sphere.position[1] = 0.0; 
    sphere.position[2] = Math.cos(rot * 1.2) * distance / 1.5;

    // Update scene
    demo.update();
    
    // Start render timing
    timer.startRender();
    
    // Perform rendering
    demo.render();
    
    // End render timing and calculate render-based FPS
    timer.endRender();
    
    // Optional: Log performance stats every 60 frames
    //if (timer.renderFrameCount % 60 === 0) {
    //  console.log(timer.getPerformanceString());
    //}
  }

  let loading = document.getElementById('loading-screen');
  if(loading) {
    loading.style.display = 'none';
  }
  demo.handleResize();
  requestAnimationFrame(animate);
}

main().catch(err => console.error('Error in main loop:', err));