export type AppSettings = {
  merchantName: string;
  transport: "nfc" | "qr";
};

export const defaultSettings: AppSettings = {
  merchantName: "yoyogi-market.tap.eth",
  transport: "nfc",
};
