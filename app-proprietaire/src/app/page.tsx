export default function DashboardPage() {
  return (
    <>
      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-[0_10px_30px_rgba(26,28,29,0.04)]">
        <div className="flex items-center justify-between px-6 h-16 w-full max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <div
              className="w-8 h-8 bg-orange-600 dark:bg-orange-500"
              style={{
                WebkitMaskImage: 'url(/logobarpilote.png)',
                WebkitMaskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskImage: 'url(/logobarpilote.png)',
                maskSize: 'contain',
                maskRepeat: 'no-repeat',
                maskPosition: 'center',
              }}
            />
            <span className="text-2xl font-bold tracking-tight text-orange-600 dark:text-orange-500">
              BarPilote
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a
              className="text-orange-600 dark:text-orange-500 border-b-2 border-orange-600 font-semibold hover:text-orange-500 transition-colors"
              href="#"
            >
              Tableau
            </a>
            <a
              className="text-gray-500 dark:text-gray-400 font-medium hover:text-orange-500 transition-colors"
              href="#"
            >
              Stocks
            </a>
            <a
              className="text-gray-500 dark:text-gray-400 font-medium hover:text-orange-500 transition-colors"
              href="#"
            >
              Équipe
            </a>
            <a
              className="text-gray-500 dark:text-gray-400 font-medium hover:text-orange-500 transition-colors"
              href="#"
            >
              Réglages
            </a>
          </nav>
          <button className="flex items-center justify-center p-2 rounded-full hover:bg-surface-container transition-colors active:scale-95 duration-200">
            <span className="material-symbols-outlined text-on-surface" data-icon="notifications">
              notifications
            </span>
          </button>
        </div>
      </header>
      <main className="pt-24 px-6 max-w-7xl mx-auto space-y-8">
        {/* Live Revenue Section (The Digital Sommelier Hero) */}
        <section className="bg-surface-container-lowest rounded-xl p-8 executive-shadow flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-hidden relative">
          <div className="relative z-10">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-on-surface-variant mb-2">
              REVENU EN DIRECT
            </p>
            <div className="flex items-baseline gap-4">
              <h1 className="text-[2.75rem] md:text-[4rem] font-black tracking-tight leading-none text-on-surface">
                $245.00
              </h1>
              <div className="flex items-center text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-sm font-semibold">
                <span className="material-symbols-outlined text-sm mr-1" data-icon="trending_up">
                  trending_up
                </span>
                +12%
              </div>
            </div>
            <p className="mt-4 text-on-surface-variant/60 font-medium text-sm">
              Dernière transaction traitée il y a 2 min
            </p>
          </div>
          {/* Asymmetric Momentum: Trend Sparkline Visual */}
          <div className="hidden md:block w-48 h-24 opacity-20">
            <svg className="w-full h-full" viewBox="0 0 100 40">
              <path
                d="M0 35 Q 20 30, 40 38 T 80 10 T 100 5"
                fill="none"
                stroke="#FF5E00"
                strokeLinecap="round"
                strokeWidth="3"
              ></path>
            </svg>
          </div>
          {/* Absolute decorative element */}
          <div className="absolute top-0 right-0 w-32 h-32 citrus-gradient opacity-[0.03] rounded-full -mr-16 -mt-16"></div>
        </section>
        {/* Bento Grid: Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Active Tables Card */}
          <div className="bg-surface-container-lowest p-8 rounded-xl executive-shadow group hover:translate-y-[-4px] transition-transform duration-300">
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 rounded-2xl bg-orange-50 text-orange-600">
                <span className="material-symbols-outlined" data-icon="table_restaurant">
                  table_restaurant
                </span>
              </div>
              <span
                className="material-symbols-outlined text-surface-variant group-hover:text-orange-600 transition-colors"
                data-icon="arrow_outward"
              >
                arrow_outward
              </span>
            </div>
            <h3 className="text-sm font-semibold tracking-wide text-on-surface-variant mb-1 uppercase">
              TABLES ACTIVES
            </h3>
            <p className="text-[2.75rem] font-bold text-on-surface tracking-tight leading-none">
              12
            </p>
            <div className="mt-4 h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-orange-600 rounded-full w-[75%]"></div>
            </div>
            <p className="mt-3 text-[11px] font-semibold text-on-surface-variant/50 uppercase tracking-widest">
              75% DE CAPACITÉ
            </p>
          </div>
          {/* Orders in Flight Card */}
          <div className="bg-surface-container-lowest p-8 rounded-xl executive-shadow group hover:translate-y-[-4px] transition-transform duration-300">
            <div className="flex justify-between items-start mb-6">
              <div className="p-3 rounded-2xl bg-orange-50 text-orange-600">
                <span className="material-symbols-outlined" data-icon="liquor">
                  liquor
                </span>
              </div>
              <span
                className="material-symbols-outlined text-surface-variant group-hover:text-orange-600 transition-colors"
                data-icon="arrow_outward"
              >
                arrow_outward
              </span>
            </div>
            <h3 className="text-sm font-semibold tracking-wide text-on-surface-variant mb-1 uppercase">
              COMMANDES EN COURS
            </h3>
            <p className="text-[2.75rem] font-bold text-on-surface tracking-tight leading-none">
              4
            </p>
            <div className="flex gap-2 mt-4">
              <div className="h-2 w-8 bg-orange-600 rounded-full"></div>
              <div className="h-2 w-8 bg-orange-600 rounded-full"></div>
              <div className="h-2 w-8 bg-orange-600 rounded-full"></div>
              <div className="h-2 w-8 bg-orange-600 rounded-full"></div>
              <div className="h-2 w-8 bg-surface-container-highest rounded-full"></div>
            </div>
            <p className="mt-3 text-[11px] font-semibold text-on-surface-variant/50 uppercase tracking-widest">
              PRÉP. MOYENNE : 4:20M
            </p>
          </div>
        </div>
        {/* Recent Sales Section */}
        <section className="bg-surface-container-lowest rounded-xl p-8 executive-shadow">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-1.5rem font-bold tracking-tight text-on-surface">Ventes Récentes</h2>
            <button className="text-orange-600 text-sm font-semibold hover:underline">
              Tout voir
            </button>
          </div>
          <div className="space-y-1">
            {/* Sale Item 1 */}
            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-surface-container transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-orange-600 overflow-hidden">
                  <img
                    alt="Margarita"
                    className="w-full h-full object-cover"
                    data-alt="Close up of a fresh lime margarita with salt rim"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDtPup9hyrYdrwhf8YEGNLNYwyTZK2JgHJ1ijmqIA84TiMEmEaf5WSPqX5eIOodqe5y3n1Ftr4HHuRIXYvs0alIR_dohGigQpSNXixDcap2brV5DIsQvAAljtj1EgRVG2jYRRVwt0Wd-el6mDDC0K4P3ujQBvNJ0KVDuR-F5vsOWAJaCAd-sArZbIaBCEvKzYdowozNPasrf6VVUJep7nXdKla4nCQBqafTMBrTJEKz0wXvJsy6unDYegiUzl699rtOKMLahvdzWYKs"
                  />
                </div>
                <div>
                  <p className="font-semibold text-on-surface">Margarita</p>
                  <p className="text-xs text-on-surface-variant/60">Table 4 • 2:45 PM</p>
                </div>
              </div>
              <p className="text-lg font-bold text-on-surface">$14.00</p>
            </div>
            {/* Sale Item 2 */}
            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-surface-container transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-orange-600 overflow-hidden">
                  <img
                    alt="IPA Pint"
                    className="w-full h-full object-cover"
                    data-alt="Craft beer pint with thick foam head"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuCR7qjAnJp72tzbXZIL-WMOEZE9TssBWmRKnaxLVEZ1Ef4fsL-307niBmUdIt26u2psHI2sAdlvFHwKYuU9y91B3WDgqnRNM5JTI1qCZVjXp4vWwxJ_HS8r7rr9MKWhIxQt-ngWiYimcE6MlY7eANHYYS6eyckQNg39fGmTtgitulhMrlp50UjQlZatfRmjGt3Zb_pBajlVotX0C1V0w6JNSLtVOZYGB0hddMNnVYzPgnX3aN_FMFmTNZLESJhCjmXVd4_C3kMo1wYo"
                  />
                </div>
                <div>
                  <p className="font-semibold text-on-surface">IPA Pint</p>
                  <p className="text-xs text-on-surface-variant/60">Bar Seat 2 • 2:42 PM</p>
                </div>
              </div>
              <p className="text-lg font-bold text-on-surface">$8.00</p>
            </div>
            {/* Sale Item 3 */}
            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-surface-container transition-colors group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-orange-600 overflow-hidden">
                  <img
                    alt="Old Fashioned"
                    className="w-full h-full object-cover"
                    data-alt="Classic old fashioned cocktail with orange peel"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuA664ds8plNvX2FPof-KGfPcV8q3i8h09dHVcVHtPxO1vchMlG47e9fit3FiKN3o3ZzCBpqj9jO_AgX-GH81VmhKGOFndhHuDdlGDhmindBm7UxpgVm2kGXtR-XKrY2QPA_zHw7zzdtTp6kYHcyCS3bfDxJkCgbosVdHcps0jpxdWtGunMSk6wc5mOANRSHa_J0MMSRrK7qC-lUGNXxIZVmlIQEK1tXcnWNC4OONn0b6sZ_WfOeRvWSXmCp7lxQ7RnqJYPb6iOlRC1R"
                  />
                </div>
                <div>
                  <p className="font-semibold text-on-surface">Old Fashioned</p>
                  <p className="text-xs text-on-surface-variant/60">Table 12 • 2:38 PM</p>
                </div>
              </div>
              <p className="text-lg font-bold text-on-surface">$16.00</p>
            </div>
          </div>
        </section>
      </main>
      {/* BottomNavBar (Mobile Only) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full glass-nav flex justify-around items-center px-6 pb-8 pt-4 rounded-t-[24px] shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-50">
        <a
          className="flex flex-col items-center justify-center text-orange-600 dark:text-orange-500 scale-110 active:scale-90 duration-150 ease-out"
          href="#"
        >
          <span
            className="material-symbols-outlined"
            data-icon="dashboard"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            dashboard
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">Tableau</span>
        </a>
        <a
          className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 active:scale-90 duration-150 ease-out"
          href="#"
        >
          <span className="material-symbols-outlined" data-icon="inventory_2">
            inventory_2
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">Stocks</span>
        </a>
        <a
          className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 active:scale-90 duration-150 ease-out"
          href="#"
        >
          <span className="material-symbols-outlined" data-icon="badge">
            badge
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">Équipe</span>
        </a>
        <a
          className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 active:scale-90 duration-150 ease-out"
          href="#"
        >
          <span className="material-symbols-outlined" data-icon="settings">
            settings
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider mt-1">Réglages</span>
        </a>
      </nav>
      {/* Contextual FAB (Dashboard relevant action) */}
      <button className="fixed bottom-24 right-6 md:bottom-12 md:right-12 citrus-gradient text-white w-14 h-14 rounded-full flex items-center justify-center shadow-2xl active:scale-95 transition-all z-40">
        <span className="material-symbols-outlined" data-icon="add">
          add
        </span>
      </button>
    </>
  );
}
