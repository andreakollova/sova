'use client'

import Sidebar from '@/components/Sidebar'
import ContentStudio from '@/components/ContentStudio'

export default function ContentPage() {
  return (
    <div className="flex h-screen dark:bg-[#0b114e] bg-gray-50 overflow-hidden">
      <Sidebar active="content" />
      <main className="flex-1 overflow-auto p-5 lg:p-7">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Content Studio</h1>
            <p className="text-muted-foreground text-sm mt-1">Clanky, LinkedIn posty a research od Sony</p>
          </div>
          <ContentStudio />
        </div>
      </main>
    </div>
  )
}
