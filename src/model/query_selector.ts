export type QuerySelectorList = "equal" | "greaterThan" | "greaterOrEqualThan" | "in" | "lessThan" | "lessOrEqualThan" | "notEqual" | "notIn";

type QuerySelector<T> = {
    equal?: T;
    greaterThan?: T;
    greaterOrEqualThan?: T;
    in?: Array<T>;
    lessThan?: T;
    lessOrEqualThan?: T;
    notEqual?: T;
    notIn?: Array<T>;
};

export const QuerySymbol: { [Property in QuerySelectorList] } = {
    equal: "=",
    greaterThan: ">",
    greaterOrEqualThan: ">=",
    in: "IN",
    lessThan: "<",
    lessOrEqualThan: "<=",
    notEqual: "<>",
    notIn: "NOT IN",
};

export default QuerySelector;