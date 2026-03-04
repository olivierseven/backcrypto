const DEBUG = process.env.NODE_ENV !== "production";
export const log = (...a: any[]) => { if (DEBUG) console.log(...a); };
export const dbg = (...a: any[]) => { if (DEBUG) console.debug(...a); };
export const warn = (...a: any[]) => console.warn(...a);
export const error = (...a: any[]) => console.error(...a);
