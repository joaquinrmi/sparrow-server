import { DocumentAttributes } from "./basic_document";
import QuerySelector from "./query_selector";

type Condition<T> = T | QuerySelector<T>;

type QueryFilter<DocumentType> = {
    [Property in keyof DocumentAttributes<DocumentType>]?: Condition<DocumentType[Property]>
};

export default QueryFilter;