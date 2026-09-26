import * as Haptics from "expo-haptics";

function ignoreUnsupported(result: Promise<void>): void {
  void result.catch(() => undefined);
}

export function hapticTap(): void {
  ignoreUnsupported(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

export function hapticSuccess(): void {
  ignoreUnsupported(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function hapticFailure(): void {
  ignoreUnsupported(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
