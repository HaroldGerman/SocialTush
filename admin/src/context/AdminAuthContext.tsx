'use client';

import axios, { AxiosInstance } from 'axios';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getApiUrl } from '@/config/api';

const TOKEN_KEY = 'lifonk_admin_access_token';
const USER_KEY = 'lifonk_admin_user';
export interface AdminSession { userId: string; username: string; displayName: string; email: string; role: 'ADMIN'; }
interface ContextValue { user: AdminSession|null; loading: boolean; api: AxiosInstance; login(identifier:string,password:string):Promise<void>; logout():void; }
const Context = createContext<ContextValue|null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user,setUser]=useState<AdminSession|null>(null); const [loading,setLoading]=useState(true);
  const api=useMemo(()=>axios.create({baseURL:getApiUrl()}),[]);
  useEffect(()=>{const interceptor=api.interceptors.request.use(config=>{const token=sessionStorage.getItem(TOKEN_KEY);if(token)config.headers.Authorization=`Bearer ${token}`;return config;});return()=>api.interceptors.request.eject(interceptor);},[api]);
  useEffect(()=>{try{const token=sessionStorage.getItem(TOKEN_KEY),stored=sessionStorage.getItem(USER_KEY);if(token&&stored){const parsed=JSON.parse(stored);if(parsed.role==='ADMIN')setUser(parsed);else{sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(USER_KEY);}}}finally{setLoading(false);}},[]);
  const logout=()=>{sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(USER_KEY);setUser(null);};
  const login=async(identifier:string,password:string)=>{const response=await axios.post(`${getApiUrl()}/auth/login`,{usernameOrEmail:identifier,password},{withCredentials:false});if(response.data.role!=='ADMIN'){logout();throw new Error('Esta cuenta no tiene permisos administrativos.');}const session:AdminSession={userId:response.data.userId,username:response.data.username,displayName:response.data.displayName,email:response.data.email,role:'ADMIN'};sessionStorage.setItem(TOKEN_KEY,response.data.accessToken);sessionStorage.setItem(USER_KEY,JSON.stringify(session));setUser(session);};
  return <Context.Provider value={{user,loading,api,login,logout}}>{children}</Context.Provider>;
}
export function useAdminAuth(){const value=useContext(Context);if(!value)throw new Error('AdminAuthProvider requerido');return value;}
