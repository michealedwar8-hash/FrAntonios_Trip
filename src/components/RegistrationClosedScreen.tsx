import { motion, useReducedMotion } from 'motion/react';
import { Bus, CalendarCheck2, Compass, Sun } from 'lucide-react';

export function RegistrationClosedScreen() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      aria-label="انتهاء التسجيل في الرحلة"
      className="flex min-h-[72vh] items-center justify-center py-10 sm:py-16"
    >
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B7285] via-[#0F8B8D] to-[#EA6A2B] p-[2px] shadow-xl shadow-[#0B7285]/15"
      >
        <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#0A6274] via-[#0E7C86] to-[#D95D24] px-6 py-10 text-center text-white sm:px-12 sm:py-14">
          {/* Vibrant Youthful Ambient Light Accents */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-amber-300/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-cyan-300/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-400/15 blur-2xl"
          />

          {/* Energetic Icon Row */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.45 }}
            className="relative mx-auto mb-6 flex items-center justify-center gap-3"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-amber-200 ring-1 ring-white/25 backdrop-blur-sm">
              <Sun className="h-5 w-5" />
            </span>
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-400 text-[#1E1A16] shadow-lg shadow-orange-950/25">
              <Bus className="h-7 w-7" />
            </span>
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-cyan-100 ring-1 ring-white/25 backdrop-blur-sm">
              <Compass className="h-5 w-5" />
            </span>
          </motion.div>

          {/* Meeting & Trip Headings */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16, duration: 0.45 }}
            className="relative space-y-2.5"
          >
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-white drop-shadow-xs sm:text-4xl lg:text-5xl">
              اجتماع شباب الثلاث فتية
            </h1>
            <p className="font-display text-lg font-bold text-amber-100 sm:text-xl lg:text-2xl">
              رحلة إلى دير الأنبا أنطونيوس بالبحر الأحمر
            </p>
          </motion.div>

          {/* Prominent Centerpiece Message Card */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="relative mx-auto mt-8 max-w-lg rounded-2xl border border-white/40 bg-white/95 px-6 py-8 text-[#1E1A16] shadow-2xl shadow-black/20 sm:px-10 sm:py-9"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-orange-500 text-white shadow-md">
              <CalendarCheck2 className="h-6 w-6" />
            </div>

            <p className="font-display text-3xl font-extrabold leading-snug text-[#0B5D6B] sm:text-4xl">
              التسجيل انتهى !!
            </p>

            <div
              aria-hidden="true"
              className="mx-auto my-4 h-1 w-20 rounded-full bg-gradient-to-r from-[#0F8B8D] via-[#F59E0B] to-[#EA6A2B]"
            />

            <p className="font-display text-xl font-extrabold text-[#C24D1A] sm:text-2xl">
              منتظرينكم في الرحلة
            </p>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
