import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  user: {
    id: string;
    email?: string;
    fullName?: string;
  } | null;
  permissions: string[];
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  permissions: [],
  isAuthenticated: !!localStorage.getItem('authToken'),
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthStart: (state) => {
      state.loading = true;
      state.error = null;
    },
    setAuthSuccess: (state, action: PayloadAction<{ user: any; permissions: string[] }>) => {
      state.user = action.payload.user;
      state.permissions = action.payload.permissions;
      state.isAuthenticated = true;
      state.loading = false;
    },
    setAuthFailure: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.loading = false;
      state.isAuthenticated = false;
    },
    setPermissions: (state, action: PayloadAction<string[]>) => {
      state.permissions = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.permissions = [];
      state.isAuthenticated = false;
      localStorage.removeItem('authToken');
    },
  },
});

export const { setAuthStart, setAuthSuccess, setAuthFailure, setPermissions, logout } = authSlice.actions;
export default authSlice.reducer;
