import React, { createContext, useState, useEffect, useContext } from 'react';
import api from '../api/axios';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // We can't use useNavigate here directly if AuthProvider is outside Router.
    // Assuming AuthProvider is inside Router in App.jsx

    useEffect(() => {
        const initAuth = async () => {
            const token = localStorage.getItem('access_token');
            if (token) {
                try {
                    const response = await api.get('/me/');
                    setUser(response.data);
                } catch (error) {
                    console.error("Failed to fetch user", error);
                    if (error.response?.status === 401) {
                        // Token invalid/expired and refresh failed in interceptor
                        setUser(null);
                    }
                }
            }
            setLoading(false);
        };
        initAuth();
    }, []);

    const login = async (username, password) => {
        try {
            // 1. Get tokens
            const response = await api.post('/auth/login/', { username, password });
            const { access, refresh } = response.data;

            localStorage.setItem('access_token', access);
            localStorage.setItem('refresh_token', refresh);

            // 2. Get user details (role)
            const meResponse = await api.get('/me/');
            setUser(meResponse.data);
            return meResponse.data; // Return user to component for navigation
        } catch (error) {
            console.error("Login failed", error);
            throw error;
        }
    };

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        window.location.href = '/login'; // Hard redirect to clear state/routes
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
