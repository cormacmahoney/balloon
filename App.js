import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { GLView } from 'expo-gl';
import { Audio } from 'expo-av';
import * as THREE from 'three';

const BALLOON_RADIUS = 0.18;
const MAX_BODY_HEIGHT = 3.5;
const RADIAL_SEGMENTS = 14;
const PINCH_DISTANCE_TO_FULL_INFLATION = 240;
const DRAG_SCENE_UNITS_PER_PIXEL = 0.01;
const ROTATE_RADIANS_PER_PIXEL = 0.01;
const TAP_MOVEMENT_THRESHOLD = 10;
const TARGET_INFLATION = 0.82;
const SNAP_OVERSHOOT = 1.35;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (from, to, amount) => from + (to - from) * amount;

const getDistance = ([firstTouch, secondTouch]) => {
  const dx = secondTouch.pageX - firstTouch.pageX;
  const dy = secondTouch.pageY - firstTouch.pageY;
  return Math.hypot(dx, dy);
};

const getAngle = ([firstTouch, secondTouch]) => {
  const dx = secondTouch.pageX - firstTouch.pageX;
  const dy = secondTouch.pageY - firstTouch.pageY;
  return Math.atan2(dy, dx);
};

const normalizeRadians = (angle) => {
  let normalized = angle;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
};

const buildBalloonProfile = (bodyHeight) => {
  const points = [];
  const tipRadius = 0.01;
  const capSegments = 8;
  for (let i = 0; i <= capSegments; i++) {
    const angle = (i / capSegments) * (Math.PI / 2);
    const x = BALLOON_RADIUS * Math.sin(angle);
    const y = tipRadius + BALLOON_RADIUS * (1 - Math.cos(angle));
    points.push(new THREE.Vector2(x, y));
  }
  const bodySegments = 12;
  for (let i = 1; i <= bodySegments; i++) {
    points.push(new THREE.Vector2(BALLOON_RADIUS, BALLOON_RADIUS + (bodyHeight * i) / bodySegments));
  }
  for (let i = 0; i <= capSegments; i++) {
    const angle = (i / capSegments) * (Math.PI / 2);
    const x = BALLOON_RADIUS * Math.cos(angle);
    const y = BALLOON_RADIUS + bodyHeight + BALLOON_RADIUS * Math.sin(angle);
    points.push(new THREE.Vector2(x, y));
  }
  return points;
};

const ensureThreeDocumentShim = () => {
  if (typeof globalThis.document !== 'undefined') return;
  globalThis.document = {
    createElementNS: () => ({
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      getContext: () => null,
    }),
  };
};

const playBoingSound = async () => {
  try {
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(
      { uri: 'https://cdn.freesound.org/previews/352/352586_5121236-lq.mp3' },
      { shouldPlay: true, volume: 0.7 }
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) sound.unloadAsync();
    });
  } catch (e) {}
};

export default function App() {
  const sceneRef = useRef(null);
  const inflationRef = useRef(0);
  const [mode, setMode] = useState('inflate');
  const modeRef = useRef('inflate');
  const buildModeRef = useRef(false);
  const snapAnimRef = useRef(null);
  const snapTriggeredRef = useRef(false);
  const gestureMode = useRef(null);
  const dragStart = useRef({ pageX: 0, pageY: 0, positionX: 0, positionY: 0, rotationX: 0, rotationY: 0 });
  const tapStart = useRef({ pageX: 0, pageY: 0, moved: false });
  const pinchStart = useRef({ distance: 0, angle: 0, inflation: 0, lastAngle: 0 });
  const springFrameRef = useRef(null);
  const flashAnim = useRef(new Animated.Value(0)).current;

  const stopRotationSpring = useCallback(() => {
    if (springFrameRef.current !== null) {
      cancelAnimationFrame(springFrameRef.current);
      springFrameRef.current = null;
    }
  }, []);

  const cycleMode = useCallback(() => {
    setMode((currentMode) => {
      const available = buildModeRef.current
        ? ['build', 'move', 'rotate']
        : ['inflate', 'move', 'rotate'];
      const nextMode = available[(available.indexOf(currentMode) + 1) % available.length];
      modeRef.current = nextMode;
      return nextMode;
    });
  }, []);

  const updateInflation = useCallback((inflation) => {
    inflationRef.current = clamp(inflation, 0, SNAP_OVERSHOOT);
    const sceneObjects = sceneRef.current;
    if (!sceneObjects) return;
    const bodyHeight = inflationRef.current * MAX_BODY_HEIGHT;
    const points = buildBalloonProfile(Math.max(bodyHeight, 0.001));
    sceneObjects.balloonMesh.geometry.dispose();
    sceneObjects.balloonMesh.geometry = new THREE.LatheGeometry(points, RADIAL_SEGMENTS);
    sceneObjects.balloon.position.y = -(BALLOON_RADIUS + bodyHeight / 2);
  }, []);

  const triggerSnapToBuild = useCallback(() => {
    if (snapTriggeredRef.current) return;
    snapTriggeredRef.current = true;

    playBoingSound();

    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0.6, duration: 100, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0.9, duration: 80, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    let current = inflationRef.current;
    let velocity = 0.08;
    const target = TARGET_INFLATION;
    const stiffness = 0.15;
    const damping = 0.6;

    const step = () => {
      const delta = target - current;
      const acceleration = delta * stiffness;
      velocity = velocity * damping + acceleration;
      current = current + velocity;
      updateInflation(current);
      if (Math.abs(delta) < 0.002 && Math.abs(velocity) < 0.001) {
        updateInflation(TARGET_INFLATION);
        buildModeRef.current = true;
        setMode('build');
        modeRef.current = 'build';
        snapAnimRef.current = null;
        return;
      }
      snapAnimRef.current = requestAnimationFrame(step);
    };
    snapAnimRef.current = requestAnimationFrame(step);
  }, [updateInflation, flashAnim]);

  const checkInflationTarget = useCallback((inflation) => {
    if (snapTriggeredRef.current) return;
    if (inflation >= TARGET_INFLATION - 0.02) triggerSnapToBuild();
  }, [triggerSnapToBuild]);

  const springRotateYHome = useCallback(() => {
    stopRotationSpring();
    const step = () => {
      const sceneObjects = sceneRef.current;
      if (!sceneObjects) { springFrameRef.current = null; return; }
      sceneObjects.balloonRig.rotation.y = lerp(sceneObjects.balloonRig.rotation.y, 0, 0.05);
      if (Math.abs(sceneObjects.balloonRig.rotation.y) < 0.001) {
        sceneObjects.balloonRig.rotation.y = 0;
        springFrameRef.current = null;
        return;
      }
      springFrameRef.current = requestAnimationFrame(step);
    };
    springFrameRef.current = requestAnimationFrame(step);
  }, [stopRotationSpring]);

  const beginDrag = useCallback((touch) => {
    const sceneObjects = sceneRef.current;
    if (!sceneObjects) return;
    stopRotationSpring();
    gestureMode.current = 'drag';
    dragStart.current = {
      pageX: touch.pageX,
      pageY: touch.pageY,
      positionX: sceneObjects.balloonRig.position.x,
      positionY: sceneObjects.balloonRig.position.y,
      rotationX: sceneObjects.balloonRig.rotation.x,
      rotationY: sceneObjects.balloonRig.rotation.y,
    };
  }, [stopRotationSpring]);

  const beginPinch = useCallback((touches) => {
    const sceneObjects = sceneRef.current;
    if (!sceneObjects) return;
    stopRotationSpring();
    gestureMode.current = 'pinch';
    pinchStart.current = {
      distance: getDistance(touches),
      angle: getAngle(touches),
      inflation: inflationRef.current,
      lastAngle: getAngle(touches),
    };
  }, [stopRotationSpring]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const { touches } = event.nativeEvent;
        if (touches.length >= 2) { beginPinch(touches); return; }
        if (touches.length === 1) {
          tapStart.current = { pageX: touches[0].pageX, pageY: touches[0].pageY, moved: false };
          beginDrag(touches[0]);
        }
      },
      onPanResponderMove: (event) => {
        const { touches } = event.nativeEvent;
        const sceneObjects = sceneRef.current;
        if (!sceneObjects) return;
        if (touches.length >= 2) {
          tapStart.current.moved = true;
          if (gestureMode.current !== 'pinch') beginPinch(touches);
          const currentAngle = getAngle(touches);
          const angleDelta = normalizeRadians(currentAngle - pinchStart.current.lastAngle);
          const currentMode = modeRef.current;
          if (currentMode === 'inflate') {
            const distanceDelta = getDistance(touches) - pinchStart.current.distance;
            const nextInflation = clamp(
              pinchStart.current.inflation + distanceDelta / PINCH_DISTANCE_TO_FULL_INFLATION, 0, 1
            );
            if (!buildModeRef.current) {
              updateInflation(nextInflation);
              checkInflationTarget(nextInflation);
            }
            sceneObjects.balloonRig.rotation.z += angleDelta;
          } else if (currentMode === 'rotate') {
            sceneObjects.balloonRig.rotation.z += angleDelta;
          }
          pinchStart.current.lastAngle = currentAngle;
          return;
        }
        if (touches.length === 1) {
          if (gestureMode.current !== 'drag') beginDrag(touches[0]);
          const deltaX = touches[0].pageX - dragStart.current.pageX;
          const deltaY = touches[0].pageY - dragStart.current.pageY;
          const tapDeltaX = touches[0].pageX - tapStart.current.pageX;
          const tapDeltaY = touches[0].pageY - tapStart.current.pageY;
          const currentMode = modeRef.current;
          if (Math.hypot(tapDeltaX, tapDeltaY) >= TAP_MOVEMENT_THRESHOLD) tapStart.current.moved = true;
          if (currentMode === 'move') {
            sceneObjects.balloonRig.position.x = dragStart.current.positionX + deltaX * DRAG_SCENE_UNITS_PER_PIXEL;
            sceneObjects.balloonRig.position.y = dragStart.current.positionY - deltaY * DRAG_SCENE_UNITS_PER_PIXEL;
          } else if (currentMode === 'rotate') {
            sceneObjects.balloonRig.rotation.x = dragStart.current.rotationX + deltaY * ROTATE_RADIANS_PER_PIXEL;
            sceneObjects.balloonRig.rotation.y = dragStart.current.rotationY + deltaX * ROTATE_RADIANS_PER_PIXEL;
          }
        }
      },
      onPanResponderRelease: (event) => {
        const { touches } = event.nativeEvent;
        if (gestureMode.current === 'drag' && !tapStart.current.moved) cycleMode();
        if (touches.length === 1) { beginDrag(touches[0]); return; }
        gestureMode.current = null;
      },
      onPanResponderTerminate: () => { gestureMode.current = null; },
    })
  ).current;

  useEffect(() => {
    return () => {
      stopRotationSpring();
      if (sceneRef.current?.frameId) cancelAnimationFrame(sceneRef.current.frameId);
      if (snapAnimRef.current) cancelAnimationFrame(snapAnimRef.current);
      sceneRef.current?.balloonMesh.geometry.dispose();
      sceneRef.current?.balloonMaterial.dispose();
      sceneRef.current?.renderer.dispose();
      sceneRef.current = null;
    };
  }, [stopRotationSpring]);

  const onContextCreate = useCallback((gl) => {
    ensureThreeDocumentShim();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, gl.drawingBufferWidth / gl.drawingBufferHeight, 0.1, 100);
    camera.position.z = 6;
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ context: gl, antialias: true });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    renderer.setClearColor(0xffffff, 1);
    renderer.sortObjects = true;
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const balloonMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xee2211) },
        uCenter: { value: new THREE.Color(0xffffff) },
        uDark: { value: new THREE.Color(0xcc1100) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform vec3 uCenter;
        uniform vec3 uDark;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vec3 n = normalize(vNormal);
          vec3 v = normalize(vViewDir);
          float facing = abs(dot(n, v));
          float centerMix = pow(facing, 0.5);
          vec3 body = mix(uDark, uCenter, centerMix);
          vec3 l = normalize(vec3(-0.32, 0.36, 1.0));
          vec3 h = normalize(l + v);
          float spec = pow(max(dot(n, h), 0.0), 60.0);
          vec3 col = body + vec3(spec * 0.95);
          gl_FragColor = vec4(col, 1.0);
        }
      `,
      side: THREE.FrontSide,
    });
    const balloonRig = new THREE.Group();
    const balloon = new THREE.Group();
    const balloonGeometry = new THREE.LatheGeometry(buildBalloonProfile(0.001), RADIAL_SEGMENTS);
    const balloonMesh = new THREE.Mesh(balloonGeometry, balloonMaterial);
    balloon.add(balloonMesh);
    balloonRig.add(balloon);
    scene.add(balloonRig);
    sceneRef.current = { balloon, balloonMesh, balloonMaterial, balloonRig, camera, frameId: null, renderer, scene };
    updateInflation(inflationRef.current);
    const render = () => {
      if (!sceneRef.current) return;
      renderer.render(scene, camera);
      gl.endFrameEXP();
      sceneRef.current.frameId = requestAnimationFrame(render);
    };
    render();
  }, [updateInflation]);

  const flashBg = flashAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['rgba(255,255,255,0)', 'rgba(255,180,150,0.6)', 'rgba(255,255,255,0.9)'],
  });

  return (
    <View style={styles.container} {...pan.panHandlers}>
      <GLView style={styles.glView} onContextCreate={onContextCreate} />
      <Animated.View pointerEvents="none" style={[styles.flashOverlay, { backgroundColor: flashBg }]} />
      <View pointerEvents="none" style={styles.modeIndicator}>
        <Text style={styles.modeText}>{mode}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  glView: { flex: 1 },
  flashOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  modeIndicator: { position: 'absolute', bottom: 32, left: 0, right: 0, alignItems: 'center' },
  modeText: { color: '#222222', fontSize: 12, opacity: 0.6 },
});
