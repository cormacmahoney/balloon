import { useEffect, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';

const MIN_WIDTH = 8;
const MIN_HEIGHT = 8;
const MAX_WIDTH = 68;
const MAX_HEIGHT = 290;
const PINCH_DISTANCE = 220;
const MAX_ROTATION = 55;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const getDistance = ([firstTouch, secondTouch]) => {
  const dx = secondTouch.pageX - firstTouch.pageX;
  const dy = secondTouch.pageY - firstTouch.pageY;

  return Math.hypot(dx, dy);
};
const getAngle = ([firstTouch, secondTouch]) => {
  const dx = secondTouch.pageX - firstTouch.pageX;
  const dy = secondTouch.pageY - firstTouch.pageY;

  return Math.atan2(dy, dx) * (180 / Math.PI);
};
const normalizeAngle = (angle) => {
  if (angle > 180) {
    return angle - 360;
  }

  if (angle < -180) {
    return angle + 360;
  }

  return angle;
};

export default function App() {
  const inflation = useRef(new Animated.Value(0)).current;
  const rotateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  const inflationValue = useRef(0);
  const rotateYValue = useRef(0);
  const translateXValue = useRef(0);
  const translateYValue = useRef(0);
  const gestureMode = useRef(null);
  const dragStart = useRef({
    pageX: 0,
    pageY: 0,
    translateX: 0,
    translateY: 0,
  });
  const pinchStart = useRef({
    distance: 0,
    angle: 0,
    inflation: 0,
    rotateY: 0,
  });
  const didRotate = useRef(false);

  useEffect(() => {
    const inflationListener = inflation.addListener(({ value }) => {
      inflationValue.current = value;
    });
    const rotateYListener = rotateY.addListener(({ value }) => {
      rotateYValue.current = value;
    });
    const translateXListener = translateX.addListener(({ value }) => {
      translateXValue.current = value;
    });
    const translateYListener = translateY.addListener(({ value }) => {
      translateYValue.current = value;
    });

    return () => {
      inflation.removeListener(inflationListener);
      rotateY.removeListener(rotateYListener);
      translateX.removeListener(translateXListener);
      translateY.removeListener(translateYListener);
    };
  }, [inflation, rotateY, translateX, translateY]);

  const beginDrag = (touch) => {
    gestureMode.current = 'drag';
    dragStart.current = {
      pageX: touch.pageX,
      pageY: touch.pageY,
      translateX: translateXValue.current,
      translateY: translateYValue.current,
    };
  };

  const beginPinch = (touches) => {
    gestureMode.current = 'pinch';
    didRotate.current = true;
    rotateY.stopAnimation((value) => {
      rotateYValue.current = value;
      pinchStart.current.rotateY = value;
    });
    pinchStart.current = {
      distance: getDistance(touches),
      angle: getAngle(touches),
      inflation: inflationValue.current,
      rotateY: rotateYValue.current,
    };
  };

  const springRotateYHome = () => {
    if (!didRotate.current) {
      return;
    }

    didRotate.current = false;
    Animated.spring(rotateY, {
      toValue: 0,
      tension: 40,
      friction: 6,
      useNativeDriver: false,
    }).start();
  };

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

        beginDrag(touches[0]);
      },
      onPanResponderMove: (event) => {
        const { touches } = event.nativeEvent;

        if (touches.length >= 2) {
          if (gestureMode.current !== 'pinch') {
            beginPinch(touches);
          }

          const nextInflation = clamp(
            pinchStart.current.inflation +
              (getDistance(touches) - pinchStart.current.distance) / PINCH_DISTANCE,
            0,
            1,
          );
          const nextRotateY = clamp(
            pinchStart.current.rotateY +
              normalizeAngle(getAngle(touches) - pinchStart.current.angle),
            -MAX_ROTATION,
            MAX_ROTATION,
          );

          inflationValue.current = nextInflation;
          rotateYValue.current = nextRotateY;
          inflation.setValue(nextInflation);
          rotateY.setValue(nextRotateY);
          return;
        }

        if (touches.length === 1) {
          if (gestureMode.current !== 'drag') {
            beginDrag(touches[0]);
          }

          const nextTranslateX =
            dragStart.current.translateX + touches[0].pageX - dragStart.current.pageX;
          const nextTranslateY =
            dragStart.current.translateY + touches[0].pageY - dragStart.current.pageY;

          translateXValue.current = nextTranslateX;
          translateYValue.current = nextTranslateY;
          translateX.setValue(nextTranslateX);
          translateY.setValue(nextTranslateY);
        }
      },
      onPanResponderRelease: (event) => {
        const { touches } = event.nativeEvent;

        if (gestureMode.current === 'pinch') {
          springRotateYHome();
        }

        if (touches.length === 1) {
          beginDrag(touches[0]);
          return;
        }

        gestureMode.current = null;
      },
      onPanResponderTerminate: () => {
        springRotateYHome();
        gestureMode.current = null;
      },
    }),
  ).current;

  const rotateYTransform = rotateY.interpolate({
    inputRange: [-MAX_ROTATION, MAX_ROTATION],
    outputRange: [`-${MAX_ROTATION}deg`, `${MAX_ROTATION}deg`],
    extrapolate: 'clamp',
  });
  const width = inflation.interpolate({
    inputRange: [0, 1],
    outputRange: [MIN_WIDTH, MAX_WIDTH],
  });
  const height = inflation.interpolate({
    inputRange: [0, 1],
    outputRange: [MIN_HEIGHT, MAX_HEIGHT],
  });
  const highlightWidth = inflation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 15],
  });
  const highlightHeight = inflation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 228],
  });
  const highlightOpacity = inflation.interpolate({
    inputRange: [0, 0.18, 1],
    outputRange: [0, 0.2, 0.48],
  });
  const highlightTranslateX = rotateY.interpolate({
    inputRange: [-MAX_ROTATION, 0, MAX_ROTATION],
    outputRange: [-7, 0, 7],
    extrapolate: 'clamp',
  });
  const knotScale = inflation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 1],
  });

  return (
    <View style={styles.container} {...pan.panHandlers}>
      <Animated.View
        style={[
          styles.balloonStage,
          {
            transform: [
              { perspective: 800 },
              { translateX },
              { translateY },
              { rotateY: rotateYTransform },
            ],
          },
        ]}
      >
        <Animated.View style={[styles.balloon, { width, height }]}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.highlight,
              {
                width: highlightWidth,
                height: highlightHeight,
                opacity: highlightOpacity,
                transform: [{ translateX: highlightTranslateX }],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[styles.knot, { transform: [{ scale: knotScale }] }]}
          />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0e8d8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balloonStage: {
    width: MAX_WIDTH,
    height: MAX_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  balloon: {
    borderRadius: 999,
    backgroundColor: 'rgba(195, 28, 28, 0.62)',
    borderWidth: 1,
    borderColor: 'rgba(140, 10, 10, 0.4)',
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: '10%',
    left: '24%',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
  },
  knot: {
    position: 'absolute',
    bottom: 5,
    alignSelf: 'center',
    width: 12,
    height: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(75, 8, 8, 0.72)',
  },
});
