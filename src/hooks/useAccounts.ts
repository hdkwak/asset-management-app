import { useAppContext } from '../context/AppContext';
import * as api from '../api/client';
import type { AccountType, CreateAccountPayload, UpdateAccountPayload } from '../types';

export function useAccounts() {
  const { state, dispatch, refreshAccounts } = useAppContext();

  const selectedAccount =
    state.accounts.find((a) => a.id === state.selectedAccountId) ?? null;

  const selectAccount = (id: number | null) =>
    dispatch({ type: 'SELECT_ACCOUNT', payload: id });

  const selectGroup = (type: AccountType) =>
    dispatch({ type: 'SELECT_GROUP', payload: type });

  const goHome = () => dispatch({ type: 'GO_HOME' });

  const goAnalytics = () => dispatch({ type: 'SET_PAGE', payload: 'analytics' });

  const goSettings = () => dispatch({ type: 'SET_PAGE', payload: 'settings' });

  const createAccount = async (data: CreateAccountPayload) => {
    const account = await api.createAccount(data);
    dispatch({ type: 'ADD_ACCOUNT', payload: account });
    return account;
  };

  const updateAccount = async (id: number, data: UpdateAccountPayload) => {
    const account = await api.updateAccount(id, data);
    dispatch({ type: 'UPDATE_ACCOUNT', payload: account });
    return account;
  };

  const deleteAccount = async (id: number) => {
    await api.deleteAccount(id);
    dispatch({ type: 'DELETE_ACCOUNT', payload: id });
  };

  return {
    accounts: state.accounts,
    selectedAccount,
    groupAccountType: state.groupAccountType,
    activePage: state.activePage,
    loading: state.loading,
    selectAccount,
    selectGroup,
    goHome,
    goAnalytics,
    goSettings,
    createAccount,
    updateAccount,
    deleteAccount,
    refreshAccounts,
  };
}
