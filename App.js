import { useCallback, useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { GLView } from 'expo-gl';
import * as THREE from 'three';

const BALLOON_RADIUS = 0.18;
const MAX_BODY_HEIGHT = 3.5;
const RADIAL_SEGMENTS = 14;
const PINCH_DISTANCE_TO_FULL_INFLATION = 240;
const DRAG_SCENE_UNITS_PER_PIXEL = 0.01;
const ROTATE_RADIANS_PER_PIXEL = 0.01;
const TAP_MOVEMENT_THRESHOLD = 10;
const modes = ['inflate', 'move', 'rotate'];

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

  while (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }

  while (normalized < -Math.PI) {
    normalized += Math.PI * 2;
  }

  return normalized;
};

const ensureThreeDocumentShim = () => {
  if (typeof globalThis.document !== 'undefined') {
    return;
  }

  globalThis.document = {
    createElementNS: () => ({
      style: {},
      addEventListener: () => {},
      removeEventListener: () => {},
      getContext: () => null,
    }),
  };
};

export default function App() {
  const sceneRef = useRef(null);
  const inflationRef = useRef(0);
  const [mode, setMode] = useState('inflate');
  const modeRef = useRef('inflate');
  const gestureMode = useRef(null);
  const dragStart = useRef({
    pageX: 0,
    pageY: 0,
    positionX: 0,
    positionY: 0,
    rotationX: 0,
    rotationY: 0,
  });
  const tapStart = useRef({
    pageX: 0,
    pageY: 0,
    moved: false,
  });
  const pinchStart = useRef({
    distance: 0,
    angle: 0,
    inflation: 0,
    lastAngle: 0,
  });
  const springFrameRef = useRef(null);

  const stopRotationSpring = useCallback(() => {
    if (springFrameRef.current !== null) {
      cancelAnimationFrame(springFrameRef.current);
      springFrameRef.current = null;
    }
  }, []);

  const cycleMode = useCallback(() => {
    setMode((currentMode) => {
      const nextMode = modes[(modes.indexOf(currentMode) + 1) % modes.length];

      modeRef.current = nextMode;
      return nextMode;
    });
  }, []);

  const updateInflation = useCallback((inflation) => {
    const sceneObjects = sceneRef.current;

    inflationRef.current = clamp(inflation, 0, 1);

    if (!sceneObjects) {
      return;
    }

    const bodyHeight = inflationRef.current * MAX_BODY_HEIGHT;

    sceneObjects.bottomCap.position.y = 0;
    sceneObjects.body.scale.y = inflationRef.current;
    sceneObjects.body.position.y = BALLOON_RADIUS + bodyHeight / 2;
    sceneObjects.topCap.position.y = BALLOON_RADIUS + bodyHeight;
    sceneObjects.balloon.position.y = -(BALLOON_RADIUS + bodyHeight / 2);
  }, []);

  const springRotateYHome = useCallback(() => {
    stopRotationSpring();

    const step = () => {
      const sceneObjects = sceneRef.current;

      if (!sceneObjects) {
        springFrameRef.current = null;
        return;
      }

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

  const beginDrag = useCallback(
    (touch) => {
      const sceneObjects = sceneRef.current;

      if (!sceneObjects) {
        return;
      }

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
    },
    [stopRotationSpring],
  );

  const beginPinch = useCallback(
    (touches) => {
      const sceneObjects = sceneRef.current;

      if (!sceneObjects) {
        return;
      }

      stopRotationSpring();
      gestureMode.current = 'pinch';
      pinchStart.current = {
        distance: getDistance(touches),
        angle: getAngle(touches),
        inflation: inflationRef.current,
        lastAngle: getAngle(touches),
      };
    },
    [stopRotationSpring],
  );

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const { touches } = event.nativeEvent;

        if (touches.length >= 2) {
          beginPinch(touches);
          return;
        }

        if (touches.length === 1) {
          tapStart.current = {
            pageX: touches[0].pageX,
            pageY: touches[0].pageY,
            moved: false,
          };
          beginDrag(touches[0]);
        }
      },
      onPanResponderMove: (event) => {
        const { touches } = event.nativeEvent;
        const sceneObjects = sceneRef.current;

        if (!sceneObjects) {
          return;
        }

        if (touches.length >= 2) {
          tapStart.current.moved = true;

          if (gestureMode.current !== 'pinch') {
            beginPinch(touches);
          }

          const currentAngle = getAngle(touches);
          const angleDelta = normalizeRadians(currentAngle - pinchStart.current.lastAngle);
          const currentMode = modeRef.current;

          if (currentMode === 'inflate') {
            const distanceDelta = getDistance(touches) - pinchStart.current.distance;
            const nextInflation = clamp(
              pinchStart.current.inflation + distanceDelta / PINCH_DISTANCE_TO_FULL_INFLATION,
              0,
              1,
            );

            updateInflation(nextInflation);
            sceneObjects.balloonRig.rotation.z += angleDelta;
          } else if (currentMode === 'rotate') {
            sceneObjects.balloonRig.rotation.z += angleDelta;
          }

          pinchStart.current.lastAngle = currentAngle;
          return;
        }

        if (touches.length === 1) {
          if (gestureMode.current !== 'drag') {
            beginDrag(touches[0]);
          }

          const deltaX = touches[0].pageX - dragStart.current.pageX;
          const deltaY = touches[0].pageY - dragStart.current.pageY;
          const tapDeltaX = touches[0].pageX - tapStart.current.pageX;
          const tapDeltaY = touches[0].pageY - tapStart.current.pageY;
          const currentMode = modeRef.current;

          if (Math.hypot(tapDeltaX, tapDeltaY) >= TAP_MOVEMENT_THRESHOLD) {
            tapStart.current.moved = true;
          }

          if (currentMode === 'move') {
            sceneObjects.balloonRig.position.x =
              dragStart.current.positionX + deltaX * DRAG_SCENE_UNITS_PER_PIXEL;
            sceneObjects.balloonRig.position.y =
              dragStart.current.positionY - deltaY * DRAG_SCENE_UNITS_PER_PIXEL;
          } else if (currentMode === 'rotate') {
            sceneObjects.balloonRig.rotation.x =
              dragStart.current.rotationX + deltaY * ROTATE_RADIANS_PER_PIXEL;
            sceneObjects.balloonRig.rotation.y =
              dragStart.current.rotationY + deltaX * ROTATE_RADIANS_PER_PIXEL;
          }
        }
      },
      onPanResponderRelease: (event) => {
        const { touches } = event.nativeEvent;

        if (gestureMode.current === 'drag' && !tapStart.current.moved) {
          cycleMode();
        }

        if (touches.length === 1) {
          beginDrag(touches[0]);
          return;
        }

        gestureMode.current = null;
      },
      onPanResponderTerminate: () => {
        gestureMode.current = null;
      },
    }),
  ).current;

  useEffect(() => {
    return () => {
      stopRotationSpring();

      if (sceneRef.current?.frameId) {
        cancelAnimationFrame(sceneRef.current.frameId);
      }

      sceneRef.current?.topCap.geometry.dispose();
      sceneRef.current?.body.geometry.dispose();
      sceneRef.current?.bottomCap.geometry.dispose();
      sceneRef.current?.balloonMaterial.dispose();
      sceneRef.current?.renderer.dispose();
      sceneRef.current = null;
    };
  }, [stopRotationSpring]);

  const onContextCreate = useCallback(
    (gl) => {
      ensureThreeDocumentShim();

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        40,
        gl.drawingBufferWidth / gl.drawingBufferHeight,
        0.1,
        100,
      );
      camera.position.z = 6;
      camera.lookAt(0, 1, 0);

      const renderer = new THREE.WebGLRenderer({ context: gl, antialias: true });
      renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
      renderer.setClearColor(0xf0e8d8, 1);

      scene.add(new THREE.AmbientLight(0xffffff, 0.3));

      const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
      keyLight.position.set(2, 3, 4);
      scene.add(keyLight);

      const warmFillLight = new THREE.DirectionalLight(0xffeedd, 0.5);
      warmFillLight.position.set(-2, -1, 2);
      scene.add(warmFillLight);

      const backLight = new THREE.DirectionalLight(0xffffff, 1.2);
      backLight.position.set(0, -2, -3);
      scene.add(backLight);

      const balloonMaterial = new THREE.MeshPhongMaterial({
        color: 0xcc2222,
        specular: 0xffffff,
        shininess: 90,
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        depthWrite: false,
      });

      const balloonRig = new THREE.Group();
      const balloon = new THREE.Group();
      const topCap = new THREE.Mesh(
        new THREE.SphereGeometry(BALLOON_RADIUS, RADIAL_SEGMENTS, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        balloonMaterial,
      );
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(
          BALLOON_RADIUS,
          BALLOON_RADIUS,
          MAX_BODY_HEIGHT,
          RADIAL_SEGMENTS,
          1,
          true,
        ),
        balloonMaterial,
      );
      const bottomCapGeometry = new THREE.SphereGeometry(
        BALLOON_RADIUS,
        RADIAL_SEGMENTS,
        8,
        0,
        Math.PI * 2,
        Math.PI / 2,
        Math.PI / 2,
      );
      bottomCapGeometry.translate(0, BALLOON_RADIUS, 0);
      const bottomCap = new THREE.Mesh(bottomCapGeometry, balloonMaterial);

      balloon.add(bottomCap);
      balloon.add(body);
      balloon.add(topCap);
      balloonRig.add(balloon);
      scene.add(balloonRig);

      sceneRef.current = {
        balloon,
        balloonMaterial,
        balloonRig,
        body,
        bottomCap,
        camera,
        frameId: null,
        renderer,
        scene,
        topCap,
      };
      updateInflation(inflationRef.current);

      const render = () => {
        if (!sceneRef.current) {
          return;
        }

        renderer.render(scene, camera);
        gl.endFrameEXP();
        sceneRef.current.frameId = requestAnimationFrame(render);
      };

      render();
    },
    [updateInflation],
  );

  return (
    <View style={styles.container} {...pan.panHandlers}>
      <GLView style={styles.glView} onContextCreate={onContextCreate} />
      <View pointerEvents="none" style={styles.modeIndicator}>
        <Text style={styles.modeText}>{mode}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0e8d8',
  },
  glView: {
    flex: 1,
  },
  modeIndicator: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  modeText: {
    color: '#222222',
    fontSize: 12,
    opacity: 0.6,
  },
});
