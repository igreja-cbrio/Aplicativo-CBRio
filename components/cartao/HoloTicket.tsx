import { type FC, type ReactNode, memo } from "react";
import { StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDecay,
  withSpring,
} from "react-native-reanimated";
import { HolographicCard } from "./HolographicCard";

type HoloTicketProps = {
  width: number;
  height: number;
  radius?: number;
  /** Cor de fundo (teal da marca por padrão). */
  color?: string;
  frontSide?: ReactNode;
  backSide?: ReactNode;
};

/**
 * Cartão "flipável" com brilho holográfico. Toque vira o cartão (com haptics);
 * arrastar gira livremente. Portado do demo "threads-holo-ticket" e adaptado
 * ao Reanimated v3 (Expo SDK 51): `scheduleOnRN` → `runOnJS`.
 */
export const HoloTicket: FC<HoloTicketProps> = memo(
  ({ width, height, radius = 22, color = "#408097", frontSide, backSide }) => {
    const translateX = useSharedValue(0);
    const contextX = useSharedValue(0);

    const panGesture = Gesture.Pan()
      .minDistance(10)
      .hitSlop({ top: 40, bottom: 40, left: 40, right: 40 })
      .onStart(() => {
        contextX.value = translateX.value;
      })
      .onUpdate((event) => {
        translateX.value = event.translationX + contextX.value;
      })
      .onEnd((event) => {
        translateX.value = withDecay({
          velocity: event.velocityX * 0.7,
          deceleration: 0.998,
          clamp: [translateX.value - 1080, translateX.value + 1080],
        });
      });

    const rotateY = useDerivedValue(() => translateX.value % 360);

    const tapGesture = Gesture.Tap()
      .maxDistance(10)
      .hitSlop({ top: 40, bottom: 40, left: 40, right: 40 })
      .onStart(() => {
        cancelAnimation(translateX);
      })
      .onEnd(() => {
        cancelAnimation(translateX);
        runOnJS(Haptics.selectionAsync)();
        const normalized = Math.round(translateX.value / 180) * 180;
        translateX.value = withSpring(normalized + 180, {
          dampingRatio: 1.5,
          duration: 500,
        });
      });

    const gesture = Gesture.Race(tapGesture, panGesture);

    const rTicketStyle = useAnimatedStyle(() => ({
      transform: [{ perspective: 1000 }, { rotateY: `${rotateY.value}deg` }],
    }));

    const isFront = useDerivedValue(() => {
      const abs = Math.abs(rotateY.value);
      return abs < 90 || abs > 270;
    });

    const rFrontStyle = useAnimatedStyle(() => ({
      opacity: isFront.value ? 1 : 0,
      zIndex: isFront.value ? 1 : 0,
    }));

    const rBackStyle = useAnimatedStyle(() => ({
      opacity: isFront.value ? 0 : 1,
      zIndex: isFront.value ? 0 : 1,
    }));

    return (
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            { width, height, borderRadius: radius, overflow: "hidden" },
            rTicketStyle,
          ]}
        >
          <HolographicCard
            width={width}
            height={height}
            rotateY={rotateY}
            color={color}
            radius={radius}
          />
          <Animated.View style={[StyleSheet.absoluteFill, rFrontStyle]}>
            {frontSide}
          </Animated.View>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ scaleX: -1 }] },
              rBackStyle,
            ]}
          >
            {backSide}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    );
  }
);
