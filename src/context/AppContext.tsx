import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  ReactNode,
} from 'react';
import type { Account, AccountType } from '../types';
import * as api from '../api/client';

// ── State ──────────────────────────────────────────────────────────────────

export type AppPage = 'main' | 'analytics' | 'settings';

interface AppState {
  accounts: Account[];
  selectedAccountId: number | null;
  groupAccountType: AccountType | null;
  activePage: AppPage;
  loading: boolean;
}

const initialState: AppState = {
  accounts: [],
  selectedAccountId: null,
  groupAccountType: null,
  activePage: 'main',
  loading: true,
};

// ── Actions ────────────────────────────────────────────────────────────────

type AppAction =
  | { type: 'SET_ACCOUNTS'; payload: Account[] }
  | { type: 'SELECT_ACCOUNT'; payload: number | null }
  | { type: 'SELECT_GROUP'; payload: AccountType | null }
  | { type: 'GO_HOME' }
  | { type: 'SET_PAGE'; payload: AppPage }
  | { type: 'ADD_ACCOUNT'; payload: Account }
  | { type: 'UPDATE_ACCOUNT'; payload: Account }
  | { type: 'DELETE_ACCOUNT'; payload: number }
  | { type: 'SET_LOADING'; payload: boolean };

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_ACCOUNTS':
      return { ...state, accounts: action.payload, loading: false };
    case 'SELECT_ACCOUNT':
      return { ...state, selectedAccountId: action.payload, groupAccountType: null, activePage: 'main' };
    case 'SELECT_GROUP':
      return { ...state, groupAccountType: action.payload, selectedAccountId: null, activePage: 'main' };
    case 'GO_HOME':
      return { ...state, selectedAccountId: null, groupAccountType: null, activePage: 'main' };
    case 'SET_PAGE':
      return { ...state, activePage: action.payload, selectedAccountId: null, groupAccountType: null };
    case 'ADD_ACCOUNT':
      return { ...state, accounts: [...state.accounts, action.payload] };
    case 'UPDATE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.map((a) =>
          a.id === action.payload.id ? action.payload : a
        ),
      };
    case 'DELETE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.payload),
        selectedAccountId:
          state.selectedAccountId === action.payload ? null : state.selectedAccountId,
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

// ── Context ────────────────────────────────────────────────────────────────

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  refreshAccounts: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const refreshAccounts = async () => {
    const accounts = await api.getAccounts();
    dispatch({ type: 'SET_ACCOUNTS', payload: accounts });
  };

  useEffect(() => {
    refreshAccounts().catch((err) => {
      console.error('계좌 목록 로드 실패:', err);
      dispatch({ type: 'SET_LOADING', payload: false });
    });
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch, refreshAccounts }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider');
  return ctx;
}
