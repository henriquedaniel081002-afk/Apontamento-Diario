import {useCallback,useEffect,useRef} from 'react';
/** Ignore outdated reads without cancelling imports or other mutations. */
export function useLatestRead() {
 const version=useRef(0);
 useEffect(()=>()=>{version.current++;},[]);
 return useCallback(()=>{const current=++version.current;return ()=>current===version.current;},[]);
}
