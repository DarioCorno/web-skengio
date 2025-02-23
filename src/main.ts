// src/main.ts
import * as ENGINE from './engine/ENGINE';
import { vec3, vec4 } from 'gl-matrix';
import projectJson from './project.json'

async function main() {
  console.log('Initializing scene...');
  
  const demo = new ENGINE.ProjectManager();
  await demo.loadProject(projectJson);
  const wm = demo.getWM();

  window.addEventListener('resize', (ev) => {
    demo.handleResize();
  });

  //const cube = demo.getEntityByName("Cube01") as ENGINE.Mesh;
  //const torus = demo.getEntityByName("Torus01") as ENGINE.Mesh;
  const light1 = demo.getEntityByName("Light01") as ENGINE.Light;
  const light2 = demo.getEntityByName("Light02") as ENGINE.Light;
  const sphere = demo.getEntityByName("Sphere01") as ENGINE.Mesh;
  let rot = 0;
  function animate() {

    requestAnimationFrame(animate);
    const time = wm?.timer.getTime();
    const deltaTime = time.deltaTime;

    rot += 0.004;

    //cube.rotation[0] += deltaTime * 0.00002;
    //cube.rotation[1] += deltaTime * 0.00007;
    //cube.rotation[2] += deltaTime * 0.0002;
    //torus.rotation[0] += deltaTime * 0.0001;
    //torus.rotation[1] += deltaTime * 0.00015;
    //torus.rotation[2] += deltaTime * 0.0002;

    const distance = 4.5;
    light1.position[0] = Math.cos(rot) * distance;
    light1.position[1] = 0.0; //Math.sin(time.elapsed / 20000.0) * 3.1;
    light1.position[2] = Math.sin(rot) * distance;
    
    light2.position[0] = Math.cos(rot * 1.5) * distance/ 2.0;
    light2.position[1] = Math.sin(rot / 2.0) * distance/ 2.0;
    light2.position[2] = Math.sin(rot * 1.5) * distance/ 2.0;

    sphere.position[0] = Math.sin(rot * 1.1) * distance / 1.5;
    sphere.position[1] = 0.0; 
    sphere.position[2] = Math.cos(rot * 1.2) * distance / 1.5;

    demo.update();
    demo.render();
        
  }

  let loading = document.getElementById('loading-screen');
  if(loading) {
    loading.style.display = 'none';
  }
  demo.handleResize();
  requestAnimationFrame(animate);
}

main().catch(err => console.error('Error in main loop:', err));
