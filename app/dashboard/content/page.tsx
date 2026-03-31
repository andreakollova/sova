'use client'

import Sidebar from '@/components/Sidebar'
import ContentStudio from '@/components/ContentStudio'

export default function ContentPage() {
  return (
    <div className="flex h-screen bg-[#0A0614] overflow-hidden">
      <Sidebar active="content" />
      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Content Studio</h1>
            <p className="text-muted-foreground text-sm mt-1">Články, LinkedIn posty a research od Soňy</p>
          </div>
          <ContentStudio />
        </div>
      </main>
    </div>
  )
}
