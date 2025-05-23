
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TaskCollaboratorsButtonProps {
  taskId: string;
  onClick?: () => void;
}

export function TaskCollaboratorsButton({ taskId, onClick }: TaskCollaboratorsButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="h-8 w-8"
    >
      <Users className="h-4 w-4" />
    </Button>
  );
}
