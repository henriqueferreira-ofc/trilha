
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Task, TaskStatus, TaskFormData, TaskCollaborator } from '../types/task';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { TaskRow } from '@/types/supabase';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Carregar tarefas do Supabase quando o componente for montado
  useEffect(() => {
    if (!user) return;

    const fetchTasks = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        console.log('Tarefas carregadas do Supabase:', data);
        
        // Convertendo do formato do banco para o formato usado na aplicação
        const formattedTasks: Task[] = data?.map((task: TaskRow) => ({
          id: task.id,
          title: task.title,
          description: task.description || '',
          status: task.status as TaskStatus,
          createdAt: task.created_at,
          dueDate: task.due_date
        })) || [];
        
        setTasks(formattedTasks);
      } catch (error) {
        console.error('Erro ao buscar tarefas:', error);
        toast.error('Erro ao carregar tarefas');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
    
    // Configurar listener para atualizações em tempo real
    const tasksSubscription = supabase
      .channel('public:tasks')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public',
        table: 'tasks'
      }, (payload) => {
        console.log('Alteração em tempo real recebida:', payload);
        
        // Atualizar o estado das tarefas com base no evento
        if (payload.eventType === 'INSERT') {
          const newTask = payload.new as TaskRow;
          if (newTask.user_id === user.id) {  // Verificar se a tarefa pertence ao usuário atual
            const formattedTask: Task = {
              id: newTask.id,
              title: newTask.title,
              description: newTask.description || '',
              status: newTask.status as TaskStatus,
              createdAt: newTask.created_at,
              dueDate: newTask.due_date
            };
            setTasks(prev => [formattedTask, ...prev]);
          }
        } else if (payload.eventType === 'UPDATE') {
          const updatedTask = payload.new as TaskRow;
          if (updatedTask.user_id === user.id) {  // Verificar se a tarefa pertence ao usuário atual
            setTasks(prev => 
              prev.map(task => task.id === updatedTask.id ? {
                id: updatedTask.id,
                title: updatedTask.title,
                description: updatedTask.description || '',
                status: updatedTask.status as TaskStatus,
                createdAt: updatedTask.created_at,
                dueDate: updatedTask.due_date
              } : task)
            );
          }
        } else if (payload.eventType === 'DELETE') {
          const deletedTaskId = payload.old.id;
          if (payload.old.user_id === user.id) {  // Verificar se a tarefa pertence ao usuário atual
            setTasks(prev => prev.filter(task => task.id !== deletedTaskId));
          }
        }
      })
      .subscribe();

    // Configurar listener para atualizações em tempo real da tabela task_collaborators
    const collaboratorSubscription = supabase
      .channel('public:task_collaborators')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public',
        table: 'task_collaborators'
      }, async (payload) => {
        console.log('Alteração em colaboradores recebida:', payload);
        
        // Se foi adicionado como colaborador em uma nova tarefa, buscar a tarefa
        if (payload.eventType === 'INSERT') {
          const newCollaborator = payload.new as any;
          if (newCollaborator.user_id === user.id) {
            // Buscar a tarefa onde foi adicionado como colaborador
            const { data, error } = await supabase
              .from('tasks')
              .select('*')
              .eq('id', newCollaborator.task_id)
              .single();
            
            if (!error && data) {
              const collaboratedTask: Task = {
                id: data.id,
                title: data.title,
                description: data.description || '',
                status: data.status as TaskStatus,
                createdAt: data.created_at,
                dueDate: data.due_date
              };
              
              // Adicionar à lista de tarefas apenas se ainda não existir
              setTasks(prev => {
                if (!prev.some(task => task.id === collaboratedTask.id)) {
                  return [collaboratedTask, ...prev];
                }
                return prev;
              });
            }
          }
        } 
        // Se foi removido como colaborador, verificar se precisa remover a tarefa da lista
        else if (payload.eventType === 'DELETE') {
          const oldCollaborator = payload.old as any;
          if (oldCollaborator.user_id === user.id) {
            // Verificar se ainda tem acesso à tarefa como dono
            const { data, error } = await supabase
              .from('tasks')
              .select('*')
              .eq('id', oldCollaborator.task_id)
              .eq('user_id', user.id)
              .single();
            
            // Se não for o dono da tarefa, remover da lista
            if (error) {
              setTasks(prev => prev.filter(task => task.id !== oldCollaborator.task_id));
            }
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tasksSubscription);
      supabase.removeChannel(collaboratorSubscription);
    };
  }, [user]);

  // Adicionar uma nova tarefa
  const addTask = async (taskData: TaskFormData): Promise<Task | null> => {
    if (!user) {
      toast.error('Você precisa estar logado para criar tarefas');
      return null;
    }

    try {
      // Criar um ID temporário para a tarefa
      const tempId = crypto.randomUUID();
      
      // Criar a nova tarefa com dados temporários
      const newTask: Task = {
        id: tempId,
        title: taskData.title,
        description: taskData.description || '',
        status: 'todo',
        createdAt: new Date().toISOString(),
        dueDate: taskData.dueDate
      };

      // Atualizar o estado local imediatamente
      setTasks(prev => [newTask, ...prev]);

      // Enviar para o banco de dados
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: taskData.title,
          description: taskData.description || '',
          status: 'todo' as TaskStatus,
          user_id: user.id,
          due_date: taskData.dueDate
        })
        .select()
        .single();

      if (error) {
        // Se houver erro, remover a tarefa temporária do estado local
        setTasks(prev => prev.filter(task => task.id !== tempId));
        throw error;
      }

      // Atualizar o estado local com os dados reais do banco
      const formattedTask: Task = {
        id: data.id,
        title: data.title,
        description: data.description || '',
        status: data.status as TaskStatus,
        createdAt: data.created_at,
        dueDate: data.due_date
      };

      setTasks(prev => prev.map(task => 
        task.id === tempId ? formattedTask : task
      ));

      toast.success('Tarefa criada com sucesso!');
      return formattedTask;
    } catch (error) {
      console.error('Erro ao criar tarefa:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao criar tarefa');
      return null;
    }
  };

  // Atualizar uma tarefa
  const updateTask = async (id: string, updatedData: Partial<Task>): Promise<void> => {
    if (!user) {
      toast.error('Você precisa estar logado para atualizar tarefas');
      return;
    }

    try {
      // Converter de volta para o formato do banco de dados
      const dbData: Partial<TaskRow> = {
        title: updatedData.title,
        description: updatedData.description,
        status: updatedData.status,
        due_date: updatedData.dueDate
      };

      const { error } = await supabase
        .from('tasks')
        .update(dbData)
        .eq('id', id);

      if (error) throw error;

      toast.success('Tarefa atualizada com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar tarefa:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar tarefa');
    }
  };

  // Excluir uma tarefa
  const deleteTask = async (id: string) => {
    if (!user) {
      toast.error('Você precisa estar logado para excluir tarefas');
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Tarefa removida com sucesso!');
    } catch (error) {
      console.error('Erro ao excluir tarefa:', error);
      toast.error('Erro ao excluir tarefa');
    }
  };

  // Alterar o status de uma tarefa
  const changeTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    if (!user) {
      toast.error('Você precisa estar logado para atualizar tarefas');
      return;
    }

    try {
      // Atualizar o estado local imediatamente
      setTasks(prev => 
        prev.map(task => 
          task.id === taskId 
            ? { ...task, status: newStatus }
            : task
        )
      );

      // Atualizar no banco de dados
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) {
        // Se houver erro, reverter a alteração local
        setTasks(prev => 
          prev.map(task => 
            task.id === taskId 
              ? { ...task, status: task.status }
              : task
          )
        );
        throw error;
      }

      toast.success(`Status da tarefa alterado para ${getStatusName(newStatus)}!`);
    } catch (error) {
      console.error('Erro ao atualizar status da tarefa:', error);
      toast.error('Erro ao atualizar status da tarefa');
    }
  };

  // Adicionar um colaborador a uma tarefa usando RPC
  const addCollaborator = async (taskId: string, userEmail: string): Promise<boolean> => {
    if (!user) {
      toast.error('Você precisa estar logado para adicionar colaboradores');
      return false;
    }

    try {
      // Buscar o ID do usuário pelo email
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', userEmail.split('@')[0])
        .single();

      if (userError || !userData) {
        toast.error('Usuário não encontrado');
        return false;
      }

      const collaboratorId = userData.id;

      // Verificar se o usuário já é colaborador usando a RPC
      const { data: existingCollaborator, error: checkError } = await supabase.rpc(
        'is_task_collaborator',
        {
          p_task_id: taskId,
          p_user_id: collaboratorId
        }
      );

      if (checkError) throw checkError;

      if (existingCollaborator) {
        toast.info('Este usuário já é colaborador desta tarefa');
        return false;
      }

      // Adicionar o colaborador usando a RPC
      const { error } = await supabase.rpc(
        'add_task_collaborator',
        {
          p_task_id: taskId,
          p_user_id: collaboratorId,
          p_added_by: user.id
        }
      );

      if (error) throw error;

      toast.success('Colaborador adicionado com sucesso!');
      return true;
    } catch (error) {
      console.error('Erro ao adicionar colaborador:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar colaborador');
      return false;
    }
  };

  // Remover um colaborador de uma tarefa usando RPC
  const removeCollaborator = async (collaboratorId: string): Promise<boolean> => {
    if (!user) {
      toast.error('Você precisa estar logado para remover colaboradores');
      return false;
    }

    try {
      // Remover o colaborador usando a RPC
      const { error } = await supabase.rpc(
        'remove_task_collaborator',
        {
          p_collaborator_id: collaboratorId
        }
      );

      if (error) throw error;

      toast.success('Colaborador removido com sucesso!');
      return true;
    } catch (error) {
      console.error('Erro ao remover colaborador:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao remover colaborador');
      return false;
    }
  };

  // Buscar colaboradores de uma tarefa usando RPC
  const getTaskCollaborators = async (taskId: string): Promise<TaskCollaborator[]> => {
    if (!user) {
      toast.error('Você precisa estar logado para ver colaboradores');
      return [];
    }

    try {
      // Buscar os colaboradores usando a RPC
      const { data, error } = await supabase.rpc(
        'get_task_collaborators',
        {
          p_task_id: taskId
        }
      );

      if (error) throw error;

      // Formatar os dados para o formato da aplicação
      const collaborators: TaskCollaborator[] = (data || []).map((collab: any) => ({
        id: collab.id,
        task_id: collab.task_id,
        user_id: collab.user_id,
        added_at: collab.added_at,
        added_by: collab.added_by,
        userEmail: collab.user_email || `${collab.username}@example.com`,
        userName: collab.username || 'Sem nome'
      }));

      return collaborators;
    } catch (error) {
      console.error('Erro ao buscar colaboradores:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao buscar colaboradores');
      return [];
    }
  };

  // Verificar se o usuário atual é dono de uma tarefa
  const isTaskOwner = async (taskId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('user_id')
        .eq('id', taskId)
        .single();

      if (error || !data) return false;
      return data.user_id === user.id;
    } catch (error) {
      console.error('Erro ao verificar propriedade da tarefa:', error);
      return false;
    }
  };

  // Função auxiliar para obter o nome legível do status
  const getStatusName = (status: TaskStatus): string => {
    switch (status) {
      case 'todo': return 'A Fazer';
      case 'inProgress': return 'Em Progresso';
      case 'done': return 'Concluída';
      default: return status;
    }
  };

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    changeTaskStatus,
    addCollaborator,
    removeCollaborator,
    getTaskCollaborators,
    isTaskOwner
  };
}
