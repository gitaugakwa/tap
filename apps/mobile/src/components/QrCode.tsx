import QRCode from "react-native-qrcode-svg";
import { theme } from "../theme";

export function QrCode({ value, size = 260 }: { value: string; size?: number }) {
  return (
    <QRCode
      value={value}
      size={size}
      color={theme.colors.foreground}
      backgroundColor={theme.colors.background}
      quietZone={12}
      ecl="M"
    />
  );
}
