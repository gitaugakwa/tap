export { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
export {
  DEFAULT_TOKEN,
  ENS_CHAIN_ID,
  ENS_PARENT,
  getPaymentChain,
  PAYMENT_CHAIN_ID,
} from "./config/chains";
export { configureTap } from "./config/clients";
export { REQUEST_TTL_SECONDS } from "./config/constants";
export {
  TapConfigError,
  TapDecodeError,
  TapError,
  TapInputError,
  TapPayError,
} from "./errors";
export { formatAmount, parseAmountInput } from "./format";
export { isPaid, pay, payWithPermit, waitForPayment } from "./payment/pay";
export { signPermit } from "./payment/permit";
export { watchPaid } from "./payment/watch";
export { newChargeRequest } from "./request/create";
export { hashRequest, PAYMENT_REQUEST_TYPES, signRequest } from "./request/sign";
export { decodeRequestUrl, encodeRequestUrl } from "./request/url";
export type {
  Address,
  Hash,
  Hex,
  LocalAccount,
  MerchantProfile,
  MerchantSetupCheck,
  PaymentRequest,
  PermitSig,
  SignedRequest,
  TapConfig,
  VerifyFailure,
  VerifyResult,
  WalletBalances,
} from "./types";
export {
  checkMerchantSetup,
  getMerchantProfile,
  isMerchantLabelAvailable,
  isUnderParent,
  registerMerchant,
  resolveMerchant,
} from "./verify/ens";
export { verifyRequest } from "./verify/verify-request";
export { getWalletBalances } from "./wallet/balances";
