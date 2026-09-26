const PAYMENT_ORIGIN = "https://tap-pay.xyz";

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const url = new URL(path);
    if (
      url.origin !== PAYMENT_ORIGIN ||
      url.pathname !== "/p" ||
      url.username !== "" ||
      url.password !== ""
    ) {
      return "/";
    }

    // Preserve the original URL as untrusted input for the normal verification flow.
    return `/customer/confirm?url=${encodeURIComponent(path)}`;
  } catch {
    return "/";
  }
}
