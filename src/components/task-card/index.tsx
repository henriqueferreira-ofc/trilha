
import { useDrag } from 'react-dnd';
import { Card } from '@/components/ui/card';
import { Task } from '@/types/task';
import { TaskDueDate } from './task-due-date';
import { TaskActionsMenu } from './task-actions-menu';
import { TaskCollaboratorsButton } from './task-collaborators-button';
import { Check, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updatedData: Partial<Task>) => void;
  onToggleComplete?: () => void;
}

export function TaskCard({ task, onDelete, onUpdate, onToggleComplete }: TaskCardProps) {
  const [{ isDragging }, drag] = useDrag({
    type: 'task',
    item: { id: task.id },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  });

  // Estilo baseado no status da tarefa
  const getTaskStyle = () => {
    switch (task.status) {
      case 'todo':
        return 'border-l-4 border-l-purple-500/70';
      case 'in-progress':
        return 'border-l-4 border-l-blue-500/70';
      case 'done':
        return 'border-l-4 border-l-green-500/70';
      default:
        return '';
    }
  };

  return (
    <Card 
      ref={drag}
      className={`p-4 mb-2 bg-black ${getTaskStyle()} shadow-sm hover:shadow-md transition-all cursor-grab ${
        isDragging ? 'opacity-50' : 'opacity-100'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="p-1 h-6 w-6 rounded-full hover:bg-purple-500/20"
              onClick={onToggleComplete}
            >
              {task.status === 'done' ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Circle className="h-4 w-4 text-gray-400" />
              )}
            </Button>
            <h3 className={`text-base font-medium ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>
              {task.title}
            </h3>
          </div>
          {task.description && (
            <p className="text-sm text-muted-foreground mt-1 ml-7 line-clamp-2">
              {task.description}
            </p>
          )}
        </div>
        
        <TaskActionsMenu task={task} onDelete={onDelete} onUpdate={onUpdate} />
      </div>
      
      <div className="flex items-center justify-between mt-4">
        {task.due_date && (
          <TaskDueDate dueDate={task.due_date} status={task.status} />
        )}
        
        <div className="flex items-center space-x-2">
          <TaskCollaboratorsButton taskId={task.id} />
        </div>
      </div>
    </Card>
  );
}
