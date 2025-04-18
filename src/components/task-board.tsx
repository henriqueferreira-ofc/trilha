
import { useMemo } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Task, TaskStatus } from '@/types/task';
import { TaskColumn } from '@/components/task-column';
import { groupTasksByStatus } from '@/lib/task-utils';

interface TaskBoardProps {
  tasks: Task[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updatedData: Partial<Task>) => void;
  onChangeStatus: (taskId: string, newStatus: TaskStatus) => void;
}

export function TaskBoard({ tasks, onDelete, onUpdate, onChangeStatus }: TaskBoardProps) {
  // Group tasks by status
  const columns = useMemo(() => groupTasksByStatus(tasks), [tasks]);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 p-6">
        {columns.map((column) => (
          <TaskColumn
            key={column.id}
            column={column}
            onDelete={onDelete}
            onUpdate={onUpdate}
            onDrop={onChangeStatus}
          />
        ))}
      </div>
    </DndProvider>
  );
}
