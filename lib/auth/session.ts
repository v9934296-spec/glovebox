import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { clearUserSyncState,clearWorkspaceData, LOCAL_WORKSPACE, moveWorkspaceData, setActiveWorkspace, userWorkspaceId, workspaceHasData } from '../db/database';
import { getSyncState, setSyncState } from '../sync/queue';
import { getSupabase, isSupabaseConfigured } from '../supabase';

const LOCAL_ONLY_KEY = 'glovebox.localOnly';
export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'localOnly';
type ImportChoice = 'move' | 'keep';
type AuthState = {
  status: AuthStatus; session: Session | null; recoveryMode: boolean; needsLocalImportDecision: boolean;
  initialize: () => Promise<void>; signIn:(email:string,password:string)=>Promise<void>;
  signUp:(email:string,password:string)=>Promise<{needsEmailConfirmation:boolean}>;
  sendPasswordReset:(email:string)=>Promise<void>; updatePassword:(password:string)=>Promise<void>;
  signOut:()=>Promise<void>; continueWithoutAccount:()=>Promise<void>;
  resolveLocalImport:(choice:ImportChoice)=>Promise<void>; deleteAccount:()=>Promise<void>;
};
function importDecisionKey(userId:string){return `localImportDecision:${userId}`;}
function activateSession(session:Session,set:(state:Partial<AuthState>)=>void){const userId=session.user.id;setActiveWorkspace(userWorkspaceId(userId));const needs=workspaceHasData(LOCAL_WORKSPACE)&&getSyncState(importDecisionKey(userId))==null;set({status:'signedIn',session,needsLocalImportDecision:needs});}

export const useAuth=create<AuthState>((set,get)=>({
  status:'loading',session:null,recoveryMode:false,needsLocalImportDecision:false,
  initialize:async()=>{
    if(!isSupabaseConfigured){setActiveWorkspace(LOCAL_WORKSPACE);set({status:'localOnly',session:null});return;}
    const supabase=getSupabase();const [{data},localOnly]=await Promise.all([supabase.auth.getSession(),AsyncStorage.getItem(LOCAL_ONLY_KEY)]);
    if(data.session)activateSession(data.session,set);else{const local=localOnly==='1';if(local)setActiveWorkspace(LOCAL_WORKSPACE);set({status:local?'localOnly':'signedOut',session:null});}
    supabase.auth.onAuthStateChange((event,session)=>{
      if(event==='PASSWORD_RECOVERY')set({recoveryMode:true});
      if(session)activateSession(session,set);
      else if(get().status==='signedIn'){setActiveWorkspace(LOCAL_WORKSPACE);void AsyncStorage.getItem(LOCAL_ONLY_KEY).then(flag=>set({status:flag==='1'?'localOnly':'signedOut',session:null,needsLocalImportDecision:false,recoveryMode:false}));}
    });
  },
  signIn:async(email,password)=>{const{data,error}=await getSupabase().auth.signInWithPassword({email,password});if(error)throw new Error(error.message);if(data.session)activateSession(data.session,set);},
  signUp:async(email,password)=>{const{data,error}=await getSupabase().auth.signUp({email,password});if(error)throw new Error(error.message);if(data.session)activateSession(data.session,set);return{needsEmailConfirmation:data.session===null};},
  sendPasswordReset:async(email)=>{const redirectTo=Linking.createURL('/reset-password');const{error}=await getSupabase().auth.resetPasswordForEmail(email,{redirectTo});if(error)throw new Error(error.message);},
  updatePassword:async(password)=>{const{error}=await getSupabase().auth.updateUser({password});if(error)throw new Error(error.message);set({recoveryMode:false});},
  resolveLocalImport:async(choice)=>{const userId=get().session?.user.id;if(!userId)return;const target=userWorkspaceId(userId);if(choice==='move')moveWorkspaceData(LOCAL_WORKSPACE,target);setSyncState(importDecisionKey(userId),choice);setActiveWorkspace(target);set({needsLocalImportDecision:false});},
  signOut:async()=>{const{error}=await getSupabase().auth.signOut();if(error)throw new Error(error.message);setActiveWorkspace(LOCAL_WORKSPACE);set({status:'signedOut',session:null,needsLocalImportDecision:false,recoveryMode:false});await AsyncStorage.removeItem(LOCAL_ONLY_KEY);},
  continueWithoutAccount:async()=>{await AsyncStorage.setItem(LOCAL_ONLY_KEY,'1');setActiveWorkspace(LOCAL_WORKSPACE);set({status:'localOnly',session:null,needsLocalImportDecision:false});},
  deleteAccount:async()=>{const session=get().session;if(!session)throw new Error('Sign in again before deleting your account.');const workspace=userWorkspaceId(session.user.id);const supabase=getSupabase();const{error}=await supabase.functions.invoke('delete-account',{body:{confirm:true}});if(error)throw new Error(error.message||'Account deletion failed');await supabase.auth.signOut({scope:'local'}).catch(()=>undefined);clearWorkspaceData(workspace);clearUserSyncState(session.user.id);await Promise.all([AsyncStorage.removeItem(LOCAL_ONLY_KEY),AsyncStorage.removeItem(`glovebox.notifications.sent:${workspace}`)]);setActiveWorkspace(LOCAL_WORKSPACE);set({status:'signedOut',session:null,needsLocalImportDecision:false,recoveryMode:false});},
}));
export function currentUserId():string|null{return useAuth.getState().session?.user.id??null;}
