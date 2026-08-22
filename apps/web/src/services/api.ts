import axios from 'axios';

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

const api = axios.create({
  baseURL: (import.meta as ImportMeta & { env: ImportMetaEnv }).env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default api;
