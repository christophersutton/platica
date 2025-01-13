import { useSelector } from 'react-redux';
import { selectAuth } from '../store/authSlice';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import { Button } from "../components/ui/button";
import { LogOut } from 'lucide-react';
import { useLogoutMutation } from '../api';

const CurrentUser = () => {
  const { currentUser, status } = useSelector(selectAuth);
  const [logout, { isLoading }] = useLogoutMutation();

  const handleLogout = async () => {
    try {
      await logout();
      // The API automatically handles removing the auth token via onQueryStarted
      window.location.href = '/login'; // Or use your router's navigation
    } catch (error) {
      console.error('Failed to logout:', error);
      // Consider adding a toast notification here
    }
  };

  if (status === 'loading') {
    return (
      <div className="p-4 border-t bg-green-950 text-white">
        <div className="animate-pulse flex items-center space-x-2">
          <div className="w-8 h-8 bg-gray-600 rounded"></div>
          <div className="h-4 bg-gray-600 rounded w-24"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-3 border-t bg-green-950 text-white">
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="ghost" 
            className="w-full p-0 h-auto hover:bg-gray-800 hover:text-white"
          >
            <div className="flex items-center space-x-2">
              {currentUser?.avatarUrl ? (
                <img 
                  src={currentUser.avatarUrl} 
                  alt={currentUser.email || 'User'} 
                  className="w-8 h-8 rounded object-cover"
                />
              ) : (
                <div className="w-8 h-8 bg-gray-600 rounded flex items-center justify-center">
                  {currentUser?.name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <span className="text-sm font-medium">
                {currentUser?.name || 'Anonymous User'}
              </span>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" side="top">
          <div className="space-y-1">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <button 
                onClick={handleLogout} 
                disabled={isLoading}
              >
                {isLoading ? 'Logging out...' : 'Logout'}
              </button>
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default CurrentUser;