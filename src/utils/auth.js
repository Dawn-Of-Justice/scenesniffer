const AUTH_TOKEN_KEY = 'authToken';

export const saveAuthToken = (token) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const getAuthToken = () => {
    return localStorage.getItem(AUTH_TOKEN_KEY);
};

export const clearAuthToken = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
};

export const isAuthenticated = () => {
    return getAuthToken() !== null;
};