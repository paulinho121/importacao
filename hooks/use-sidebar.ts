"use client";

import * as React from "react";

const STORAGE_KEY = "importflow:sidebar-collapsed";

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

function getServerSnapshot() {
  return false;
}

export function useSidebar() {
  const collapsed = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = React.useCallback(() => {
    const next = !(window.localStorage.getItem(STORAGE_KEY) === "1");
    window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    listeners.forEach((listener) => listener());
  }, []);

  return { collapsed, toggle };
}
