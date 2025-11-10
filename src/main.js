import * as THREE from 'three';
import initPhysics, { addBox, addGround, addKinematicTrigger } from './physics.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true });
renderer.setPixelRatio(Math.max(1, window.devicePixelRatio));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e13);

// 카메라
const camera = new THREE.PerspectiveCamera(60, 2, 0.1, 200);
camera.position.set(8, 10, 14);
camera.lookAt(0,0,0);

// 기본 조명
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dl = new THREE.DirectionalLight(0xffffff, 0.8);
dl.position.set(5,10,4);
scene.add(dl);

// 바닥
const groundGeo = new THREE.PlaneGeometry(40, 40);
groundGeo.rotateX(-Math.PI/2);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness:0, roughness:1 });
const groundMesh = new THREE.Mesh(groundGeo, groundMat);
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// 물리 초기화
const physics = await initPhysics(scene);

// 물리: 바닥 콜라이더
addGround(physics, { size: [40, 0.2, 40], position: [0, -0.1, 0] });

// 떨어질 박스 몇 개
for (let i=0;i<30;i++){
  const x = (Math.random()-0.5)*12;
  const z = (Math.random()-0.5)*12;
  const y = 4 + Math.random()*6;
  addBox(physics, { size:[1,1,1], position:[x,y,z], color: 0x93c5fd });
}

// “구멍” 트리거: 보이지 않는 원기둥(충돌 off, 센서 on)
const hole = addKinematicTrigger(physics, {
  radius: 2.0, height: 2.0, position:[0,0.5,0],
  onOverlap: (rb/*Rapier RigidBody*/, handle) => {
    // 트리거에 닿은 애들: 바닥 충돌 계층 해제 + 아래로 당김
    // 간단 버전: 위치 y를 서서히 낮추는 임시 처리
    const p = rb.translation();
    rb.setTranslation({ x:p.x, y: p.y - 0.05, z:p.z }, true);
  }
});

// 입력: 마우스로 구멍 위치 이동(바닥 평면 레이캐스트)
const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2();
window.addEventListener('pointermove', (e)=>{
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});
const plane = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
const planeIntersect = new THREE.Vector3();

// 루프
let last = performance.now();
function resize(){
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w,h,false);
  camera.aspect = w/h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize); resize();

function animate(now){
  const dt = Math.min(1/30, (now-last)/1000); last = now;

  // 레이 → 바닥 교점 계산
  ray.setFromCamera(mouse, camera);
  ray.ray.intersectPlane(plane, planeIntersect);
  if (planeIntersect) {
    // 구멍(트리거) 위치를 마우스 교점으로 이동
    hole.setNextKinematicTranslation({ x:planeIntersect.x, y:0.5, z:planeIntersect.z });
  }

  physics.step(dt); // 물리 한 스텝
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
