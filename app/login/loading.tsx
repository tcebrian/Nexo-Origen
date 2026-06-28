export default function LoginLoading() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black text-white">
      <div
        className="absolute inset-0 bg-cover bg-[70%_center] bg-no-repeat sm:bg-right"
        style={{ backgroundImage: "url(/images/login-background.png)" }}
      />
      <div className="absolute inset-0 bg-black/55" />
      <p className="relative z-10 text-sm text-gray-400">Cargando acceso…</p>
    </main>
  );
}
