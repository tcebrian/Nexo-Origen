import Image from "next/image";
import { Suspense } from "react";
import { NexoOrigenWordmark } from "@/app/_components/nexo-brand";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <Image
        src="/images/login-background.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-[70%_center] sm:object-right"
        quality={90}
      />

      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/75" />

      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-6 lg:items-start lg:pl-[8%] xl:pl-[10%]">
        <div className="w-full max-w-[560px]">
          <div className="relative overflow-hidden rounded-[36px] border border-white/20 bg-[#14101c]/90 px-10 py-10 shadow-[0_0_90px_rgba(109,40,217,0.38)] backdrop-blur-2xl">
            <div className="pointer-events-none absolute inset-0 rounded-[36px] border border-purple-300/20" />
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-purple-200/70 to-transparent" />
            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-purple-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-violet-700/15 blur-3xl" />

            <div className="relative z-10">
              <NexoOrigenWordmark size="xl" align="center" variant="dashboard" className="px-2" />

              <div className="my-9 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

              <div>
                <h2 className="text-center text-[34px] font-light tracking-tight text-white">
                  Bienvenido
                </h2>

                <p className="mt-3 text-center text-sm text-gray-300/75">
                  Inicia sesión para acceder a tu panel
                </p>

                <Suspense fallback={<div className="mt-9 h-[280px]" />}>
                  <LoginForm />
                </Suspense>

                <div className="my-8 flex items-center gap-4">
                  <div className="h-px flex-1 bg-white/12" />
                  <div className="text-purple-200/85">◇</div>
                  <div className="h-px flex-1 bg-white/12" />
                </div>

                <p className="text-center text-sm text-gray-300/70">
                  Inteligencia reputacional para cadenas de restauración
                </p>
              </div>
            </div>
          </div>

          <footer className="mt-7 text-center text-xs text-gray-400/70">
            <p>© 2026 Nexo Origen. Todos los derechos reservados.</p>

            <div className="mt-3 flex justify-center gap-4 text-purple-200/75">
              <a href="/logout" className="hover:text-white">
                Cerrar sesión
              </a>
              <span>•</span>
              <span>Privacidad</span>
              <span>•</span>
              <span>Términos</span>
              <span>•</span>
              <span>Contacto</span>
            </div>
          </footer>
        </div>
      </section>
    </main>
  );
}
