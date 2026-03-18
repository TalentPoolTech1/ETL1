import { createSlice } from '@reduxjs/toolkit';
const initialState = {
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
        setAuthSuccess: (state, action) => {
            state.user = action.payload.user;
            state.permissions = action.payload.permissions;
            state.isAuthenticated = true;
            state.loading = false;
        },
        setAuthFailure: (state, action) => {
            state.error = action.payload;
            state.loading = false;
            state.isAuthenticated = false;
        },
        setPermissions: (state, action) => {
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
