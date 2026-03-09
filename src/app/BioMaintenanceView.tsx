import { ASSET_PREFIX } from "./constants";

const MAINTENANCE_MSG = {
  en: "The server is under maintenance for improvements and we'll be back soon.",
  pt: "O servidor está em manutenção para melhoria/ajuste e voltaremos em breve.",
};

export default function BioMaintenanceView() {
  return (
    <div className="crypto-login-page relative overflow-hidden min-h-screen flex flex-col items-center">
      <div className="crypto-login-wrap relative mx-auto w-full max-w-5xl flex-1 flex flex-col items-center justify-center px-6 py-8 sm:px-12 sm:py-10">
        <div className="mx-auto max-w-4xl w-full">
          <div className="mb-8 flex items-center justify-center">
            <div
              className="protected-logo-container drop-shadow-sm"
              style={{
                userSelect: "none",
                WebkitUserSelect: "none",
                MozUserSelect: "none",
                msUserSelect: "none",
                position: "relative",
                display: "inline-block",
              }}
            >
              <img
                src={`${ASSET_PREFIX}/icon.png`}
                alt="Crypto"
                width={80}
                height={80}
                className="protected-logo h-20 w-20 object-contain"
                loading="eager"
                decoding="async"
                fetchPriority="high"
                draggable={false}
                style={{
                  userSelect: "none",
                  WebkitUserSelect: "none",
                  MozUserSelect: "none",
                  msUserSelect: "none",
                  pointerEvents: "none",
                  WebkitUserDrag: "none",
                  userDrag: "none",
                } as React.CSSProperties}
              />
            </div>
          </div>
          <header className="crypto-login-header w-full text-center">
            <h1 className="block w-full text-2xl font-bold leading-tight tracking-tight text-zinc-900 md:text-3xl">
              Crypto
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">by SevenCoins</p>
          </header>
        </div>

        <div className="mx-auto w-full max-w-md">
          <section
            className="crypto-login-card card-crypto-generator w-full rounded-2xl px-6 py-8 text-center"
            aria-live="polite"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-0.5">
                <h2 className="crypto-login-title text-lg font-semibold tracking-tight text-zinc-800">
                  Maintenance
                </h2>
                <p className="text-zinc-700">{MAINTENANCE_MSG.en}</p>
              </div>
              <p className="text-zinc-600 text-sm">{MAINTENANCE_MSG.pt}</p>
              <p className="text-zinc-500 text-xs border-t border-zinc-200 pt-4">
                {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
