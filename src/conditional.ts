export type If<T, Condition> = Condition extends "true" ? T : never;

export type IsFunction<T> = T extends Function ? "true" : "false";

export type Not<T> = T extends "true" ? "false" : "true";