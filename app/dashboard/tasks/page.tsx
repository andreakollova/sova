'use client'

import Sidebar from '@/components/Sidebar'
import TaskBoard from '@/components/TaskBoard'

export default function TasksPage() {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar active="tasks" />
      <main className="flex-1 overflow-auto px-8 py-8">
        <div className="max-w-[900px] mx-auto space-y-6">
          <div>
            <h1 className="text-[22px] font-normal text-foreground">Úlohy</h1>
            <p className="text-[13px] font-light text-muted-foreground mt-1">
              Soňa sleduje tvoje priority a deadliny
            </p>
          </div>
          <TaskBoard fullView />
        </div>
      </main>
    </div>
  )
}
