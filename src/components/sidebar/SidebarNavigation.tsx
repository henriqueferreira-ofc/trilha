import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  HomeIcon, 
  GearIcon, 
  CalendarIcon, 
  PieChartIcon, 
  PersonIcon,
  ExitIcon,
  EnvelopeClosedIcon,
  HeartFilledIcon
} from '@radix-ui/react-icons';
import { Cake } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useBoards } from '@/hooks/use-boards';

interface SidebarNavigationProps {
  onLogout: () => void;
}

export function SidebarNavigation({ onLogout }: SidebarNavigationProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { setCurrentBoard } = useBoards();
  const isActive = (path: string) => location.pathname === path;

  const handleNavigation = (path: string) => {
    if (path === '/app') {
      setCurrentBoard(null);
    }
  };

  // Items comuns para todos os usuários
  let navItems = [
    { 
      icon: <HomeIcon className="h-4 w-4 mr-2" />, 
      label: 'Tarefas', 
      path: '/app'
    }
  ];

  // Adiciona itens específicos apenas para usuários autenticados
  if (user) {
    navItems = [
      ...navItems,
      { 
        icon: <Cake className="h-4 w-4 mr-2" />, 
        label: 'Aniversários', 
        path: '/birthdays' 
      },
      { 
        icon: <CalendarIcon className="h-4 w-4 mr-2" />, 
        label: 'Calendário', 
        path: '/calendar' 
      },
      { 
        icon: <HeartFilledIcon className="h-4 w-4 mr-2" />, 
        label: 'Planos', 
        path: '/subscription' 
      },
      { 
        icon: <GearIcon className="h-4 w-4 mr-2" />, 
        label: 'Configurações', 
        path: '/settings' 
      },
      { 
        icon: <PersonIcon className="h-4 w-4 mr-2" />, 
        label: 'Sobre', 
        path: '/about' 
      }
    ];
  }

  return (
    <ScrollArea className="flex-1 pt-2">
      <div className="flex flex-col gap-1 p-2">
        {navItems.map((item) => (
          <Link 
            to={item.path} 
            key={item.path} 
            onClick={() => handleNavigation(item.path)}
          >
            <Button
              variant={isActive(item.path) ? 'secondary' : 'ghost'}
              className="w-full justify-start"
            >
              {item.icon}
              {item.label}
            </Button>
          </Link>
        ))}
        <div className="mt-auto">
          <Button
            variant="ghost"
            className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-100/10"
            onClick={onLogout}
          >
            <ExitIcon className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}
