// src/main.ts
import * as ENGINE from './engine/ENGINE';
import { vec3 } from 'gl-matrix';
import projectJson from './project.json';

// References to scene objects that we want to animate
let camera: ENGINE.Camera | null = null;
let light1: ENGINE.Light | null = null;
let light2: ENGINE.Light | null = null;
let sphere: ENGINE.Mesh | null = null;
let torus: ENGINE.Mesh | null = null;
let rotatingCube: ENGINE.Mesh | null = null;
let floor: ENGINE.Mesh | null = null;
let cameraController: ENGINE.OrbitCameraController | null = null;

// Animation state
let rotation = 0;
let cubeRotationX = 0;
let cubeRotationY = 0;

/**
 * Initialize callback - called once after the first frame
 * Use this to get references to scene objects and set up controllers
 * @param {ENGINE.ProjectManager} manager - The project manager instance
 */
function onInit(manager: ENGINE.ProjectManager): void {
    console.log('Initializing scene references...');
    
    // Get references to scene objects
    camera = manager.getEntityByName("Camera01") as ENGINE.Camera;
    light1 = manager.getEntityByName("Light01") as ENGINE.Light;
    light2 = manager.getEntityByName("Light02") as ENGINE.Light;
    sphere = manager.getEntityByName("Sphere01") as ENGINE.Mesh;
    torus = manager.getEntityByName("Torus01") as ENGINE.Mesh;
    rotatingCube = manager.getEntityByName("RotatingCube") as ENGINE.Mesh;
    
    // Mark torus as static since it won't move
    if (torus) {
        torus.setStatic(true);
        console.log('Torus marked as static');
    }
    
    // Log that we found the rotating cube
    if (rotatingCube) {
        console.log('Rotating cube initialized at origin');
    } else {
        console.warn('Could not find RotatingCube in scene');
    }
    
    // Set up camera controller
    const wm = manager.getWM();
    const inputManager = wm?.getInputManager();
    
    if (inputManager && camera) {
        cameraController = new ENGINE.OrbitCameraController(camera, inputManager, {
            moveSpeed: 0.02,
            rotateSpeed: 0.003,
            zoomSpeed: 0.2,
            minDistance: 2.0,
            maxDistance: 50.0,
            minPolarAngle: 0.1,
            maxPolarAngle: Math.PI - 0.1,
            enableDamping: true,
            dampingFactor: 0.08,
            enableKeyboard: true,
            enableMouse: true,
            enableGamepad: true,
            gamepadIndex: 0
        });
        
        console.log('Camera controller initialized');
        logControls();
    }
}

/**
 * Update callback - called every frame before rendering
 * Use this for animations and game logic
 * @param {ENGINE.ProjectManager} manager - The project manager instance
 * @param {number} deltaTime - Time since last frame in seconds
 * @param {number} time - Total elapsed time in seconds
 */
function onUpdate(manager: ENGINE.ProjectManager, deltaTime: number, time: number): void {
    // Update animation
    rotation += 0.004;
    
    // Animate the rotating cube around X and Y axes
    if (rotatingCube) {
        // Rotate around X axis at one speed
        cubeRotationX += 0.01;
        // Rotate around Y axis at a different speed for interesting pattern
        cubeRotationY += 0.015;
        
        // Apply rotations to the cube
        rotatingCube.setRotation(vec3.fromValues(
            cubeRotationX,
            cubeRotationY,
            0  // Keep Z rotation at 0, or add cubeRotationZ for third axis
        ));
    }
    
    // Animate lights
    if (light1) {
        const distance = 4.5;
        light1.setPosition(vec3.fromValues(
            Math.cos(rotation) * distance,
            0.0,
            Math.sin(rotation) * distance
        ));
    }
    
    if (light2) {
        const distance = 4.5;
        light2.setPosition(vec3.fromValues(
            Math.cos(rotation * 1.5) * distance / 2.0,
            Math.sin(rotation / 2.0) * distance / 2.0,
            Math.sin(rotation * 1.5) * distance / 2.0
        ));
    }
    
    // Animate sphere orbiting around the cube
    if (sphere) {
        const distance = 4.5;
        sphere.setPosition(vec3.fromValues(
            Math.sin(rotation * 1.1) * distance / 1.5,
            0.0,
            Math.cos(rotation * 1.2) * distance / 1.5
        ));
    }
    
    // Update camera controller if it exists
    if (cameraController) {
        cameraController.onUpdate(deltaTime);
    }
}

/**
 * Log control instructions to console
 */
function logControls(): void {
    console.log('=== Controls ===');
    console.log('Mouse:');
    console.log('  - Left Click + Drag: Rotate camera');
    console.log('  - Scroll Wheel: Zoom in/out');
    console.log('Keyboard:');
    console.log('  - W/A/S/D: Move forward/left/backward/right');
    console.log('  - R/F: Move up/down');
    console.log('  - Shift: Move faster');
    console.log('  - Alt: Move slower');
    console.log('  - Space: Reset camera');
    console.log('Gamepad:');
    console.log('  - Left Stick: Move');
    console.log('  - Right Stick: Rotate');
    console.log('  - Triggers: Up/Down');
    console.log('Scene Objects:');
    console.log('  - Rotating Cube: Center (rotating on X and Y axes)');
    console.log('  - Sphere: Orbiting around center');
    console.log('  - Torus: Static at left');
    console.log('  - Lights: Animated orbits');
}

/**
 * Main application entry point
 */
async function main() {
    try {
        console.log('Starting WebGL Engine...');
        
        // Create project manager
        const projectManager = new ENGINE.ProjectManager();
        
        // Load the project
        await projectManager.loadProject(projectJson);
        console.log('Project loaded successfully');
        
        // Start the animation loop with callbacks
        projectManager.startAnimation(onInit, onUpdate);
        
    } catch (error) {
        console.error('Failed to start application:', error);
        
        // Show error to user
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.innerHTML = `
                <div style="color: #ff4444;">
                    Failed to start WebGL engine<br>
                    ${error}
                </div>
            `;
        }
    }
}

// Start the application
main();