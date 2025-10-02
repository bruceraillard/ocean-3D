<template>
  <div class="wrap" @pointermove="onPointerMove" @click="onClick">
    <canvas ref="canvasRef" class="webgl"></canvas>

    <div
        v-show="tooltip.visible"
        class="tooltip"
        :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
    >
      {{ tooltip.text }}
    </div>

    <div class="hud">
      <button class="hud-btn" @click="recenterCamera()">Recentrer</button>
      <span class="hud-info">Thons: {{ ocean.filteredRows.length }}</span>
    </div>
  </div>
</template>

<script setup>
import {onMounted, onBeforeUnmount, ref, watch, nextTick} from 'vue'
import * as THREE from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js'
import {clone} from 'three/examples/jsm/utils/SkeletonUtils.js'
import {EffectComposer} from 'three/examples/jsm/postprocessing/EffectComposer.js'
import {RenderPass} from 'three/examples/jsm/postprocessing/RenderPass.js'
import {UnrealBloomPass} from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

import {useOceanStore} from '../stores/ocean.js'

const ocean = useOceanStore()
const canvasRef = ref(null)

let renderer, scene, camera, controls, rafId, composer
let raycaster, pointer, clock
let groupSchool // parent group for all fish
let hovered = null

const tooltip = ref({visible: false, x: 0, y: 0, text: ''})

// Model & animations
let tunaModel = null
const mixers = []
const agents = [] // { root, velocity, speed, row }

// Bounds (aquarium)
const BOUNDS = new THREE.Vector3(8, 4, 8)
const CENTER = new THREE.Vector3(0, 1.5, 0)
const MAX_FISH = 50

// Sol & marges
const FLOOR_Y = 0
const CLEARANCE = 0.35
const CEILING_MARGIN = 0.3
const MIN_Y = FLOOR_Y + CLEARANCE
const MAX_Y = BOUNDS.y - CEILING_MARGIN

// tooltip
function setTooltip(text = '', x = 0, y = 0) {
  if (text) tooltip.value = {visible: true, x, y, text}
  else tooltip.value.visible = false
}

// Resize
function onResize() {
  if (!canvasRef.value || !camera) return
  const parent = canvasRef.value.parentElement
  const w = parent.clientWidth
  const h = Math.max(parent.clientHeight, 500)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h, false)
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  composer?.setSize(w, h)
}

// Recentrage
function recenterCamera() {
  if (!camera) return
  camera.position.set(0, 2.2, 8)
  if (controls) {
    controls.target.copy(CENTER)
    controls.update()
  }
}

// Hover
function clearHover() {
  if (!hovered) return
  hovered.scale.set(1, 1, 1)
  setTooltip('')
  hovered = null
}

function onPointerMove(e) {
  if (!groupSchool) return
  const hits = getIntersections(e.clientX, e.clientY)
  const hit = hits.find(h => h.object?.userData?.isFishPart)
  if (!hit) {
    clearHover();
    return
  }
  const root = getFishRoot(hit.object)
  if (hovered && hovered !== root) hovered.scale.set(1, 1, 1)
  hovered = root
  hovered.scale.set(1.08, 1.08, 1.08)
  const row = hovered.userData?.row
  const title = row ? `${row.type_poissons} — ${row.description}` : 'Thon'
  setTooltip(title, e.clientX + 12, e.clientY + 12)
}

function onClick(e) {
  if (!groupSchool) return
  const hits = getIntersections(e.clientX, e.clientY)
  const hit = hits.find(h => h.object?.userData?.isFishPart)
  if (!hit) return
  const root = getFishRoot(hit.object)
  const row = root.userData?.row
  if (row) ocean.select(row)
}

function getFishRoot(obj) {
  let cur = obj
  while (cur && !cur.userData?.isFishRoot) cur = cur.parent
  return cur || obj
}

function getIntersections(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect()
  const x = ((clientX - rect.left) / rect.width) * 2 - 1
  const y = -((clientY - rect.top) / rect.height) * 2 + 1
  pointer.set(x, y)
  raycaster.setFromCamera(pointer, camera)
  return raycaster.intersectObjects(groupSchool ? groupSchool.children : [], true)
}

// GLB loader
async function loadTunaModel() {
  if (tunaModel) return tunaModel
  const loader = new GLTFLoader()
  try {
    const gltf = await loader.loadAsync('/models/tuna.glb')
    tunaModel = gltf
  } catch (e) {
    console.warn('GLB load failed, using fallback capsule', e)
    tunaModel = {
      scene: new THREE.Mesh(
          new THREE.CapsuleGeometry(0.2, 0.6, 4, 12),
          new THREE.MeshStandardMaterial({color: 0x66c5ff, roughness: 0.5})
      ),
      animations: []
    }
  }
  return tunaModel
}

// utils
function randomInBox() {
  const spanY = Math.max(0.2, MAX_Y - MIN_Y)
  return new THREE.Vector3(
      (Math.random() - 0.5) * 2 * BOUNDS.x,
      MIN_Y + Math.random() * spanY,
      (Math.random() - 0.5) * 2 * BOUNDS.z
  )
}

function randomDir() {
  const v = new THREE.Vector3(Math.random() - 0.5, (Math.random() - 0.5) * 0.2, Math.random() - 0.5)
  return v.normalize()
}

function alignToVelocity(obj, vel, slerp = 0.1) {
  const target = new THREE.Vector3().copy(obj.position).add(vel)
  const q = new THREE.Quaternion()
  const m = new THREE.Matrix4()
  m.lookAt(obj.position, target, new THREE.Vector3(0, 1, 0))
  q.setFromRotationMatrix(m).invert()
  obj.quaternion.slerp(q, slerp)
}

// Dispose
function disposeSchool() {
  if (!groupSchool) return
  scene.remove(groupSchool)
  groupSchool = null
  mixers.splice(0, mixers.length)
  agents.splice(0, agents.length)
}

// Build school
async function buildSchool(rows) {
  if (!scene || !renderer) return
  disposeSchool()
  groupSchool = new THREE.Group()
  scene.add(groupSchool)

  const {scene: baseScene, animations} = await loadTunaModel()
  const clip = animations && animations[0] ? animations[0] : null

  const count = Math.min(rows.length, MAX_FISH)
  for (let i = 0; i < count; i++) {
    const row = rows[i]
    const root = clone(baseScene)
    root.userData.isFishRoot = true
    root.userData.row = row
    root.traverse(n => {
      if (n.isMesh) n.userData.isFishPart = true
    })

    // Échelle selon decompte (optionnel)
    const dec = Number(row.decompte ?? 0)
    const s = 0.8 + Math.min(1, dec / 5) * 0.6
    root.scale.setScalar(s)

    root.position.copy(randomInBox())
    groupSchool.add(root)

    const velocity = randomDir().multiplyScalar(1 + Math.random() * 0.8)
    agents.push({root, velocity, speed: 1 + Math.random() * 0.6, row})

    if (clip) {
      const mixer = new THREE.AnimationMixer(root)
      const action = mixer.clipAction(clip)
      action.play()
      mixers.push(mixer)
    }
  }
}

// Flocking update
function updateSchool(dt) {
  const desiredSep = 0.6
  const neighborDist = 2.2
  const alignFactor = 0.5
  const cohFactor = 0.25
  const sepFactor = 0.9

  const tmp = new THREE.Vector3()
  const avg = new THREE.Vector3()
  const sep = new THREE.Vector3()
  const steer = new THREE.Vector3()

  for (let i = 0; i < agents.length; i++) {
    const a = agents[i]
    avg.set(0, 0, 0)
    sep.set(0, 0, 0)
    steer.set(0, 0, 0)
    let countAlign = 0
    let countCoh = 0

    for (let j = 0; j < agents.length; j++) {
      if (i === j) continue
      const b = agents[j]
      const d = a.root.position.distanceTo(b.root.position)
      if (d < neighborDist) {
        avg.add(b.velocity);
        countAlign++
        steer.add(b.root.position);
        countCoh++
        if (d < desiredSep) {
          tmp.copy(a.root.position).sub(b.root.position).normalize().divideScalar(Math.max(0.1, d))
          sep.add(tmp)
        }
      }
    }
    if (countAlign > 0) {
      avg.divideScalar(countAlign).normalize().multiplyScalar(alignFactor)
      a.velocity.addScaledVector(avg, dt)
    }
    if (countCoh > 0) {
      steer.divideScalar(countCoh).sub(a.root.position).normalize().multiplyScalar(cohFactor)
      a.velocity.addScaledVector(steer, dt)
    }
    a.velocity.addScaledVector(sep, sepFactor * dt)

    // Attraction douce vers le centre
    tmp.copy(CENTER).sub(a.root.position).multiplyScalar(0.06 * dt)
    a.velocity.add(tmp)

    // “Wander” léger
    a.velocity.x += (Math.random() - 0.5) * 0.15 * dt
    a.velocity.y += (Math.random() - 0.5) * 0.05 * dt
    a.velocity.z += (Math.random() - 0.5) * 0.15 * dt

    // bounds latéraux
    const p = a.root.position
    if (Math.abs(p.x) > BOUNDS.x) a.velocity.x += (p.x > 0 ? -1 : 1) * 0.5 * dt
    if (Math.abs(p.z) > BOUNDS.z) a.velocity.z += (p.z > 0 ? -1 : 1) * 0.5 * dt

    // sol/plafond
    if (p.y < MIN_Y + 0.2) a.velocity.y += 0.9 * dt
    if (p.y > MAX_Y - 0.2) a.velocity.y -= 0.9 * dt

    // vitesses min/max
    const maxSpd = 1.6 * a.speed
    const minSpd = 0.6
    const spd = a.velocity.length()
    if (spd > maxSpd) a.velocity.multiplyScalar(maxSpd / spd)
    if (spd < minSpd) a.velocity.multiplyScalar((minSpd + 0.0001) / (spd + 0.0001))

    // intégration
    tmp.copy(a.velocity).multiplyScalar(dt * 2.0)
    a.root.position.add(tmp)

    // clamp final (ne jamais dépasser)
    a.root.position.y = Math.max(MIN_Y, Math.min(a.root.position.y, MAX_Y))

    // orientation vers la vitesse
    alignToVelocity(a.root, a.velocity, 0.12)
  }
}

onMounted(async () => {
  scene = new THREE.Scene()
  scene.background = new THREE.Color('#071421')
  scene.fog = new THREE.FogExp2(0x0a2638, 0.08)

  camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000)

  renderer = new THREE.WebGLRenderer({canvas: canvasRef.value, antialias: true})
  renderer.outputColorSpace = THREE.SRGBColorSpace

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.minDistance = 2
  controls.maxDistance = 20
  controls.target.copy(CENTER)
  recenterCamera()

  // lights
  scene.add(new THREE.HemisphereLight(0x88ccff, 0x083049, 0.9))
  const dir = new THREE.DirectionalLight(0xbbe8ff, 0.6)
  dir.position.set(5, 8, 5)
  scene.add(dir)

  // seafloor (légèrement sous 0 pour éviter z-fighting)
  const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({color: '#0a1f33', roughness: 1})
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = FLOOR_Y - 0.05
  scene.add(floor)

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()
  clock = new THREE.Clock()

  window.addEventListener('resize', onResize)
  await nextTick();
  onResize()

  if (ocean.filteredRows.length) buildSchool(ocean.filteredRows)

  // post-processing
  composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.4, 0.7, 0.85)
  composer.addPass(bloom)

  // Water shader
  const waterTex = new THREE.TextureLoader().load('/textures/waternormals.jpg')
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping
  const waterMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      uTime: {value: 0},
      uTex: {value: waterTex},
      uTint: {value: new THREE.Color(0x74c3ff)},
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform float uTime; uniform sampler2D uTex; uniform vec3 uTint; varying vec2 vUv;
    void main(){
      vec2 uv=vUv*6.0+vec2(uTime*0.02,uTime*0.015);
      vec3 n=texture2D(uTex,uv).rgb;
      float sparkle=smoothstep(0.75,1.0,n.g);
      vec3 col=mix(vec3(0.0),uTint,0.08)+sparkle*0.35;
      gl_FragColor=vec4(col,0.25);
    }`
  })
  const water = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), waterMat)
  water.rotation.x = -Math.PI / 2
  water.position.y = BOUNDS.y + 0.2
  scene.add(water)

  // Caustics
  const causticsTex = new THREE.TextureLoader().load('/textures/caustics.webp')
  causticsTex.wrapS = causticsTex.wrapT = THREE.RepeatWrapping
  const causticsMat = new THREE.MeshBasicMaterial({
    map: causticsTex,
    transparent: true,
    opacity: 0.6,
    depthWrite: false
  })
  const causticsQuad = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), causticsMat)
  causticsQuad.rotation.x = -Math.PI / 2
  causticsQuad.position.y = 0.05
  scene.add(causticsQuad)
  let causticsScroll = 0

  // bubbles
  const bubbleGeo = new THREE.SphereGeometry(0.03, 8, 8)
  const bubbleMat = new THREE.MeshBasicMaterial({color: 0xffffff, transparent: true, opacity: 0.35})
  const BUBBLE_COUNT = 200
  const bubbles = new THREE.InstancedMesh(bubbleGeo, bubbleMat, BUBBLE_COUNT)
  scene.add(bubbles)
  const bubbleData = []
  const m4 = new THREE.Matrix4()
  for (let i = 0; i < BUBBLE_COUNT; i++) {
    const p = new THREE.Vector3(
        (Math.random() - 0.5) * 2 * BOUNDS.x,
        Math.random() * BOUNDS.y,
        (Math.random() - 0.5) * 2 * BOUNDS.z
    )
    const spd = 0.2 + Math.random() * 0.4
    bubbleData.push({p, spd})
    m4.makeTranslation(p.x, p.y, p.z)
    bubbles.setMatrixAt(i, m4)
  }
  bubbles.instanceMatrix.needsUpdate = true

  // tick loop
  const tick = () => {
    const dt = clock.getDelta()
    for (const m of mixers) m.update(dt)
    updateSchool(dt)
    controls.update()

    waterMat.uniforms.uTime.value += dt
    causticsScroll += dt * 0.1
    causticsTex.offset.set(causticsScroll, causticsScroll * 0.7)

    for (let i = 0; i < BUBBLE_COUNT; i++) {
      const b = bubbleData[i]
      b.p.y += b.spd * dt
      if (b.p.y > BOUNDS.y) {
        b.p.y = MIN_Y
        b.p.x = (Math.random() - 0.5) * 2 * BOUNDS.x
        b.p.z = (Math.random() - 0.5) * 2 * BOUNDS.z
      }
      m4.makeTranslation(b.p.x, b.p.y, b.p.z)
      bubbles.setMatrixAt(i, m4)
    }
    bubbles.instanceMatrix.needsUpdate = true

    composer ? composer.render() : renderer.render(scene, camera)
    rafId = requestAnimationFrame(tick)
  }
  tick()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  cancelAnimationFrame(rafId)
  disposeSchool()
})

// Watchers
watch(() => ocean.filteredRows, rows => {
  if (rows && rows.length) buildSchool(rows)
}, {flush: 'post'})

watch(() => ocean.recenterTick, () => {
  recenterCamera()
}, {flush: 'post'})
</script>
