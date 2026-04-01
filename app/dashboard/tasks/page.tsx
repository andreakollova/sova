'use client'

import Sidebar from '@/components/Sidebar'
import TaskBoard from '@/components/TaskBoard'

export default function TasksPage() {
  return (
    <div className="flex h-screen dark:bg-[#0b114e] bg-gray-50 overflow-hidden">
      <Sidebar active="tasks" />
      <main className="flex-1 overflow-auto p-5 lg:p-7">
        <div className="max-w-5xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Ulohy</h1>
            <p className="text-muted-foreground text-sm mt-1">Sona sleduje tvoje priority a deadliny</p>
          </div>
          <TaskBoard fullView />
        </div>
      </main>
    </div>
  )
}
