'use client'

import Sidebar from '@/components/Sidebar'
import ContentStudio from '@/components/ContentStudio'

export default function ContentPage() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar active="content" />
      <main className="flex-1 overflow-auto px-8 py-8">
        <div className="max-w-[900px] mx-auto space-y-6">
          <div>
            <h1 className="text-[22px] font-normal text-foreground">Content Studio</h1>
            <p className="text-[13px] font-light text-muted-foreground mt-1">
              Články, LinkedIn posty a research od Soňy
            </p>
          </div>
          <ContentStudio />
        </div>
      </main>
    </div>
  )
}
