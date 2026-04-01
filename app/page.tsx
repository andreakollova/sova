'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="relative h-screen w-full overflow-hidden flex items-center justify-center">
      {/* Video background */}
      <video
        src="/animacia.mp4"
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(8,47,93,0.65) 0%, rgba(11,17,78,0.80) 50%, rgba(11,17,78,0.92) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 animate-fade-in">
        {/* Logo */}
        <div className="mb-8">
          <div
            className="w-24 h-24 rounded-3xl overflow-hidden mx-auto mb-4 shadow-2xl"
            style={{ boxShadow: '0 0 60px rgba(255,127,0,0.35)' }}
          >
            <Image
              src="/robutka.png"
              alt="SOVA"
              width={96}
              height={96}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <h1
            className="text-5xl md:text-7xl font-bold tracking-tight text-white"
            style={{ textShadow: '0 2px 20px rgba(0,0,0,0.4)' }}
          >
            SOVA
          </h1>
        </div>

        {/* Tagline */}
        <p
          className="text-lg md:text-2xl font-light text-white/80 mb-2 tracking-wide"
          style={{ textShadow: '0 1px 10px rgba(0,0,0,0.4)' }}
        >
          Tvoja osobna AI asistentka
        </p>
        <p className="text-sm text-white/50 mb-12 tracking-widest uppercase">
          Sona je tu pre teba
        </p>

        {/* CTA */}
        <Link
          href="/dashboard"
          className="group relative px-10 py-4 rounded-2xl text-white font-semibold text-lg overflow-hidden transition-all duration-300 hover:scale-105 active:scale-95"
          style={{
            background: 'linear-gradient(135deg, #FF7F00, #e06000)',
            boxShadow: '0 8px 30px rgba(255,127,0,0.4)',
          }}
        >
          <span className="relative z-10">Otvorit dashboard</span>
          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
        </Link>

        {/* Bottom hint */}
        <p className="mt-8 text-white/30 text-xs tracking-wider">
          SOVA · Personal AI · 2025
        </p>
      </div>
    </div>
  )
}
