import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';
import { Center, Spinner } from '@chakra-ui/react';

const RedirectIfAuth = () => {
  const { auth, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Center height="100vh">
        <Spinner size="xl" />
      </Center>
    );
  }

  return auth?.accessToken ? <Navigate to="/" /> : <Outlet />;
};

export default RedirectIfAuth;