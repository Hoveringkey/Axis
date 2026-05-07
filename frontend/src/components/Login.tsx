import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button, Input } from './ui';
import './Login.css';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const loginError = err as { response?: { data?: { detail?: string } } };
      setError(
        loginError.response?.data?.detail ||
        'No se pudo iniciar sesión. Revisa tus credenciales.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-brand" aria-hidden="true">Axis</div>
        <div className="login-header">
          <h2>Acceso a Axis</h2>
          <p>Ingresa tus credenciales para continuar.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}
          
          <Input
            id="username"
            label="Usuario"
            name="username"
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Ingresa tu usuario"
            required
            type="text"
            value={username}
          />

          <Input
            id="password"
            label="Contraseña"
            name="password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            type="password"
            value={password}
          />

          <Button className="login-button" disabled={isLoading} size="lg" type="submit">
            {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Login;
