import { useEffect, useRef, useState } from 'react';
import { AcademyDatabase, DatabaseUnavailableError } from '../engine/database';
import type { QueryResult } from '../types';
import type { Workspace } from '../data/cleaning';
export function useDatabase(workspace: Workspace = 'finance') {
  const database = useRef<AcademyDatabase | null>(null);
  const activeWorkspace = useRef<Workspace | null>(null);
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; error?: string }>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    const instance = new AcademyDatabase(workspace); database.current = instance; activeWorkspace.current = workspace;
    setState({ status: 'loading' });
    void instance.initialise().then(() => { if (active) setState({ status: 'ready' }); })
      .catch(error => { if (active) setState({ status: 'error', error: String(error) }); });
    return () => { active = false; if (database.current === instance) database.current = null; void instance.dispose(); };
  }, [generation, workspace]);
  const query = async (sql: string): Promise<QueryResult> => {
    const instance = database.current;
    if (state.status !== 'ready' || !instance || activeWorkspace.current !== workspace) throw new Error('Wait for the database to finish loading.');
    try { return await instance.query(sql); }
    catch (error) {
      if (error instanceof DatabaseUnavailableError && database.current === instance) setState({ status: 'error', error: error.message });
      throw error;
    }
  };
  const downloadFile = async (name: 'statement.csv' | 'statement.parquet') => {
    if (!database.current || state.status !== 'ready' || activeWorkspace.current !== workspace) throw new Error('Wait for the practice files to finish loading.');
    return database.current.downloadFile(name);
  };
  return { ...state, status: activeWorkspace.current === workspace ? state.status : 'loading' as const, generation, query, downloadFile, reset: () => { setState({ status: 'loading' }); setGeneration(g => g + 1); } };
}
