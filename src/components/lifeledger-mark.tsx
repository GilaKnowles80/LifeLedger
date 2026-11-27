export default function LifeLedgerMark() {
  return (
    <svg
      className="brand-mark"
      width={48}
      height={36}
      viewBox="0 0 96 72"
      fill="none"
      aria-label="LifeLedger"
      role="img"
    >
      <title>LifeLedger infinity ribbon and ledger matrix logo</title>
      <defs>
        <linearGradient id="life-ribbon-a" x1="4" y1="15" x2="92" y2="57" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FF9B53" />
          <stop offset="0.27" stop-color="#EF426D" />
          <stop offset="0.58" stop-color="#8A45EF" />
          <stop offset="1" stop-color="#20C5D0" />
        </linearGradient>
        <linearGradient id="life-ribbon-b" x1="92" y1="14" x2="5" y2="60" gradientUnits="userSpaceOnUse">
          <stop stop-color="#2BCBE3" />
          <stop offset="0.38" stop-color="#3575F2" />
          <stop offset="0.72" stop-color="#BE3CD9" />
          <stop offset="1" stop-color="#FF7657" />
        </linearGradient>
        <linearGradient id="cube-top" x1="37" y1="5" x2="59" y2="19" gradientUnits="userSpaceOnUse">
          <stop stop-color="#39F5A4" />
          <stop offset="1" stop-color="#00A987" />
        </linearGradient>
        <linearGradient id="cube-blue" x1="9" y1="17" x2="35" y2="45" gradientUnits="userSpaceOnUse">
          <stop stop-color="#36E7FF" />
          <stop offset="1" stop-color="#0878F4" />
        </linearGradient>
        <linearGradient id="cube-violet" x1="61" y1="17" x2="86" y2="45" gradientUnits="userSpaceOnUse">
          <stop stop-color="#DB65FF" />
          <stop offset="1" stop-color="#7B31E8" />
        </linearGradient>
        <linearGradient id="cube-pink" x1="34" y1="34" x2="61" y2="64" gradientUnits="userSpaceOnUse">
          <stop stop-color="#FF80EA" />
          <stop offset="1" stop-color="#CF3FA8" />
        </linearGradient>
        <filter id="glow" x="0" y="0" width="96" height="72" filterUnits="userSpaceOnUse">
          <feGaussianBlur stdDeviation="2" />
        </filter>
      </defs>
      <path d="M5 36C18 12 27 12 42 36C57 60 70 60 91 36" stroke="url(#life-ribbon-a)" stroke-width="7" stroke-linecap="round" opacity=".62" filter="url(#glow)" />
      <path d="M5 36C18 12 27 12 42 36C57 60 70 60 91 36" stroke="url(#life-ribbon-a)" stroke-width="4.7" stroke-linecap="round" />
      <path d="M5 36C18 60 27 60 42 36C57 12 70 12 91 36" stroke="url(#life-ribbon-b)" stroke-width="7" stroke-linecap="round" opacity=".55" filter="url(#glow)" />
      <path d="M5 36C18 60 27 60 42 36C57 12 70 12 91 36" stroke="url(#life-ribbon-b)" stroke-width="4.7" stroke-linecap="round" />
      <g stroke-linejoin="round" stroke-width="1.35">
        <path d="M48 3L60 10L48 17L36 10L48 3Z" fill="url(#cube-top)" stroke="#72FFD0" />
        <path d="M36 10L48 17V31L36 24V10Z" fill="#0CBF99" stroke="#6DFFD0" />
        <path d="M60 10L48 17V31L60 24V10Z" fill="#0A997F" stroke="#55F6CA" />
        <path d="M22 15L35 22L22 29L9 22L22 15Z" fill="url(#cube-blue)" stroke="#9AFAFF" />
        <path d="M9 22L22 29V44L9 36V22Z" fill="#097DE1" stroke="#5DEBFF" />
        <path d="M35 22L22 29V44L35 36V22Z" fill="#075CCB" stroke="#63DAFF" />
        <path d="M74 15L87 22L74 29L61 22L74 15Z" fill="url(#cube-violet)" stroke="#F1B0FF" />
        <path d="M61 22L74 29V44L61 36V22Z" fill="#923DD7" stroke="#DA8BFF" />
        <path d="M87 22L74 29V44L87 36V22Z" fill="#682DC0" stroke="#C680FF" />
        <path d="M48 31L62 39L48 47L34 39L48 31Z" fill="url(#cube-pink)" stroke="#FFC5F3" />
        <path d="M34 39L48 47V65L34 57V39Z" fill="#CA47AC" stroke="#FF9CE8" />
        <path d="M62 39L48 47V65L62 57V39Z" fill="#982E9C" stroke="#F181DE" />
      </g>
      <path d="M14 28V35M19 31V38M24 32V39M70 31V38M75 32V39M80 29V36M42 48V56M47 51V59M54 49V57" stroke="#FFFFFF" stroke-opacity=".85" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  );
}