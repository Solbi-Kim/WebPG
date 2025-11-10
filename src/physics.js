import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export default async function initPhysics(scene){
  await RAPIER.init();
  const gravity = { x:0, y:-9.81, z:0 };
  const world = new RAPIER.World(gravity);
  return { RAPIER, world, scene, bodies: new Map() };
}

export function addGround(p,{ size:[sx,sy,sz], position:[x,y,z] }){
  const { RAPIER, world } = p;
  const rb = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x,y,z));
  const col = RAPIER.ColliderDesc.cuboid(sx/2, sy/2, sz/2);
  world.createCollider(col, rb);
}

export function addBox(p,{ size:[sx,sy,sz], position:[x,y,z], color=0xffffff }){
  const { RAPIER, world, scene, bodies } = p;

  // Three
  const geo = new THREE.BoxGeometry(sx,sy,sz);
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true; mesh.receiveShadow = true;
  scene.add(mesh);

  // Rapier
  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(x,y,z)
  );
  const col = RAPIER.ColliderDesc.cuboid(sx/2, sy/2, sz/2)
    .setFriction(0.6).setRestitution(0.1);
  world.createCollider(col, rb);

  bodies.set(rb.handle, { mesh, rb });

  // 동기화 훅
  if (!p._synced){
    p._synced = true;
    p.step = (dt)=>{
      world.timestep = dt; world.step();
      bodies.forEach(({ mesh, rb })=>{
        const t = rb.translation(), r = rb.rotation();
        mesh.position.set(t.x, t.y, t.z);
        mesh.quaternion.set(r.x, r.y, r.z, r.w);
      });
    };
  }
  return rb;
}

export function addKinematicTrigger(p,{ radius, height, position:[x,y,z], onOverlap }){
  const { RAPIER, world, bodies } = p;
  const rb = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x,y,z)
  );
  // 센서(트리거): 충돌은 감지하되 힘은 전달X
  const col = RAPIER.ColliderDesc.cylinder(height/2, radius).setSensor(true);
  world.createCollider(col, rb);

  // 오버랩 감지 간단 버전(폴링)
  const tmp = new RAPIER.Vector3(0,0,0);
  const q = new RAPIER.Quaternion(0,0,0,1);
  const handle = rb.handle;

  // step에 후처리 추가
  const prevStep = p.step;
  p.step = (dt)=>{
    prevStep?.(dt);
    // 근처 바디들 대충 폴링(실전은 narrow-phase 이벤트 리스너 사용)
    bodies.forEach(({ rb:other })=>{
      if (other.handle === handle) return;
      // 원통 근사: xy 평면 거리로 판정(라프하게)
      const t1 = rb.translation(), t2 = other.translation();
      const dx = t1.x - t2.x, dz = t1.z - t2.z;
      if (dx*dx + dz*dz <= radius*radius && Math.abs(t1.y - t2.y) < height){
        onOverlap?.(other, handle);
      }
    });
  };

  return rb;
}
