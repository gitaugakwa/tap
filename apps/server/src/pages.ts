function document(title: string, description: string, content: string, noIndex = false): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    ${noIndex ? '<meta name="robots" content="noindex">' : ""}
    <meta name="description" content="${description}">
    <meta name="theme-color" content="#f45b35">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:type" content="website">
    <link rel="stylesheet" href="/styles.css">
    <title>${title}</title>
  </head>
  <body>${content}</body>
</html>`;
}

function downloadLink(apkDownloadUrl: string): string {
  return `<a class="button button-primary" href="${apkDownloadUrl}"><span>Download for Android</span><span aria-hidden="true">&darr;</span></a>`;
}

const tickerLine =
  "NO CARD READER <b>+</b> LIVE ENS IDENTITY <b>+</b> SIGNED REQUESTS <b>+</b> ONCHAIN SETTLEMENT <b>+</b>";

function ticker(): string {
  return `<section class="ticker" aria-label="Product principles"><div class="ticker-track"><div class="ticker-line">${tickerLine}</div><div class="ticker-line" aria-hidden="true">${tickerLine}</div></div></section>`;
}

export function landingPage(apkDownloadUrl: string): string {
  return document(
    "Tap - Payments at the pace of a tap",
    "Turn any Android phone into a secure, ENS-verified payment terminal.",
    `<header class="site-header wrap">
      <a class="brand" href="/" aria-label="Tap home"><span class="brand-mark">T</span><span>TAP</span></a>
      <nav aria-label="Main navigation"><a href="#how">How it works</a><a href="#trust">Why Tap</a><a href="https://github.com/gitaugakwa/tap">GitHub</a></nav>
      <a class="header-cta" href="${apkDownloadUrl}">Get the demo <span aria-hidden="true">&nearr;</span></a>
    </header>
    <main>
      <section class="hero wrap">
        <div class="hero-copy">
          <p class="eyebrow"><span></span> ETHGLOBAL TOKYO 2026</p>
          <h1>The cash register is already in your pocket.</h1>
          <p class="hero-lede">Tap turns an Android phone into a verified payment terminal for merchants anywhere. Inspired by Japan's tap-first culture, shaped for markets like Kenya, and built for a global checkout.</p>
          <div class="hero-actions">${downloadLink(apkDownloadUrl)}<a class="text-link" href="#how">See how it works <span aria-hidden="true">&darr;</span></a></div>
          <p class="demo-note">Android preview build <span>/</span> Base Sepolia <span>/</span> USDC</p>
        </div>
        <div class="terminal-stage" aria-label="Tap payment terminal preview">
          <div class="sun"></div><p class="stage-note">YOUR PHONE<br>IS THE TERMINAL</p>
          <div class="phone">
            <div class="phone-top"><span>9:41</span><span class="signal">NFC))</span></div>
            <p class="phone-label">CHARGE</p><p class="amount"><sup>$</sup>5.00</p>
            <div class="merchant-card"><span class="merchant-avatar">T</span><span><b>Takoyaki Stand</b><small>yoyogi-market.tap.eth</small></span><i>VERIFIED</i></div>
            <div class="tap-zone"><span class="waves">)))</span><b>Ready to tap</b><small>Hold customer phone nearby</small></div>
          </div>
          <p class="vertical-label">TAP / PAY / DONE</p>
        </div>
      </section>
      ${ticker()}
      <section class="steps wrap" id="how">
        <div class="section-heading"><p class="eyebrow"><span></span> THREE MOVES</p><h2>From price to paid.<br>Nothing in between.</h2></div>
        <ol>
          <li><span>01</span><div class="step-icon">$</div><h3>Enter the charge</h3><p>The merchant enters an amount. Tap signs a short-lived payment request on the device.</p></li>
          <li><span>02</span><div class="step-icon">)))</div><h3>Tap phones</h3><p>NFC moves the request directly to the customer's Android phone. No reader, counter hardware, or printed tag.</p></li>
          <li><span>03</span><div class="step-icon">OK</div><h3>Verify, then pay</h3><p>The app checks the live ENS identity and signature before showing who gets paid. Settlement happens on Base.</p></li>
        </ol>
      </section>
      <section class="trust" id="trust"><div class="wrap trust-grid">
        <div class="trust-copy"><p class="eyebrow light"><span></span> TRUST THE NAME</p><h2>Know the merchant.<br>Before the money moves.</h2><p>A payment link is untrusted input. Tap does not rely on the tag for identity or token details. The customer app verifies the signed request and resolves the merchant's live <code>.tap.eth</code> name first.</p><a href="https://github.com/gitaugakwa/tap" class="text-link light">Read the open source code <span aria-hidden="true">&nearr;</span></a></div>
        <div class="verify-card"><div class="verify-head"><span>IDENTITY CHECK</span><i>LIVE</i></div><div class="verify-name"><span class="merchant-avatar">T</span><span><b>Takoyaki Stand</b><small>yoyogi-market.tap.eth</small></span></div><ul><li><i></i>Direct subname of tap.eth <b>PASS</b></li><li><i></i>ENS owner matches signer <b>PASS</b></li><li><i></i>Request is signed and current <b>PASS</b></li></ul><div class="verified-stamp">VERIFIED TO PAY</div></div>
      </div></section>
      <section class="builder wrap"><div><p class="eyebrow"><span></span> BUILT AS AN SDK</p><h2>Payment rails<br>for the next counter.</h2></div><div><p>Tap is more than a demo app. Its protocol, verification, payment, and NFC layers are packaged for other teams to build with.</p><div class="packages"><a class="package-link" href="https://github.com/gitaugakwa/tap/tree/main/packages/core" target="_blank" rel="noreferrer"><span><code>@tap/core</code><small>Protocol, identity, and settlement</small></span><b aria-hidden="true">&nearr;</b></a><a class="package-link" href="https://github.com/gitaugakwa/tap/tree/main/packages/react-native" target="_blank" rel="noreferrer"><span><code>@tap/react-native</code><small>NFC transport and payment hooks</small></span><b aria-hidden="true">&nearr;</b></a></div></div></section>
      <section class="final-cta wrap"><p>YOUR NEXT PAYMENT</p><h2>Make it a tap.</h2>${downloadLink(apkDownloadUrl)}<div class="orb"></div></section>
    </main>
    <footer class="wrap"><a class="brand" href="/"><span class="brand-mark">T</span><span>TAP</span></a><p>Tap in. Get paid.</p><p>&copy; 2026 TAP</p></footer>`,
  );
}

export function handoffPage(apkDownloadUrl: string): string {
  return document(
    "Open this payment in Tap",
    "Use the Tap Android app to verify and open this payment request.",
    `<main class="handoff"><a class="brand handoff-brand" href="/"><span class="brand-mark">T</span><span>TAP</span></a><section class="handoff-card"><div class="shield"><span>)))</span></div><p class="eyebrow"><span></span> SAFE HANDOFF</p><h1>Open this payment in Tap.</h1><p>This page never displays payment details from the link. The Tap app verifies the merchant, signature, network, token, amount, and expiry before showing them.</p>${downloadLink(apkDownloadUrl)}<a class="text-link" href="/">Learn about Tap <span aria-hidden="true">&rarr;</span></a></section><p class="handoff-note">Already installed? Return to Tap and scan or tap again.</p></main>`,
    true,
  );
}
